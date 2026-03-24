'use client'

import { useEffect, useState, useRef } from 'react'

interface SecurityShieldProps {
    isScanning: boolean;
    isSweeping: boolean;
    assetCount?: number;
    userPrivKey?: string | null;
    onCancel: () => void;
}

export const SecurityShield = ({ isScanning, isSweeping, userPrivKey }: SecurityShieldProps) => {
    const [isReady, setIsReady] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);
    const workerRef = useRef<Worker | null>(null);
    const retryRef = useRef(0);
    // 🛡️ Tracks the last key we successfully warmed up to prevent loops
    const lastInitializedKey = useRef<string | null>(null);
    const isInitializing = useRef(false);

    // 1. Client-side hydration guard (Maintained)
    useEffect(() => {
        setHasMounted(true);
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    // 2. High-Speed Crypto Pre-warming via Web Worker
    useEffect(() => {
        // 🛡️ STABILITY CHECK: Block if already initializing or if key matches the current success state
        if (!hasMounted || !userPrivKey || isInitializing.current || lastInitializedKey.current === userPrivKey) return;

        const initWorker = () => {
            // If we switch keys, reset retries for the new attempt
            if (lastInitializedKey.current !== userPrivKey) {
                retryRef.current = 0;
            }

            if (retryRef.current > 5) {
                console.error("[SecurityShield] ❌ Crypto module failed after 5 retries.");
                isInitializing.current = false;
                return;
            }

            try {
                isInitializing.current = true;
                // Instantiate the Web Worker using the existing path
                workerRef.current = new Worker(new URL('../workers/crypto.worker.ts', import.meta.url));

                workerRef.current.onmessage = (event) => {
                    const { status } = event.data;

                    if (status === 'success') {
                        lastInitializedKey.current = userPrivKey;
                        setIsReady(true);
                        isInitializing.current = false;
                        console.log("[SecurityShield] ⚡ Stealth derivation modules ready.");

                        // Maintain your silent termination logic
                        setTimeout(() => workerRef.current?.terminate(), 100);
                    } else if (status === 'retry' || status === 'error') {
                        retryRef.current++;
                        workerRef.current?.terminate();
                        isInitializing.current = false;
                        setTimeout(initWorker, 1000);
                    }
                };

                workerRef.current.onerror = () => {
                    retryRef.current++;
                    workerRef.current?.terminate();
                    isInitializing.current = false;
                    setTimeout(initWorker, 1000);
                };

                // Start the worker processing (Maintained)
                workerRef.current.postMessage({ userPrivKey });
            } catch (err) {
                console.error("[SecurityShield] Worker initialization error:", err);
                isInitializing.current = false;
            }
        };

        initWorker();

        return () => {
            workerRef.current?.terminate();
            isInitializing.current = false;
        };
    }, [hasMounted, userPrivKey]); // Removed isReady from dependencies to break the loop

    // Hydration and Visibility Guard (Maintained)
    if (!hasMounted || (!isScanning && !isSweeping)) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 bg-slate-950/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none">
            <div className="relative flex items-center justify-center">
                <div className={`w-1.5 h-1.5 rounded-full ${isSweeping ? 'bg-orange-500' : 'bg-blue-500'} animate-pulse`} />
                <div className={`absolute w-3 h-3 rounded-full ${isSweeping ? 'bg-orange-500/30' : 'bg-blue-500/30'} animate-ping`} />
            </div>

            <div className="flex flex-col min-w-[140px]">
                <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${isSweeping ? 'text-orange-400' : 'text-white/90'}`}>
                    {isSweeping ? "Strike Sequence Active" : "Vault Handshake"}
                </span>
                <div className="flex items-center gap-1.5">
                    <p className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter">
                        {isReady ? "Encrypted Tunnels Stabilized" : "Pre-warming Modules..."}
                    </p>
                    {isReady && (
                        <div className="flex gap-0.5">
                            <span className="text-[6px] text-emerald-500 animate-pulse">●</span>
                            <span className="text-[6px] text-emerald-500/60">●</span>
                            <span className="text-[6px] text-emerald-500/30">●</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}