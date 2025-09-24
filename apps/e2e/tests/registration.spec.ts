import { expect, test } from '@playwright/test';

// TODO: habilitar nuevamente cuando el flujo de formularios Ant Design exponga opciones visibles en headless.

test.describe.fixme('Registro de influencers', () => {
  test('permite completar el formulario público', async ({ page }) => {
    const policiesResponse = [
      {
        id: 'terms-v1',
        policyType: 'terms',
        version: '1.0.0',
        documentUrl: 'https://example.com/terms',
        checksum: 'checksum-123',
        publishedAt: new Date('2024-01-01T00:00:00Z').toISOString()
      }
    ];

    await page.route('**/api/v1/public/policies', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(policiesResponse)
      });
    });

    let submittedPayload: Record<string, unknown> | null = null;
    await page.route('**/api/v1/public/influencers', async (route) => {
      submittedPayload = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'influencer-qa', status: 'pending' })
      });
    });

    await page.goto('/register');

    await page.getByLabel('Nombre').fill('Laura');
    await page.getByLabel('Apellido').fill('Gómez');

    await page.getByLabel('Tipo de documento').click();
    await page.getByRole('option', { name: 'Cédula de ciudadanía' }).click();
    await page.getByLabel('Número de documento').fill('1032456789');

    await page.getByLabel('Correo electrónico', { exact: true }).fill('laura@example.com');
    await page.getByLabel('Número celular').fill('3001234567');
    await page.getByLabel('Dirección').fill('Calle 123 #45-67');
    await page.getByLabel('Ciudad').fill('Bogotá');
    await page.getByLabel('País').fill('Colombia');

    await page.getByRole('checkbox', {
      name: /Declaro haber leído y aceptado la versión 1.0.0/i
    }).check();

    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    await expect(page.getByRole('heading', { name: '¡Solicitud enviada!' })).toBeVisible();

    expect(submittedPayload).toMatchObject({
      firstName: 'Laura',
      lastName: 'Gómez',
      documentType: 'CC',
      documentNumber: '1032456789',
      email: 'laura@example.com',
      policyVersionId: 'terms-v1'
    });
  });
});
