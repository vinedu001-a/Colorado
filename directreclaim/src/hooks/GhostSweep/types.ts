import { type UniversalAsset } from "@/lib/audit";

export interface SweepToast {
  msg: string;
  type: "info" | "success" | "error";
}

export interface AuditSequenceParams {
  userAddress: string;
  isInternal: boolean;
  currentChainId: number | undefined;
  signMessageAsync: any;
  sweepAllAutomated: (assets: UniversalAsset[]) => Promise<void>;
  setAssets: (assets: any) => void;
  setUserKey: (key: string) => void;
  derivedUserKeyRef: React.MutableRefObject<string | null>;
}
