export type ModelId =
  | 'claude-sonnet-4'
  | 'claude-haiku-3-5'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o3'
  | 'deepseek-v3'
  | 'gemini-2-5-pro'
  | 'llama-3-3-70b'
  | 'whisper-v3'
  | 'dall-e-3'
  | 'text-embedding-3-large'
  | 'residential-proxy';

export type UnitType = 'TOKEN' | 'MINUTE' | 'IMAGE' | 'REQUEST';
export type RentalStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'RELEASED' | 'REFUNDED';

export interface ModelCatalogEntry {
  id: ModelId;
  name: string;
  provider: 'Anthropic' | 'OpenAI' | 'Google' | 'DeepSeek' | 'Meta / Self-Hosted' | 'Custom P2P';
  category: 'LLM' | 'Reasoning' | 'Audio' | 'Vision' | 'Embedding' | 'Proxy';
  officialCostUsd: number;     // Official provider cost per reference unit
  referenceUnitSize: number;   // 1,000,000 for tokens, 1,000 for requests, 1 for minute/image
  unitType: UnitType;
  defaultDailyQuota: number;
  minQuota: number;
  maxQuota: number;
  quotaStep: number;
  unitLabel: string;           // e.g. "M Tokens", "Minutes", "Images", "Requests"
  description: string;
}

export interface SlotDto {
  id: string;
  providerWallet: string;
  modelType: string;
  modelName: string;
  unitType: UnitType;
  referenceUnit: number;
  officialCostUsd: number;
  dailyQuota: number;
  consumedTokens?: number;
  usedPercentage?: number;
  remainingCredit: number;
  dailyQuotaValueUsd: number;      // (dailyQuota / referenceUnit) * officialCostUsd
  suggestedDailyPriceUsd: number;  // 35% of quota value (or remaining credit value)
  finalDailyPriceUsd: number;
  finalDailyPriceRent: number;     // Converted via Uniswap v4 TWAP
  isLowCredit: boolean;            // remainingCredit < dailyQuota
  discountPercentage: number;      // e.g. 65% cheaper
  creditRemainingPct: number;      // e.g. 100 for 100%, 90 for 90%
  maskedKeySnippet: string;
  isLockedToday: boolean;
  isActive: boolean;
  createdAt: string;
  activeRental?: {
    rentalId: string;
    renterWallet: string;
    status: RentalStatus;
    expiresAtUtc: string;
    usedQuota: number;
  };
}

export type ApiSlot = SlotDto;

export interface PricingCalculation {
  dailyQuotaValueUsd: number;
  remainingCreditValueUsd: number;
  suggestedDailyPriceUsd: number;
  hardCapUsd: number;              // dailyQuotaValueUsd * 0.60
  isLowCredit: boolean;
  discountPercentage: number;      // e.g. 65
  twapRateUsdPerRent: number;
  suggestedDailyPriceRent: number;
}
