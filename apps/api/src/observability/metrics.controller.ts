import { Controller, Get, Headers, Res, UnauthorizedException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  async scrape(@Headers('x-metrics-key') providedKey: string | undefined, @Res() res: Response) {
    const requiredKey = this.configService.get<string>('metrics.apiKey') ?? process.env.METRICS_API_KEY;

    if (requiredKey && requiredKey.length > 0 && providedKey !== requiredKey) {
      throw new UnauthorizedException('Invalid metrics key');
    }

    const body = await this.metricsService.getMetricsSnapshot();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(body);
  }
}
