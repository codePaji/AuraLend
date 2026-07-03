import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"InvalidToken"},
  2: {message:"InsufficientBalance"},
  3: {message:"InvalidAmount"}
}

export type DataKey = {tag: "TokenA", values: void} | {tag: "TokenB", values: void} | {tag: "TotalShares", values: void} | {tag: "LpBalance", values: readonly [string]};

export interface Client {
  /**
   * Construct and simulate a swap transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  swap: ({user, token_in, token_out, amount_in}: {user: string, token_in: string, token_out: string, amount_in: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deposit: ({user, amount_a, amount_b}: {user: string, amount_a: i128, amount_b: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw: ({user, shares}: {user: string, shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>

  /**
   * Construct and simulate a get_lp_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_lp_balance: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_total_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_total_shares: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {token_a, token_b}: {token_a: string, token_b: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({token_a, token_b}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAAwAAAAAAAAAMSW52YWxpZFRva2VuAAAAAQAAAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAACAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAAAw==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAABlRva2VuQQAAAAAAAAAAAAAAAAAGVG9rZW5CAAAAAAAAAAAAAAAAAAtUb3RhbFNoYXJlcwAAAAABAAAAAAAAAAlMcEJhbGFuY2UAAAAAAAABAAAAEw==",
        "AAAAAAAAAAAAAAAEc3dhcAAAAAQAAAAAAAAABHVzZXIAAAATAAAAAAAAAAh0b2tlbl9pbgAAABMAAAAAAAAACXRva2VuX291dAAAAAAAABMAAAAAAAAACWFtb3VudF9pbgAAAAAAAAsAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAAAAAAAHZGVwb3NpdAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAIYW1vdW50X2EAAAALAAAAAAAAAAhhbW91bnRfYgAAAAsAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAAAAAAAId2l0aGRyYXcAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAQAAA+kAAAPtAAAAAgAAAAsAAAALAAAAAw==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAAB3Rva2VuX2EAAAAAEwAAAAAAAAAHdG9rZW5fYgAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAOZ2V0X2xwX2JhbGFuY2UAAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAQZ2V0X3RvdGFsX3NoYXJlcwAAAAAAAAABAAAACw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    swap: this.txFromJSON<Result<i128>>,
        deposit: this.txFromJSON<Result<i128>>,
        withdraw: this.txFromJSON<Result<readonly [i128, i128]>>,
        get_lp_balance: this.txFromJSON<i128>,
        get_total_shares: this.txFromJSON<i128>
  }
}