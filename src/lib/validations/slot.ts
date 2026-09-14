import { z } from 'zod';
import { MODEL_CATALOG } from '../constants';
import { ModelId } from '../types';

export const evmAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Invalid EVM wallet address. Must be a 42-character 0x-prefixed hex string.',
  })
  .transform((val) => val.toLowerCase());

export const createSlotSchema = z
  .object({
    modelType: z.enum(
      [
        'claude-sonnet-4',
        'claude-haiku-3-5',
        'gpt-4o',
        'gpt-4o-mini',
        'o3',
        'deepseek-v3',
        'gemini-2-5-pro',
        'llama-3-3-70b',
        'whisper-v3',
        'dall-e-3',
        'text-embedding-3-large',
        'residential-proxy',
      ],
      {
        errorMap: () => ({ message: 'Unsupported AI model type.' }),
      }
    ),
    apiKey: z
      .string()
      .trim()
      .min(8, { message: 'API key must be at least 8 characters.' })
      .max(512, { message: 'API key cannot exceed 512 characters.' }),
    dailyQuota: z
      .number()
      .positive({ message: 'Daily quota must be greater than zero.' })
      .optional(),
    remainingCredit: z
      .number()
      .positive({ message: 'Remaining account credit must be greater than zero.' })
      .optional(),
    customPriceUsd: z.number().positive().optional(),
    providerWallet: evmAddressSchema.optional(),
  })
  .refine(
    (data) => {
      const model = MODEL_CATALOG[data.modelType as ModelId];
      if (!model) return true;
      const quota = data.dailyQuota ?? model.defaultDailyQuota;
      const officialValue = (quota / model.referenceUnitSize) * model.officialCostUsd;
      const hardCap = officialValue * 0.60;

      if (data.customPriceUsd && data.customPriceUsd > hardCap) {
        return false;
      }
      return true;
    },
    {
      message: 'Custom rental price cannot exceed the 60% hard cap of official API value.',
      path: ['customPriceUsd'],
    }
  );

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
