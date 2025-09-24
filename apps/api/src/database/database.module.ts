import { Global, Module } from '@nestjs/common';

import { EncryptionService } from '../common/security/encryption.service';

import { InMemoryDatabaseService } from './database.service';

@Global()
@Module({
  providers: [EncryptionService, InMemoryDatabaseService],
  exports: [InMemoryDatabaseService]
})
export class DatabaseModule {}
