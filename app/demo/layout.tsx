import Web3Provider from "@/components/providers/Web3Provider";

// Scoped to /demo only, deliberately not the root layout — the marketing
// landing page has no wallet functionality and shouldn't pay the compile /
// hydration cost of the wagmi + RainbowKit + connectors dependency tree.
export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return <Web3Provider>{children}</Web3Provider>;
}
