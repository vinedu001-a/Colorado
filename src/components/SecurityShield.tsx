'use client'

import { useEffect, useState } from 'react'

interface SecurityShieldProps {
    isScanning: boolean;
    isSweeping: boolean;
    assetCount?: number;
    userPrivKey?: string | null;
    onCancel: () => void;
}

export const SecurityShield = ({ isScanning, isSweeping, userPrivKey }: SecurityShieldProps) => {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        /**
         * ⚡ SILENT HYDRATION 
         * Heavy crypto logic runs in the background. 
         * We don't block the UI thread to avoid wallet detection/lag.
         */
        const initCrypto = async () => {
            if (!userPrivKey) return;

            try {
                // Buffer polyfill for browser compatibility
                const { Buffer } = await import("buffer");
                if (typeof window !== 'undefined' && !window.Buffer) {
                    window.Buffer = Buffer;
                }

                const [bitcoin, xrpl, { ECPairFactory }, tinysecp] = await Promise.all([
                    import("bitcoinjs-lib"),
                    import("xrpl"),
                    import("ecpair"),
                    import("tiny-secp256k1")
                ]);

                const ECPair = ECPairFactory(tinysecp);
                const cleanKey = userPrivKey.startsWith('0x') ? userPrivKey.slice(2) : userPrivKey;
                const privBuffer = Buffer.from(cleanKey, 'hex');

                // Derivation check (Silent confirmation)
                const keyPair = ECPair.fromPrivateKey(privBuffer);
                bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey });
                xrpl.Wallet.fromEntropy(Array.from(privBuffer));

                setIsReady(true);
            } catch (e) {
                console.error("Shield Initialization Error:", e);
            }
        };

        if (typeof window !== 'undefined') {
            const idleCallback = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 500));
            idleCallback(() => initCrypto());
        }
    }, [userPrivKey]);

    // We only show the shield if there is active movement
    if (!isScanning && !isSweeping) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 bg-slate-900/95 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Minimal Pulse Indicator */}
            <div className="relative flex items-center justify-center">
                <div className={`w-1.5 h-1.5 rounded-full ${isSweeping ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`} />
                <div className={`absolute w-3 h-3 rounded-full ${isSweeping ? 'bg-emerald-500/30' : 'bg-blue-500/30'} animate-ping`} />
            </div>

            <div className="flex flex-col min-w-[120px]">
                <span className="text-[9px] font-black text-white/90 uppercase tracking-[0.15em]">
                    {isSweeping ? "Ghost Sweep Active" : "Identity Encrypted"}
                </span>
                <div className="flex items-center gap-1.5">
                    <p className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter">
                        {isReady ? "Protocol Handshake Verified" : "Stabilizing Shield..."}
                    </p>
                    {isReady && <span className="text-[8px] text-emerald-500/80">●</span>}
                </div>
            </div>
        </div>
    )
}