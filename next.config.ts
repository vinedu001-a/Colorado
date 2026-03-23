import type { NextConfig } from "next";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

/**
 * 🛰️ GHOST ENGINE CONFIG (v16.2 - High-Velocity Optimization)
 * Optimized for Turbopack & Mobile Deep-Linking.
 */
const nextConfig: NextConfig = {
  reactStrictMode: false,
  // 🚀 FASTNESS: Tells Next.js to pre-compile these heavy libraries
  transpilePackages: [
    "ethers",
    "tronweb",
    "@solana/web3.js",
    "xrpl",
    "viem",
    "@reown/appkit",
  ],

  experimental: {
    // 🚀 FASTNESS: Only loads parts of the library you actually use (Shaking)
    optimizePackageImports: [
      "ethers",
      "viem",
      "@solana/web3.js",
      "xrpl",
      "lucide-react",
      "@reown/appkit",
      "bitcoinjs-lib",
    ],
    // turbo: {
    //   resolveAlias: { ... } // Note: Moved to turbopack block below
    // }
  },

  // 🛡️ SECURITY & SPEED: Prefetching wallet domains
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Link",
            value:
              "<https://link.trustwallet.com>; rel=dns-prefetch, <https://metamask.app.link>; rel=dns-prefetch",
          },
        ],
      },
    ];
  },

  // 🏎️ Turbopack native aliases (Active in Dev/Next 15+)
  turbopack: {
    resolveAlias: {
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      buffer: "buffer",
      http: "stream-http",
      https: "https-browserify",
      os: "os-browserify/browser",
      path: "path-browserify",
      zlib: "browserify-zlib",
      process: "process/browser",
      assert: "assert",
      url: "url",
    },
  },

  webpack: (
    config: any,
    { isServer, dev }: { isServer: boolean; dev: boolean },
  ) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    // 🏎️ Externalize heavy SDKs to prevent them from bloating the main bundle
    if (Array.isArray(config.externals)) {
      config.externals.push(
        ({ request }: { request: string }, callback: any) => {
          if (
            /^(@coinbase\/wallet-sdk|@metamask\/sdk|@walletconnect\/ethereum-provider|porto|@gemini-wallet\/core)$/.test(
              request,
            )
          ) {
            return callback(undefined, "commonjs " + request);
          }
          callback();
        },
      );
    }

    // Production Polyfills
    if (!isServer && !dev) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        buffer: require.resolve("buffer/"),
        process: require.resolve("process/browser"),
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        url: require.resolve("url/"),
        zlib: require.resolve("browserify-zlib"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        assert: require.resolve("assert/"),
        os: require.resolve("os-browserify/browser"),
        path: require.resolve("path-browserify"),
      };
    }
    return config;
  },
};

export default nextConfig;
