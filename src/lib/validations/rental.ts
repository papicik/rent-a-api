import { z } from 'zod';
import { evmAddressSchema } from './slot';

// Regex for UTC Day YYYY-MM-DD
const utcDateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const rentSlotSchema = z.object({
  slotId: z.string().trim().min(1, { message: 'slotId is required.' }),
  rentalDate: z
    .string()
    .trim()
    .regex(utcDateRegex, { message: 'Invalid UTC date format. Must be YYYY-MM-DD.' })
    .optional()
    .default(() => new Date().toISOString().split('T')[0]),
  renterWallet: evmAddressSchema.optional(),
  txHash: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid transaction hash format (txHash).' }),
});

export const rentalIdParamSchema = z.object({
  id: z.string().trim().min(1, { message: 'Rental ID parameter is required.' }),
});

export const rentalReleaseSchema = z.object({
  reason: z.string().trim().optional(),
});

export const rentalRefundSchema = z.object({
  reason: z.string().trim().min(3, { message: 'Refund reason must be at least 3 characters.' }),
});

export type RentSlotInput = z.infer<typeof rentSlotSchema>;
