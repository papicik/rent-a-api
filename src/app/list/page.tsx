'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Navbar } from '@/components/Navbar';
import { MODEL_CATALOG, DEFAULT_DAILY_QUOTA, detectModelFromApiKey } from '@/lib/constants';
import { ModelId } from '@/lib/types';
import { calculateIdleKeyPrice, formatQuota, formatUsd, formatRentToken } from '@/lib/pricing';
import { maskApiKey } from '@/lib/crypto';
import { ShieldCheck, Eye, EyeOff, Lock, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';

export default function ListApiPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [modelType, setModelType] = useState<ModelId>('claude-sonnet-4');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);

  const currentModel = MODEL_CATALOG[modelType];
  const dailyQuota = DEFAULT_DAILY_QUOTA[modelType] || currentModel.defaultDailyQuota;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pricing = calculateIdleKeyPrice(
    modelType,
    dailyQuota,
    dailyQuota
  );

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    const detected = detectModelFromApiKey(val);
    if (detected) {
      setModelType(detected.modelId);
      setDetectedProvider(detected.label);
    } else {
      setDetectedProvider(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!isConnected || !address) {
      setError('Please connect your Web3 wallet first.');
      return;
    }

    if (!apiKey || apiKey.trim().length < 8) {
      setError('API key must be at least 8 characters.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelType,
          apiKey: apiKey.trim(),
          providerWallet: address,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Slot successfully encrypted and listed on marketplace!');
        setApiKey('');
        setDetectedProvider(null);
        setTimeout(() => {
          router.push('/marketplace');
        }, 1500);
      } else {
        setError(data.error || 'Failed to list slot.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0D1117] font-sans selection:bg-[#CDFF00]/20 selection:text-[#CDFF00]">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Header */}
        <div className="border-b border-[#E5E7EB] pb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-xs font-semibold tracking-tight">
            <ShieldCheck className="w-3.5 h-3.5 text-[#CDFF00]" />
            <span>AES-256-GCM Hardware-Grade Encrypted Vault</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#0D1117] tracking-tight">
            List Your Idle API Key
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed max-w-2xl tracking-tight">
            Monetize unused AI API credits on Robinhood Chain L2. Daily rentals settled directly in RENT token.
          </p>
        </div>

        {/* Wallet Warning */}
        {!isConnected && (
          <div className="p-4 rounded-3xl bg-[#F8FAFC] border border-[#E5E7EB] text-[#0D1117] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 text-[#CDFF00] flex-shrink-0" />
              <span>Connect your Web3 wallet to list slots and receive RENT rewards.</span>
            </div>
            <div className="rk-connect-container [&_button]:!rounded-full">
              <ConnectButton />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Inputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* API Key Vault Input - Placed First for Instant Auto-Detection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block">
                  Provider API Key
                </label>
                <span className="text-[11px] font-mono text-[#000000] flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#CDFF00]" />
                  AES-256-GCM Encrypted
                </span>
              </div>

              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="Paste your API key (e.g. AQ..., AIzaSy..., sk-ant-..., sk-proj-...)"
                  className="w-full pl-4 pr-11 py-3 rounded-2xl bg-white border border-[#E5E7EB] text-[#0D1117] text-xs sm:text-sm font-mono focus:outline-none focus:border-[#CDFF00] transition-colors shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0D1117] cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {detectedProvider && (
                <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-[#CDFF00]/15 border border-[#CDFF00]/40 text-xs text-[#0D1117] font-medium transition-all">
                  <Sparkles className="w-4 h-4 text-[#759e00] shrink-0" />
                  <span>
                    Detected provider: <strong>{detectedProvider}</strong>. Automatically selected <strong>{currentModel.name}</strong>!
                  </span>
                </div>
              )}

              {apiKey && (
                <div className="text-[11px] font-mono text-[#64748B] flex items-center gap-2 pt-1">
                  <span>Public Snippet:</span>
                  <span className="text-[#000000] bg-[#F8FAFC] px-2 py-0.5 rounded-full border border-[#E5E7EB]">
                    {maskApiKey(apiKey)}
                  </span>
                </div>
              )}
            </div>

            {/* Model Catalog Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block">
                  Select AI Model (12 Verified Models)
                </label>
                {detectedProvider && (
                  <span className="text-[11px] font-semibold text-[#658c00] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Auto-selected {currentModel.name}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {(Object.keys(MODEL_CATALOG) as ModelId[]).map((id) => {
                  const m = MODEL_CATALOG[id];
                  const isSelected = modelType === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setModelType(id);
                        setDetectedProvider(null);
                      }}
                      className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#CDFF00] bg-[#CDFF00]/10 shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.25)] ring-1 ring-[#CDFF00]'
                          : 'border-[#E5E7EB] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC] shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#0D1117] truncate max-w-[140px] tracking-tight">
                          {m.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                          {m.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-1 font-mono">
                        Quota: {formatQuota(DEFAULT_DAILY_QUOTA[id] || m.defaultDailyQuota, m.unitType)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Clean Slot Summary & Listing Action */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 space-y-4 sticky top-28 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                Slot Summary
              </h3>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-3 text-xs font-mono">
                <div className="flex justify-between text-[#64748B]">
                  <span>Model:</span>
                  <span className="text-[#0D1117] font-bold">{currentModel.name}</span>
                </div>

                <div className="flex justify-between text-[#64748B]">
                  <span>Daily Quota:</span>
                  <span className="text-[#0D1117] font-bold">{formatQuota(dailyQuota, currentModel.unitType)}</span>
                </div>

                <div className="flex justify-between text-[#000000] font-bold border-t border-[#E5E7EB] pt-2.5">
                  <span>Daily Price:</span>
                  <span>{formatUsd(pricing.suggestedDailyPriceUsd)} / day</span>
                </div>

                <div className="flex justify-between text-[#0D1117] font-bold">
                  <span>Settlement:</span>
                  <span>≈ {formatRentToken(pricing.suggestedDailyPriceRent)}</span>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-[#FF5000]/10 border border-[#FF5000]/30 text-[#FF5000] text-xs">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#CDFF00]" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* List Slot Button - Capsule Pill */}
              <button
                type="submit"
                disabled={loading || !isConnected}
                className="w-full py-3.5 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] disabled:opacity-50 text-black font-bold text-xs sm:text-sm tracking-tight transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_-3px_rgba(205, 255, 0,0.4)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Encrypting & Listing...</span>
                  </>
                ) : (
                  <span>List Slot</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
