import { useState, useEffect, useCallback } from "react";
import { rpc } from "../lib/stellar";
import * as StellarSdk from "@stellar/stellar-sdk";

export interface ContractEventRecord {
  id: string;
  type: string;
  user: string;
  amount: string;
  ledger: number;
}

export function useContractEvents(contractId: string) {
  const [events, setEvents] = useState<ContractEventRecord[]>([]);

  const fetchEvents = useCallback(async () => {
    if (!contractId) return;
    try {
      const latestLedgerRes = await rpc.getLatestLedger();
      const startLedger = Math.max(1, latestLedgerRes.sequence - 1000);

      // Fetch latest events filtered by contract address
      const response = await rpc.getEvents({
        startLedger,
        filters: [
          {
            type: "contract",
            contractIds: [contractId],
          },
        ],
        limit: 10,
      });

      const parsed: ContractEventRecord[] = (response.events || []).map((e) => {
        try {
          const topics = e.topic || [];
          const eventType = topics[0] ? StellarSdk.scValToNative(topics[0]) : "unknown";
          const user = topics[1] ? StellarSdk.scValToNative(topics[1]) : "unknown";
          const amountValue = e.value ? StellarSdk.scValToNative(e.value) : 0;
          
          // Format amount value (scaling 7 decimal places for mock USDC)
          const formattedAmount = (Number(amountValue) / 10_000_000).toFixed(2);

          return {
            id: e.id,
            type: String(eventType),
            user: String(user),
            amount: formattedAmount,
            ledger: e.ledger,
          };
        } catch (innerErr) {
          console.error("Failed to parse individual event", innerErr);
          return null;
        }
      }).filter((item): item is ContractEventRecord => item !== null);

      setEvents(parsed);
    } catch (err) {
      console.error("Failed to fetch contract events", err);
    }
  }, [contractId]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return { events, refreshEvents: fetchEvents };
}
