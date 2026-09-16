import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Web3Provider } from '@/components/Web3Provider';
import { FloatingActionButton } from '@/components/FloatingActionButton';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RENT an API | Decentralized AI Compute Marketplace',
  description: 'Monetize idle enterprise AI API keys or rent dedicated 24H single-tenant capacity far below official rates. Powered by Robinhood Chain L2.',
  keywords: [
    'RENT an API',
    'Robinhood Crypto',
    'AI API Rental',
    'P2P Marketplace',
    'Claude 3.5 Sonnet',
    'GPT-4o',
    'DeepSeek V3',
    'Robinhood Chain',
    'RENT Token',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-white text-[#0D1117] min-h-screen antialiased font-sans tracking-tight selection:bg-[#CDFF00]/20 selection:text-[#CDFF00]">
        <Web3Provider>
          <div className="relative min-h-screen overflow-x-hidden flex flex-col bg-white">
            {/* Subtle Robinhood Ambient Lighting */}
            <div className="pointer-events-none fixed top-[-8rem] left-1/2 -translate-x-1/2 w-[650px] h-[320px] bg-[#CDFF00]/[0.05] blur-[140px] rounded-full" />
            <div className="pointer-events-none fixed top-[40rem] right-[-10rem] w-[500px] h-[350px] bg-[#CDFF00]/[0.03] blur-[160px] rounded-full" />

            <main className="flex-1 z-10 flex flex-col">
              {children}
            </main>

            {/* Bottom-left Robinhood Capsule Floating Action Button */}
            <FloatingActionButton />
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
