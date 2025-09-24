import { Injectable } from '@nestjs/common';

import type { AuthUser } from '../../common/interfaces/user.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InMemoryDatabaseService } from '../../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly database: InMemoryDatabaseService) {}

  findByEmail(email: string): AuthUser | undefined {
    return this.database.findUserByEmail(email);
  }

  findById(id: string): AuthUser | undefined {
    return this.database.findUserById(id);
  }

  updatePassword(userId: string, passwordHash: string) {
    this.database.updateUserPassword(userId, passwordHash);
  }
}
