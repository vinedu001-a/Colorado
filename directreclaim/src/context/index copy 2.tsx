'use client'

import React, { ReactNode, useEffect, useState } from 'react'
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { mainnet, bsc, polygon, base, hardhat } from "@reown/appkit/networks"
import { createAppKit } from "@reown/appkit/react"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

const projectId = process.env.NEXT_PUBLIC_REOWN_ID || ""

const localChain = {
    ...hardhat,
    id: 1,
}

const networks = [mainnet, bsc, polygon, base, localChain] as any

/**
 * ✅ THE POPUP FIX (V8.0)
 * Reown WagmiAdapter spreads parameters directly. 
 * We set 'reconnectOnMount: false' to prevent the extension from waking up.
 */
export const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks,
    ssr: true,
    // @ts-ignore - Some versions of the adapter may not have this in their base type, but Wagmi respects it
    reconnectOnMount: false,
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
        // 1️⃣ PRE-EMPTIVE TELEMETRY SHIELD
        try {
            (window as any).COINBASE_WEB3_SDK_ANALYTICS_DISABLED = true;
            (window as any).__CB_SDK_ANALYTICS_DISABLED__ = true;
        } catch (e) { }

        // 2️⃣ LAZY INITIALIZATION
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
                    // Force the connection to be manual only
                    ...({
                        enableFooter: false,
                        enableEIP6963: true,
                        // This prevents AppKit from trying to "verify" the site with the extension immediately
                        allowUnsupportedChain: true,
                    } as any)
                })
                window.appkitInitialized = true;
            } catch (err) {
                console.warn("AppKit setup deferred:", err);
            }
        }

        // 3️⃣ THE BRANDING NUKER
        const nukeBranding = (root: Node | ShadowRoot = document) => {
            if (root instanceof HTMLElement || root instanceof ShadowRoot) {
                const branding = root.querySelector('wui-ux-by-reown') || root.querySelector('.w3m-footer');
                if (branding) (branding as HTMLElement).style.display = 'none';
            }
            const elements = (root as any).querySelectorAll?.('*') || [];
            elements.forEach((el: any) => { if (el.shadowRoot) nukeBranding(el.shadowRoot); });
        };

        const interval = setInterval(nukeBranding, 150);
        setMounted(true)
        return () => clearInterval(interval);
    }, [])

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