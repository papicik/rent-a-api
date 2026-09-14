'use client';

import React, { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '@/lib/web3/wagmi';
import { robinhoodChain } from '@/lib/web3/config';

const baseTheme = lightTheme({
  accentColor: '#CDFF00',
  accentColorForeground: '#000000',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'small',
});

const robinhoodTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    connectButtonBackground: '#CDFF00',
    connectButtonText: '#000000',
    connectButtonInnerBackground: '#CDFF00',
  },
  radii: {
    ...baseTheme.radii,
    connectButton: '9999px',
    actionButton: '9999px',
  },
};

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 10_000,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale="en-US"
          theme={robinhoodTheme}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
