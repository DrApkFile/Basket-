import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { WalletClient } from "viem";

// Somnia testnet — Shannon. Confirmed against source (README + addresses.ts),
// not just the knowledge-base summary: dev.smk.somnia.host is the testnet
// indexer, SOMNIA_TESTNET_ADDRESSES has every field this flow needs populated
// (binaryModule, binarySettlement, collateral, ...).
export const SOMNIA_TESTNET_INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

// 50312 in hex — used for wallet_switchEthereumChain / wallet_addEthereumChain.
export const SOMNIA_SHANNON_CHAIN_ID_HEX = "0xc488";

export { somniaShannon };

/**
 * One exchange per page load. Construct without a signer at boot (public
 * reads work immediately); call `exchange.setSigner({ walletClient })` once
 * the user's wallet connects — this is the pattern the SDK's own README
 * documents for browser apps.
 */
export function createExchange(walletClient?: WalletClient): SomniaMarkets {
  return new SomniaMarkets({
    indexerUrl: SOMNIA_TESTNET_INDEXER_URL,
    chain: somniaShannon,
    addresses: SOMNIA_TESTNET_ADDRESSES,
    ...(walletClient ? { walletClient } : {}),
  });
}

/** JSON.stringify replacer — the SDK returns bigints all over on-chain reads. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
