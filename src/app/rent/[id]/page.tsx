'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useReadContract, useConfig } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { parseEther } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Navbar } from '@/components/Navbar';
import { SlotDto } from '@/lib/types';
import { formatQuota, formatUsd, formatRentToken } from '@/lib/pricing';
import { maskWallet } from '@/lib/crypto';
import { CONTRACT_ADDRESSES } from '@/lib/constants';
import { RENT_TOKEN_ABI, API_ESCROW_ABI } from '@/lib/web3/abi';
import {
  Lock,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Terminal,
  Key,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import Link from 'next/link';

export default function RentSlotPage() {
  const params = useParams();
  const router = useRouter();
  const slotId = params?.id as string;

  const { address, isConnected } = useAccount();

  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [proxyToken, setProxyToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'IDLE' | 'CONFIRMING' | 'SUCCESS'>('IDLE');
  const [confirmStatus, setConfirmStatus] = useState<string>('Waiting for confirmation...');
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.RENT_TOKEN,
    abi: RENT_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.API_ESCROW] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  const todayUtc = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function loadSlot() {
      try {
        setLoading(true);
        const res = await fetch('/api/slots');
        const data = await res.json();
        if (data.success && Array.isArray(data.slots)) {
          const found = data.slots.find((s: SlotDto) => s.id === slotId);
          if (found) {
            setSlot(found);
          } else {
            setError('Requested slot not found.');
          }
        } else {
          setError('Failed to load slots.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Network error.');
      } finally {
        setLoading(false);
      }
    }

    if (slotId) {
      loadSlot();
    }
  }, [slotId]);

  const handleCopyToken = () => {
    if (!proxyToken) return;
    navigator.clipboard.writeText(proxyToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMintFaucet = async () => {
    if (!address) return;
    try {
      setFaucetLoading(true);
      setFaucetMsg(null);
      const res = await fetch('/api/dev/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: 5000 }),
      });
      const data = await res.json();
      if (data.success) {
        setFaucetMsg('Minted 5,000 $RENT!');
        await refetchAllowance();
        setTimeout(() => setFaucetMsg(null), 4000);
      } else {
        setError(data.error || 'Faucet request failed.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Faucet request failed.');
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleStartRental = async () => {
    if (!isConnected || !address || !slot) return;
    setError(null);
    setStep('CONFIRMING');

    try {
      const rentTokenAmount = parseEther(slot.finalDailyPriceRent.toString());
      const needsApproval = !allowance || allowance < rentTokenAmount;

      // 1. Check allowance and auto-prompt approve if needed
      if (needsApproval) {
        setConfirmStatus('Approving $RENT token spend in wallet...');
        const approveTxHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.RENT_TOKEN,
          abi: RENT_TOKEN_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.API_ESCROW, rentTokenAmount],
        });

        await waitForTransactionReceipt(config, { hash: approveTxHash });
        await refetchAllowance();
      }

      // 2. Lock funds in ApiEscrow via createRental(slotId, provider, amount, duration)
      setConfirmStatus('Locking funds in ApiEscrow contract...');
      const rentTxHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.API_ESCROW,
        abi: API_ESCROW_ABI,
        functionName: 'createRental',
        args: [
          slot.id,
          slot.providerWallet as `0x${string}`,
          rentTokenAmount,
          BigInt(86400), // 24-hour rental duration
        ],
      });

      // 3. Wait for transaction receipt confirmation
      setConfirmStatus('Confirming on-chain transaction receipt...');
      await waitForTransactionReceipt(config, { hash: rentTxHash });

      // 4. Send txHash to POST /api/rent to record active rental
      setConfirmStatus('Activating proxy token session...');
      const res = await fetch('/api/rent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.id,
          rentalDate: todayUtc,
          renterWallet: address,
          txHash: rentTxHash,
        }),
      });

      const data = await res.json();
      if (data.success && data.rental?.proxyToken) {
        // 5. Display active proxyToken upon successful lock
        setProxyToken(data.rental.proxyToken);
        setStep('SUCCESS');
      } else {
        setStep('IDLE');
        setError(data.error || 'Rental confirmation failed.');
      }
    } catch (err: unknown) {
      setStep('IDLE');
      const msg = err instanceof Error ? err.message : 'Transaction failed.';
      if (msg.includes('User rejected') || msg.includes('User denied')) {
        setError('Transaction cancelled by user in wallet.');
      } else {
        setError(msg);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white text-[#0D1117] font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#CDFF00] animate-spin" />
          <span className="text-xs text-[#64748B] font-mono">Loading slot details...</span>
        </div>
      </div>
    );
  }

  if (error || !slot) {
    return (
      <div className="min-h-screen flex flex-col bg-white text-[#0D1117] font-sans">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="p-8 rounded-3xl bg-[#F8FAFC] border border-[#E5E7EB] text-[#0D1117] space-y-3 shadow-sm">
            <AlertCircle className="w-8 h-8 mx-auto text-[#FF5000]" />
            <h2 className="text-lg font-bold">Slot Not Found</h2>
            <p className="text-xs text-[#64748B]">{error}</p>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-[#CDFF00] text-xs font-semibold hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0D1117] font-sans selection:bg-[#CDFF00]/20 selection:text-[#CDFF00]">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#CDFF00] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </Link>

        {/* Title Header */}
        <div className="border-b border-[#E5E7EB] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0D1117] tracking-tight">
                Rent {slot.modelName}
              </h1>
              {slot.isLockedToday ? (
                <span className="px-3 py-1 rounded-full bg-[#FF5000]/10 border border-[#FF5000]/30 text-[#FF5000] text-xs font-bold font-mono">
                  Locked
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-xs font-bold font-mono">
                  Available
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Provider: <span className="font-mono text-[#0D1117]">{maskWallet(slot.providerWallet)}</span> • 00:00:00 - 23:59:59 UTC Single Lock
            </p>
          </div>

          <div className="text-right font-mono">
            <div className="text-2xl font-extrabold text-[#0D1117]">{formatUsd(slot.finalDailyPriceUsd)}</div>
            <div className="text-xs text-[#000000] font-bold">
              ≈ {formatRentToken(slot.finalDailyPriceRent)}
            </div>
          </div>
        </div>

        {/* Success Modal / Token Banner */}
        {step === 'SUCCESS' && proxyToken ? (
          <div className="p-8 rounded-3xl border border-[#CDFF00]/40 bg-[#F8FAFC] space-y-6 shadow-xl">
            <div className="flex items-center gap-3 text-[#CDFF00]">
              <CheckCircle2 className="w-8 h-8 text-[#CDFF00]" />
              <div>
                <h2 className="text-xl font-bold text-[#0D1117]">Rental Confirmed! Slot Locked</h2>
                <p className="text-xs text-[#64748B]">
                  Your dedicated reverse proxy token is ready for today's UTC calendar day.
                </p>
              </div>
            </div>

            {/* Token Card */}
            <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] space-y-2 font-mono shadow-sm">
              <span className="text-[11px] text-[#64748B] block uppercase tracking-wider">
                Dedicated Proxy Token (rap_live_...)
              </span>
              <div className="flex items-center justify-between gap-3 bg-[#F8FAFC] px-4 py-3 rounded-full border border-[#E5E7EB]">
                <span className="text-xs sm:text-sm text-[#000000] break-all select-all font-bold">
                  {proxyToken}
                </span>
                <button
                  onClick={handleCopyToken}
                  className="px-3.5 py-1.5 rounded-full bg-[#CDFF00]/10 hover:bg-[#CDFF00]/20 text-[#000000] text-xs font-bold flex items-center gap-1.5 transition-colors flex-shrink-0 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Quick Test Code Snippet */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#0D1117] flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#CDFF00]" />
                Call via Fastify Reverse Proxy:
              </span>
              <pre className="p-4 rounded-2xl bg-[#0D1117] border border-[#1F242C] text-[11px] text-[#CDFF00] overflow-x-auto font-mono">
{`curl -X POST http://localhost:4000/v1/chat/completions \\
  -H "Authorization: Bearer ${proxyToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${slot.modelType}",
    "messages": [{"role": "user", "content": "Hello Rent-A-API!"}]
  }'`}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#64748B]">
                Monitor live quota and response logs in your dashboard.
              </span>
              <Link
                href="/dashboard"
                className="px-6 py-3 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] text-black font-bold text-xs transition-colors shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.3)]"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Slot Specs */}
            <div className="md:col-span-2 space-y-6">
              <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Rental Parameters
                </h3>

                {/* Price Display */}
                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#64748B]">Daily Rental Price:</span>
                  <div className="text-right">
                    <span className="text-[#0D1117] font-bold text-base">{formatUsd(slot.finalDailyPriceUsd)}</span>
                    <span className="text-[#64748B] text-xs ml-1">/ day</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2">
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB]">
                    <span className="text-[#64748B] block text-[11px]">Daily Quota</span>
                    <span className="text-[#0D1117] font-bold text-sm mt-1 block">
                      {formatQuota(slot.dailyQuota, slot.unitType)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB]">
                    <span className="text-[#64748B] block text-[11px]">Lock Expiration</span>
                    <span className="text-[#000000] font-bold text-sm mt-1 block">
                      23:59:59 UTC
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB]">
                    <span className="text-[#64748B] block text-[11px]">Settlement Token</span>
                    <span className="text-[#0D1117] font-bold text-sm mt-1 block">
                      $RENT (ERC-20)
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB]">
                    <span className="text-[#64748B] block text-[11px]">Credit Remaining</span>
                    <span className="text-[#000000] font-bold text-sm mt-1 block">
                      ≈{slot.creditRemainingPct ?? 100}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] text-xs text-[#64748B] flex items-start gap-3 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-[#CDFF00] flex-shrink-0 mt-0.5" />
                <p>
                  Escrow Guarantee: Payment is held in smart contract escrow until API verification. Keys are never shared directly.
                </p>
              </div>
            </div>

            {/* Checkout Panel */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 space-y-5 sticky top-28 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Payment Summary
                </h3>

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Rent Price (USD):</span>
                    <span className="text-[#0D1117]">{formatUsd(slot.finalDailyPriceUsd)}</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>TWAP Benchmark:</span>
                    <span className="text-[#0D1117]">$0.05 / RENT</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#000000] border-t border-[#E5E7EB] pt-2.5">
                    <span>Total in RENT:</span>
                    <span>{formatRentToken(slot.finalDailyPriceRent)}</span>
                  </div>
                </div>

                {isConnected && (
                  <div className="p-3.5 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/20 text-xs flex items-center justify-between font-mono">
                    <div className="flex items-center gap-1.5 text-[#000000]">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Testnet Faucet</span>
                    </div>
                    <button
                      onClick={handleMintFaucet}
                      disabled={faucetLoading}
                      className="px-3 py-1 rounded-full bg-[#CDFF00]/20 hover:bg-[#CDFF00]/30 text-[#000000] border border-[#CDFF00]/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {faucetLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      <span>{faucetMsg ? faucetMsg : 'Mint 5,000 $RENT'}</span>
                    </button>
                  </div>
                )}

                {!isConnected ? (
                  <div className="space-y-3 text-center">
                    <p className="text-xs text-[#64748B]">Connect your wallet to proceed with rental:</p>
                    <div className="flex justify-center rk-connect-container [&_button]:!rounded-full">
                      <ConnectButton />
                    </div>
                  </div>
                ) : slot.isLockedToday ? (
                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] text-[#FF5000] text-xs text-center space-y-2">
                    <Lock className="w-5 h-5 mx-auto text-[#FF5000]" />
                    <span className="block font-bold">This Slot is Locked for Today</span>
                    <span className="block text-[11px] text-[#64748B]">
                      Unlocks at 00:00:00 UTC tomorrow.
                    </span>
                  </div>
                ) : (
                  <>
                    {step === 'CONFIRMING' && (
                      <div className="p-3.5 rounded-2xl bg-[#CDFF00]/10 border border-[#CDFF00]/30 text-[#000000] text-xs flex items-center justify-center gap-2.5 font-mono text-center">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-[#CDFF00]" />
                        <span>{confirmStatus}</span>
                      </div>
                    )}
                    <button
                      onClick={handleStartRental}
                      disabled={step !== 'IDLE'}
                      className="w-full py-3.5 rounded-full bg-[#CDFF00] hover:bg-[#BCE600] disabled:opacity-50 text-black font-bold text-xs sm:text-sm tracking-tight transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_-3px_rgba(205, 255, 0,0.4)]"
                    >
                      {step === 'CONFIRMING' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-black" />
                          <span>Processing Transaction...</span>
                        </>
                      ) : (
                        <>
                          <Key className="w-4 h-4 text-black" />
                          <span>
                            {!allowance || allowance < parseEther(slot.finalDailyPriceRent.toString())
                              ? 'Approve $RENT & Rent'
                              : 'RENT'}
                          </span>
                        </>
                      )}
                    </button>
                    {!allowance || allowance < parseEther(slot.finalDailyPriceRent.toString()) ? (
                      <p className="text-[11px] text-center text-[#64748B]">
                        Auto-prompts $RENT approval on first rental.
                      </p>
                    ) : null}
                  </>
                )}

                {error && (
                  <div className="p-3 rounded-2xl bg-[#FF5000]/10 border border-[#FF5000]/30 text-[#FF5000] text-xs">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
