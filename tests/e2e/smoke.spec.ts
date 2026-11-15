import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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

test('RPOD workspace solves HCW and cross-checks relative propagation with Orekit', async ({ page }) => {
  let requestBody: unknown;
  await page.route('**/api/rpod/relative-state', async route => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: true,
        engine: 'Orekit',
        engineVersion: '13.1.9',
        frame: 'EME2000 / target LVLH',
        epoch: '2000-01-01T12:29:27.816',
        elapsedSeconds: 1800,
        target: { positionKm: [6928, 0, 0], velocityKmS: [0, 7.5, 0] },
        chaser: { positionKm: [6928.1, 0, 0], velocityKmS: [0, 7.5, 0] },
        relativeLvlh: { positionKm: [0.1, -0.2, 0.05], velocityKmS: [0.0001, 0.0002, -0.00005] },
        history: Array.from({ length: 21 }, (_, index) => ({
          elapsedSeconds: index * 90,
          relativeLvlh: {
            positionKm: [0.1 + index * 0.00001, -0.2, 0.05],
            velocityKmS: [0.0001, 0.0002 + index * 0.0000001, -0.00005]
          }
        })),
        assumptions: ['Newtonian central gravity only'],
        comparison: { engineAdapter: 'orekit-rpod-http', status: 'connected' }
      })
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'RPOD Design', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Design a preliminary rendezvous.' })).toBeVisible();
  await page.getByRole('button', { name: 'Solve two-impulse rendezvous', exact: true }).click();
  await expect(page.getByText(/total ideal impulsive Δv/)).toBeVisible();
  await expect(page.getByText(/Maximum sampled separation \/ chief radius/)).toBeVisible();
  await page.getByRole('button', { name: 'Cross-check initial propagation (no burns) against Orekit', exact: true }).click();

  await expect(page.getByText('Orekit propagated LVLH position')).toBeVisible();
  await expect(page.getByText('Orekit relative-state history')).toBeVisible();
  await expect(page.getByText('21 samples')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Orekit versus HCW position residual time series' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Orekit versus HCW velocity residual time series' })).toBeVisible();
  await expect(page.getByText('Orekit epoch (TAI)')).toBeVisible();
  const sent = requestBody as {
    target: { positionKm: number[]; velocityKmS: number[] };
    chaser: { positionKm: number[]; velocityKmS: number[] };
    elapsedSeconds: number;
    epochTai: string;
    historySamples: number;
  };
  expect(sent.target.positionKm).toEqual([6928.137, 0, 0]);
  expect(sent.target.velocityKmS[1]).toBeCloseTo(7.585088535, 8);
  expect(sent.chaser.positionKm).toEqual([6928.237, -0.2, 0.05]);
  expect(sent.chaser.velocityKmS[0]).toBeCloseTo(0.0003189647, 9);
  expect(sent.chaser.velocityKmS[1]).toBeCloseTo(7.585398018, 8);
  expect(sent.elapsedSeconds).toBe(1800);
  expect(sent.epochTai).toBe('2000-01-01T12:00:00');
  expect(sent.historySamples).toBe(21);
});

test('RPOD imports EME2000 mission states and forwards their TAI epoch', async ({ page }) => {
  let requestBody: unknown;
  await page.route('**/api/rpod/relative-state', async route => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        valid: true,
        engine: 'Orekit',
        engineVersion: '13.1.9',
        frame: 'EME2000 / target LVLH',
        epoch: '2026-11-15T12:30:00.000',
        elapsedSeconds: 1800,
        target: { positionKm: [6928.137, 0, 0], velocityKmS: [0, 7.585, 0] },
        chaser: { positionKm: [6928.237, -0.2, 0.05], velocityKmS: [0.0001, 7.585, 0] },
        relativeLvlh: { positionKm: [0.1, -0.2, 0.05], velocityKmS: [0.0001, 0.0002, -0.00005] },
        history: Array.from({ length: 21 }, (_, index) => ({
          elapsedSeconds: index * 90,
          relativeLvlh: { positionKm: [0.1, -0.2, 0.05], velocityKmS: [0.0001, 0.0002, -0.00005] }
        })),
        assumptions: ['Newtonian central gravity only'],
        comparison: { engineAdapter: 'orekit-rpod-http', status: 'connected' }
      })
    });
  });

  const mission = {
    epochTai: '2026-11-15T12:00:00',
    frame: 'EME2000',
    target: { positionKm: [6928.137, 0, 0], velocityKmS: [0, 7.585, 0] },
    chaser: { positionKm: [6928.237, -0.2, 0.05], velocityKmS: [0.0001, 7.585, 0] }
  };

  await page.goto('/');
  await page.getByRole('button', { name: 'RPOD Design', exact: true }).click();
  await page.locator('#rpod-mission-file').setInputFiles({
    name: 'mission-state.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(mission))
  });
  await expect(page.getByText(/Imported target and chaser Cartesian states in EME2000/)).toBeVisible();
  await page.locator('#rpod-epoch-tai').fill('2026-11-15T12:05:00');
  await expect(page.getByText(/at 2026-11-15T12:05:00 TAI/)).toBeVisible();
  await page.getByRole('button', { name: 'Solve two-impulse rendezvous', exact: true }).click();
  await expect(page.getByText('Inertial target / chaser history · EME2000')).toBeVisible();
  await expect(page.getByText('41 samples each')).toBeVisible();
  await expect(page.getByText(/two-body gravity \(RK4, maximum 10 s integration step\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Cross-check imported mission states against Orekit', exact: true }).click();

  await expect(page.getByText('Orekit propagated LVLH position')).toBeVisible();
  await expect(page.getByText('Orekit relative-state history')).toBeVisible();
  await expect(page.getByText(/Imported mission: Orekit relative-state history is available/)).toBeVisible();
  await expect(page.getByText('Orekit vs HCW position difference')).toHaveCount(0);
  expect(requestBody).toMatchObject({
    target: mission.target,
    chaser: mission.chaser,
    elapsedSeconds: 1800,
    epochTai: '2026-11-15T12:05:00',
    historySamples: 21
  });
  await expect(page.getByText('Orekit vs HCW position difference')).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export versioned engineering report (JSON)', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^aryaksha-rpod-report-.*\.json$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const report = JSON.parse(await readFile(downloadPath!, 'utf8'));
  expect(report.schema).toBe('aryaksha.rpod-engineering-report/v1');
  expect(report.mission).toMatchObject({
    epochTai: '2026-11-15T12:05:00',
    stateSource: 'manual-lvlh',
    importedFrame: 'EME2000',
    importedMissionState: { target: mission.target, chaser: mission.chaser }
  });
  expect(report.engineeringLimitations).toContain(
    'HCW rendezvous design uses the manually entered LVLH state; imported EME2000 target/chaser states are retained as provenance and used only for the Orekit cross-check.'
  );
  expect(report.trajectory.length).toBe(41);
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
          elapsedSeconds: 0,
          epoch: '2000-01-01T11:59:27.816',
          timeScale: 'TAI',
          frame: 'EME2000',
          positionKm: [6921.2, 0, 0],
          velocityKmS: [0, -1.0, 7.5]
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
  await expect(page.getByText('Connected: this result came from the Orekit numerical-propagation service.')).toBeVisible();
  expect(requestBody).toEqual({ altitudeKm: 550, inclinationDeg: 97.6, eccentricity: 0.001, elapsedSeconds: 0 });
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
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Orbit & Maneuver', exact: true }).click();

  await page.getByLabel('INCLINATION', { exact: true }).fill('181');
  await page.getByRole('button', { name: 'Verification', exact: true }).click();

  const inputCheck = page.locator('.verification-row').filter({ hasText: 'Engineering inputs valid' });
  await expect(inputCheck).toContainText('FAIL');
  await expect(page.getByText('Engineering inputs valid')).toBeVisible();
});

test('seasonal ground-track overlay matches equinox and solstice calibration', async ({ page }) => {
  test.setTimeout(60_000);
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
