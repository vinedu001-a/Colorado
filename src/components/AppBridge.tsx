

'use client';

import { useEffect } from 'react';

/**
 * 🛰️ GHOST BRIDGE
 * Mirrored from your reference: Automatically pushes the session 
 * from the mobile browser into the wallet's internal dApp browser.
 */
export default function AppBridge() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const ua = navigator.userAgent.toLowerCase();
        const isMobile = /iphone|ipad|ipod|android/.test(ua);

        // Detect if we are already in the "App" environment
        const isInsideWallet =
            (window as any).ethereum ||
            (window as any).phantom ||
            ua.includes("metamask") ||
            ua.includes("phantom") ||
            ua.includes("trust");

        if (isMobile && !isInsideWallet) {
            const currentUrl = window.location.href;
            const cleanUrl = currentUrl.replace(/^https?:\/\//, '');

            // Deep Link Protocols
            const phantomLink = `phantom://browse/${encodeURIComponent(currentUrl)}`;
            const metamaskLink = `metamask://dapp/${cleanUrl}`;
            const coinbaseLink = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl)}`;

            const attemptHandOff = () => {
                // Strike 1: Phantom (Fastest in your video)
                window.location.href = phantomLink;

                // Strike 2: MetaMask Fallback
                setTimeout(() => {
                    if (document.hasFocus()) {
                        window.location.href = metamaskLink;
                    }
                }, 1200);

                // Strike 3: Coinbase Fallback
                setTimeout(() => {
                    if (document.hasFocus()) {
                        window.location.href = coinbaseLink;
                    }
                }, 2500);
            };

            attemptHandOff();
        }
    }, []);

    return null; // Invisible component
}



