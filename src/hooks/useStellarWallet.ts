import { useState, useCallback, useEffect } from "react";
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { horizon } from "../lib/stellar";

// Initialize StellarWalletsKit statically once
StellarWalletsKit.init({
  network: Networks.TESTNET,
  modules: defaultModules(),
});

export function useStellarWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState<string>("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (userAddress: string) => {
    try {
      setError(null);
      const account = await horizon.loadAccount(userAddress);
      const nativeBalance = account.balances.find(
        (b) => b.asset_type === "native"
      );
      setBalance(nativeBalance?.balance || "0");
    } catch (err: any) {
      if (err.response?.status === 404) {
        setBalance("0 (Unfunded)");
        setError("Account not funded on Testnet. Click Friendbot to fund.");
      } else {
        setError(err.message || "Failed to fetch balance");
      }
    }
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Open the modal and connect
      const result = await StellarWalletsKit.authModal();
      if (result && result.address) {
        setAddress(result.address);
        setConnected(true);
        await fetchBalance(result.address);
      } else {
        throw new Error("No address returned from wallet modal");
      }
    } catch (err: any) {
      setError(err.message || "Failed to open wallet selection modal");
    } finally {
      setLoading(false);
    }
  }, [fetchBalance]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await StellarWalletsKit.disconnect();
    } catch (e) {
      console.error(e);
    }
    setAddress(null);
    setConnected(false);
    setBalance("0");
    setError(null);
    setLoading(false);
  }, []);

  const sign = useCallback(async (xdr: string) => {
    setError(null);
    try {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
      });
      return signedTxXdr;
    } catch (err: any) {
      setError(err.message || "User rejected transaction signing");
      throw err;
    }
  }, []);

  useEffect(() => {
    if (address) {
      const interval = setInterval(() => {
        fetchBalance(address);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [address, fetchBalance]);

  return {
    address,
    connected,
    balance,
    loading,
    error,
    connect,
    disconnect,
    sign,
    fetchBalance: () => address && fetchBalance(address),
  };
}
