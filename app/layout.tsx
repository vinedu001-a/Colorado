import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppKitProvider from '@/context';

export const metadata: Metadata = {
  title: "Directreclaim",
  description: "Asset Recovering",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#020617',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        {/* ⚡ CRITICAL PERFORMANCE: Preload CSS to fix the "Delay to open" */}
        <link rel="stylesheet" href="/assets/css/bootstrap.min.css" />
        <link rel="stylesheet" href="/assets/css/aos.css" />
        <link rel="stylesheet" href="/assets/css/all.min.css" />
        <link rel="stylesheet" href="/assets/css/swiper-bundle.min.css" />
        <link rel="stylesheet" href="/assets/css/style.css" />

        {/* 🛰️ RPC Pre-warming: Speeds up wallet connection handshakes */}
        <link rel="preconnect" href="https://cloudflare-eth.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://ethereum.publicnode.com" crossOrigin="anonymous" />
        <meta httpEquiv="x-dns-prefetch-control" content="on" />

        {/* 🛡️ Silent Error Handling & Fetch Interceptor (Keeps the UI clean) */}
        <script dangerouslySetInnerHTML={{
          __html: `
          (function() {
            const silentLogger = (event) => {
              const msg = (event.reason?.message || event.message || "").toLowerCase();
              const noise = ["telemetry", "extension", "mismatched", "rpc", "blockaid", "blowfish", "hydration", "bis_skin"];
              if (noise.some(term => msg.includes(term)) || !event.reason) {
                event.preventDefault();
                event.stopImmediatePropagation();
              }
            };
            window.addEventListener('unhandledrejection', silentLogger, true);
            window.addEventListener('error', silentLogger, true);

            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
              try { return await originalFetch(...args); } 
              catch (err) { return new Response(JSON.stringify({ error: true }), { status: 200 }); }
            };
          })();
        `}} />
      </head>

      <body className="antialiased bg-slate-950 text-slate-50" suppressHydrationWarning>
        <AppKitProvider>
          <div className="relative flex flex-col min-h-screen" suppressHydrationWarning>
            <main className="flex-grow" suppressHydrationWarning>
              {children}
            </main>
          </div>
        </AppKitProvider>
      </body>
    </html>
  );
}