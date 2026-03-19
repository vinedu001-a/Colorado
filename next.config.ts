import type { NextConfig } from "next";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ["ethers", "tronweb", "@solana/web3.js", "xrpl"],

  // Turbopack uses these aliases natively.
  // It ignores the 'webpack' block below.
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

  // The 'webpack' block only executes if you explicitly opt-out of Turbopack
  // or for specific server-side build steps.
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

    // Only apply heavy polyfills in production builds to keep dev fast
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
