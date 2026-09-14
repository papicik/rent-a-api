import { MODEL_CATALOG, PLATFORM_COMMISSION_RATE } from './constants';
import { ModelId, PricingCalculation, UnitType } from './types';

/**
 * Returns the current Uniswap v4 TWAP rate (USD per 1 RENT token).
 * Default benchmark: 1 RENT = $0.05 USD ($1 USD = 20 RENT).
 */
export function getRentTwapRateUsd(): number {
  const envTwap = process.env.NEXT_PUBLIC_RENT_TWAP_USD;
  if (envTwap && !isNaN(Number(envTwap)) && Number(envTwap) > 0) {
    return Number(envTwap);
  }
  return 0.05;
}

/**
 * Calculates the exact deterministic "idle key" pricing breakdown:
 * dailyQuotaValueUsd = (dailyQuota / referenceUnit) * officialCostUsd
 * remainingCreditValueUsd = (remainingCredit / referenceUnit) * officialCostUsd
 *
 * IF remainingCredit >= dailyQuota:
 *   suggestedDailyPriceUsd = dailyQuotaValueUsd * 0.35 (65% cheaper)
 * ELSE:
 *   suggestedDailyPriceUsd = remainingCreditValueUsd * 0.35 ("Low credit — discounted")
 *
 * Hard cap:
 *   hardCapUsd = dailyQuotaValueUsd * 0.60 (enforced strictly)
 */
export function calculateIdleKeyPrice(
  modelType: string,
  dailyQuota: number,
  remainingCredit: number,
  customPriceUsd?: number
): PricingCalculation {
  const model = MODEL_CATALOG[modelType as ModelId];
  const officialCostUsd = model ? model.officialCostUsd : 5.00;
  const referenceUnit = model ? model.referenceUnitSize : 1_000_000;

  const dailyQuotaValueUsd = (dailyQuota / referenceUnit) * officialCostUsd;
  const remainingCreditValueUsd = (remainingCredit / referenceUnit) * officialCostUsd;

  const isLowCredit = remainingCredit < dailyQuota;

  // 35% of official value (i.e. 65% cheaper)
  let suggestedDailyPriceUsd = isLowCredit
    ? remainingCreditValueUsd * 0.35
    : dailyQuotaValueUsd * 0.35;

  // Minimum floor price to prevent dust spam ($0.10)
  suggestedDailyPriceUsd = Math.max(0.10, Number(suggestedDailyPriceUsd.toFixed(2)));

  // Hard Cap: can NEVER exceed dailyQuotaValueUsd * 0.60
  const hardCapUsd = Number((dailyQuotaValueUsd * 0.60).toFixed(2));

  let finalUsd = suggestedDailyPriceUsd;
  if (customPriceUsd !== undefined && customPriceUsd > 0) {
    // Custom price can be at most 20% above suggestion, and cannot exceed hardCapUsd
    const maxAllowedCustom = Math.min(hardCapUsd, suggestedDailyPriceUsd * 1.20);
    finalUsd = Math.min(customPriceUsd, maxAllowedCustom);
  }

  finalUsd = Math.min(finalUsd, hardCapUsd);
  finalUsd = Number(finalUsd.toFixed(2));

  // Discount percentage against official value
  const discountPercentage = Math.round(
    ((dailyQuotaValueUsd - finalUsd) / (dailyQuotaValueUsd || 1)) * 100
  );

  const twapRate = getRentTwapRateUsd();
  const suggestedDailyPriceRent = Number((finalUsd / twapRate).toFixed(4));

  return {
    dailyQuotaValueUsd: Number(dailyQuotaValueUsd.toFixed(2)),
    remainingCreditValueUsd: Number(remainingCreditValueUsd.toFixed(2)),
    suggestedDailyPriceUsd: finalUsd,
    hardCapUsd,
    isLowCredit,
    discountPercentage: Math.max(0, discountPercentage),
    twapRateUsdPerRent: twapRate,
    suggestedDailyPriceRent,
  };
}

/**
 * Formats quota according to unit type (Tokens, Minutes, Images, Requests)
 */
export function formatQuota(amount: number, unitType: UnitType): string {
  switch (unitType) {
    case 'TOKEN':
      if (amount >= 1_000_000) {
        return `${(amount / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M Tokens`;
      }
      return `${(amount / 1_000).toLocaleString('en-US')}K Tokens`;

    case 'MINUTE':
      return `${amount.toLocaleString('en-US')} Mins`;

    case 'IMAGE':
      return `${amount.toLocaleString('en-US')} Images`;

    case 'REQUEST':
      if (amount >= 1_000) {
        return `${(amount / 1_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}K Requests`;
      }
      return `${amount.toLocaleString('en-US')} Requests`;

    default:
      return `${amount.toLocaleString('en-US')}`;
  }
}

/**
 * Currency formatters
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRentToken(amount: number): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} RENT`;
}
