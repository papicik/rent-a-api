'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Key, Zap, CheckCircle2 } from 'lucide-react';

export function DualVisionCards() {
  return (
    <section className="space-y-8 font-sans">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="text-xs font-semibold text-[#CDFF00] uppercase tracking-wider">
          Built For Both Sides of the Compute Economy
        </span>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0D1117] tracking-tight">
          Two Ways to Win with RENT a API
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] max-w-lg mx-auto">
          Whether you hold unused enterprise tiers or need high-throughput inference at discount rates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: For API Owners & Teams */}
        <div className="p-8 sm:p-10 rounded-3xl bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-300 space-y-6 relative overflow-hidden backdrop-blur-md group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#CDFF00]/[0.03] rounded-full blur-2xl pointer-events-none -z-10 group-hover:bg-[#CDFF00]/[0.06] transition-colors" />

          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00] shadow-inner">
              <Key className="w-5 h-5 text-[#CDFF00]" />
            </div>
            <span className="text-[11px] font-bold px-3.5 py-1 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/20 text-[#000000] uppercase tracking-tight">
              For Key Providers
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-[#0D1117] tracking-tight">
              For API Owners & Teams
            </h3>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Monetize your unused capacity automatically. Turn sunken SaaS expenses and expiring credits into daily $RENT income with bank-grade encryption.
            </p>
          </div>

          <ul className="space-y-2.5 text-xs text-[#64748B] font-medium border-t border-[#E5E7EB] pt-4">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#CDFF00] shrink-0" />
              <span className="text-[#0D1117]">Monetize unused capacity & prepaid monthly commitments</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#CDFF00] shrink-0" />
              <span className="text-[#0D1117]">Automated 24H escrow payouts directly in $RENT</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#CDFF00] shrink-0" />
              <span className="text-[#0D1117]">Zero key exposure — AES-256-GCM vault isolation</span>
            </li>
          </ul>

          <div className="pt-2">
            <Link
              href="/list"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black text-xs font-bold transition-all shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.3)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>List Your First Key</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Card 2: For AI Builders & Hackers */}
        <div className="p-8 sm:p-10 rounded-3xl bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-300 space-y-6 relative overflow-hidden backdrop-blur-md group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#CDFF00]/[0.03] rounded-full blur-2xl pointer-events-none -z-10 group-hover:bg-[#CDFF00]/[0.06] transition-colors" />

          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00] shadow-inner">
              <Zap className="w-5 h-5 text-[#CDFF00]" />
            </div>
            <span className="text-[11px] font-bold px-3.5 py-1 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/20 text-[#000000] uppercase tracking-tight">
              For AI Engineers
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-[#0D1117] tracking-tight">
              For AI Builders & Hackers
            </h3>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Enterprise AI compute muscle far below official retail. Rent an exclusive daily slot, hook up our low-latency reverse proxy, and start building.
            </p>
          </div>

          <ul className="space-y-2.5 text-xs text-[#64748B] font-medium border-t border-[#E5E7EB] pt-4">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#CDFF00] shrink-0" />
              <span className="text-[#0D1117]">Frontier AI model access up to 50% below official list pricing</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#CDFF00] shrink-0" />
              <span className="text-[#0D1117]">Single-tenant 24H isolation — zero noisy neighbors</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#CDFF00] shrink-0" />
              <span className="text-[#0D1117]">Zero contracts, subscriptions, or credit card requirements</span>
            </li>
          </ul>

          <div className="pt-2">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] hover:border-[#CDFF00]/40 text-[#0D1117] text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
