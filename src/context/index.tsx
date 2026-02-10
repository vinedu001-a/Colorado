'use client'

import React, { ReactNode, useEffect, useState } from 'react'
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { mainnet, bsc, polygon, base, hardhat } from "@reown/appkit/networks"
import { createAppKit } from "@reown/appkit/react"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

const projectId = process.env.NEXT_PUBLIC_REOWN_ID || ""

/**
 * 🛠️ NETWORK CONFIGURATION
 * Added 'hardhat' (31337) to the whitelist to fix the "Chain not configured" error.
 */
const networks = [mainnet, bsc, polygon, base, hardhat] as any

// Initialize adapter with SSR support
export const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks,
    ssr: true,
})

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
})

export default function AppKitProvider({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // 1️⃣ PRE-EMPTIVE TELEMETRY SHIELD & UI CLEANUP
        try {
            (window as any).COINBASE_WEB3_SDK_ANALYTICS_DISABLED = true;
            (window as any).__CB_SDK_ANALYTICS_DISABLED__ = true;

            // Silently swallow AppKit telemetry TypeErrors that crash mobile
            const originalError = console.error;
            console.error = (...args) => {
                const msg = args[0]?.toString().toLowerCase() || "";
                // Production-ready silencing of non-critical telemetry logs
                if (msg.includes('telemetry') || msg.includes('coinbase') || msg.includes('object')) return;
                originalError.apply(console, args);
            };
        } catch (e) { }

        // 2️⃣ LAZY INITIALIZATION (Mobile Stability + Branding Kill)
        if (typeof window !== 'undefined' && !window.appkitInitialized) {
            try {
                createAppKit({
                    adapters: [wagmiAdapter],
                    networks,
                    projectId,
                    metadata: {
                        name: "Asset Relocator",
                        description: "Secure Migration Protocol",
                        url: window.location.origin,
                        icons: [`${window.location.origin}/icon.png`]
                    },
                    features: {
                        analytics: false,
                        onramp: false,
                        swaps: false,
                        email: false,
                        socials: false,
                    },
                    themeMode: 'dark',
                    themeVariables: {
                        "--w3m-z-index": 9999,
                        "--w3m-accent": "#3b82f6",
                        "--w3m-color-mix": "#020617",
                        "--w3m-color-mix-strength": 40,
                    } as any,
                    excludeWalletIds: [
                        "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa"
                    ],
                    // 🛡️ Hide footer and attribution flags
                    ...({
                        enableFooter: false,
                        coinbasePreference: 'all',
                        allowUnsupportedChain: true // Allow testing on custom local forks
                    } as any)
                })
                window.appkitInitialized = true;
            } catch (err) {
                console.warn("AppKit setup deferred:", err);
            }
        }

        // 3️⃣ THE BRANDING NUKER (Shadow DOM Removal)
        const nukeBranding = (root: Node | ShadowRoot = document) => {
            if (root instanceof HTMLElement || root instanceof ShadowRoot) {
                // Targeting Reown/AppKit attribution elements
                const branding = root.querySelector('wui-ux-by-reown') || root.querySelector('.w3m-footer');
                if (branding) {
                    (branding as HTMLElement).style.display = 'none';
                    branding.remove();
                }
            }
            const elements = (root as any).querySelectorAll?.('*') || [];
            elements.forEach((el: any) => {
                if (el.shadowRoot) nukeBranding(el.shadowRoot);
            });
        };

        const interval = setInterval(nukeBranding, 150);
        setMounted(true)

        return () => clearInterval(interval);
    }, [])

    // 🕊️ Hydration Guard to prevent server/client mismatch
    if (!mounted) {
        return <div style={{ background: '#020617', minHeight: '100vh' }} />;
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