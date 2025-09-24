import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MetricsService } from '../../observability/metrics.service';

export interface NotificationEvent {
  id: string;
  type: string;
  recipient: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  private readonly events: NotificationEvent[] = [];

  constructor(private readonly metrics: MetricsService) {}

  emit(event: Omit<NotificationEvent, 'id' | 'createdAt'>) {
    this.events.push({
      id: uuid(),
      createdAt: new Date(),
      ...event
    });
    this.metrics.setQueueDepth('notifications', this.events.length);
  }

  pending(): NotificationEvent[] {
    return this.events.map((event) => ({
      ...event,
      createdAt: new Date(event.createdAt)
    }));
  }
}
