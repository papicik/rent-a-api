'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Lock, Server, Copy, Check } from 'lucide-react';
import { CONTRACT_ADDRESSES } from '@/lib/constants';

interface HeroProps {
  availableSlots?: number;
  lockedToday?: number;
  totalPaidOutRent?: number;
}

export function Hero({
  availableSlots = 12,
  lockedToday = 4,
}: HeroProps) {
  const [copied, setCopied] = useState(false);
  const rentTokenAddress = CONTRACT_ADDRESSES.RENT_TOKEN;

  const handleCopyCa = async () => {
    try {
      await navigator.clipboard.writeText(rentTokenAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard fallback
    }
  };

  return (
    <section className="relative rounded-3xl p-8 sm:p-14 overflow-hidden border border-[#E5E7EB] bg-white backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] font-sans">
      {/* Subtle Robinhood Ambient Lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#CDFF00]/[0.05] rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 lg:gap-12">
        {/* Left: Main Content */}
        <div className="max-w-3xl space-y-6">
          {/* Main Headline with Robinhood Green highlight without background clipping */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0D1117] leading-[1.12]">
            Stop Wasting Paid API Quotas.{' '}
            <span className="text-[#75A300]">
              Turn Idle Keys Into Passive $RENT.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-[#64748B] leading-relaxed max-w-2xl font-normal tracking-tight">
            Millions of enterprise AI credits expire unused every month. RENT an API unlocks that trapped compute: Key holders earn automated income, while builders rent dedicated daily access up to 50% below retail.
          </p>

          {/* CTAs - Signature Capsule Pills */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/marketplace"
              className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black font-bold text-sm shadow-[0_0_20px_-3px_rgba(205, 255, 0,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>Explore the Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/list"
              className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] hover:border-[#CBD5E1] text-[#0D1117] font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
            >
              <span>Start Earning</span>
            </Link>
          </div>

          {/* Token CA (Contract Address) Cell */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] hover:border-[#CBD5E1] text-xs font-mono transition-all shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#CDFF00] animate-pulse" />
              <span className="text-[#64748B] font-semibold font-sans uppercase tracking-wider text-[11px]">$RENT CA:</span>
              <span className="text-[#0D1117] font-bold tracking-tight select-all">
                {rentTokenAddress}
              </span>
              <button
                type="button"
                onClick={handleCopyCa}
                title="Copy Token CA"
                className="p-1 rounded-lg hover:bg-[#E5E7EB] text-[#64748B] hover:text-[#0D1117] transition-colors cursor-pointer flex items-center gap-1 ml-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#75A300]" />
                    <span className="text-[10px] text-[#75A300] font-sans font-bold">Copied!</span>
                  </>
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: 2 Metric Cards Stacked Vertically */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-4 shrink-0 lg:w-72">
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] p-5 space-y-1.5 hover:border-[#CDFF00]/40 transition-colors shadow-sm">
            <div className="flex items-center gap-2 text-xs text-[#64748B] font-medium">
              <Server className="w-4 h-4 text-[#88B300]" />
              <span>Available Slots</span>
            </div>
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#000000] block tracking-tight">
              {availableSlots} Active
            </span>
          </div>

          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] p-5 space-y-1.5 hover:border-[#FF5000]/40 transition-colors shadow-sm">
            <div className="flex items-center gap-2 text-xs text-[#64748B] font-medium">
              <Lock className="w-4 h-4 text-[#FF5000]" />
              <span>Locked Today</span>
            </div>
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#FF5000] block tracking-tight">
              {lockedToday} Slots
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
