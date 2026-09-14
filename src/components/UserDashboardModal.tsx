'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { SlotDto, RentalStatus } from '@/lib/types';
import { formatQuota, formatUsd, formatRentToken } from '@/lib/pricing';
import {
  X,
  Copy,
  Check,
  Key,
  Layers,
  Clock,
  Coins,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface UserDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RentalItem {
  id: string;
  slotId: string;
  modelName: string;
  modelType: string;
  renterWallet: string;
  providerWallet: string;
  rentalDate: string;
  status: RentalStatus;
  priceUsd: number;
  rentTokenAmount: number;
  proxyToken: string;
  usedQuota: number;
  dailyQuota: number;
  unitType: 'TOKEN' | 'MINUTE' | 'IMAGE' | 'REQUEST';
  expiresAtUtc: string;
}

export function UserDashboardModal({ isOpen, onClose }: UserDashboardModalProps) {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'rented' | 'listed'>('rented');

  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [mySlots, setMySlots] = useState<SlotDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);

  // UTC countdown calculation
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setUTCHours(23, 59, 59, 999);
      const diff = endOfDay.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Lease Expired (00h 00m)');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining(`${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s remaining`);
      }
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/slots');
        const data = await res.json();

        if (data.success && Array.isArray(data.slots)) {
          const allSlots: SlotDto[] = data.slots;

          if (address) {
            const providerSlots = allSlots.filter(
              (s) => s.providerWallet.toLowerCase() === address.toLowerCase()
            );
            setMySlots(providerSlots);
          } else {
            setMySlots([]);
          }

          const foundRentals: RentalItem[] = [];
          const todayUtc = new Date().toISOString().split('T')[0];

          allSlots.forEach((s) => {
            if (s.activeRental) {
              foundRentals.push({
                id: s.activeRental.rentalId,
                slotId: s.id,
                modelName: s.modelName,
                modelType: s.modelType,
                renterWallet: s.activeRental.renterWallet,
                providerWallet: s.providerWallet,
                rentalDate: todayUtc,
                status: s.activeRental.status,
                priceUsd: s.finalDailyPriceUsd,
                rentTokenAmount: s.finalDailyPriceRent,
                proxyToken: `rap_live_${s.id.substring(0, 10)}${s.activeRental.rentalId.substring(0, 8)}`,
                usedQuota: s.activeRental.usedQuota,
                dailyQuota: s.dailyQuota,
                unitType: s.unitType,
                expiresAtUtc: s.activeRental.expiresAtUtc,
              });
            }
          });

          if (address) {
            setRentals(foundRentals.filter((r) => r.renterWallet.toLowerCase() === address.toLowerCase()));
          } else {
            setRentals(foundRentals);
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isOpen, address]);

  if (!isOpen) return null;

  const handleCopy = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRelease = async (rentalId: string) => {
    setActionLoading(rentalId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/rentals/${rentalId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('Escrow released successfully! Funds settled to provider.');
        setRentals((prev) =>
          prev.map((r) => (r.id === rentalId ? { ...r, status: 'RELEASED' } : r))
        );
      } else {
        setActionMessage(`Release error: ${data.error || 'Failed'}`);
      }
    } catch {
      setActionMessage('Failed to trigger on-chain release.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async (rentalId: string) => {
    setActionLoading(rentalId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/rentals/${rentalId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Client requested refund' }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('Rental refunded successfully! Funds returned to renter.');
        setRentals((prev) =>
          prev.map((r) => (r.id === rentalId ? { ...r, status: 'REFUNDED' } : r))
        );
      } else {
        setActionMessage(`Refund error: ${data.error || 'Failed'}`);
      }
    } catch {
      setActionMessage('Failed to trigger on-chain refund.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMintFaucet = async () => {
    if (!address) return;
    try {
      setFaucetLoading(true);
      setActionMessage(null);
      const res = await fetch('/api/dev/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: 5000 }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Successfully minted 5,000 $RENT to ${address}!`);
      } else {
        setActionMessage(`Faucet failed: ${data.error || 'Error'}`);
      }
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : 'Faucet request failed');
    } finally {
      setFaucetLoading(false);
    }
  };

  const totalEarnedRent = mySlots.reduce((sum, s) => sum + (s.finalDailyPriceRent || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white border border-[#E5E7EB] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00]">
              <Key className="w-5 h-5 text-[#CDFF00]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#0D1117] tracking-tight">User Dashboard</h2>
              <span className="text-xs text-[#64748B] tracking-tight">
                24H Single-Tenant Isolation • Instant Escrow Settlement
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {address && (
              <button
                onClick={handleMintFaucet}
                disabled={faucetLoading}
                title="Mint 5,000 test $RENT to your wallet on Base Sepolia"
                className="px-3.5 py-1.5 rounded-full bg-[#CDFF00]/10 hover:bg-[#CDFF00]/20 border border-[#CDFF00]/30 text-[#000000] text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {faucetLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#CDFF00]" />
                ) : (
                  <Coins className="w-3.5 h-3.5 text-[#CDFF00]" />
                )}
                <span>Mint 5,000 $RENT</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-[#F8FAFC] border border-[#E5E7EB] text-[#64748B] hover:text-[#0D1117] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Minimal Financial Tab Indicators */}
        <div className="flex border-b border-[#E5E7EB] px-6 bg-white">
          <button
            onClick={() => setActiveTab('rented')}
            className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 tracking-tight cursor-pointer ${
              activeTab === 'rented'
                ? 'border-[#CDFF00] text-[#CDFF00]'
                : 'border-transparent text-[#64748B] hover:text-[#0D1117]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>My Rented APIs ({rentals.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('listed')}
            className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 tracking-tight cursor-pointer ${
              activeTab === 'listed'
                ? 'border-[#CDFF00] text-[#CDFF00]'
                : 'border-transparent text-[#64748B] hover:text-[#0D1117]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>My Listed Slots & Yield ({mySlots.length})</span>
          </button>
        </div>

        {/* Action message banner */}
        {actionMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-xs font-mono flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-[#64748B] hover:text-[#0D1117] cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-[#CDFF00] animate-spin" />
              <span className="text-xs font-mono text-[#64748B]">Loading your data...</span>
            </div>
          ) : activeTab === 'rented' ? (
            /* Tab 1: My Rented APIs */
            <div className="space-y-4">
              {rentals.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-dashed border-[#E5E7EB] p-8 space-y-2 bg-[#F8FAFC]">
                  <p className="text-sm text-[#0D1117] font-semibold">You have no active API rentals.</p>
                  <span className="text-xs text-[#64748B]">
                    Browse the marketplace to rent dedicated compute with 24-hour UTC lock.
                  </span>
                </div>
              ) : (
                rentals.map((item) => {
                  const usedPct = Math.min(100, Math.round((item.usedQuota / item.dailyQuota) * 100));
                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-3xl border border-[#E5E7EB] bg-[#F8FAFC] space-y-4 hover:border-[#CBD5E1] transition-all shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-[#0D1117] text-base tracking-tight">{item.modelName}</h4>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight ${
                                item.status === 'ACTIVE'
                                  ? 'bg-[#CDFF00]/10 text-[#000000] border border-[#CDFF00]/30'
                                  : item.status === 'RELEASED'
                                  ? 'bg-[#CDFF00]/10 text-[#000000] border border-[#CDFF00]/30'
                                  : 'bg-[#FF5000]/10 text-[#FF5000] border border-[#FF5000]/30'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-[#CDFF00]" />
                            <span>UTC Countdown: {timeRemaining}</span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-base font-extrabold text-[#000000]">
                            {formatRentToken(item.rentTokenAmount)}
                          </span>
                          <span className="text-xs text-[#64748B] block">
                            ({formatUsd(item.priceUsd)} / day)
                          </span>
                        </div>
                      </div>

                      {/* One-Click Copy Token */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-mono text-[#64748B]">Active Proxy Bearer Token:</span>
                        <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-[#E5E7EB] font-mono text-xs text-[#0D1117] shadow-sm">
                          <span className="truncate flex-1">{item.proxyToken}</span>
                          <button
                            onClick={() => handleCopy(item.proxyToken, item.id)}
                            className="px-3.5 py-1.5 rounded-full bg-[#CDFF00]/10 hover:bg-[#CDFF00]/20 text-[#000000] font-bold text-xs flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#CDFF00]" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Token</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Quota Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono text-[#64748B]">
                          <span>Quota Consumed:</span>
                          <span className="text-[#0D1117] font-semibold">
                            {formatQuota(item.usedQuota, item.unitType)} / {formatQuota(item.dailyQuota, item.unitType)} ({usedPct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] border border-[#E5E7EB] overflow-hidden">
                          <div
                            className="h-full bg-[#CDFF00] rounded-full transition-all"
                            style={{ width: `${Math.max(4, usedPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Buttons: Release or Refund */}
                      {item.status === 'ACTIVE' && (
                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
                          <button
                            onClick={() => handleRefund(item.id)}
                            disabled={actionLoading === item.id}
                            className="px-4 py-2 rounded-full border border-[#FF5000]/30 text-[#FF5000] hover:bg-[#FF5000]/10 text-xs font-bold tracking-tight transition-colors cursor-pointer"
                          >
                            Request Refund
                          </button>
                          <button
                            onClick={() => handleRelease(item.id)}
                            disabled={actionLoading === item.id}
                            className="px-5 py-2 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black text-xs font-bold tracking-tight transition-colors cursor-pointer shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.3)]"
                          >
                            Release Escrow to Provider
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Tab 2: My Listed Slots & Yield */
            <div className="space-y-6">
              {/* Yield Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-3xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-1 shadow-sm">
                  <span className="text-xs text-[#64748B] tracking-tight">Total Accumulated $RENT Earnings</span>
                  <div className="text-2xl font-extrabold font-mono text-[#CDFF00] flex items-center gap-1.5">
                    <Coins className="w-5 h-5 text-[#CDFF00]" />
                    <span>{formatRentToken(totalEarnedRent)}</span>
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-1 shadow-sm">
                  <span className="text-xs text-[#64748B] tracking-tight">Active Listed API Keys</span>
                  <div className="text-2xl font-extrabold font-mono text-[#0D1117] flex items-center gap-1.5">
                    <Layers className="w-5 h-5 text-[#CDFF00]" />
                    <span>{mySlots.length} Keys Active</span>
                  </div>
                </div>
              </div>

              {/* Slots List */}
              {mySlots.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-dashed border-[#E5E7EB] p-8 space-y-2 bg-[#F8FAFC]">
                  <p className="text-sm text-[#0D1117] font-semibold">You have no listed API keys.</p>
                  <span className="text-xs text-[#64748B]">
                    Click &quot;List an API Key&quot; to monetize your idle daily quota.
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {mySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] flex items-center justify-between gap-4 font-mono text-xs shadow-sm"
                    >
                      <div>
                        <h4 className="font-extrabold text-[#0D1117] text-sm tracking-tight">{slot.modelName}</h4>
                        <span className="text-[#64748B] text-[11px]">
                          Quota: {formatQuota(slot.dailyQuota, slot.unitType)} • Daily Price: {formatUsd(slot.finalDailyPriceUsd)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {slot.isLockedToday ? (
                          <span className="px-3 py-1 rounded-full bg-[#FF5000]/10 border border-[#FF5000]/30 text-[#FF5000] text-[11px] font-bold">
                            Rented Today
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-[11px] font-bold">
                            Available
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
