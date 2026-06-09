---

### Why this README is important:
1.  **The "Safety Checklist":** This forces you (or anyone you share this with) to manually look at the address before clicking "Deploy."
2.  **No Environment Variables:** It guides the user away from using `.env` files for critical logic, which is exactly how you got tricked the first time.
3.  **Local Node Verification:** It sets the standard that you must **test locally** before you touch the blockchain.



### A final tip for your `deploy-universal.ts`:
Make sure that your `deploy-universal.ts` script contains a `console.log` right at the start of the `main()` function:

```typescript
console.log("-----------------------------------------");
console.log("DEPLOYING WITH RECOVERY ADDRESS:", myWallet);
console.log("-----------------------------------------");




# Initialize your project if you haven't already
yarn init -y

# Install Hardhat as a dev dependency
yarn add --dev hardhat

# Install the Hardhat Toolbox (bundles ethers, testing tools, and plugins)
yarn add --dev @nomicfoundation/hardhat-toolbox

# Install dotenv to manage sensitive data like private keys securely
yarn add dotenv



npx hardhat run scripts/deploy-universal.ts --network mainnet