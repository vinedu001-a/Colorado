
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';

export default function AppBridge() {
    const [mounted, setMounted] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const { isConnected } = useAccount();
    const lastAttempt = useRef(0);

    useEffect(() => {
        setMounted(true);
    }, []);

    const executeTeleport = useCallback((walletType: string) => {
        // 1. Safety check for document state
        if (typeof window === 'undefined' || document.readyState !== 'complete') {
            console.log("⏳ Waiting for page to be fully idle...");
            return;
        }

        if (Date.now() - lastAttempt.current < 4000) return;
        lastAttempt.current = Date.now();

        // 2. Clean the URL (Removing ngrok hashes that cause crashes)
        const currentUrl = window.location.href.split('#')[0].split('?')[0];
        const encodedUrl = encodeURIComponent(currentUrl);
        const cleanUrl = currentUrl.replace(/^https?:\/\//, "");

        const targetLinks: Record<string, string> = {
            metamask: `metamask://dapp/${cleanUrl}`,
            trust: `trust://open_url?url=${encodedUrl}`,
            coinbase: `https://go.cb-w.com/dapp?cb_url=${encodedUrl}`,
            phantom: `phantom://browse/${encodedUrl}`,
            rainbow: `https://rnbwapp.com/browse/${encodedUrl}`
        };

        const target = targetLinks[walletType.toLowerCase()] || targetLinks.metamask;

        setRedirecting(true);

        // 3. 🛑 State cleanup BEFORE the jump
        localStorage.removeItem('ghost_pending_bridge');
        localStorage.setItem('ghost_teleport_active', 'true');

        /**
         * ⚡ THE STABILITY FIX
         * Using 'setTimeout' with 0 inside 'requestAnimationFrame' forces the 
         * browser to wait until the current execution stack (Next.js logic) 
         * is completely empty before trying to redirect.
         */
        requestAnimationFrame(() => {
            setTimeout(() => {
                window.location.replace(target);
            }, 300); // 300ms allows the UI to settle
        });

        setTimeout(() => {
            setRedirecting(false);
            localStorage.removeItem('ghost_teleport_active');
        }, 10000);
    }, []);

    useEffect(() => {
        if (!mounted || isConnected) return;

        const watcher = setInterval(() => {
            const isInsideWallet = !!(
                (window as any).ethereum ||
                (window as any).phantom ||
                (window as any).trustwallet ||
                navigator.userAgent.toLowerCase().match(/metamask|trust|coinbase|phantom|bitget|tokenpocket/i)
            );

            if (isInsideWallet) {
                localStorage.removeItem('ghost_pending_bridge');
                return;
            }

            const pending = localStorage.getItem('ghost_pending_bridge');

            // 🛡️ Ensure the modal is FULLY unmounted from DOM
            const isModalOpen = !!(
                document.querySelector('appkit-modal') ||
                document.querySelector('wcm-modal') ||
                document.querySelector('div[class*="w3m-"]')
            );

            if (pending && !isConnected && !isModalOpen) {
                executeTeleport(pending);
            }
        }, 500); // Slightly slower check for better stability

        return () => clearInterval(watcher);
    }, [mounted, isConnected, executeTeleport]);

    if (!mounted || !redirecting) return null;

    return (
        <div className="fixed inset-0 z-[99999] bg-[#020617] flex items-center justify-center transition-opacity duration-300">
            <div className="flex flex-col items-center p-8 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <h2 className="mt-6 text-white font-bold text-xl tracking-tight">Launching Wallet</h2>
                <p className="mt-2 text-slate-500 text-xs uppercase tracking-widest">Ghost V6.2 Secure Bridge</p>
            </div>
        </div>
    );
}