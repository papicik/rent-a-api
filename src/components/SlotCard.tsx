'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';
import { SlotDto } from '@/lib/types';
import { formatQuota, formatUsd, formatRentToken } from '@/lib/pricing';
import { maskWallet } from '@/lib/crypto';
import { MODEL_CATALOG } from '@/lib/constants';
import { ModelId } from '@/lib/types';

interface SlotCardProps {
  slot: SlotDto;
}

export function SlotCard({ slot }: SlotCardProps) {
  const catalog = MODEL_CATALOG[slot.modelType as ModelId];

  // Capacity calculation (Used vs Remaining)
  const totalQuota = slot.dailyQuota;
  const usedQuota = slot.activeRental?.usedQuota ?? (slot.consumedTokens ?? 0);
  const remainingQuota = Math.max(0, totalQuota - usedQuota);
  const usedPercentage = Math.min(100, Math.round((usedQuota / totalQuota) * 100));

  // Remaining credit health indicator
  const creditPct = slot.creditRemainingPct ?? 100;
  let creditColor = 'text-[#CDFF00]';
  if (creditPct < 20) {
    creditColor = 'text-[#FF5000]';
  } else if (creditPct <= 50) {
    creditColor = 'text-amber-400';
  }

  return (
    <div
      className={`rounded-3xl border transition-all duration-200 p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-md font-sans ${
        slot.isLockedToday
          ? 'bg-[#F8FAFC]/90 border-[#E5E7EB] opacity-75'
          : 'bg-white border-[#E5E7EB] hover:border-[#CBD5E1] shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]'
      }`}
    >
      {/* Top Details & Distinct Status Badges */}
      <div className="space-y-4 mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-[#CDFF00] uppercase tracking-wider">
                {catalog?.provider || 'AI Provider'}
              </span>
              <span className="text-[#E5E7EB]">•</span>
              <span className="text-[11px] font-mono text-[#94A3B8]">
                {maskWallet(slot.providerWallet)}
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-[#0D1117] tracking-tight">
              {slot.modelName}
            </h3>
          </div>

          {/* Status Badges: #CDFF00 for "AVAILABLE" vs #FF5000 for "LOCKED TODAY" */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {slot.isLockedToday ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF5000]/10 border border-[#FF5000]/30 text-[#FF5000] text-[11px] font-bold tracking-tight">
                <Lock className="w-3 h-3 text-[#FF5000]" />
                <span>LOCKED TODAY</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-[11px] font-bold tracking-tight shadow-sm shadow-[#CDFF00]/10">
                <span className="w-2 h-2 rounded-full bg-[#CDFF00] animate-pulse" />
                <span>AVAILABLE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Robinhood-Green Capacity Progress Bar */}
      <div className="space-y-2 py-3 border-t border-[#E5E7EB] text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#64748B] tracking-tight">Daily Quota:</span>
          <span className="text-[#0D1117] font-mono font-bold">
            {formatQuota(totalQuota, slot.unitType)}
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748B] tracking-tight">Daily Capacity:</span>
            <span className="text-[#64748B] font-mono font-semibold">{usedPercentage}% Consumed</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#F1F5F9] border border-[#E5E7EB] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                usedPercentage > 85
                  ? 'bg-[#FF5000]'
                  : 'bg-[#CDFF00]'
              }`}
              style={{ width: `${Math.max(4, usedPercentage)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono pt-0.5">
            <span>Used: {formatQuota(usedQuota, slot.unitType)}</span>
            <span>Free: {formatQuota(remainingQuota, slot.unitType)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[#64748B] tracking-tight">Credit Balance:</span>
          <span className={`font-mono font-bold ${creditColor}`}>
            ≈{creditPct}% Healthy
          </span>
        </div>
      </div>

      {/* Price & Full-width Green Pill Action Button */}
      <div className="pt-4 border-t border-[#E5E7EB] space-y-3">
        <div className="flex items-baseline justify-between font-mono">
          <div>
            <span className="text-2xl font-extrabold text-[#0D1117] tracking-tight">
              {formatUsd(slot.finalDailyPriceUsd)}
            </span>
            <span className="text-xs text-[#64748B] ml-1">/ day</span>
          </div>
          <div className="text-xs text-[#000000] font-bold">
            ≈ {formatRentToken(slot.finalDailyPriceRent)}
          </div>
        </div>

        {slot.isLockedToday ? (
          <button
            disabled
            className="w-full py-3 rounded-full bg-[#F1F5F9] border border-[#E5E7EB] text-[#94A3B8] text-xs font-bold tracking-tight cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-[#FF5000]" />
            <span>Locked for Today</span>
          </button>
        ) : (
          <Link
            href={`/rent/${slot.id}`}
            className="w-full py-3 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black text-xs font-bold tracking-tight transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.35)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer uppercase"
          >
            <span>RENT</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
