# AuraLend Protocol MVP (Soroban Live)

AuraLend is a premium, decentralized lending and leveraged yield farming protocol built natively on the high-performance Stellar/Soroban smart contract engine. The protocol enables users to supply stablecoin collateral, borrow liquidity, and enter paired AMM pools at up to 5x leverage to optimize organic yield opportunities.

---

## 🚀 Key Features

*   **Organic Lending Vaults:** Securely deposit USDC collateral to earn low-risk, compounding yield backed by collateralized borrowing positions.
*   **Leveraged Yield Farming:** Lock margin collateral (USDC) and borrow liquidity (USDC/XLM) automatically using atomic transactions to enter AMM liquidity pools at up to 5x leverage.
*   **Interactive 3D Balance Telemetry:** A custom-built 3D physical balance scale made with Three.js and GSAP that dynamically tilts and weights your Lending (Teal) and Borrowing (Blue) assets as you interact with the UI.
*   **Live Production Monitor:** An active system telemetry panel tracking Stellar RPC node connectivity, ping latency, contract verification, and full real-time transaction event logs.
*   **Freighter Wallet Onboarding:** Clean wallet connection flow with automatic balance updates and transaction signing.

---

## 🛠️ Stellar Testnet Contract Addresses

All smart contracts have been compiled and deployed on the **Stellar Testnet**:

| Contract Name | Contract ID |
|---|---|
| **Mock USDC (SAC)** | `CA5CBZU5WNPXCWMHFRZ3QDLXGE3O77M2BJ3A6HC3NCWZRMKVEZWITSGJ` |
| **Lending Pool** | `CBW7MYEY6Q6LUDDJQGVYQKOAQYHC2NELIUYPGABD4C5W7N2JPXH7HT4H` |
| **Leverage Engine** | `CBB2FB5SOLDM6EF6B2S23DZTXJ3VTALLTV2T6XMUUXPCAXKRJMJUMNSI` |

---

## 💻 Tech Stack & Architecture

### Frontend
*   **Framework:** React 18, TypeScript, Vite
*   **Interactivity & Graphics:** Three.js, GSAP (GreenSock Animation Platform)
*   **Styling:** Custom CSS, Lucide icons, modern glassmorphism design variables
*   **Stellar Integration:** Freighter Wallet SDK (`@stellar/freighter-api`), Soroban Client

### Smart Contracts (Rust)
*   **Standard:** Soroban SDK (v20+)
*   **Tokens:** Stellar Asset Contract (SAC) compliance

---

## 📦 Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/<your-username>/auralend.git
    cd auralend
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```

4.  **Build for Production:**
    ```bash
    npm run build
    ```

---

## 👥 Onboarding & User Interaction

This MVP is designed for testnet onboarding:
1.  Connect your **Freighter Wallet** (configured to Stellar Testnet).
2.  Use the built-in **Get 5k USDC Faucet** helper to obtain mock tokens on-chain.
3.  Perform deposits and withdrawals to test **Lending Vault** smart contract interactions.
4.  Specify leverage factors and click **Open Leveraged Position** to test atomic yield loops.
5.  Monitor your transactions and network metrics in real-time under the **Activity** tab.
