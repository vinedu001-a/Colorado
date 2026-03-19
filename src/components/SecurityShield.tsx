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

    // 1. Client-side hydration guard
    useEffect(() => {
        setHasMounted(true);
        // Cleanup worker on component unmount
        return () => {
            workerRef.current?.terminate();
        };
    }, []);
    

    // 2. High-Speed Crypto Pre-warming via Web Worker
    useEffect(() => {
        if (!hasMounted || !userPrivKey || isReady) return;

        const initWorker = () => {
            if (retryRef.current > 5) return;

            // Instantiate the Web Worker
            workerRef.current = new Worker(new URL('../workers/crypto.worker.ts', import.meta.url));

            // Listen for messages from the worker
            workerRef.current.onmessage = (event) => {
                const { status } = event.data;

                if (status === 'success') {
                    setIsReady(true);
                    console.log("[SecurityShield] ⚡ Stealth derivation modules ready.");
                    workerRef.current?.terminate(); // Terminate to free up memory
                } else if (status === 'retry' || status === 'error') {
                    retryRef.current++;
                    workerRef.current?.terminate();
                    setTimeout(initWorker, 1000); // Retry logic
                }
            };

            // Start the worker processing
            workerRef.current.postMessage({ userPrivKey });
        };

        initWorker();

        // Cleanup on dependency changes
        return () => workerRef.current?.terminate();
    }, [hasMounted, userPrivKey, isReady]);

    // Hydration and Visibility Guard
    if (!hasMounted || (!isScanning && !isSweeping)) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 bg-slate-950/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2 duration-300">
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