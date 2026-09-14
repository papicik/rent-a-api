import { prisma } from './prisma';
import { MODEL_CATALOG } from './constants';
import { encryptApiKey, maskApiKey } from './crypto';
import { calculateIdleKeyPrice } from './pricing';
import { ModelId } from './types';

const INITIAL_PROVIDERS = [
  '0x7a83b9c019cde91823b9c41e92019448e4b9c001',
  '0x3d91e0a724c94801bc38f41d8b93c523091b33e2',
  '0x992afbc810398d80f174a7d53c654921d391a203',
  '0x12fa8990ce74fb92945d10b962e304859ad04e84',
  '0x2c0f7b88e1a384594c92da5152069f1092e448b5',
];

const SEED_SLOTS: Array<{
  modelType: ModelId;
  apiKey: string;
  dailyQuota: number;
  remainingCredit: number; // Idle credit in provider's account
  providerIndex: number;
}> = [
  {
    modelType: 'claude-sonnet-4',
    apiKey: 'sk-ant-api03-live-prod-exclusive-8f921bc4e029194a',
    dailyQuota: 5_000_000,
    remainingCredit: 25_000_000, // Plenty of credit -> standard 65% cheaper
    providerIndex: 0,
  },
  {
    modelType: 'gpt-4o',
    apiKey: 'sk-proj-gpt4o-enterprise-vault-39048aeb9271cba8',
    dailyQuota: 4_000_000,
    remainingCredit: 12_000_000,
    providerIndex: 1,
  },
  {
    modelType: 'deepseek-v3',
    apiKey: 'sk-ds-v3-cluster-dedicated-4482910baef91203',
    dailyQuota: 15_000_000,
    remainingCredit: 50_000_000,
    providerIndex: 2,
  },
  {
    modelType: 'o3',
    apiKey: 'sk-proj-o3-reasoning-vault-8812938102391029',
    dailyQuota: 2_000_000,
    remainingCredit: 1_200_000, // Low credit example (< dailyQuota) -> automatic extra discount!
    providerIndex: 3,
  },
  {
    modelType: 'whisper-v3',
    apiKey: 'sk-proj-whisper-speech-transcribe-88192301920',
    dailyQuota: 1_000,
    remainingCredit: 8_000,
    providerIndex: 4,
  },
  {
    modelType: 'residential-proxy',
    apiKey: 'sec_proxy_residential_mesh_node_994821a00192',
    dailyQuota: 25_000,
    remainingCredit: 100_000,
    providerIndex: 0,
  },
];

export async function ensureDatabaseSeeded(): Promise<void> {
  const count = await prisma.slot.count();
  if (count > 0) return;

  for (const item of SEED_SLOTS) {
    const catalog = MODEL_CATALOG[item.modelType];
    const providerWallet = INITIAL_PROVIDERS[item.providerIndex].toLowerCase();

    const provider = await prisma.provider.upsert({
      where: { walletAddress: providerWallet },
      update: {},
      create: { walletAddress: providerWallet },
    });

    const pricing = calculateIdleKeyPrice(item.modelType, item.dailyQuota, item.remainingCredit);
    const encrypted = encryptApiKey(item.apiKey);

    await prisma.slot.create({
      data: {
        providerId: provider.id,
        modelType: item.modelType,
        modelName: catalog.name,
        unitType: catalog.unitType,
        referenceUnit: catalog.referenceUnitSize,
        officialCostUsd: catalog.officialCostUsd,
        dailyQuota: item.dailyQuota,
        remainingCredit: item.remainingCredit,
        suggestedDailyPriceUsd: pricing.suggestedDailyPriceUsd,
        encryptedApiKey: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        maskedKeySnippet: maskApiKey(item.apiKey),
        isActive: true,
      },
    });
  }
}
