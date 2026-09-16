'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { MODEL_CATALOG, DEFAULT_DAILY_QUOTA } from '@/lib/constants';
import { ModelId } from '@/lib/types';
import { formatQuota, formatUsd, formatRentToken } from '@/lib/pricing';
import {
  X,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import { detectModelFromApiKey } from '@/lib/constants';

interface ListApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ListApiModal({ isOpen, onClose, onSuccess }: ListApiModalProps) {
  const { address, isConnected } = useAccount();

  const [modelType, setModelType] = useState<ModelId>('claude-sonnet-4');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);

  // Live Real-Time Estimator Controls
  const [usedPercentage, setUsedPercentage] = useState<number>(0); // 0% to 90%
  const [marginDiscount, setMarginDiscount] = useState<number>(35); // 20% to 50% of retail

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentModel = MODEL_CATALOG[modelType];
  const baseDailyQuota = DEFAULT_DAILY_QUOTA[modelType] || currentModel.defaultDailyQuota;

  // Real-time calculation
  const remainingQuota = baseDailyQuota * (1 - usedPercentage / 100);
  const officialRetailValue = (remainingQuota / currentModel.referenceUnitSize) * currentModel.officialCostUsd;
  const estimatedDailyPriceUsd = Math.max(0.5, officialRetailValue * (marginDiscount / 100));
  const estimatedDailyPriceRent = Math.round(estimatedDailyPriceUsd / 0.05); // TWAP estimate ~ $0.05 per RENT

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
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(data.error || 'Failed to list API key.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white border border-[#E5E7EB] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-[11px] font-semibold tracking-tight">
              <ShieldCheck className="w-3.5 h-3.5 text-[#CDFF00]" />
              <span>AES-256-GCM Vault Protected</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#0D1117] tracking-tight">List Your Idle API Key</h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#F8FAFC] border border-[#E5E7EB] text-[#64748B] hover:text-[#0D1117] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body with Real-Time Price Estimator */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-[#FF5000]/10 border border-[#FF5000]/30 text-[#FF5000] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Select AI Model
            </label>
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value as ModelId)}
              className="w-full px-4 py-3 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] text-[#0D1117] text-sm font-medium focus:outline-none focus:border-[#CDFF00] transition-colors"
            >
              {Object.values(MODEL_CATALOG).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
          </div>

          {/* Live Price & Yield Estimator */}
          <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#CDFF00] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Live Dynamic Yield Estimator
              </span>
              <span className="text-[11px] font-mono text-[#64748B]">
                Quota: {formatQuota(baseDailyQuota, currentModel.unitType)}
              </span>
            </div>

            {/* Slider 1: % Already Used Today */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#64748B] tracking-tight">Quota Already Consumed Today:</span>
                <span className="text-[#0D1117] font-mono font-bold">{usedPercentage}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={usedPercentage}
                onChange={(e) => setUsedPercentage(Number(e.target.value))}
                className="w-full h-1.5 rounded-full bg-[#E5E7EB] appearance-none cursor-pointer accent-[#CDFF00]"
              />
            </div>

            {/* Slider 2: Provider Margin Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#64748B] tracking-tight">Pricing vs Retail:</span>
                <span className="text-[#0D1117] font-mono font-bold">{marginDiscount}% of official retail</span>
              </div>
              <input
                type="range"
                min="20"
                max="60"
                step="5"
                value={marginDiscount}
                onChange={(e) => setMarginDiscount(Number(e.target.value))}
                className="w-full h-1.5 rounded-full bg-[#E5E7EB] appearance-none cursor-pointer accent-[#CDFF00]"
              />
            </div>

            {/* Dynamic Calculated Daily Rate */}
            <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#64748B] block tracking-tight">Estimated Daily Payout:</span>
                <span className="text-xl font-extrabold font-mono text-[#000000]">
                  {formatRentToken(estimatedDailyPriceRent)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#64748B] block tracking-tight">USD Daily Rate:</span>
                <span className="text-xl font-extrabold font-mono text-[#0D1117]">
                  {formatUsd(estimatedDailyPriceUsd)} / day
                </span>
              </div>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
              <span>Provider API Key</span>
              <span className="text-[11px] text-[#000000] font-normal">Encrypted on submit</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setApiKey(val);
                  const detected = detectModelFromApiKey(val);
                  if (detected) {
                    setModelType(detected.modelId);
                    setDetectedProvider(detected.label);
                  } else {
                    setDetectedProvider(null);
                  }
                }}
                placeholder="Paste your API key (AQ..., AIza..., sk-ant-..., sk-...)"
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E5E7EB] text-[#0D1117] font-mono text-sm pr-11 focus:outline-none focus:border-[#CDFF00] transition-colors shadow-sm"
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
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-[#CDFF00]/15 border border-[#CDFF00]/40 text-xs text-[#0D1117]">
                <Sparkles className="w-3.5 h-3.5 text-[#759e00]" />
                <span>Detected: <strong>{detectedProvider}</strong> → Selected <strong>{currentModel.name}</strong></span>
              </div>
            )}
            <p className="text-[11px] text-[#64748B] font-mono">
              Keys are encrypted with AES-256-GCM and never displayed in cleartext or returned to clients.
            </p>
          </div>

          {/* Capsule Pill Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !isConnected}
              className="w-full py-3.5 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black font-bold text-sm shadow-[0_0_20px_-3px_rgba(205, 255, 0,0.35)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Encrypting & Listing Key...</span>
                </>
              ) : !isConnected ? (
                <span>Connect Wallet to List</span>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-black" />
                  <span>Encrypt & List API Key</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
