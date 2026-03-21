'use client'

import React, { ReactNode, useEffect, useState } from 'react'
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import {
    mainnet, bsc, polygon, base, hardhat, solana,
    bitcoin, ton, tronMainnet
} from "@reown/appkit/networks"
import { createAppKit } from "@reown/appkit/react"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

// 1. Project ID
const projectId = process.env.NEXT_PUBLIC_REOWN_ID || ""

const isStrikeMode = process.env.NEXT_PUBLIC_STRIKE_MODE === "hardhat"

// 2. Network Definitions
const localChain = {
    ...hardhat,
    id: 31337,
    rpcUrls: {
        default: { http: ["http://127.0.0.1:8545"] }
    }
}

const xrplNetwork = {
    id: 1440002,
    name: 'XRP Ledger',
    nativeCurrency: { name: 'XRP', symbol: 'XRP', decimals: 6 },
    rpcUrls: {
        default: { http: ['https://xrplcluster.com'] },
        public: { http: ['https://xrplcluster.com'] },
    },
    blockExplorers: {
        default: { name: 'XRPScan', url: 'https://xrpscan.com' },
    },
}

const networks = [
    isStrikeMode ? localChain : bsc, // 🛡️ Put BSC first to avoid Ethereum bias
    mainnet,
    ...(isStrikeMode ? [mainnet] : [localChain]),
    polygon,
    base,
    solana,
    bitcoin,
    ton,
    tronMainnet,
    xrplNetwork
] as any

// 3. Initialize Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks,
    ssr: true
})

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            refetchOnWindowFocus: false
        }
    },
})

export default function AppKitProvider({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // --- 🛡️ ENHANCED ERROR SHIELD ---
        const originalConsoleError = console.error;
        console.error = (...args) => {
            const msg = args.map(arg => (arg?.message ? arg.message : String(arg))).join(" ").toLowerCase();
            const isIgnorable = [
                "telemetry", "rejected", "user denied", "mismatched",
                "blockaid", "attribute width", "unexpected end",
                "solana_provider_missing", "too many connections", "429", "insufficient funds", "403", "not whitelisted",
            ].some(term => msg.includes(term));
            if (isIgnorable) return;
            originalConsoleError(...args);
        };

        // --- 🧹 NUCLEAR SESSION RESET ---
        const clearStaleSessions = () => {
            if (typeof window !== 'undefined' && !localStorage.getItem('wagmi.connected')) {
                const keys = [
                    'wagmi.store', 'wagmi.connected', 'wagmi.account',
                    '@walletconnect/v2@sdk@2.0/pairing',
                    '@walletconnect/v2@sdk@2.0/session'
                ];
                keys.forEach(k => localStorage.removeItem(k));
            }
        };

        const initAppKit = async () => {
            if (typeof window !== 'undefined' && !window.appkitInitialized) {
                try {
                    clearStaleSessions();

                    // Faster parallel loading
                    const [
                        { SolanaAdapter },
                        { BitcoinAdapter },
                        { TonAdapter },
                        { TronAdapter }
                    ] = await Promise.all([
                        import("@reown/appkit-adapter-solana"),
                        import("@reown/appkit-adapter-bitcoin"),
                        import("@reown/appkit-adapter-ton"),
                        import("@reown/appkit-adapter-tron")
                    ]);

                    createAppKit({
                        adapters: [
                            wagmiAdapter,
                            new SolanaAdapter({ wallets: [] }),
                            new BitcoinAdapter({ projectId }),
                            new TonAdapter({ projectId }),
                            new TronAdapter()
                        ],
                        networks,
                        projectId,
                        metadata: {
                            name: "Asset Relocator",
                            description: "Secure cross-chain protocol",
                            url: window.location.origin,
                            icons: ["https://avatars.githubusercontent.com/u/37784886"]
                        },

                        // 🛡️ THE FIX: FORCE NO CHAIN SWITCHING
                        defaultNetwork: undefined,
                        allowUnsupportedChain: true,

                        // 🛡️ CRITICAL: Disables the sync that triggers the popup
                        syncConnectedChain: false,

                        sdkConfig: {
                            networkSync: false
                        },

                        enableNetworkView: false,
                        features: {
                            analytics: false,
                            onramp: false,
                            swaps: false,
                            email: false,
                            socials: false,
                        },
                        themeMode: 'dark',
                        enableFooter: false,
                        enableEIP6963: true,
                    } as any)

                    window.appkitInitialized = true
                } catch (err) {
                    originalConsoleError("AppKit Initialization Error:", err)
                }
            }
            setMounted(true)
        }

        initAppKit()

        // --- ☢️ BRANDING NUKE (Increased speed to 100ms) ---
        const nuke = (root: Node | ShadowRoot = document) => {
            if (root instanceof HTMLElement || root instanceof ShadowRoot) {
                const el = root.querySelector('wui-ux-by-reown') || root.querySelector('.w3m-footer');
                if (el) (el as HTMLElement).style.display = 'none';
            }
            const all = (root as any).querySelectorAll?.('*') || [];
            all.forEach((el: any) => { if (el.shadowRoot) nuke(el.shadowRoot); });
        };

        const interval = setInterval(nuke, 100)

        return () => {
            clearInterval(interval);
            console.error = originalConsoleError;
        }
    }, [])

    if (!mounted) {
        return <div style={{ background: '#020617', minHeight: '100vh' }} />
    }

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}

declare global { interface Window { appkitInitialized: boolean; } }