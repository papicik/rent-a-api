import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSlotSchema } from '@/lib/validations/slot';
import { calculateIdleKeyPrice } from '@/lib/pricing';
import { encryptApiKey, maskApiKey } from '@/lib/crypto';
import { ensureDatabaseSeeded } from '@/lib/seed';
import { MODEL_CATALOG, DEFAULT_DAILY_QUOTA } from '@/lib/constants';
import { ModelId, SlotDto } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getTodayUtcString(): string {
  return new Date().toISOString().split('T')[0];
}

export async function GET() {
  try {
    try {
      await ensureDatabaseSeeded();
    } catch {
      // Non-fatal if DB is in local setup
    }

    const todayUtc = getTodayUtcString();

    const slots = await prisma.slot.findMany({
      where: { isActive: true },
      include: {
        provider: true,
        rentals: {
          include: { usageLogs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const slotDtos: SlotDto[] = slots.map((slot) => {
      const pricing = calculateIdleKeyPrice(
        slot.modelType,
        slot.dailyQuota,
        slot.remainingCredit,
        slot.suggestedDailyPriceUsd
      );
      const activeRental = slot.rentals.find(
        (r) => r.rentalDate === todayUtc && (r.status === 'PENDING' || r.status === 'ACTIVE')
      );

      // Calculate creditRemainingPct based on completed usage and remaining credit
      const totalUsedAcrossRentals = slot.rentals.reduce((sum, r) => sum + r.usedQuota, 0);
      let creditRemainingPct = 100;
      if (totalUsedAcrossRentals > 0) {
        const initialCreditEstimate = slot.remainingCredit + totalUsedAcrossRentals;
        creditRemainingPct = Math.max(0, Math.min(100, Math.round((slot.remainingCredit / initialCreditEstimate) * 100)));
      } else if (slot.remainingCredit < slot.dailyQuota) {
        creditRemainingPct = Math.max(1, Math.min(100, Math.round((slot.remainingCredit / slot.dailyQuota) * 100)));
      }

      return {
        id: slot.id,
        providerWallet: slot.provider.walletAddress,
        modelType: slot.modelType,
        modelName: slot.modelName,
        unitType: slot.unitType,
        referenceUnit: slot.referenceUnit,
        officialCostUsd: slot.officialCostUsd,
        dailyQuota: slot.dailyQuota,
        remainingCredit: slot.remainingCredit,
        dailyQuotaValueUsd: pricing.dailyQuotaValueUsd,
        suggestedDailyPriceUsd: pricing.suggestedDailyPriceUsd,
        finalDailyPriceUsd: pricing.suggestedDailyPriceUsd,
        finalDailyPriceRent: pricing.suggestedDailyPriceRent,
        isLowCredit: pricing.isLowCredit,
        discountPercentage: pricing.discountPercentage,
        creditRemainingPct,
        maskedKeySnippet: slot.maskedKeySnippet,
        isLockedToday: !!activeRental,
        isActive: slot.isActive,
        createdAt: slot.createdAt.toISOString(),
        activeRental: activeRental
          ? {
              rentalId: activeRental.id,
              renterWallet: activeRental.renterWallet,
              status: activeRental.status,
              expiresAtUtc: `${activeRental.rentalDate}T23:59:59.999Z`,
              usedQuota: activeRental.usedQuota,
            }
          : undefined,
      };
    });

    slotDtos.sort((a, b) => {
      if (a.isLockedToday === b.isLockedToday) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return a.isLockedToday ? 1 : -1;
    });

    return NextResponse.json({
      success: true,
      todayUtc,
      count: slotDtos.length,
      slots: slotDtos,
    });
  } catch (error: unknown) {
    // Resilient offline fallback for local demo preview
    const todayUtc = getTodayUtcString();

    const fallbackSlots: SlotDto[] = [
      {
        id: 'slot_sonnet4_01',
        providerWallet: '0x7a83b9c019cde91823b9c41e92019448e4b9c001',
        modelType: 'claude-sonnet-4',
        modelName: 'Claude Sonnet 4',
        unitType: 'TOKEN',
        referenceUnit: 1_000_000,
        officialCostUsd: 6.00,
        dailyQuota: 5_000_000,
        remainingCredit: 25_000_000,
        dailyQuotaValueUsd: 30.00,
        suggestedDailyPriceUsd: 10.50,
        finalDailyPriceUsd: 10.50,
        finalDailyPriceRent: 210,
        isLowCredit: false,
        discountPercentage: 65,
        creditRemainingPct: 100,
        maskedKeySnippet: 'sk-ant-...194a',
        isLockedToday: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'slot_gpt4o_02',
        providerWallet: '0x3d91e0a724c94801bc38f41d8b93c523091b33e2',
        modelType: 'gpt-4o',
        modelName: 'GPT-4o',
        unitType: 'TOKEN',
        referenceUnit: 1_000_000,
        officialCostUsd: 5.00,
        dailyQuota: 4_000_000,
        remainingCredit: 12_000_000,
        dailyQuotaValueUsd: 20.00,
        suggestedDailyPriceUsd: 7.00,
        finalDailyPriceUsd: 7.00,
        finalDailyPriceRent: 140,
        isLowCredit: false,
        discountPercentage: 65,
        creditRemainingPct: 92,
        maskedKeySnippet: 'sk-proj-...cba8',
        isLockedToday: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'slot_o3_03',
        providerWallet: '0x992afbc810398d80f174a7d53c654921d391a203',
        modelType: 'o3',
        modelName: 'o3 Reasoning Model',
        unitType: 'TOKEN',
        referenceUnit: 1_000_000,
        officialCostUsd: 20.00,
        dailyQuota: 2_000_000,
        remainingCredit: 1_200_000, // Low credit example (< dailyQuota)
        dailyQuotaValueUsd: 40.00,
        suggestedDailyPriceUsd: 8.40, // Discounted from remaining credit (1.2M * 20 * 0.35 = 8.40)
        finalDailyPriceUsd: 8.40,
        finalDailyPriceRent: 168,
        isLowCredit: true,
        discountPercentage: 79,
        creditRemainingPct: 30,
        maskedKeySnippet: 'sk-proj-...1029',
        isLockedToday: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'slot_deepseek_04',
        providerWallet: '0x12fa8990ce74fb92945d10b962e304859ad04e84',
        modelType: 'deepseek-v3',
        modelName: 'DeepSeek V3',
        unitType: 'TOKEN',
        referenceUnit: 1_000_000,
        officialCostUsd: 0.28,
        dailyQuota: 15_000_000,
        remainingCredit: 60_000_000,
        dailyQuotaValueUsd: 4.20,
        suggestedDailyPriceUsd: 1.47,
        finalDailyPriceUsd: 1.47,
        finalDailyPriceRent: 29.4,
        isLowCredit: false,
        discountPercentage: 65,
        creditRemainingPct: 85,
        maskedKeySnippet: 'sk-ds-...1203',
        isLockedToday: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'slot_whisper_05',
        providerWallet: '0x2c0f7b88e1a384594c92da5152069f1092e448b5',
        modelType: 'whisper-v3',
        modelName: 'Whisper v3 Speech-to-Text',
        unitType: 'MINUTE',
        referenceUnit: 1,
        officialCostUsd: 0.006,
        dailyQuota: 240,
        remainingCredit: 2_400,
        dailyQuotaValueUsd: 1.44,
        suggestedDailyPriceUsd: 0.50,
        finalDailyPriceUsd: 0.50,
        finalDailyPriceRent: 10,
        isLowCredit: false,
        discountPercentage: 65,
        creditRemainingPct: 95,
        maskedKeySnippet: 'sk-whi...920a',
        isLockedToday: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'slot_proxy_06',
        providerWallet: '0x7a83b9c019cde91823b9c41e92019448e4b9c001',
        modelType: 'residential-proxy',
        modelName: 'Residential Scraping Proxy',
        unitType: 'REQUEST',
        referenceUnit: 1_000,
        officialCostUsd: 0.50,
        dailyQuota: 25_000,
        remainingCredit: 100_000,
        dailyQuotaValueUsd: 12.50,
        suggestedDailyPriceUsd: 4.38,
        finalDailyPriceUsd: 4.38,
        finalDailyPriceRent: 87.6,
        isLowCredit: false,
        discountPercentage: 65,
        creditRemainingPct: 43,
        maskedKeySnippet: 'sec_proxy...0192',
        isLockedToday: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        activeRental: {
          rentalId: 'rent_proxy_06_locked',
          renterWallet: '0x3d91e0a724c94801bc38f41d8b93c523091b33e2',
          status: 'ACTIVE',
          expiresAtUtc: `${todayUtc}T23:59:59.999Z`,
          usedQuota: 14200,
        },
      },
    ];

    return NextResponse.json({
      success: true,
      todayUtc,
      count: fallbackSlots.length,
      slots: fallbackSlots,
      mode: 'dev_offline_fallback',
    });
  }
}

import { requireAuth } from '@/lib/siwe';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if ('error' in auth) {
      return auth.error;
    }
    const sessionAddress = auth.address;

    const rawBody = await request.json();

    if (rawBody.providerWallet && rawBody.providerWallet.toLowerCase() !== sessionAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: providerWallet does not match authenticated session.' },
        { status: 403 }
      );
    }

    const parseResult = createSlotSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { modelType, apiKey } = parseResult.data;
    const providerWallet = sessionAddress;
    const catalog = MODEL_CATALOG[modelType as ModelId];
    if (!catalog) {
      return NextResponse.json(
        { success: false, error: `Unsupported model: ${modelType}` },
        { status: 400 }
      );
    }

    const dailyQuota = DEFAULT_DAILY_QUOTA[modelType as ModelId] || catalog.defaultDailyQuota;
    const remainingCredit = dailyQuota;

    const pricing = calculateIdleKeyPrice(
      modelType,
      dailyQuota,
      remainingCredit
    );

    // Ensure provider exists or create
    const provider = await prisma.provider.upsert({
      where: { walletAddress: providerWallet },
      update: {},
      create: { walletAddress: providerWallet },
    });

    const encrypted = encryptApiKey(apiKey);
    const maskedKey = maskApiKey(apiKey);

    const newSlot = await prisma.slot.create({
      data: {
        providerId: provider.id,
        modelType,
        modelName: catalog.name,
        unitType: catalog.unitType,
        referenceUnit: catalog.referenceUnitSize,
        officialCostUsd: catalog.officialCostUsd,
        dailyQuota,
        remainingCredit,
        suggestedDailyPriceUsd: pricing.suggestedDailyPriceUsd,
        encryptedApiKey: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        maskedKeySnippet: maskedKey,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'API slot successfully encrypted with AES-256-GCM and listed.',
        slot: {
          id: newSlot.id,
          providerWallet: provider.walletAddress,
          modelType: newSlot.modelType,
          modelName: newSlot.modelName,
          unitType: newSlot.unitType,
          dailyQuota: newSlot.dailyQuota,
          remainingCredit: newSlot.remainingCredit,
          dailyQuotaValueUsd: pricing.dailyQuotaValueUsd,
          suggestedDailyPriceUsd: pricing.suggestedDailyPriceUsd,
          suggestedDailyPriceRent: pricing.suggestedDailyPriceRent,
          discountPercentage: pricing.discountPercentage,
          maskedKeySnippet: newSlot.maskedKeySnippet,
          isLockedToday: false,
          createdAt: newSlot.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create slot.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
