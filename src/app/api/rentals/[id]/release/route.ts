import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/siwe';
import { publicClient } from '@/lib/web3/config';
import { CONTRACT_ADDRESSES } from '@/lib/constants';
import { triggerOnChainRelease } from '@/lib/web3/escrowActions';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

// Contract owner / platform admin address for automated end-of-day release
const PLATFORM_OWNER_ADDRESS = (
  process.env.OWNER_ADDRESS ||
  process.env.ADMIN_ADDRESS ||
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
).toLowerCase();

export async function POST(request: NextRequest, { params }: RouteContext) {
  let sessionAddress = '';
  try {
    // 1. SIWE Authentication (getSession)
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }
    sessionAddress = session.address.toLowerCase();

    const { id } = params;
    let body: { txHash?: string } = {};
    try {
      body = await request.json();
    } catch {
      // body may be empty
    }

    const rental = await prisma.rental.findUnique({
      where: { id },
      include: {
        slot: {
          include: { provider: true },
        },
      },
    });

    if (!rental) {
      return NextResponse.json(
        { success: false, error: 'Rental record not found.' },
        { status: 404 }
      );
    }

    // 2. Authorization: Verify caller is provider or admin
    const isProvider = rental.slot.provider.walletAddress.toLowerCase() === sessionAddress;
    const isOwner = sessionAddress === PLATFORM_OWNER_ADDRESS;

    if (!isProvider && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only the provider or admin can release escrow funds.' },
        { status: 403 }
      );
    }

    if (rental.status === 'RELEASED' || rental.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'This rental is already released and funds have been transferred.' },
        { status: 400 }
      );
    }

    if (rental.status === 'REFUNDED') {
      return NextResponse.json(
        { success: false, error: 'A refunded rental cannot be released.' },
        { status: 400 }
      );
    }

    // 3. Trigger on-chain release
    let releaseTxHash = body.txHash as `0x${string}` | undefined;

    if (!releaseTxHash && rental.onChainRentalId) {
      const actionRes = await triggerOnChainRelease(rental.onChainRentalId);
      if (!actionRes.success) {
        return NextResponse.json(
          { success: false, error: `On-chain release failed: ${actionRes.error || 'Transaction reverted'}` },
          { status: 500 }
        );
      }
      releaseTxHash = actionRes.txHash;
    } else if (releaseTxHash) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: releaseTxHash });
        if (!receipt || receipt.status !== 'success') {
          return NextResponse.json(
            { success: false, error: 'Provided release transaction could not be verified' },
            { status: 400 }
          );
        }
      } catch (onChainErr) {
        console.error('Release on-chain verification error:', onChainErr);
        return NextResponse.json(
          { success: false, error: 'Transaction could not be verified' },
          { status: 400 }
        );
      }
    }

    // 4. Update status to RELEASED
    const updated = await prisma.rental.update({
      where: { id },
      data: {
        status: 'RELEASED',
        ...(releaseTxHash ? { txHash: releaseTxHash } : {}),
      },
    });

    // 5. Deduct remainingCredit from UsageLog / usedQuota and recalculate suggestedDailyPriceUsd
    const unitsToDeduct = rental.usedQuota > 0 ? rental.usedQuota : rental.slot.dailyQuota;
    const newRemainingCredit = Math.max(0, rental.slot.remainingCredit - unitsToDeduct);

    const { calculateIdleKeyPrice } = await import('@/lib/pricing');
    const newPricing = calculateIdleKeyPrice(
      rental.slot.modelType,
      rental.slot.dailyQuota,
      newRemainingCredit
    );

    await prisma.slot.update({
      where: { id: rental.slot.id },
      data: {
        remainingCredit: newRemainingCredit,
        suggestedDailyPriceUsd: newPricing.suggestedDailyPriceUsd,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Escrow released successfully. 100% RENT transferred to provider.',
      rental: {
        id: updated.id,
        status: updated.status,
        providerWallet: rental.slot.provider.walletAddress,
        rentTokenAmount: updated.rentTokenAmount,
        platformFeeUsd: 0.00,
        providerPayoutRent: updated.rentTokenAmount,
        slotUpdatedCredit: newRemainingCredit,
        newSuggestedPriceUsd: newPricing.suggestedDailyPriceUsd,
        txHash: releaseTxHash || updated.txHash,
      },
    });
  } catch (error: unknown) {
    // Non-production fallback if database is offline
    if (
      process.env.NODE_ENV !== 'production' &&
      error instanceof Error &&
      error.message.includes("Can't reach database server")
    ) {
      const isOwner = sessionAddress === PLATFORM_OWNER_ADDRESS;
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Only the provider or admin can release escrow funds.' },
          { status: 403 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Escrow released successfully (Development Mode Fallback).',
        rental: {
          id: params.id,
          status: 'RELEASED',
          platformFeeUsd: 0.0,
          providerPayoutRent: 690,
          txHash: `0xdev_simulated_release_${Date.now()}`,
        },
      });
    }

    const message = error instanceof Error ? error.message : 'Failed to release escrow payment.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
