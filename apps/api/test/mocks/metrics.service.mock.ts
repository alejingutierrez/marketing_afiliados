export class MockMetricsService {
  public readonly httpCalls: Array<{ method: string; route: string; statusCode: number; durationMs: number }> = [];
  public readonly webhookCalls: Array<{ eventType: string; success: boolean; durationMs: number }> = [];
  public readonly reconciliationCalls: Array<{ type: string; count: number }> = [];
  public readonly queueSamples: Array<{ queue: string; depth: number }> = [];
  public readonly alerts: string[] = [];

  observeHttpRequest(input: { method: string; route: string; statusCode: number; durationMs: number }) {
    this.httpCalls.push(input);
  }

  observeWebhookProcessing(input: { eventType: string; success: boolean; durationMs: number }) {
    this.webhookCalls.push(input);
  }

  recordReconciliationDiscrepancies(input: { type: string; count: number }) {
    this.reconciliationCalls.push(input);
  }

  setQueueDepth(queue: string, depth: number) {
    this.queueSamples.push({ queue, depth });
  }

  incrementAlert(alertType: string) {
    this.alerts.push(alertType);
  }

  async getMetricsSnapshot(): Promise<string> {
    return '# mock metrics\n';
  }
}
