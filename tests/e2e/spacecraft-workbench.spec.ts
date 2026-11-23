import { expect, test } from '@playwright/test';

test('spacecraft workbench imports mesh geometry and updates mass budgets', async ({ page }) => {
  await page.goto('/');
  const coachOn = page.getByRole('button', { name: /COACH ON/i });
  if (await coachOn.count()) await coachOn.click();
  await page.getByRole('button', { name: 'Spacecraft', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Spacecraft model workbench' })).toBeVisible();
  const obj = `
v 0 0 0
v 1000 0 0
v 1000 500 0
v 0 500 0
v 0 0 200
v 1000 0 200
v 1000 500 200
v 0 500 200
f 1 2 3 4
f 5 8 7 6
f 1 5 6 2
f 2 6 7 3
f 3 7 8 4
f 5 1 4 8
`;
  await page.locator('input[type="file"][accept*=".obj"]').setInputFiles({
    name: 'test-spacecraft.obj',
    mimeType: 'text/plain',
    buffer: Buffer.from(obj)
  });
  await expect(page.getByText('test-spacecraft.obj')).toBeVisible();
  await page.locator('.spacecraft-geometry-controls select').selectOption('mm');
  await expect(page.getByText('1.0000 m')).toBeVisible();
  await expect(page.getByText('0.5000 m')).toBeVisible();
  await expect(page.getByText('0.2000 m')).toBeVisible();

  await page.getByRole('button', { name: 'Add component' }).click();
  await expect(page.getByText('9.000 kg')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove component-/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export spacecraft configuration' })).toBeEnabled();
});

test('mission analysis exposes J2 selection and applies JPL lunar snapshot to Earth 3D', async ({ page }) => {
  await page.route('**/api/v1/ephemeris/moon?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      body: 'MOON', epoch: '2026-11-11T21:00:00.000', timeScale: 'TDB', frame: 'ICRF',
      positionM: [384400000, 1200000, -900000], velocityMps: [-30, 1020, 2],
      source: 'JPL-HORIZONS', kernelId: 'DE441', coverageStart: '2026-11-11T21:00:00.000',
      coverageEnd: '2026-11-11T21:00:00.000', positionUncertaintyM: null
    })
  }));
  await page.goto('/');
  const coachOn = page.getByRole('button', { name: /COACH ON/i });
  if (await coachOn.count()) await coachOn.click();
  await page.getByRole('button', { name: 'Mission Analysis', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Orbital Mission Analysis' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Orbital force model' })).toHaveValue('TWO_BODY');
  await page.getByRole('combobox', { name: 'Orbital force model' }).selectOption('J2');
  await expect(page.getByRole('combobox', { name: 'Orbital force model' })).toHaveValue('J2');
  await expect(page.getByRole('heading', { name: 'JPL Horizons lunar ephemeris' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Moon ephemeris epoch in TDB' })).toHaveValue('2026-11-11T21:00:00.000');
  await page.getByRole('button', { name: 'Fetch lunar state' }).click();
  await expect(page.getByText('DE441')).toBeVisible();
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  const scene = page.locator('.earth3d-canvas');
  await expect(scene).toHaveAttribute('data-moon-ephemeris', 'JPL-HORIZONS-SNAPSHOT');
  await expect(page.getByText(/MOON POSITION SNAPSHOT · JPL-HORIZONS/)).toBeVisible();
});
