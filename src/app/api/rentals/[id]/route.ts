import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publicClient } from '@/lib/web3/config';
import { MARKETPLACE_ABI, API_ESCROW_ABI } from '@/lib/web3/abi';
import { parseEventLogs } from 'viem';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = params;

    const rental = await prisma.rental.findUnique({
      where: { id },
      include: {
        slot: {
          include: { provider: true },
        },
        usageLogs: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
      },
    });

    if (!rental) {
      return NextResponse.json(
        { success: false, error: 'Rental record not found.' },
        { status: 404 }
      );
    }

    let onChainRentalId: string | null = null;
    if (rental.txHash && rental.txHash.startsWith('0x')) {
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: rental.txHash as `0x${string}`,
        });
        if (receipt) {
          const escrowLogs = parseEventLogs({
            abi: API_ESCROW_ABI,
            eventName: 'RentalCreated',
            logs: receipt.logs,
          });
          if (escrowLogs.length > 0 && escrowLogs[0].args.rentalId !== undefined) {
            onChainRentalId = escrowLogs[0].args.rentalId.toString();
          } else {
            const marketplaceLogs = parseEventLogs({
              abi: MARKETPLACE_ABI,
              eventName: 'Rented',
              logs: receipt.logs,
            });
            if (marketplaceLogs.length > 0 && marketplaceLogs[0].args.rentalId) {
              onChainRentalId = marketplaceLogs[0].args.rentalId;
            }
          }
        }
      } catch {
        // Non-fatal if RPC is not reachable
      }
    }

    const expiresAtUtc = `${rental.rentalDate}T23:59:59.999Z`;
    const isExpired = new Date().getTime() > new Date(expiresAtUtc).getTime();

    return NextResponse.json({
      success: true,
      rental: {
        id: rental.id,
        slotId: rental.slot.id,
        modelName: rental.slot.modelName,
        modelType: rental.slot.modelType,
        renterWallet: rental.renterWallet,
        providerWallet: rental.slot.provider.walletAddress,
        rentalDate: rental.rentalDate,
        status: rental.status,
        priceUsd: rental.priceUsd,
        rentTokenAmount: rental.rentTokenAmount,
        proxyToken: rental.proxyToken,
        txHash: rental.txHash,
        onChainRentalId,
        usedQuota: rental.usedQuota,
        totalQuota: rental.slot.dailyQuota,
        remainingQuota: Math.max(0, rental.slot.dailyQuota - rental.usedQuota),
        unitType: rental.slot.unitType,
        expiresAtUtc,
        isExpired,
        createdAt: rental.createdAt.toISOString(),
        recentUsage: rental.usageLogs.map((log) => ({
          timestamp: log.timestamp.toISOString(),
          requestCount: log.requestCount,
          tokenCount: log.tokenCount,
        })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve rental details.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
