import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, walletConnectWallet, phantomWallet } from "@rainbow-me/rainbowkit/wallets";
import type { WalletList } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

// Free at cloud.walletconnect.com (Reown). Without a real one, WalletConnect's
// client tries to open a relay connection with a malformed project id, which
// hangs rather than failing cleanly — so unlike a merely-missing config value,
// this isn't safe to fall back to a placeholder. Only wire the connector in
// once a real id is set.
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// A curated wallet list, NOT RainbowKit's getDefaultConfig default set:
// that default list includes Coinbase's "Base Account" connector, which
// drags in @coinbase/cdp-sdk and an optional @x402/core payment-protocol
// dependency we never installed (and don't need for a testnet MetaMask
// flow) — Turbopack fails to resolve it at build time. Naming only the
// wallets we actually want sidesteps that import chain entirely.
//
// NOTE: We explicitly list wallets instead of using `injectedWallet` to avoid
// duplicate key errors when multiple wallet extensions are installed (e.g.
// Phantom + MetaMask both registering as injected wallets).
const walletGroup: WalletList[number] = {
  groupName: "Recommended",
  wallets: projectId
    ? [metaMaskWallet, phantomWallet, walletConnectWallet]
    : [metaMaskWallet, phantomWallet],
};

const connectors = connectorsForWallets([walletGroup], {
  appName: "Basket",
  projectId: projectId ?? "",
});

export const wagmiConfig = createConfig({
  connectors,
  chains: [somniaShannon],
  transports: {
    [somniaShannon.id]: http(),
  },
  ssr: true,
});
