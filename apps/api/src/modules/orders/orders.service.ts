import { Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InMemoryDatabaseService } from '../../database/database.service';

@Injectable()
export class OrdersService {
  constructor(private readonly database: InMemoryDatabaseService) {}

  list() {
    return this.database.listOrders();
  }
}
