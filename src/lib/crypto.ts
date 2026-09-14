import crypto from 'crypto';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM

/**
 * Derives a deterministic 32-byte encryption key from environment variable
 */
function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 'rent-a-api-p2p-zero-commission-secure-key-32b!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a raw provider API key using AES-256-GCM with a fresh 96-bit IV
 */
export function encryptApiKey(plainText: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);

  let ciphertext = cipher.update(plainText, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext payload and validates authentication tag
 */
export function decryptApiKey(payload: { ciphertext: string; iv: string; authTag: string }): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getMasterKey(),
    Buffer.from(payload.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Creates safe masked representation for UI presentation (e.g. "sk-ant-...98b4")
 */
export function maskApiKey(key: string): string {
  if (!key) return '****';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****' + trimmed.slice(-2);
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Formats an EVM wallet address: 0x7a83B9c019cDe91823B9c41E92019448E4B9c -> 0x7a83...4B9c
 */
export function maskWallet(wallet: string): string {
  if (!wallet) return '0x0000...0000';
  if (wallet.length < 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

/**
 * Generates an exclusive high-entropy proxy token with "rap_live_" prefix
 */
export function generateProxyToken(): string {
  const randomEntropy = crypto.randomBytes(24).toString('hex');
  return `rap_live_${randomEntropy}`;
}
