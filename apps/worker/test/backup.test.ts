import { strict as assert } from 'node:assert';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createBackupSnapshot } from '../src/backup';

function withTempDir(fn: (dir: string) => Promise<void>) {
  return async () => {
    const prefix = path.join(os.tmpdir(), 'marketing-afiliados-worker-');
    const dir = await mkdtemp(prefix);
    try {
      process.env.BACKUP_OUTPUT_DIR = dir;
      await fn(dir);
    } finally {
      delete process.env.BACKUP_OUTPUT_DIR;
      await rm(dir, { recursive: true, force: true });
    }
  };
}

test('createBackupSnapshot generates a JSON backup file', withTempDir(async (dir) => {
  const filePath = await createBackupSnapshot();
  assert.ok(filePath.startsWith(dir));

  const files = await readdir(dir);
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith('.json'));
}));
