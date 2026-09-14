'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Plus, LayoutDashboard, Coins, Zap, X, ShieldCheck } from 'lucide-react';
import { ListApiModal } from '@/components/ListApiModal';
import { UserDashboardModal } from '@/components/UserDashboardModal';

export function FloatingActionButton() {
  const { isConnected, address } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);

  const handleFaucetMint = async () => {
    if (!address) return;
    try {
      setFaucetLoading(true);
      setFaucetMsg(null);
      const res = await fetch('/api/dev/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: 5000 }),
      });
      const data = await res.json();
      if (data.success) {
        setFaucetMsg('+5,000 $RENT Minted');
        setTimeout(() => setFaucetMsg(null), 3000);
      }
    } catch {
      // ignore
    } finally {
      setFaucetLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-6 z-40 font-sans">
        {/* Quick Menu Popover */}
        {isOpen && (
          <div className="mb-3 p-2 rounded-2xl bg-white/95 border border-[#E5E7EB] shadow-2xl backdrop-blur-xl flex flex-col gap-1 min-w-[200px] animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-[#64748B] tracking-tight uppercase border-b border-[#E5E7EB] mb-1">
              Robinhood Quick Actions
            </div>

            <button
              onClick={() => {
                setIsOpen(false);
                setIsListModalOpen(true);
              }}
              className="w-full px-3.5 py-2 rounded-full text-xs font-semibold text-[#0D1117] hover:bg-[#F3F4F6] hover:text-[#CDFF00] transition-colors flex items-center gap-2.5 text-left cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-[#CDFF00]/10 flex items-center justify-center text-[#CDFF00]">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span>List an API Key</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                setIsDashboardOpen(true);
              }}
              className="w-full px-3.5 py-2 rounded-full text-xs font-semibold text-[#0D1117] hover:bg-[#F3F4F6] hover:text-[#CDFF00] transition-colors flex items-center gap-2.5 text-left cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-[#CDFF00]/10 flex items-center justify-center text-[#CDFF00]">
                <LayoutDashboard className="w-3.5 h-3.5" />
              </div>
              <span>My Vault & Leases</span>
            </button>

            {isConnected && address && (
              <button
                onClick={handleFaucetMint}
                disabled={faucetLoading}
                className="w-full px-3.5 py-2 rounded-full text-xs font-semibold text-[#000000] hover:bg-[#CDFF00]/10 transition-colors flex items-center gap-2.5 text-left cursor-pointer disabled:opacity-50"
              >
                <div className="w-6 h-6 rounded-full bg-[#CDFF00]/20 flex items-center justify-center text-[#CDFF00]">
                  <Coins className="w-3.5 h-3.5" />
                </div>
                <span>{faucetMsg || (faucetLoading ? 'Minting...' : 'Mint 5,000 $RENT')}</span>
              </button>
            )}
          </div>
        )}

        {/* Capsule Pill Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group px-4 py-2.5 rounded-full bg-white/95 hover:bg-[#F8FAFC] border border-[#E5E7EB] hover:border-[#CDFF00]/50 shadow-xl backdrop-blur-xl text-[#0D1117] text-xs font-bold tracking-tight flex items-center gap-2.5 transition-all cursor-pointer"
        >
          <div className="relative flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-[#CDFF00] animate-pulse" />
            <span className="absolute w-2 h-2 rounded-full bg-[#CDFF00]/50 animate-ping" />
          </div>
          <span className="group-hover:text-[#CDFF00] transition-colors">
            {isOpen ? 'Close' : 'Quick Actions'}
          </span>
          {isOpen ? (
            <X className="w-3.5 h-3.5 text-[#64748B]" />
          ) : (
            <Zap className="w-3.5 h-3.5 text-[#CDFF00]" />
          )}
        </button>
      </div>

      <ListApiModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
      />

      <UserDashboardModal
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
      />
    </>
  );
}
