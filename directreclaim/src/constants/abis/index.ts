import UniversalDeployer from "./contracts/UniversalSettler.sol/UniversalDeployer.json";
import GhostFactory from "./contracts/factory.sol/GhostFactory.json";

export const UNIVERSAL_SETTLER_ABI = UniversalDeployer.abi;
export const UNIVERSAL_SETTLER_BYTECODE = UniversalDeployer.bytecode;

export const GHOST_FACTORY_ABI = GhostFactory.abi;
export const GHOST_FACTORY_BYTECODE = GhostFactory.bytecode;

/**
 * 🪙 Standard ERC20 ABI
 * Used by the scanner to verify balances and existing allowances.
 */
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
];
