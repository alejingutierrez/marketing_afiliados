import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { recordBackupFailure, recordBackupSuccess } from './metrics';

const DEFAULT_BACKUP_DIR = path.resolve(process.cwd(), 'backups');

function resolveBackupDir(): string {
  return process.env.BACKUP_OUTPUT_DIR ? path.resolve(process.env.BACKUP_OUTPUT_DIR) : DEFAULT_BACKUP_DIR;
}

export async function createBackupSnapshot() {
  const startedAt = Date.now();
  const backupDir = resolveBackupDir();
  try {
    await fs.mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = randomUUID();
    const payload = {
      id: backupId,
      createdAt: new Date().toISOString(),
      checksum: createHash('sha256')
        .update(`${backupId}:${Date.now()}:${Math.random()}`)
        .digest('hex'),
      notes: 'Backup simulado generado por el worker'
    };

    const filePath = path.join(backupDir, `backup-${timestamp}.json`);
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    recordBackupSuccess(Date.now() - startedAt);
    return filePath;
  } catch (error) {
    recordBackupFailure();
    throw error;
  }
}
