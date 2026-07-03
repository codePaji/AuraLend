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
  1: {message:"NotInitialized"},
  2: {message:"NoActivePosition"},
  3: {message:"PositionAlreadyExists"},
  4: {message:"InvalidLeverage"},
  5: {message:"InsufficientCollateral"},
  6: {message:"PositionHealthy"}
}

export type DataKey = {tag: "Admin", values: void} | {tag: "TokenA", values: void} | {tag: "TokenB", values: void} | {tag: "LendingPool", values: void} | {tag: "MockAmm", values: void} | {tag: "Position", values: readonly [string]};


export interface Position {
  borrow_amount: i128;
  collateral: i128;
  lp_shares: i128;
}




export interface Client {
  /**
   * Construct and simulate a liquidate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  liquidate: ({user, liquidator}: {user: string, liquidator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_position: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Position>>>

  /**
   * Construct and simulate a open_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  open_position: ({user, collateral, leverage}: {user: string, collateral: i128, leverage: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a close_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  close_position: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_health_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_health_factor: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, token_a, token_b, pool, amm}: {admin: string, token_a: string, token_b: string, pool: string, amm: string},
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
    return ContractClient.deploy({admin, token_a, token_b, pool, amm}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABgAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAEE5vQWN0aXZlUG9zaXRpb24AAAACAAAAAAAAABVQb3NpdGlvbkFscmVhZHlFeGlzdHMAAAAAAAADAAAAAAAAAA9JbnZhbGlkTGV2ZXJhZ2UAAAAABAAAAAAAAAAWSW5zdWZmaWNpZW50Q29sbGF0ZXJhbAAAAAAABQAAAAAAAAAPUG9zaXRpb25IZWFsdGh5AAAAAAY=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAGVG9rZW5BAAAAAAAAAAAAAAAAAAZUb2tlbkIAAAAAAAAAAAAAAAAAC0xlbmRpbmdQb29sAAAAAAAAAAAAAAAAB01vY2tBbW0AAAAAAQAAAAAAAAAIUG9zaXRpb24AAAABAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAACFBvc2l0aW9uAAAAAwAAAAAAAAANYm9ycm93X2Ftb3VudAAAAAAAAAsAAAAAAAAACmNvbGxhdGVyYWwAAAAAAAsAAAAAAAAACWxwX3NoYXJlcwAAAAAAAAs=",
        "AAAABQAAAAAAAAAAAAAACkxpcXVpZGF0ZWQAAAAAAAEAAAAKbGlxdWlkYXRlZAAAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAAAAAAAApsaXF1aWRhdG9yAAAAAAATAAAAAAAAAAAAAAAUcGF5b3V0X3RvX2xpcXVpZGF0b3IAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADlBvc2l0aW9uQ2xvc2VkAAAAAAABAAAAD3Bvc2l0aW9uX2Nsb3NlZAAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAAAAAABnBheW91dAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADlBvc2l0aW9uT3BlbmVkAAAAAAABAAAAD3Bvc2l0aW9uX29wZW5lZAAAAAAEAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAAAAAACmNvbGxhdGVyYWwAAAAAAAsAAAAAAAAAAAAAAA1ib3Jyb3dfYW1vdW50AAAAAAAACwAAAAAAAAAAAAAACWxwX3NoYXJlcwAAAAAAAAsAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAJbGlxdWlkYXRlAAAAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAACmxpcXVpZGF0b3IAAAAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAMZ2V0X3Bvc2l0aW9uAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAD6AAAB9AAAAAIUG9zaXRpb24=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAUAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHdG9rZW5fYQAAAAATAAAAAAAAAAd0b2tlbl9iAAAAABMAAAAAAAAABHBvb2wAAAATAAAAAAAAAANhbW0AAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAANb3Blbl9wb3NpdGlvbgAAAAAAAAMAAAAAAAAABHVzZXIAAAATAAAAAAAAAApjb2xsYXRlcmFsAAAAAAALAAAAAAAAAAhsZXZlcmFnZQAAAAQAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAAAAAAAOY2xvc2VfcG9zaXRpb24AAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAAAAAAARZ2V0X2hlYWx0aF9mYWN0b3IAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAE" ]),
      options
    )
  }
  public readonly fromJSON = {
    liquidate: this.txFromJSON<Result<void>>,
        get_position: this.txFromJSON<Option<Position>>,
        open_position: this.txFromJSON<Result<i128>>,
        close_position: this.txFromJSON<Result<i128>>,
        get_health_factor: this.txFromJSON<u32>
  }
}