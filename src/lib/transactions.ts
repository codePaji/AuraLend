import * as StellarSdk from "@stellar/stellar-sdk";
import { horizon, config } from "./stellar";

export async function buildPaymentTx(
  sourceAddress: string,
  destinationAddress: string,
  amount: string
) {
  const account = await horizon.loadAccount(sourceAddress);

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationAddress,
        asset: StellarSdk.Asset.native(),
        amount: amount,
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}

export async function submitTransaction(signedXdr: string) {
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  const response = await horizon.submitTransaction(transaction);
  return {
    hash: response.hash,
    ledger: response.ledger,
  };
}

export async function fundAccount(address: string) {
  const response = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
  if (!response.ok) {
    throw new Error("Failed to fund account via Friendbot");
  }
  return response.json();
}
