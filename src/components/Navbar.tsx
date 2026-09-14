'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignMessage } from 'wagmi';
import { Key, ShieldCheck, Loader2, Plus, LayoutDashboard, Coins } from 'lucide-react';
import { createSiweMessage } from '@/lib/siwe';
import { maskWallet } from '@/lib/crypto';
import { UserDashboardModal } from '@/components/UserDashboardModal';
import { ListApiModal } from '@/components/ListApiModal';

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetSuccessMsg, setFaucetSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/list', label: 'List a Key' },
    { href: '/dashboard', label: 'Dashboard' },
  ];

  // Check current SIWE session on mount and when wallet address changes
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (isMounted) {
          if (data.authenticated && data.address) {
            setSessionAddress(data.address);
          } else {
            setSessionAddress(null);
          }
        }
      } catch {
        if (isMounted) setSessionAddress(null);
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [address]);

  const handleSignIn = async () => {
    if (!address) return;
    try {
      setSigning(true);

      // 1. Fetch nonce from server
      const nonceRes = await fetch('/api/auth/nonce');
      const nonceData = await nonceRes.json();
      if (!nonceData.success || !nonceData.nonce) {
        throw new Error('Failed to retrieve authentication nonce.');
      }

      // 2. Format SIWE message
      const message = createSiweMessage(address, nonceData.nonce);

      // 3. Request signature from wallet
      const signature = await signMessageAsync({ message });

      // 4. Verify signature on backend
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          message,
          signature,
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyData.success && verifyData.address) {
        setSessionAddress(verifyData.address);
      }
    } catch {
      // User rejected or network failure
    } finally {
      setSigning(false);
    }
  };

  const handleMintFaucet = async () => {
    if (!address) return;
    try {
      setFaucetLoading(true);
      setFaucetSuccessMsg(null);
      const res = await fetch('/api/dev/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: 5000 }),
      });
      const data = await res.json();
      if (data.success) {
        setFaucetSuccessMsg('Minted 5,000 $RENT!');
        setTimeout(() => setFaucetSuccessMsg(null), 4000);
      } else {
        alert(data.error || 'Faucet request failed');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Faucet request failed');
    } finally {
      setFaucetLoading(false);
    }
  };

  const isUserAuthenticated =
    Boolean(isConnected && address && sessionAddress && sessionAddress.toLowerCase() === address.toLowerCase());

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#E5E7EB] bg-white/90 backdrop-blur-xl transition-all font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Left: Brand Robinhood Leaf/Key Icon and "RENT a API" */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00] group-hover:border-[#CDFF00] group-hover:bg-[#CDFF00]/20 transition-all shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.25)]">
                <Key className="w-5 h-5 text-[#CDFF00]" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-[#0D1117] group-hover:text-[#CDFF00] transition-colors">
                RENT a API
              </span>
            </Link>

            {/* Nav Links - Robinhood Capsule Pills */}
            <nav className="hidden md:flex items-center gap-1.5">
              {navLinks.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-full text-xs font-semibold tracking-tight transition-all ${
                      isActive
                        ? 'bg-[#CDFF00]/15 text-[#000000] border border-[#CDFF00]/30'
                        : 'text-[#64748B] hover:text-[#0D1117] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Quick Modals, Faucet, SIWE Status & Wallet ConnectButton */}
          <div className="flex items-center gap-3">
            {isConnected && address && (
              <button
                onClick={handleMintFaucet}
                disabled={faucetLoading}
                title="Mint 5,000 test $RENT to connected wallet on Base Sepolia"
                className="px-3.5 py-1.5 rounded-full bg-[#CDFF00]/10 hover:bg-[#CDFF00]/20 border border-[#CDFF00]/30 text-[#000000] text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {faucetLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#CDFF00]" />
                ) : (
                  <Coins className="w-3.5 h-3.5 text-[#CDFF00]" />
                )}
                <span className="hidden sm:inline">
                  {faucetSuccessMsg ? faucetSuccessMsg : 'Mint 5,000 $RENT'}
                </span>
                <span className="sm:hidden">Faucet</span>
              </button>
            )}

            {isConnected && (
              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={() => setIsListModalOpen(true)}
                  className="px-4 py-2 rounded-full bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[#0D1117] hover:text-[#CDFF00] hover:border-[#CDFF00]/40 text-xs font-semibold tracking-tight flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-[#CDFF00]" />
                  <span>List Key</span>
                </button>
                <button
                  onClick={() => setIsDashboardOpen(true)}
                  className="px-4 py-2 rounded-full bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[#0D1117] hover:text-[#CDFF00] hover:border-[#CDFF00]/40 text-xs font-semibold tracking-tight flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-[#CDFF00]" />
                  <span>My Vault</span>
                </button>
              </div>
            )}

            {isConnected && address && (
              <>
                {isUserAuthenticated ? (
                  <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-xs font-mono">
                    <span className="w-2 h-2 rounded-full bg-[#CDFF00] animate-pulse" />
                    <span>Signed in as {maskWallet(sessionAddress!)}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSignIn}
                    disabled={signing}
                    className="px-4 py-2 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] disabled:opacity-50 text-black text-xs font-bold tracking-tight transition-colors flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.3)]"
                  >
                    {signing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Signing...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Sign In</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            <div className="rk-connect-container [&_button]:!rounded-full">
              <ConnectButton
                chainStatus="icon"
                showBalance={false}
                accountStatus={{
                  smallScreen: 'avatar',
                  largeScreen: 'full',
                }}
              />
            </div>
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <div className="md:hidden flex items-center justify-around border-t border-[#E5E7EB] px-4 py-2.5 bg-white/95 overflow-x-auto">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  isActive ? 'bg-[#CDFF00]/15 text-[#000000] font-bold border border-[#CDFF00]/30' : 'text-[#64748B] hover:text-[#0D1117]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Modals */}
      <UserDashboardModal
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
      />
      <ListApiModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
      />
    </>
  );
}
