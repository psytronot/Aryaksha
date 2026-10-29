import { expect, test } from '@playwright/test';

test('desktop app shell renders and mission analysis navigation works', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: /Explore Space/ })).toBeVisible();

  await page.getByRole('button', { name: 'Mission Analysis', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Orbital Mission Analysis' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('mobile navigation opens, changes section and closes after selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const openButton = page.getByRole('button', { name: 'Open navigation' });
  await expect(openButton).toHaveAttribute('aria-expanded', 'false');
  await openButton.click();

  const closeButton = page.getByRole('button', { name: 'Close navigation' });
  await expect(closeButton).toHaveAttribute('aria-expanded', 'true');
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation.getByRole('button', { name: 'Satellite Tracking', exact: true }).click();

  await expect(page.getByRole('heading', { name: /Satellite tracking & pass planning/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
});

test('mission analysis submits numeric inputs and renders the engine result', async ({ page }) => {
  let requestBody: unknown;
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/api/mission-analysis/orbit', async route => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: true,
        engine: 'Orekit',
        engineVersion: '13.1.9',
        fidelity: 'Orekit Keplerian propagation (two-body)',
        assumptions: ['No J2, drag, solar radiation pressure or third-body forces'],
        orbit: {
          altitudeKm: 550,
          semiMajorAxisKm: 6928.137,
          eccentricity: 0.001,
          inclinationDeg: 97.6,
          periodSeconds: 5738.9928,
          periodMinutes: 95.64988,
          periapsisAltitudeKm: 543.0719,
          apoapsisAltitudeKm: 556.9281,
          circularVelocityKmS: 7.58509,
          specificOrbitalEnergyKm2S2: -28.76678
        },
        comparison: {
          engineAdapter: 'orekit-http',
          status: 'connected',
          note: 'Results returned by the independently hosted Orekit service.'
        }
      })
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Mission Analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();

  await expect(page.getByText(/Analysis completed · Orekit/)).toBeVisible();
  await expect(page.getByText('95.65 min')).toBeVisible();
  await expect(page.getByText('Connected: this result came from the Orekit service.')).toBeVisible();
  expect(requestBody).toEqual({ altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001 });
  expect(pageErrors).toEqual([]);
});

test('mission analysis displays a structured service error and remains usable', async ({ page }) => {
  await page.route('**/api/mission-analysis/orbit', route => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Orekit service is configured but unavailable. Check its deployment and logs.' })
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Mission Analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Orekit service is configured but unavailable.');
  await expect(page.getByRole('button', { name: 'Run analysis', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Orbital Mission Analysis' })).toBeVisible();
});

test('mobile mission analysis rejects an Earth-intersecting orbit without showing metrics', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await mobileNavigation.getByRole('button', { name: 'Mission Analysis', exact: true }).click();

  await page.getByRole('spinbutton', { name: 'Altitude above Earth in kilometres' }).fill('120');
  await page.getByRole('spinbutton', { name: 'Orbit eccentricity' }).fill('0.99');
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('intersects Earth');
  await expect(page.getByText(/Analysis completed/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Run analysis', exact: true })).toBeEnabled();
});

test('invalid engineering orbit inputs produce a visible FAIL in Verification', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Orbit & Maneuver', exact: true }).click();

  await page.locator('.orbit-layout .field-grid label.field').filter({ hasText: 'INCLINATION' }).locator('input').fill('181');
  await page.getByRole('button', { name: 'Verification', exact: true }).click();

  const inputCheck = page.locator('.verification-row').filter({ hasText: 'Engineering inputs valid' });
  await expect(inputCheck).toContainText('FAIL');
  await expect(page.getByText('Engineering inputs valid')).toBeVisible();
});

test('seasonal ground-track overlay matches equinox and solstice calibration', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  const epoch = page.getByLabel('Solar overlay epoch');
  const readSubsolarLatitude = async () => {
    const text = await page.locator('.ground-track-controls span').innerText();
    const match = text.match(/Sub-solar:\s*(-?\d+(?:\.\d+)?)° lat/);
    expect(match).not.toBeNull();
    return Number(match![1]);
  };
  const terminator = page.locator('.ground-track-svg path[stroke="#f59e0b"]');
  const groundTrack = page.locator('.ground-track-svg path[stroke="#51ddff"]');

  await epoch.selectOption('vernal');
  expect(Math.abs(await readSubsolarLatitude())).toBeLessThan(1);
  await expect(terminator).toHaveCount(2);
  await expect(groundTrack.first()).toBeVisible();

  await epoch.selectOption('summer');
  const summerLatitude = await readSubsolarLatitude();
  expect(summerLatitude).toBeGreaterThan(23);
  expect(summerLatitude).toBeLessThan(24);
  await expect(terminator).toHaveCount(2);

  await epoch.selectOption('autumnal');
  expect(Math.abs(await readSubsolarLatitude())).toBeLessThan(1);
  await expect(terminator).toHaveCount(2);

  await epoch.selectOption('winter');
  const winterLatitude = await readSubsolarLatitude();
  expect(winterLatitude).toBeLessThan(-23);
  expect(winterLatitude).toBeGreaterThan(-24);
  await expect(terminator).toHaveCount(2);
  await expect(groundTrack.first()).toBeVisible();
});
