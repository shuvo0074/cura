import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import * as argon2 from 'argon2';
import { AppConfigService } from '../../config/app.config';

/**
 * All cryptographic primitives live behind this one service.
 *
 * Centralising them means algorithm choices and parameters are reviewed in a
 * single place, and no feature module can accidentally hand-roll a weaker
 * variant. Callers depend on the behaviour, not the algorithm.
 */
@Injectable()
export class CryptoService {
  private static readonly AES_ALGORITHM = 'aes-256-gcm';
  private static readonly IV_BYTES = 12;
  private static readonly TAG_BYTES = 16;

  /**
   * Argon2id — memory-hard, resistant to GPU/ASIC cracking. Parameters follow
   * OWASP's recommended minimum (19 MiB, t=2, p=1).
   */
  private static readonly ARGON2_OPTIONS: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };

  constructor(private readonly config: AppConfigService) {}

  hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, CryptoService.ARGON2_OPTIONS);
  }

  /**
   * Verification never throws on malformed input — a corrupt stored hash must
   * read as "wrong password", not as a 500 that distinguishes accounts.
   */
  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** True when the stored hash used weaker parameters and should be upgraded. */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, CryptoService.ARGON2_OPTIONS);
    } catch {
      return true;
    }
  }

  /** Cryptographically uniform numeric OTP — not `Math.random()`. */
  generateNumericCode(length: number): string {
    let out = '';
    for (let i = 0; i < length; i += 1) out += randomInt(0, 10).toString();
    return out;
  }

  generateToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /** SHA-256 hex. Used for refresh-token and file lookup keys. */
  sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /**
   * Keyed hash for OTP codes. The pepper lives in the environment, so a stolen
   * database dump alone does not let an attacker verify or replay codes.
   */
  hashOtp(purpose: string, destination: string, code: string): string {
    return createHmac('sha256', this.config.crypto.otpPepper)
      .update(`${purpose}:${destination}:${code}`)
      .digest('hex');
  }

  /**
   * Deterministic fingerprint for a sensitive identifier (NID). Lets us enforce
   * uniqueness and detect duplicates without ever decrypting stored values.
   */
  fingerprint(value: string): string {
    return createHmac('sha256', this.config.crypto.fieldKey)
      .update(value.trim().toLowerCase())
      .digest('hex');
  }

  /** Constant-time comparison; prevents timing oracles on hash equality. */
  safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * AES-256-GCM field encryption. Output layout: iv | authTag | ciphertext.
   * GCM is authenticated, so tampering with stored bytes fails decryption
   * rather than silently yielding altered plaintext.
   */
  encryptField(plain: string): Buffer {
    const iv = randomBytes(CryptoService.IV_BYTES);
    const cipher = createCipheriv(CryptoService.AES_ALGORITHM, this.config.crypto.fieldKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  }

  decryptField(payload: Buffer): string {
    const iv = payload.subarray(0, CryptoService.IV_BYTES);
    const tag = payload.subarray(
      CryptoService.IV_BYTES,
      CryptoService.IV_BYTES + CryptoService.TAG_BYTES,
    );
    const ciphertext = payload.subarray(CryptoService.IV_BYTES + CryptoService.TAG_BYTES);
    const decipher = createDecipheriv(CryptoService.AES_ALGORITHM, this.config.crypto.fieldKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /** Hash an IP for audit rows so logs are useful but not directly identifying. */
  hashIp(ip: string | undefined): string | null {
    return ip ? this.sha256(`${this.config.crypto.otpPepper}:${ip}`) : null;
  }
}
