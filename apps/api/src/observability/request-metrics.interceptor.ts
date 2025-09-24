import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MetricsService } from './metrics.service';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const fullPath = request.originalUrl ?? request.url ?? request.path ?? '';

    if (fullPath.startsWith('/api/v1/metrics')) {
      return next.handle();
    }

    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.observe(start, request, response),
        error: () => this.observe(start, request, response)
      })
    );
  }

  private observe(start: bigint, request: Request, response: Response) {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    const route = this.resolveRoute(request);

    this.metrics.observeHttpRequest({
      method: request.method,
      route,
      statusCode: response.statusCode || 500,
      durationMs
    });
  }

  private resolveRoute(request: Request): string {
    if (request.route?.path) {
      return request.baseUrl ? `${request.baseUrl}${request.route.path}` : request.route.path;
    }

    if (request.originalUrl) {
      return request.originalUrl.split('?')[0] ?? request.originalUrl;
    }

    return request.url;
  }
}
