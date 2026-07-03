import * as StellarSdk from "@stellar/stellar-sdk";

export const config = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: StellarSdk.Networks.TESTNET,
  friendbotUrl: "https://friendbot.stellar.org",
};

export const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);
export const rpc = new StellarSdk.rpc.Server(config.rpcUrl);
