import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    /* ignore */
  }

  const hash = createHash('sha256');
  hash.update(trimmed);
  return hash.digest();
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer | null;

  constructor() {
    const secret = process.env.DATA_ENCRYPTION_KEY;
    if (!secret || secret.length < 16) {
      this.logger.warn('DATA_ENCRYPTION_KEY no definido o demasiado corto. Se usará codificación base64 como fallback.');
      this.key = null;
    } else {
      this.key = deriveKey(secret);
    }
  }

  encrypt(plain: string): string {
    if (!this.key) {
      return Buffer.from(plain, 'utf8').toString('base64');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(payload: string): string {
    if (!this.key) {
      return Buffer.from(payload, 'base64').toString('utf8');
    }

    const buffer = Buffer.from(payload, 'base64');
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const data = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
