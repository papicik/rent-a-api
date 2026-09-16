'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  phantomWallet,
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { http } from 'viem';
import {
  mainnet,
  base,
  arbitrum,
  polygon,
  sepolia,
  arbitrumSepolia,
  baseSepolia,
} from 'viem/chains';
import { robinhoodChain } from './config';

export const supportedChains = [
  mainnet,
  base,
  polygon,
  arbitrum,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  robinhoodChain,
] as const;

export const wagmiConfig = getDefaultConfig({
  appName: 'RENT-an-API',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'c4b0f92b7408849b294e5f2cf2996253',
  chains: supportedChains,
  wallets: [
    {
      groupName: 'Popular',
      wallets: [
        phantomWallet,
        metaMaskWallet,
        coinbaseWallet,
        rainbowWallet,
        walletConnectWallet,
      ],
    },
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [robinhoodChain.id]: http(),
  },
  ssr: true,
});

