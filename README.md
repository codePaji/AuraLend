# AuraLend

**A Premium Decentralized Lending and Leveraged Yield Farming Protocol**

*Trustless organic stablecoin lending and up to 5x leverage yields secured by Stellar Soroban smart contracts*

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live_Demo-auralend.netlify.app-6366f1?style=for-the-badge&logo=netlify)](https://auralend.netlify.app/)
[![GitHub](https://img.shields.io/badge/Source_Code-codePaji%2FAuraLend-181717?style=for-the-badge&logo=github)](https://github.com/codePaji/AuraLend)
[![Network](https://img.shields.io/badge/Network-Stellar_Testnet-00B4D8?style=for-the-badge&logo=stellar)](https://stellar.expert/explorer/testnet)
[![Built for RiseIn](https://img.shields.io/badge/Built_for-RiseIn_Level_4-f59e0b?style=for-the-badge)](https://www.risein.com/)

</div>

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Why Stellar?](#why-stellar)
3. [Live Deployment](#live-deployment)
4. [Contract Addresses & Transactions](#contract-addresses--transactions)
5. [User Onboarding & Feedback](#user-onboarding-and-feedback)
6. [Architecture](#architecture)
7. [Smart Contracts](#smart-contracts)
8. [Production Hardening (Level 4)](#production-hardening-level-4)
9. [Tech Stack](#tech-stack)
10. [Project Structure](#project-structure)
11. [Testing](#testing)
12. [CI/CD Pipeline](#cicd-pipeline)
13. [Local Development](#local-development)
14. [Roadmap](#roadmap)
15. [Author](#author)

---

## Problem Statement

The decentralized finance landscape is plagued by high gas fees, slow settlement times, and insecure cross-chain bridges. Yield generation on legacy chains is often dilute, subject to high slippage, and locks capital inefficiently.

| Issue | Impact |
|-------|--------|
| **Rent Extraction** | Centralized liquidity brokers and high gas platforms eat 5-15% of yield margins |
| **Asset Underutilization** | Liquidity pools require high capital lockups without leverage support |
| **Slippage and Latency** | Slow transaction execution speeds lead to missed price windows and arbitrage losses |
| **Oracle Exploits** | Flash-loan attacks and unreliable price feeds compromise collateral ratios |

**AuraLend** solves these issues by deploying yield-optimization pools natively on Stellar Soroban. Users deposit USDC to earn organic lending yields. Leveraged yield farmers borrow this liquidity atomically to enter paired AMM pools at up to 5x leverage, maximizing LP share yield while ensuring liquidators can secure the protocol's solvency in real time.

---

## Why Stellar?

AuraLend leverages Stellar's specific properties to enable premium capital efficiency:

| Stellar Property | AuraLend Benefit |
|-----------------|-------------------|
| **5 second transaction finality** | Real-time position tracking and instant liquidation execution |
| **Near-zero gas fees** | Makes micro-compounding and leverage adjustments economically viable |
| **Soroban Inter-Contract Calls** | Atomic executions: approving USDC, borrowing, and swapping AMM shares inside a single transaction |
| **Stellar Asset Contract (SAC)** | Secure, standardized bridging of classic Stellar assets into smart contracts |

---

## Live Deployment

| Resource | Link |
|----------|------|
| **Live dApp** | [auralend.netlify.app](https://auralend.netlify.app/) |
| **GitHub Repo** | [codePaji/AuraLend](https://github.com/codePaji/AuraLend) |
| **Feedback Form** | [AuraLend Feedback - Google Forms](https://forms.gle/sE8QTDWDodg2cs2T7) |
| **Onboarded Users & Wallet Interactions** | [Responses Spreadsheet - Google Sheets](https://docs.google.com/spreadsheets/d/1fHMaIiXoWxpco0DZpuwzqAlIIUg6lDGEvKc1Ep5Mfus/edit?usp=sharing) |

---

## Contract Addresses & Transactions

All smart contracts are deployed and cross-initialized on the Stellar Testnet.

### Deployed Contract IDs

| Contract | Address |
|----------|---------|
| **Mock USDC (SAC)** | `CA5CBZU5WNPXCWMHFRZ3QDLXGE3O77M2BJ3A6HC3NCWZRMKVEZWITSGJ` |
| **Lending Pool Contract** | `CBW7MYEY6Q6LUDDJQGVYQKOAQYHC2NELIUYPGABD4C5W7N2JPXH7HT4H` |
| **Leverage Engine Contract** | `CBB2FB5SOLDM6EF6B2S23DZTXJ3VTALLTV2T6XMUUXPCAXKRJMJUMNSI` |

---

## User Onboarding and Feedback

To meet Level 4 validation requirements, users can perform onboarding actions on the Stellar Testnet:

1. Install Freighter Wallet and switch network to Testnet.
2. Fund the wallet with test XLM using the Friendbot faucet.
3. Launch the AuraLend Terminal.
4. Request 5,000 mock USDC from the on-chain faucet.
5. Deposit USDC collateral into the Lending Pool.
6. Open an automated Leveraged Farming Position at up to 5x leverage.
7. Monitor active position metrics, liquidation health factor, and live telemetry on the dashboard.

| Resource | Link |
|----------|------|
| **Feedback Form** | [Submit Feedback](https://forms.gle/sE8QTDWDodg2cs2T7) |
| **User Responses & Wallet Proof** | [View Spreadsheet](https://docs.google.com/spreadsheets/d/1fHMaIiXoWxpco0DZpuwzqAlIIUg6lDGEvKc1Ep5Mfus/edit?usp=sharing) |

---

## Architecture

AuraLend utilizes a dual-contract architecture where the Leverage Engine communicates atomically with the Lending Pool and the USDC Token Contract via Inter-Contract Calls (ICC).

```
┌─────────────────────────────────────────────────────────────────────┐
│                          React / Vite Frontend                      │
│                                                                     │
│  Lending Vaults │ Leveraged Farming │ Portfolio │ Live Telemetry    │
│                        Freighter Wallet SDK                         │
└──────────────────┬─────────────────────────────┬───────────────────┘
                   │ TypeScript Contract Clients  │
          ┌────────▼─────────┐         ┌─────────▼────────┐
          │ Leverage Engine  │──ICC──→ │   Lending Pool   │
          │                  │         │                  │
          │  open_position() │         │  deposit()       │
          │  close_position()│         │  withdraw()      │
          │  liquidate()     │         │  get_balance()   │
          └──────────────────┘         └──────────────────┘
                            Stellar Testnet
```

---

## Smart Contracts

### Lending Pool Contract

Manages supplier liquidity reserves, lending balances, interest rates, and utilization parameters.

| Function | Access | Description |
|----------|--------|-------------|
| `deposit()` | Supplier | Deposit USDC into the pool to earn organic lending yield |
| `withdraw()` | Supplier | Withdraw deposited USDC collateral |
| `borrow()` | Leverage Engine | Borrow USDC for leverage farming positions |
| `repay()` | Leverage Engine | Repay borrowed USDC debt |
| `get_balance()` | Public | Query a user's current lending deposit balance |
| `get_total_liquidity()` | Public | Query total USDC liquidity deposited in the pool |
| `get_total_borrowed()` | Public | Query total USDC active borrow debt |
| `get_borrow_rate()` | Public | Query utilization-driven interest rate parameters |

### Leverage Engine Contract

Controls leverage position lifecycles, collateral ratios, debt records, and liquidation logic.

| Function | Access | Description |
|----------|--------|-------------|
| `open_position()` | User | Lock collateral and borrow USDC to enter a leveraged yield position |
| `close_position()` | User | Unwind leverage position, repay outstanding borrow debt, return margin |
| `liquidate()` | Keeper | Force-close position if health factor falls below 1.00; pays 10% bounty |
| `get_position()` | Public | Query active position collateral and debt data |
| `get_health_factor()` | Public | Compute current ratio of collateral value to borrow debt |

---

## Production Hardening (Level 4)

We implemented several production-grade improvements in Level 4:

### Smart Contract Hardening
*   **Initialization Guard:** Prevented double-initialization of contracts after deployment.
*   **Access Control Limits:** Restricted `borrow()` and `repay()` actions on the Lending Pool solely to the registered Leverage Engine.
*   **Data Expiry Prevention:** Integrated instance TTL extensions (`extend_ttl`) on every state-changing transaction to keep contract data active.
*   **Structured Errors:** Replaced raw `panic!` strings with a typed `#[contracterror]` enum.

### Frontend Enhancements
*   **Memory Leak Fixes:** Ensured all WebGL renders, window resize event listeners, and polling cycles clear correctly on component unmount.
*   **Live Status telemetry:** Built a dedicated Stellar RPC Monitor in the Activity tab to track node ping, connection status, and transaction histories in real time.
*   **Mobile Responsiveness:** Refactored layout frameworks (`hero-grid`, `features-grid`, `stats-grid`) to stack gracefully on narrow mobile device viewports (down to 390px).

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | React 18, Vite, TypeScript | Client application build |
| **Interactivity** | Three.js, GSAP | Animated 3D Balance Scale element |
| **Styling** | Custom CSS | Global layouts, custom fonts, glassmorphism UI |
| **Stellar SDK** | @stellar/stellar-sdk | Transaction building and XDR parsing |
| **Wallet** | @stellar/freighter-api | Freighter user wallet connection |

---

## Project Structure

```
AuraLend/
├── .github/
│   └── workflows/
│       └── ci.yml             # Automated build pipeline
├── contracts/                 # Soroban Smart Contracts (Rust)
│   ├── contracts/
│   │   ├── lending_pool/      # Lending pool code & unit tests
│   │   └── leverage_engine/   # Leverage engine code & unit tests
│   └── Cargo.toml
├── public/                    # Static branding icons
├── src/                       # Frontend Source
│   ├── assets/                # Visual media assets
│   ├── components/            # UI components (AreaChart, PriceChart)
│   ├── contracts/             # Auto-generated TypeScript client bindings
│   ├── App.tsx                # Main application logic and layout shell
│   ├── index.css              # Responsive styling variables
│   └── main.tsx               # Root React mounting
├── netlify.toml               # Netlify deployment configurations
└── package.json
```

---

## Testing

Smart contract suites are written in Rust using the Soroban testing utilities.

To execute tests:
```bash
cd contracts
cargo test
```

Unit tests cover:
*   Supply deposit and withdrawal limits.
*   Borrow limits and utilization rate calculations.
*   Leverage position openings, debt calculations, and liquidation triggers.

---

## CI/CD Pipeline

Continuous Integration is configured via GitHub Actions. Every push to the main branch triggers:
1. TypeScript compilation and React build check.
2. Rust Cargo test execution across all smart contracts.

---

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

---

## Roadmap

### Completed (Level 3 & 4)
*   Dual Soroban contracts with Inter-Contract Calls.
*   Yield Farming and Lending Vault interfaces.
*   Three.js animated 3D Balance Scale.
*   Stellar RPC Telemetry Console.
*   Mobile responsive layouts.

### Planned (Level 5 & 6)
*   Mainnet deployment.
*   Gasless onboarding via Stellar Fee Bump transactions.
*   Reputation scoring system for active address volume.

---

## Author

**Arindam Das** - [codePaji](https://github.com/codePaji)

---

## UI Screenshots

### Desktop UI Overview
![Desktop Dashboard](sub%20assets/ui1.png)
![Markets Vaults](sub%20assets/ui2.png)
![Leveraged Farming Controls](sub%20assets/ui3.png)
![Activity Telemetry Logs](sub%20assets/ui4.png)

### Mobile Responsive UI
![Mobile Layout](sub%20assets/mobui.png)
