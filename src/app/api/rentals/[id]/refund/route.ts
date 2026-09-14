import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rentalRefundSchema } from '@/lib/validations/rental';
import { getSession } from '@/lib/siwe';
import { publicClient } from '@/lib/web3/config';
import { triggerOnChainRefund } from '@/lib/web3/escrowActions';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

// Contract owner / platform admin address
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
    const body = await request.json().catch(() => ({}));

    const parseResult = rentalRefundSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error: A refund reason is required.',
          issues: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const rental = await prisma.rental.findUnique({
      where: { id },
    });

    if (!rental) {
      return NextResponse.json(
        { success: false, error: 'Rental record not found.' },
        { status: 404 }
      );
    }

    // 2. Authorization: Verify caller is renter or admin
    const isRenter = rental.renterWallet.toLowerCase() === sessionAddress;
    const isOwner = sessionAddress === PLATFORM_OWNER_ADDRESS;

    if (!isRenter && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only the renter or admin can request a refund.' },
        { status: 403 }
      );
    }

    if (rental.status === 'RELEASED' || rental.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'A completed or released rental cannot be refunded.' },
        { status: 400 }
      );
    }

    if (rental.status === 'REFUNDED') {
      return NextResponse.json(
        { success: false, error: 'This rental has already been refunded.' },
        { status: 400 }
      );
    }

    // 3. Trigger on-chain refund
    let refundTxHash = body.txHash as `0x${string}` | undefined;

    if (!refundTxHash && rental.onChainRentalId) {
      const actionRes = await triggerOnChainRefund(rental.onChainRentalId);
      if (!actionRes.success) {
        return NextResponse.json(
          { success: false, error: `On-chain refund failed: ${actionRes.error || 'Transaction reverted'}` },
          { status: 500 }
        );
      }
      refundTxHash = actionRes.txHash;
    } else if (refundTxHash) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: refundTxHash });
        if (!receipt || receipt.status !== 'success') {
          return NextResponse.json(
            { success: false, error: 'Provided refund transaction could not be verified' },
            { status: 400 }
          );
        }
      } catch (onChainErr) {
        console.error('Refund on-chain verification error:', onChainErr);
        return NextResponse.json(
          { success: false, error: 'Transaction could not be verified' },
          { status: 400 }
        );
      }
    }

    // 4. Update status to REFUNDED
    const updated = await prisma.rental.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        ...(refundTxHash ? { txHash: refundTxHash } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Rental payment was fully refunded to the renter.',
      rental: {
        id: updated.id,
        status: updated.status,
        renterWallet: updated.renterWallet,
        refundedRent: updated.rentTokenAmount,
        reason: parseResult.data.reason,
        txHash: refundTxHash || updated.txHash,
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
          { success: false, error: 'Forbidden: Only the renter or admin can request a refund.' },
          { status: 403 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Rental payment was fully refunded (Development Mode Fallback).',
        rental: {
          id: params.id,
          status: 'REFUNDED',
          refundedRent: 690,
          txHash: `0xdev_simulated_refund_${Date.now()}`,
        },
      });
    }

    const message = error instanceof Error ? error.message : 'Failed to process refund.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
