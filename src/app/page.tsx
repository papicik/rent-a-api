'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { DualVisionCards } from '@/components/DualVisionCards';
import { HowItWorks } from '@/components/HowItWorks';
import { SlotCard } from '@/components/SlotCard';
import { SlotDto } from '@/lib/types';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  const [slots, setSlots] = useState<SlotDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeaturedSlots() {
      try {
        const res = await fetch('/api/slots');
        const data = await res.json();
        if (data.success && Array.isArray(data.slots)) {
          setSlots(data.slots);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    loadFeaturedSlots();
  }, []);

  const availableSlotsCount = slots.filter((s) => !s.isLockedToday).length || 8;
  const lockedTodayCount = slots.filter((s) => s.isLockedToday).length || 4;
  const featuredSlots = slots.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0D1117] font-sans selection:bg-[#CDFF00]/20 selection:text-[#CDFF00]">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-24">
        {/* 1. Hero Section with Key Metric Badges */}
        <Hero
          availableSlots={availableSlotsCount}
          lockedToday={lockedTodayCount}
        />

        {/* 2. Dual-Persona Vision Cards */}
        <DualVisionCards />

        {/* 3. 3-Step Arbitrage Engine */}
        <HowItWorks />

        {/* 4. Featured Live Slots Showcase */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E7EB] pb-4">
            <div>
              <span className="text-xs font-semibold text-[#CDFF00] uppercase tracking-wider block">
                Live Compute Inventory
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D1117] mt-1 tracking-tight">
                Featured API Slots
              </h2>
            </div>

            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#CDFF00] hover:text-[#000000] transition-colors group tracking-tight"
            >
              <span>View All {slots.length} Slots</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredSlots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} />
            ))}
          </div>
        </section>

        {/* 5. Bottom Call To Action Band */}
        <section className="rounded-3xl p-8 sm:p-14 border border-[#E5E7EB] bg-[#F8FAFC] backdrop-blur-xl relative overflow-hidden text-center space-y-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0D1117] tracking-tight leading-snug">
              Idle capacity on one side. Overpriced APIs on the other.{' '}
              <span className="text-[#75A300]">
                We just connected them.
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] max-w-lg mx-auto leading-relaxed tracking-tight">
              Start earning automated yield from your prepaid quotas or build your AI applications at wholesale rates.
            </p>
          </div>

          <div>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black font-bold text-sm shadow-[0_0_20px_-3px_rgba(205, 255, 0,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Clean Footer */}
        <footer className="border-t border-[#E5E7EB] pt-8 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <div>
            <span>RENT an API • Robinhood Chain (Arbitrum L2 EVM) • 0% Platform Fee</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/marketplace" className="hover:text-[#0D1117] transition-colors">
              Marketplace
            </Link>
            <Link href="/list" className="hover:text-[#0D1117] transition-colors">
              List a Key
            </Link>
            <Link href="/dashboard" className="hover:text-[#0D1117] transition-colors">
              Dashboard
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
