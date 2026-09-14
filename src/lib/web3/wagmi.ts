'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { robinhoodChain } from './config';

export const wagmiConfig = getDefaultConfig({
  appName: 'RENT-a-API',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'c4b0f92b7408849b294e5f2cf2996253',
  chains: [robinhoodChain],
  transports: {
    [robinhoodChain.id]: http(),
  },
  ssr: true,
});
