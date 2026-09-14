import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { robinhoodChain, ESCROW_CONTRACT_ADDRESS, publicClient } from './config';
import { API_ESCROW_ABI } from './abi';

// Default local dev signer key if not configured in environment
const DEFAULT_DEV_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`;

/**
 * Creates and returns an authenticated Viem WalletClient using the backend signer key.
 */
export function getBackendWalletClient() {
  const rawKey =
    process.env.BACKEND_SIGNER_PRIVATE_KEY ||
    process.env.SIGNER_PRIVATE_KEY ||
    DEFAULT_DEV_PRIVATE_KEY;

  const formattedKey: `0x${string}` = rawKey.startsWith('0x')
    ? (rawKey as `0x${string}`)
    : (`0x${rawKey}` as `0x${string}`);

  const account = privateKeyToAccount(formattedKey);

  return createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'),
  }).extend(publicActions);
}

export interface EscrowActionResult {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
}

/**
 * Triggers on-chain release of escrow funds to provider using the backend signer key.
 *
 * @param rentalId - On-chain rental ID (uint256)
 */
export async function triggerOnChainRelease(
  rentalId: number | bigint
): Promise<EscrowActionResult> {
  try {
    const walletClient = getBackendWalletClient();
    const formattedRentalId = BigInt(rentalId);

    const txHash = await walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: API_ESCROW_ABI,
      functionName: 'releaseFunds',
      args: [formattedRentalId],
    });

    // Wait for settlement confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      return {
        success: false,
        txHash,
        error: 'On-chain release transaction reverted.',
      };
    }

    return {
      success: true,
      txHash,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown on-chain error';
    console.error(`[triggerOnChainRelease] Failed for rentalId ${rentalId}:`, message);

    // In dev / test offline mode, allow graceful simulated fallback if RPC is unreachable
    if (
      process.env.NODE_ENV !== 'production' &&
      (message.includes('fetch failed') ||
        message.includes('Could not connect') ||
        message.includes('ECONNREFUSED'))
    ) {
      console.warn('[triggerOnChainRelease] Development simulation fallback used.');
      return {
        success: true,
        txHash: `0xdev_simulated_release_${rentalId}_${Date.now()}` as `0x${string}`,
      };
    }

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Triggers on-chain refund of escrow funds back to renter using the backend signer key.
 *
 * @param rentalId - On-chain rental ID (uint256)
 */
export async function triggerOnChainRefund(
  rentalId: number | bigint
): Promise<EscrowActionResult> {
  try {
    const walletClient = getBackendWalletClient();
    const formattedRentalId = BigInt(rentalId);

    const txHash = await walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: API_ESCROW_ABI,
      functionName: 'refundRental',
      args: [formattedRentalId],
    });

    // Wait for settlement confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      return {
        success: false,
        txHash,
        error: 'On-chain refund transaction reverted.',
      };
    }

    return {
      success: true,
      txHash,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown on-chain error';
    console.error(`[triggerOnChainRefund] Failed for rentalId ${rentalId}:`, message);

    // In dev / test offline mode, allow graceful simulated fallback if RPC is unreachable
    if (
      process.env.NODE_ENV !== 'production' &&
      (message.includes('fetch failed') ||
        message.includes('Could not connect') ||
        message.includes('ECONNREFUSED'))
    ) {
      console.warn('[triggerOnChainRefund] Development simulation fallback used.');
      return {
        success: true,
        txHash: `0xdev_simulated_refund_${rentalId}_${Date.now()}` as `0x${string}`,
      };
    }

    return {
      success: false,
      error: message,
    };
  }
}
