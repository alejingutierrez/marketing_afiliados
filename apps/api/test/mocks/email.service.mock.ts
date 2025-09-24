interface AlertOptions {
  category: string;
  group: 'global' | 'finance' | 'operations';
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

export class MockEmailService {
  public readonly alerts: AlertOptions[] = [];

  async sendAlert(options: AlertOptions): Promise<void> {
    this.alerts.push(options);
  }

  getOutbox() {
    return this.alerts.map((alert, index) => ({
      id: `mock-email-${index}`,
      category: alert.category,
      group: alert.group,
      subject: alert.subject,
      to: ['qa@mock.local'],
      text: alert.text,
      html: alert.html,
      metadata: alert.metadata,
      delivered: true,
      sentAt: new Date().toISOString()
    }));
  }
}
