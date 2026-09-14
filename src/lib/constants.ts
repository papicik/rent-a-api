import { ModelCatalogEntry, ModelId } from './types';

export const PLATFORM_COMMISSION_RATE = 0.00; // %0 Platform Commission — 100% to Provider

export const MODEL_CATALOG: Record<ModelId, ModelCatalogEntry> = {
  'claude-sonnet-4': {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    category: 'LLM',
    officialCostUsd: 6.00, // $3 in / $15 out blended ~ $6.00 per 1M
    referenceUnitSize: 1_000_000,
    unitType: 'TOKEN',
    defaultDailyQuota: 5_000_000,
    minQuota: 500_000,
    maxQuota: 30_000_000,
    quotaStep: 500_000,
    unitLabel: 'M Tokens',
    description: 'SOTA reasoning, complex coding, and multimodal intelligence.',
  },
  'claude-haiku-3-5': {
    id: 'claude-haiku-3-5',
    name: 'Claude Haiku 3.5',
    provider: 'Anthropic',
    category: 'LLM',
    officialCostUsd: 1.60, // $0.80 in / $4 out blended ~ $1.60 per 1M
    referenceUnitSize: 1_000_000,
    unitType: 'TOKEN',
    defaultDailyQuota: 10_000_000,
    minQuota: 1_000_000,
    maxQuota: 50_000_000,
    quotaStep: 1_000_000,
    unitLabel: 'M Tokens',
    description: 'Ultra-fast, cost-efficient intelligence for high throughput.',
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    category: 'LLM',
    officialCostUsd: 5.00, // $2.50 in / $10 out blended ~ $5.00 per 1M
    referenceUnitSize: 1_000_000,
    unitType: 'TOKEN',
    defaultDailyQuota: 4_000_000,
    minQuota: 500_000,
    maxQuota: 30_000_000,
    quotaStep: 500_000,
    unitLabel: 'M Tokens',
    description: 'Flagship multimodal omnimodel with vision, audio, and text.',
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o-mini',
    provider: 'OpenAI',
    category: 'LLM',
    officialCostUsd: 0.30, // $0.15 in / $0.60 out blended ~ $0.30 per 1M
    referenceUnitSize: 1_000_000,
    unitType: 'TOKEN',
    defaultDailyQuota: 20_000_000,
    minQuota: 2_000_000,
    maxQuota: 100_000_000,
    quotaStep: 2_000_000,
    unitLabel: 'M Tokens',
    description: 'Small, lightweight model tailored for speed and low-latency tasks.',
  },
  'o3': {
    id: 'o3',
    name: 'o3 Reasoning Model',
    provider: 'OpenAI',
    category: 'Reasoning',
    officialCostUsd: 20.00, // $10 in / $40 out blended ~ $20.00 per 1M
    referenceUnitSize: 1_000_000,
    unitType: 'TOKEN',
    defaultDailyQuota: 2_000_000,
    minQuota: 200_000,
    maxQuota: 10_000_000,
    quotaStep: 200_000,
    unitLabel: 'M Tokens',
    description: 'Deep reasoning frontier model for STEM and complex algorithmic puzzles.',
  },
  'deepseek-v3': {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    category: 'LLM',
    officialCostUsd: 0.28, // $0.14 in / $0.28 out blended ~ $0.28 per 1M
    referenceUnitSize: 1_000_000,
    unitType: 'TOKEN',
    defaultDailyQuota: 15_000_000,
    minQuota: 1_000_000,
    maxQuota: 80_000_000,
    quotaStep: 1_000_000,
    unitLabel: 'M Tokens',
    description: 'Ultra-low cost open-weights MoE architecture with frontier benchmark results.',
  },
  'gemini-2-5-pro': {
    id: 'gemini-2-5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    category: 'LLM',
    officialCostUsd: 3.50, // $1.25 in / $10 out blended ~ $3.50 per 1M
    referenceUnitSize: 1_000_000,
    unitType: 'TOKEN',
    defaultDailyQuota: 5_000_000,
    minQuota: 1_000_000,
    maxQuota: 30_000_000,
    quotaStep: 1_000_000,
    unitLabel: 'M Tokens',
    description: '2M token massive context window with deep video, audio, and code reasoning.',
  },
  'llama-3-3-70b': {
    id: 'llama-3-3-70b',
    name: 'Llama 3.3 70B',
    provider: 'Meta / Self-Hosted',
    category: 'LLM',
    officialCostUsd: 1.00, // Custom self-hosted reference value
    referenceUnitSize: 1_000_000,
    unitType: 'TOKEN',
    defaultDailyQuota: 10_000_000,
    minQuota: 1_000_000,
    maxQuota: 50_000_000,
    quotaStep: 1_000_000,
    unitLabel: 'M Tokens',
    description: 'High-speed open source 70B parameter model hosted on private GPU clusters.',
  },
  'whisper-v3': {
    id: 'whisper-v3',
    name: 'Whisper v3 Speech-to-Text',
    provider: 'OpenAI',
    category: 'Audio',
    officialCostUsd: 0.006, // $0.006 per minute
    referenceUnitSize: 1,
    unitType: 'MINUTE',
    defaultDailyQuota: 240, // 240 minutes
    minQuota: 100,
    maxQuota: 10_000,
    quotaStep: 100,
    unitLabel: 'Minutes',
    description: 'Robust multilingual speech recognition and transcription model.',
  },
  'dall-e-3': {
    id: 'dall-e-3',
    name: 'DALL-E 3 Image Generation',
    provider: 'OpenAI',
    category: 'Vision',
    officialCostUsd: 0.04, // $0.040 per HD standard image
    referenceUnitSize: 1,
    unitType: 'IMAGE',
    defaultDailyQuota: 1_000, // 1000 images
    minQuota: 25,
    maxQuota: 2_500,
    quotaStep: 25,
    unitLabel: 'Images',
    description: 'State of the art text-to-image synthesis with unmatched prompt adherence.',
  },
  'text-embedding-3-large': {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    provider: 'OpenAI',
    category: 'Embedding',
    officialCostUsd: 0.13, // $0.13 per 1M tokens
    referenceUnitSize: 1_000_000,
    unitType: 'TOKEN',
    defaultDailyQuota: 30_000_000,
    minQuota: 5_000_000,
    maxQuota: 200_000_000,
    quotaStep: 5_000_000,
    unitLabel: 'M Tokens',
    description: 'Dense vector embeddings for high-dimensional semantic search and RAG.',
  },
  'residential-proxy': {
    id: 'residential-proxy',
    name: 'Residential Scraping Proxy',
    provider: 'Custom P2P',
    category: 'Proxy',
    officialCostUsd: 0.50, // $0.50 per 1K requests
    referenceUnitSize: 1_000,
    unitType: 'REQUEST',
    defaultDailyQuota: 25_000,
    minQuota: 1_000,
    maxQuota: 150_000,
    quotaStep: 1_000,
    unitLabel: 'Requests',
    description: 'Rotating residential and datacenter proxy nodes that bypass Cloudflare.',
  },
};

export const DEFAULT_DAILY_QUOTA: Record<ModelId, number> = {
  'claude-sonnet-4': 5_000_000,
  'claude-haiku-3-5': 10_000_000,
  'gpt-4o': 4_000_000,
  'gpt-4o-mini': 20_000_000,
  'o3': 2_000_000,
  'deepseek-v3': 15_000_000,
  'gemini-2-5-pro': 5_000_000,
  'llama-3-3-70b': 10_000_000,
  'whisper-v3': 240,
  'dall-e-3': 1_000,
  'text-embedding-3-large': 30_000_000,
  'residential-proxy': 25_000,
};

export const ROBINHOOD_CHAIN_CONFIG = {
  id: 421614,
  name: 'Robinhood Chain L2',
  network: 'robinhood-l2',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood L2 Explorer',
      url: 'https://sepolia.arbiscan.io',
    },
  },
};

export const CONTRACT_ADDRESSES = {
  RENT_TOKEN: (process.env.NEXT_PUBLIC_RENT_TOKEN_ADDRESS || '0x4444444444444444444444444444444444444444') as `0x${string}`,
  MARKETPLACE: (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || '0x5555555555555555555555555555555555555555') as `0x${string}`,
  API_ESCROW: (process.env.NEXT_PUBLIC_API_ESCROW_ADDRESS || process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || '0x5555555555555555555555555555555555555555') as `0x${string}`,
  UNISWAP_V4_POOL: (process.env.NEXT_PUBLIC_UNISWAP_V4_POOL || '0x6666666666666666666666666666666666666666') as `0x${string}`,
};
