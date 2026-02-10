'use client'

import React, { ReactNode, useEffect, useState } from 'react'
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { mainnet, bsc, polygon, base } from "@reown/appkit/networks"
import { createAppKit } from "@reown/appkit/react"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

const queryClient = new QueryClient()
const projectId = process.env.NEXT_PUBLIC_REOWN_ID || ""
const networks = [mainnet, bsc, polygon, base] as any

export const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks,
    ssr: true,
})

let initialized = false;

if (typeof window !== 'undefined' && !initialized) {
    createAppKit({
        adapters: [wagmiAdapter],
        networks,
        projectId,
        metadata: {
            name: "Sentry Vault",
            description: "Asset Security",
            url: "http://localhost:3000",
            icons: []
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
            "--w3m-border-radius-master": "20px",
        } as any,
        excludeWalletIds: [
            "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa"
        ],
        ...({ enableFooter: false } as any)
    })
    initialized = true;
}

export default function AppKitProvider({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)

        // Function to find and nuke the branding across all shadow boundaries
        const nukeBranding = (root: Node | ShadowRoot = document) => {
            // 1. Check current level for the tag
            if (root instanceof HTMLElement || root instanceof ShadowRoot) {
                const branding = root.querySelector('wui-ux-by-reown');
                if (branding) {
                    (branding as HTMLElement).style.display = 'none';
                    branding.remove();
                }
            }

            // 2. Recursively dive into every Shadow Root found
            const elements = (root as any).querySelectorAll?.('*') || [];
            elements.forEach((el: any) => {
                if (el.shadowRoot) {
                    nukeBranding(el.shadowRoot);
                }
            });
        };

        // Run every 100ms to catch re-renders
        const interval = setInterval(nukeBranding, 100);

        return () => clearInterval(interval);
    }, [])

    if (!mounted) return null

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}