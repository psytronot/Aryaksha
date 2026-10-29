import { expect, test } from '@playwright/test';

test('live deployed UI serves the app shell and report-only CSP', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: /Explore Space/ })).toBeVisible();

  const headers = await response?.allHeaders();
  expect(headers?.['content-security-policy-report-only']).toContain("default-src 'self'");
  expect(headers?.['content-security-policy-report-only']).toContain("connect-src 'self' https://celestrak.org");
  expect(pageErrors).toEqual([]);
});

test('live deployed UI renders mission analysis against the versioned response contract', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const requestBodies: Array<Record<string, unknown>> = [];
  await page.route('**/api/mission-analysis/orbit', route => {
    requestBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      valid: true,
      engine: 'Orekit',
      engineVersion: '13.1.9',
      fidelity: 'Orekit numerical propagation (two-body)',
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
      state: {
        elapsedSeconds: 600,
        epoch: '2000-01-01T12:09:27.816',
        timeScale: 'TAI',
        frame: 'EME2000',
        positionKm: [123.456, 456.789, 789.012],
        velocityKmS: [1.234567, 2.345678, 3.456789]
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
  await page.getByRole('spinbutton', { name: 'Propagation time in seconds' }).fill('600');
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();

  await expect(page.getByText(/Analysis completed · Orekit/)).toBeVisible();
  await expect(page.getByText('95.65 min')).toBeVisible();
  await expect(page.getByText(/Epoch 2000-01-01T12:09:27\.816 TAI · Frame EME2000/)).toBeVisible();
  await expect(page.getByText('123.456, 456.789, 789.012')).toBeVisible();
  expect(requestBodies).toHaveLength(1);
  expect(requestBodies[0]).toMatchObject({ elapsedSeconds: 600 });
  expect(pageErrors).toEqual([]);
});

test('live deployed UI loads the lazy simulation, tracking and calculator workspaces', async ({ page }) => {
  const pageErrors: string[] = [];
  const loadedAssets: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/assets/')) loadedAssets.push(response.url());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
  await expect.poll(() => loadedAssets.some(url => /Earth3DScene-[^/]+\.js/.test(url))).toBe(true);

  await page.getByRole('button', { name: 'Satellite Tracking', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Satellite tracking & pass planning' })).toBeVisible();
  await expect.poll(() => loadedAssets.some(url => /SatelliteTrackingView-[^/]+\.js/.test(url))).toBe(true);

  await page.getByRole('button', { name: 'Calculator & Reference', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Engineering tools without leaving the lab.' })).toBeVisible();
  await expect.poll(() => loadedAssets.some(url => /ScientificCalculator-[^/]+\.js/.test(url))).toBe(true);
  expect(pageErrors).toEqual([]);
});
