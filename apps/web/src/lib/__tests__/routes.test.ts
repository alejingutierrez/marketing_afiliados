import { describe, expect, it } from 'vitest';

import { getDefaultDashboardPath } from '@/lib/routes';

describe('getDefaultDashboardPath', () => {
  it('prioritises admin route when user is admin', () => {
    expect(getDefaultDashboardPath(['admin_dentsu'])).toBe('/dashboard/admin');
  });

  it('returns finance dashboard when user is finance', () => {
    expect(getDefaultDashboardPath(['finance'])).toBe('/dashboard/finance');
  });

  it('prefers gestor when user is admin marca', () => {
    expect(getDefaultDashboardPath(['admin_marca'])).toBe('/dashboard/gestor');
  });

  it('falls back to influencer dashboard when applicable', () => {
    expect(getDefaultDashboardPath(['influencer'])).toBe('/dashboard/influencer');
  });

  it('returns generic dashboard if no matching roles', () => {
    expect(getDefaultDashboardPath([])).toBe('/dashboard');
  });
});
