import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}
