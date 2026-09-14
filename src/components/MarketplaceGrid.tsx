'use client';

import React, { useState } from 'react';
import { SlotCard } from '@/components/SlotCard';
import { SlotDto, ModelId } from '@/lib/types';
import { MODEL_CATALOG } from '@/lib/constants';
import { Search, SlidersHorizontal } from 'lucide-react';

interface MarketplaceGridProps {
  slots: SlotDto[];
  loading?: boolean;
}

const PROVIDER_PILLS = [
  'ALL',
  'Anthropic',
  'OpenAI',
  'Google',
  'DeepSeek',
  'Groq',
] as const;

export function MarketplaceGrid({ slots, loading = false }: MarketplaceGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('ALL');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const filteredSlots = slots.filter((slot) => {
    // Text search filter
    const matchesSearch =
      slot.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      slot.modelType.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Availability toggle
    if (onlyAvailable && slot.isLockedToday) return false;

    // Provider pill filter: ALL, Anthropic, OpenAI, Google, DeepSeek, Groq
    if (selectedProvider !== 'ALL') {
      const catalog = MODEL_CATALOG[slot.modelType as ModelId];
      const providerName = catalog?.provider || '';
      const normSelected = selectedProvider.toLowerCase();
      const normProvider = providerName.toLowerCase();
      const normModelType = slot.modelType.toLowerCase();

      const matchesProvider =
        normProvider.includes(normSelected) ||
        normModelType.includes(normSelected) ||
        (normSelected === 'groq' && (normModelType.includes('llama') || normModelType.includes('whisper')));

      if (!matchesProvider) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Search and Availability Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models (Claude Sonnet, GPT-4o, DeepSeek, Whisper)..."
            className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-[#E5E7EB] text-[#0D1117] text-xs sm:text-sm focus:outline-none focus:border-[#CDFF00] transition-colors placeholder:text-[#94A3B8] tracking-tight shadow-sm"
          />
        </div>

        <label className="flex items-center gap-2 px-5 py-3 rounded-full bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] text-xs font-semibold text-[#64748B] hover:text-[#0D1117] cursor-pointer select-none transition-colors whitespace-nowrap self-stretch sm:self-auto shadow-sm">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="rounded border-[#E5E7EB] text-[#CDFF00] focus:ring-[#CDFF00]/20 bg-white"
          />
          <span>Available Only</span>
        </label>
      </div>

      {/* Capsule category filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1.5 text-[#64748B] text-xs font-semibold pr-2 tracking-tight">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#CDFF00]" />
          <span>Provider:</span>
        </div>
        {PROVIDER_PILLS.map((provider) => {
          const isSelected = selectedProvider === provider;
          return (
            <button
              key={provider}
              onClick={() => setSelectedProvider(provider)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border tracking-tight cursor-pointer ${
                isSelected
                  ? 'bg-[#CDFF00]/15 border-[#CDFF00]/40 text-[#000000] shadow-sm'
                  : 'bg-white border-[#E5E7EB] text-[#64748B] hover:text-[#0D1117] hover:bg-[#F8FAFC]'
              }`}
            >
              {provider}
            </button>
          );
        })}
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-72 rounded-3xl bg-[#F8FAFC] border border-[#E5E7EB] animate-pulse"
            />
          ))}
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-dashed border-[#E5E7EB] p-8 space-y-3 bg-[#F8FAFC]">
          <p className="text-[#64748B] text-sm tracking-tight">No API slots match your search or provider filter.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedProvider('ALL');
              setOnlyAvailable(false);
            }}
            className="text-[#CDFF00] text-xs hover:underline font-semibold tracking-tight cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSlots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} />
          ))}
        </div>
      )}
    </div>
  );
}
