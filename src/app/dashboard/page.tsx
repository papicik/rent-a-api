'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useConfig } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { CONTRACT_ADDRESSES } from '@/lib/constants';
import { MARKETPLACE_ABI, API_ESCROW_ABI } from '@/lib/web3/abi';
import { Navbar } from '@/components/Navbar';
import { SlotDto, UnitType, RentalStatus } from '@/lib/types';
import { formatQuota, formatUsd, formatRentToken } from '@/lib/pricing';
import { maskWallet } from '@/lib/crypto';
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Loader2,
  PlusCircle,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

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
  unitType: UnitType;
  expiresAtUtc: string;
}

export default function DashboardPage() {
  const { address } = useAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  const [activeTab, setActiveTab] = useState<'rentals' | 'slots'>('rentals');

  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [mySlots, setMySlots] = useState<SlotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const todayUtc = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/slots');
      const data = await res.json();

      if (data.success && Array.isArray(data.slots)) {
        const allSlots: SlotDto[] = data.slots;

        const foundRentals: RentalItem[] = [];
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
              proxyToken: `rap_live_${s.id.substring(0, 10)}...`,
              usedQuota: s.activeRental.usedQuota,
              dailyQuota: s.dailyQuota,
              unitType: s.unitType,
              expiresAtUtc: s.activeRental.expiresAtUtc,
            });
          }
        });

        setRentals(
          address
            ? foundRentals.filter((r) => r.renterWallet.toLowerCase() === address.toLowerCase())
            : foundRentals
        );

        setMySlots(
          address
            ? allSlots.filter((s) => s.providerWallet.toLowerCase() === address.toLowerCase())
            : allSlots.slice(0, 2)
        );
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [address]);

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRelease = async (rentalId: string) => {
    try {
      setActionLoading(rentalId);

      // 1. Fetch rental details to get onChainRentalId
      let onChainRentalId: string | null = null;
      try {
        const detailRes = await fetch(`/api/rentals/${rentalId}`);
        const detailData = await detailRes.json();
        onChainRentalId = detailData?.rental?.onChainRentalId || null;
      } catch {
        // fallback
      }

      let txHash: string | undefined;

      // 2. Call contract releaseFunds(rentalId) or release(rentalId) before DB status change
      if (onChainRentalId) {
        if (!onChainRentalId.startsWith('0x')) {
          txHash = await writeContractAsync({
            address: CONTRACT_ADDRESSES.API_ESCROW,
            abi: API_ESCROW_ABI,
            functionName: 'releaseFunds',
            args: [BigInt(onChainRentalId)],
          });
        } else {
          txHash = await writeContractAsync({
            address: CONTRACT_ADDRESSES.MARKETPLACE,
            abi: MARKETPLACE_ABI,
            functionName: 'release',
            args: [onChainRentalId as `0x${string}`],
          });
        }

        await waitForTransactionReceipt(config, { hash: txHash as `0x${string}` });
      }

      // 3. Confirm to backend
      const res = await fetch(`/api/rentals/${rentalId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch (err: unknown) {
      console.error('Release failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async (rentalId: string) => {
    try {
      setActionLoading(rentalId);

      let onChainRentalId: string | null = null;
      try {
        const detailRes = await fetch(`/api/rentals/${rentalId}`);
        const detailData = await detailRes.json();
        onChainRentalId = detailData?.rental?.onChainRentalId || null;
      } catch {
        // fallback
      }

      let txHash: string | undefined;

      if (onChainRentalId) {
        if (!onChainRentalId.startsWith('0x')) {
          txHash = await writeContractAsync({
            address: CONTRACT_ADDRESSES.API_ESCROW,
            abi: API_ESCROW_ABI,
            functionName: 'refundRental',
            args: [BigInt(onChainRentalId)],
          });
        } else {
          txHash = await writeContractAsync({
            address: CONTRACT_ADDRESSES.MARKETPLACE,
            abi: MARKETPLACE_ABI,
            functionName: 'refund',
            args: [onChainRentalId as `0x${string}`],
          });
        }

        await waitForTransactionReceipt(config, { hash: txHash as `0x${string}` });
      }

      // 3. Confirm to backend
      const res = await fetch(`/api/rentals/${rentalId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          reason: 'API key failed to deliver requested units.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch (err: unknown) {
      console.error('Refund failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const totalEarnedUsd = mySlots.reduce(
    (acc, slot) => acc + (slot.isLockedToday ? slot.finalDailyPriceUsd : 0),
    0
  );
  const totalEarnedRent = mySlots.reduce(
    (acc, slot) => acc + (slot.isLockedToday ? slot.finalDailyPriceRent : 0),
    0
  );

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0D1117] font-sans selection:bg-[#CDFF00]/20 selection:text-[#CDFF00]">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-[#0D1117] tracking-tight">
              Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Wallet: <span className="font-mono text-[#000000]">{address ? maskWallet(address) : 'Not Connected'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('rentals')}
              className={`px-5 py-2 rounded-full text-xs font-bold tracking-tight transition-all cursor-pointer ${
                activeTab === 'rentals'
                  ? 'bg-[#CDFF00]/15 text-[#000000] border border-[#CDFF00]/30'
                  : 'bg-white border border-[#E5E7EB] text-[#64748B] hover:text-[#0D1117] shadow-sm'
              }`}
            >
              My Rentals ({rentals.length})
            </button>

            <button
              onClick={() => setActiveTab('slots')}
              className={`px-5 py-2 rounded-full text-xs font-bold tracking-tight transition-all cursor-pointer ${
                activeTab === 'slots'
                  ? 'bg-[#CDFF00]/15 text-[#000000] border border-[#CDFF00]/30'
                  : 'bg-white border border-[#E5E7EB] text-[#64748B] hover:text-[#0D1117] shadow-sm'
              }`}
            >
              My Slots ({mySlots.length})
            </button>
          </div>
        </div>

        {/* Tab 1: My Rentals */}
        {activeTab === 'rentals' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0D1117] flex items-center gap-2 font-mono">
                <Key className="w-4 h-4 text-[#CDFF00]" />
                <span>Active & Past Rentals</span>
              </h2>
              <button
                onClick={loadData}
                className="text-xs font-mono text-[#64748B] hover:text-[#CDFF00] flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="w-8 h-8 text-[#CDFF00] animate-spin" />
              </div>
            ) : rentals.length === 0 ? (
              <div className="text-center py-20 rounded-3xl border border-dashed border-[#E5E7EB] p-8 space-y-4 bg-[#F8FAFC]">
                <p className="text-[#64748B] text-sm">You have no active rentals for today.</p>
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black text-xs font-bold transition-all shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.3)] cursor-pointer"
                >
                  Find a Slot
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {rentals.map((item) => (
                  <div
                    key={item.id}
                    className="p-6 rounded-3xl border border-[#E5E7EB] bg-white space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
                      <div>
                        <h3 className="text-base font-bold text-[#0D1117] tracking-tight">{item.modelName}</h3>
                        <span className="text-xs font-mono text-[#64748B]">
                          Date: {item.rentalDate} • Expires: 23:59:59 UTC
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                            item.status === 'COMPLETED'
                              ? 'bg-[#CDFF00]/10 text-[#000000] border border-[#CDFF00]/30'
                              : item.status === 'REFUNDED'
                              ? 'bg-[#FF5000]/10 text-[#FF5000] border border-[#FF5000]/30'
                              : 'bg-[#CDFF00]/10 text-[#000000] border border-[#CDFF00]/30'
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#000000]">
                          {formatRentToken(item.rentTokenAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Proxy Token */}
                    <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-between gap-3 font-mono text-xs shadow-sm">
                      <div className="truncate">
                        <span className="text-[#64748B] text-[10px] block">PROXY TOKEN</span>
                        <span className="text-[#000000] font-bold">{item.proxyToken}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(item.proxyToken)}
                        className="px-3.5 py-1.5 rounded-full bg-[#CDFF00]/10 hover:bg-[#CDFF00]/20 text-[#000000] text-xs font-bold flex items-center gap-1.5 transition-colors flex-shrink-0 cursor-pointer"
                      >
                        {copiedToken === item.proxyToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedToken === item.proxyToken ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Quota Progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#64748B]">Used Quota:</span>
                        <span className="text-[#0D1117]">
                          {formatQuota(item.usedQuota, item.unitType)} / {formatQuota(item.dailyQuota, item.unitType)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden border border-[#E5E7EB]">
                        <div
                          className="h-full bg-[#CDFF00] rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.round((item.usedQuota / item.dailyQuota) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Sample Curl Snippet */}
                    <div className="p-3 rounded-2xl bg-[#0D1117] border border-[#1F242C] space-y-1">
                      <span className="text-[11px] font-mono text-[#CDFF00] flex items-center gap-1">
                        <Terminal className="w-3 h-3 text-[#CDFF00]" />
                        Sample cURL Call:
                      </span>
                      <code className="text-[11px] font-mono text-[#E5E7EB] block truncate">
                        {`curl -X POST http://localhost:4000/v1/chat/completions -H "Authorization: Bearer ${item.proxyToken}"`}
                      </code>
                    </div>

                    {/* Actions */}
                    {item.status === 'ACTIVE' || item.status === 'PENDING' ? (
                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          onClick={() => handleRefund(item.id)}
                          disabled={actionLoading === item.id}
                          className="px-4 py-2 rounded-full border border-[#FF5000]/30 text-[#FF5000] hover:bg-[#FF5000]/10 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Request Refund
                        </button>
                        <button
                          onClick={() => handleRelease(item.id)}
                          disabled={actionLoading === item.id}
                          className="px-5 py-2 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black text-xs font-bold transition-colors cursor-pointer shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.3)]"
                        >
                          Release Escrow to Provider
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Slots */}
        {activeTab === 'slots' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-white border border-[#E5E7EB] space-y-1 shadow-sm">
                <span className="text-xs text-[#64748B] block font-medium">Total RENT Earned</span>
                <span className="text-2xl font-bold font-mono text-[#CDFF00]">
                  {formatRentToken(totalEarnedRent)}
                </span>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-[#E5E7EB] space-y-1 shadow-sm">
                <span className="text-xs text-[#64748B] block font-medium">USD Equivalent</span>
                <span className="text-2xl font-bold font-mono text-[#0D1117]">
                  {formatUsd(totalEarnedUsd)}
                </span>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-[#E5E7EB] space-y-1 shadow-sm">
                <span className="text-xs text-[#64748B] block font-medium">Active Listed Slots</span>
                <span className="text-2xl font-bold font-mono text-[#0D1117]">
                  {mySlots.length} Slots
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0D1117] flex items-center gap-2 font-mono">
                <Layers className="w-4 h-4 text-[#CDFF00]" />
                <span>My Listed Slots</span>
              </h2>
              <Link
                href="/list"
                className="px-4 py-2 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.3)] cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ List New Slot</span>
              </Link>
            </div>

            {mySlots.length === 0 ? (
              <div className="text-center py-20 rounded-3xl border border-dashed border-[#E5E7EB] p-8 space-y-4 bg-[#F8FAFC]">
                <p className="text-[#64748B] text-sm">You haven't listed any API slots yet.</p>
                <Link
                  href="/list"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black text-xs font-bold transition-all shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.3)] cursor-pointer"
                >
                  List Your First Key
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {mySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-5 rounded-3xl border border-[#E5E7EB] bg-white space-y-3 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-[#0D1117] text-sm tracking-tight">{slot.modelName}</h4>
                        <span className="text-[11px] font-mono text-[#64748B]">
                          {slot.maskedKeySnippet}
                        </span>
                      </div>
                      {slot.isLockedToday ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#FF5000]/10 text-[#FF5000] border border-[#FF5000]/30 font-bold">
                          Locked
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#CDFF00]/10 text-[#000000] border border-[#CDFF00]/30 font-bold">
                          Available
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-mono space-y-1 text-[#0D1117] border-t border-[#E5E7EB] pt-2">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Remaining Credit:</span>
                        <span className="text-[#CDFF00] font-bold">
                          {formatQuota(slot.remainingCredit, slot.unitType)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Daily Rent:</span>
                        <span>{formatUsd(slot.finalDailyPriceUsd)}</span>
                      </div>
                      <div className="flex justify-between text-[#000000] font-bold">
                        <span>RENT Value:</span>
                        <span>{formatRentToken(slot.finalDailyPriceRent)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
