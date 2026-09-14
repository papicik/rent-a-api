'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { MarketplaceGrid } from '@/components/MarketplaceGrid';
import { SlotDto } from '@/lib/types';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function MarketplacePage() {
  const [slots, setSlots] = useState<SlotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSlots() {
      try {
        setLoading(true);
        const res = await fetch('/api/slots');
        const data = await res.json();
        if (data.success && Array.isArray(data.slots)) {
          setSlots(data.slots);
        } else {
          setError(data.error || 'Failed to load slots.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Network error.');
      } finally {
        setLoading(false);
      }
    }

    fetchSlots();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0D1117] font-sans selection:bg-[#CDFF00]/20 selection:text-[#CDFF00]">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-[#0D1117] tracking-tight">
              API Slot Marketplace
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] tracking-tight">
              Verified 24-hour exclusive AI API slots with zero-lag reverse proxying on Robinhood Chain L2.
            </p>
          </div>

          <Link
            href="/list"
            className="self-start sm:self-auto px-5 py-2.5 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black font-bold text-xs tracking-tight transition-all shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.3)] cursor-pointer"
          >
            + List an API Key
          </Link>
        </div>

        {/* Error Notification */}
        {error ? (
          <div className="p-6 rounded-2xl bg-[#FF5000]/10 border border-[#FF5000]/30 text-[#FF5000] flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        ) : null}

        {/* Marketplace Grid with Provider Filter Pills & Capacity Bars */}
        <MarketplaceGrid slots={slots} loading={loading} />
      </main>
    </div>
  );
}
