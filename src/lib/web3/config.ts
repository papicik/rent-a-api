import { createPublicClient, defineChain, http } from 'viem';

// Robinhood Chain (Arbitrum L2 EVM)
export const robinhoodChain = defineChain({
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 421614),
  name: 'Robinhood Chain L2',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood L2 Explorer',
      url: 'https://sepolia.arbiscan.io',
    },
  },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'),
});

export const ESCROW_CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_API_ESCROW_ADDRESS ||
  process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
  '0x5555555555555555555555555555555555555555'
) as `0x${string}`;
