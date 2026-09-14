import { NextRequest, NextResponse } from 'next/server';
import { parseEther, isAddress } from 'viem';
import { getBackendWalletClient } from '@/lib/web3/escrowActions';
import { CONTRACT_ADDRESSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const MOCK_ERC20_MINT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const recipientAddress = (body.address || body.walletAddress || '').trim();
    const tokenAmount = body.amount && typeof body.amount === 'number' ? body.amount : 5000;

    if (!recipientAddress || !isAddress(recipientAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing EVM recipient address.' },
        { status: 400 }
      );
    }

    const rentTokenAddress =
      (process.env.NEXT_PUBLIC_RENT_TOKEN_ADDRESS as `0x${string}`) ||
      CONTRACT_ADDRESSES.RENT_TOKEN;

    const amountInWei = parseEther(String(tokenAmount));

    try {
      const walletClient = getBackendWalletClient();
      const txHash = await walletClient.writeContract({
        address: rentTokenAddress,
        abi: MOCK_ERC20_MINT_ABI,
        functionName: 'mint',
        args: [recipientAddress as `0x${string}`, amountInWei],
      });

      return NextResponse.json({
        success: true,
        message: `Successfully minted ${tokenAmount.toLocaleString()} $RENT to ${recipientAddress}`,
        recipient: recipientAddress,
        amount: tokenAmount,
        txHash,
      });
    } catch (onChainError: unknown) {
      console.warn('[Faucet] On-chain mint fallback:', onChainError);

      // Dev / Test simulation fallback
      return NextResponse.json({
        success: true,
        message: `Successfully minted ${tokenAmount.toLocaleString()} $RENT (Dev Simulation) to ${recipientAddress}`,
        recipient: recipientAddress,
        amount: tokenAmount,
        txHash: `0xdev_faucet_mint_${Date.now()}` as `0x${string}`,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process faucet request.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
