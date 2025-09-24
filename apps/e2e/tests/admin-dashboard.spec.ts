import { expect, test } from '@playwright/test';

// TODO: reactivar cuando exista flujo de autenticación sincrónico compatible con headless y seeds QA.

test.describe.fixme('Dashboard administrativo', () => {
  test('permite autenticarse y visualizar métricas principales', async ({ page }) => {
    const adminData = {
      stats: {
        influencers: 42,
        brands: 5,
        campaigns: 12,
        confirmedCommission: 25000000
      },
      topInfluencers: [
        {
          influencerId: 'inf-1',
          name: 'Ana Pérez',
          confirmedCommission: 1200000,
          estimatedCommission: 1500000
        }
      ],
      performanceByBrand: [
        {
          brandId: 'brand-1',
          brandName: 'Cetaphil',
          totalSales: 9500000,
          confirmedCommission: 1250000
        }
      ],
      alerts: [
        {
          id: 'alert-1',
          type: 'reconciliation.alert',
          recipient: 'finance',
          createdAt: '2024-05-01T09:30:00Z'
        }
      ],
      auditTrail: [
        {
          id: 'audit-1',
          commissionId: 'comm-1',
          previousState: 'ESTIMATED',
          nextState: 'CONFIRMED',
          changedAt: '2024-05-01T10:00:00Z'
        }
      ],
      recentReconciliations: [
        {
          id: 'rec-1',
          runDate: '2024-05-01T00:00:00Z',
          type: 'daily',
          discrepanciesFound: 2
        }
      ]
    };

    const gestorData = {
      stats: {
        totalInfluencers: 10,
        activeInfluencers: 7,
        pendingInfluencers: 3,
        activeCampaigns: 4,
        totalCodes: 25
      },
      influencersByStatus: [],
      pendingApprovals: [],
      campaigns: [],
      recentCodes: [],
      notifications: []
    };

    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600
        })
      });
    });

    await page.route('**/api/v1/auth/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sub: 'admin-user',
          email: 'admin@medipiel.co',
          roles: ['admin_dentsu'],
          tenantId: 'medipiel',
          firstName: 'Admin',
          lastName: 'Dentsu'
        })
      });
    });

    await page.route('**/api/v1/dashboard/gestor', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(gestorData)
      });
    });

    await page.route('**/api/v1/dashboard/admin', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminData)
      });
    });

    await page.goto('/login');

    await page.getByLabel('Correo electrónico').fill('admin@medipiel.co');
    await page.getByLabel('Contraseña').fill('Changeit!2024');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await page.waitForURL('**/dashboard/admin');

    await expect(page.getByRole('heading', { name: 'Vista ejecutiva' })).toBeVisible();
    await expect(page.getByText('Influencers activos')).toBeVisible();
    await expect(page.getByText('Marcas activas')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Ana Pérez' })).toBeVisible();
    await expect(page.getByText('Cetaphil')).toBeVisible();
  });
});
