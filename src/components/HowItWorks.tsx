'use client';

import React from 'react';
import { Lock, Coins, Terminal } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Pick a Slot',
      desc: 'Browse active AI models with verified credit balances. One exclusive renter per UTC day ensures unthrottled throughput.',
      icon: Lock,
    },
    {
      num: '02',
      title: 'Instant $RENT Settlement',
      desc: 'Funds lock directly into the non-custodial ApiEscrow contract on Robinhood Chain L2. 100% of tokens go to the provider with 0% platform take.',
      icon: Coins,
    },
    {
      num: '03',
      title: 'Build via Instant Proxy',
      desc: 'Receive your unique rap_live_ proxy bearer token immediately. Drop it into your OpenAI or Anthropic SDKs with zero configuration.',
      icon: Terminal,
    },
  ];

  return (
    <section className="space-y-8 font-sans">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="text-xs font-semibold text-[#CDFF00] uppercase tracking-wider">
          3-Step Execution Model
        </span>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0D1117] tracking-tight">
          How It Works
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B]">
          Seamless non-custodial escrow, zero key leakage, and instant proxy execution.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="p-8 rounded-3xl bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all space-y-4 relative overflow-hidden backdrop-blur-md group"
            >
              <div className="flex items-center justify-between">
                {/* Rounded-full #CDFF00 badge indicator */}
                <div className="w-12 h-12 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center text-[#000000] font-mono font-bold text-sm shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.25)]">
                  {step.num}
                </div>
                <div className="w-9 h-9 rounded-full bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-center text-[#CDFF00]">
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-[#0D1117] tracking-tight">
                {step.title}
              </h3>

              <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
