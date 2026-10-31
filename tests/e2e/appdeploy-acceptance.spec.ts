import { expect, test, type Page } from '@playwright/test';

const issTle = [
  'ISS (ZARYA)',
  '1 25544U 98067A   24001.50000000  .00016717  00000+0  30163-3 0  9990',
  '2 25544  51.6416  17.0426 0004105  61.5794  53.7712 15.50000000432109'
].join('\n') + '\n';

async function openLab(page: Page) {
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Start with the engineering problem.' })).toBeVisible();
}

async function openWorkspace(page: Page, label: string) {
  const openNavigation = page.getByRole('button', { name: 'Open navigation' });
  if (await openNavigation.isVisible().catch(() => false)) {
    await openNavigation.click();
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNavigation).toBeVisible();
    await mobileNavigation.getByRole('button', { name: label, exact: true }).click();
    await expect(openNavigation).toHaveAttribute('aria-expanded', 'false');
    return;
  }
  await page.getByRole('button', { name: label, exact: true }).click();
}

async function stubCelesTrak(page: Page) {
  await page.route('https://celestrak.org/**', route => route.fulfill({
    status: 200,
    contentType: 'text/plain',
    body: issTle
  }));
}

async function loadTrackingAndPredict(page: Page) {
  await page.clock.install({ time: new Date('2024-01-01T12:00:00.000Z') });
  await stubCelesTrak(page);
  await openLab(page);
  await openWorkspace(page, 'Satellite Tracking');
  await expect(page.getByRole('heading', { name: 'Satellite tracking & pass planning' })).toBeVisible();
  await expect(page.getByText('Live data loaded · 1 objects · Space stations')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('LATITUDE · DEG').fill('0');
  await page.getByLabel('LONGITUDE · DEG').fill('0');
  await page.getByLabel('MIN ELEVATION · DEG').fill('0');
  await page.getByRole('button', { name: 'Predict next 24 hours' }).click();
  await expect(page.locator('.sat-track-pass-card .sat-track-count'))
    .not.toHaveText('0 passes · 24 h', { timeout: 20_000 });
}

test.describe('Desktop AppDeploy acceptance scenarios', () => {

  test('1. Complete student engineering workflow with verification', async ({ page }) => {
    await openLab(page);

    await openWorkspace(page, 'Payload');
    await expect(page.getByRole('heading', { name: 'Turn the payload into spacecraft constraints.' })).toBeVisible();
    await expect(page.getByLabel('FOCAL LENGTH')).toBeVisible();
    await expect(page.getByLabel('DETECTOR PITCH')).toBeVisible();

    await openWorkspace(page, 'Spacecraft');
    await expect(page.getByRole('heading', { name: 'Build the vehicle around the mission.' })).toBeVisible();
    for (const label of ['BATTERY', 'THERMAL AREA', 'FREQUENCY', 'THRUST']) {
      await expect(page.getByLabel(label)).toBeVisible();
    }

    await openWorkspace(page, 'Orbit & Maneuver');
    await expect(page.getByRole('heading', { name: 'Make the orbital mechanics visible.' })).toBeVisible();
    await expect(page.getByText('ESTIMATED MANEUVER ΔV')).toBeVisible();

    await openWorkspace(page, 'Simulation');
    await expect(page.getByRole('heading', { name: 'Earth 3D' })).toBeVisible();
    await expect(page.getByLabel('Simulation timeline')).toBeVisible();

    await openWorkspace(page, 'Engineering Analysis');
    for (const module of ['ADCS', 'Propulsion', 'Power', 'Thermal', 'Communications']) {
      await expect(page.locator('.analysis-card').filter({ hasText: module }).first()).toBeVisible();
    }

    await openWorkspace(page, 'Verification');
    await expect(page.getByRole('heading', { name: 'Prove the design meets the requirements.' })).toBeVisible();
    await expect(page.locator('.verification-summary')).toBeVisible();

    await openWorkspace(page, 'Design Report');
    await expect(page.getByRole('heading', { name: 'A traceable preliminary spacecraft design.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export report' })).toBeVisible();
  });

  test('2. Reject invalid engineering inputs instead of returning plausible results', async ({ page }) => {
    await openLab(page);
    await openWorkspace(page, 'Orbit & Maneuver');
    await page.locator('.orbit-layout .field-grid label.field')
      .filter({ hasText: 'ECCENTRICITY' })
      .locator('input')
      .fill('1.2');

    await openWorkspace(page, 'Verification');
    const inputCheck = page.locator('.verification-row').filter({ hasText: 'Engineering inputs valid' });
    await expect(inputCheck).toContainText('FAIL');
    await expect(page.getByText('Engineering inputs valid')).toBeVisible();
  });

  test('3. Ground track and solar terminator match all four seasonal calibration epochs', async ({ page }) => {
    await openLab(page);
    await openWorkspace(page, 'Simulation');

    const epoch = page.getByLabel('Solar overlay epoch');
    const subSolarText = page.locator('.ground-track-controls span');
    const readLatitude = async () => {
      const match = (await subSolarText.innerText()).match(/Sub-solar:\s*(-?\d+(?:\.\d+)?)° lat/);
      expect(match).not.toBeNull();
      return Number(match![1]);
    };
    const terminator = page.locator('.ground-track-svg path[stroke="#f59e0b"]');
    const groundTrack = page.locator('.ground-track-svg path[stroke="#51ddff"]');

    await epoch.selectOption('vernal');
    expect(Math.abs(await readLatitude())).toBeLessThan(0.05);
    await expect(terminator).toHaveCount(2);
    await expect(groundTrack.first()).toBeVisible();

    await epoch.selectOption('summer');
    const summerLatitude = await readLatitude();
    expect(summerLatitude).toBeGreaterThan(23.3);
    expect(summerLatitude).toBeLessThan(23.5);
    await expect(terminator).toHaveCount(2);

    await epoch.selectOption('autumnal');
    expect(Math.abs(await readLatitude())).toBeLessThan(0.05);
    await expect(terminator).toHaveCount(2);

    await epoch.selectOption('winter');
    const winterLatitude = await readLatitude();
    expect(winterLatitude).toBeLessThan(-23.3);
    expect(winterLatitude).toBeGreaterThan(-23.5);
    await expect(terminator).toHaveCount(2);
    await expect(groundTrack.first()).toBeVisible();
  });

  test('4. Satellite tracking validates TLEs and predicts 24-hour passes', async ({ page }) => {
    await loadTrackingAndPredict(page);
    await expect(page.getByText('SGP4 / TEME')).toBeVisible();
    await expect(page.getByText(/AOS|LOS|peak elevation/i).first()).toBeVisible();

    await page.getByPlaceholder(/ISS \(ZARYA\)/).fill('ISS (ZARYA)\nnot-a-line\nnot-a-line');
    await page.getByRole('button', { name: 'Load manual TLE' }).click();
    await expect(page.getByRole('alert')).toContainText('Invalid TLE format');
  });

  test('5. Satellite Ops exposes the sky path, pass timeline and frequency-dependent Doppler estimate', async ({ page }) => {
    await loadTrackingAndPredict(page);
    await page.getByLabel('NOMINAL FREQUENCY · MHz').fill('437.5');
    await expect(page.locator('.sat-track-doppler-wide b')).toHaveText(/437\.5\d* MHz/);

    await expect(page.getByRole('img', { name: '24-hour timeline of predicted satellite passes' })).toBeVisible();
    await expect(page.locator('.sat-track-world-current')).toBeVisible();
    await expect(page.locator('.sat-track-world-station')).toBeVisible();

    const firstPass = page.getByRole('button', { name: 'Select pass 1' });
    await expect(firstPass).toBeVisible();
    await firstPass.click();
    await expect(firstPass).toHaveClass(/selected/);
    await expect(page.getByRole('img', { name: 'Polar sky plot with north at the top and elevation rings' })).toBeVisible();
    await expect(page.locator('.sat-track-sky-path')).toBeVisible();
    await expect(page.locator('.sat-track-doppler-grid').getByText(/km\/s$/)).toBeVisible();
  });
});

test.describe('Mobile AppDeploy acceptance scenarios', () => {
  test.use({
    viewport: { width: 412, height: 915 },
    screen: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });

  test('6. Mobile catalog selection, filtering and pass CSV export', async ({ page }) => {
    await page.clock.install({ time: new Date('2024-01-01T12:00:00.000Z') });
    await stubCelesTrak(page);
    await openLab(page);

    const openNavigation = page.getByRole('button', { name: 'Open navigation' });
    await expect(openNavigation).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
    await openNavigation.click();
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNavigation).toBeVisible();
    await mobileNavigation.getByRole('button', { name: 'Satellite Tracking', exact: true }).click();
    await expect(openNavigation).toHaveAttribute('aria-expanded', 'false');

    await expect(page.getByRole('heading', { name: 'Satellite tracking & pass planning' })).toBeVisible();
    const group = page.locator('.sat-track-field').filter({ hasText: 'CATALOG GROUP' }).locator('select');
    await group.selectOption('active');
    await expect(page.getByText('Live data loaded · 1 objects · Active satellites')).toBeVisible({ timeout: 20_000 });
    await page.getByPlaceholder('Filter by satellite name').fill('ISS');
    await expect(page.locator('.sat-track-field').filter({ hasText: 'SELECTED OBJECT' }).locator('select option')).toHaveCount(1);

    await page.getByLabel('LATITUDE · DEG').fill('0');
    await page.getByLabel('LONGITUDE · DEG').fill('0');
    await page.getByLabel('MIN ELEVATION · DEG').fill('0');
    await page.getByRole('button', { name: 'Predict next 24 hours' }).click();
    await expect(page.locator('.sat-track-pass-card .sat-track-count'))
      .not.toHaveText('0 passes · 24 h', { timeout: 20_000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export pass predictions as CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('orbital-lab-pass-predictions.csv');
  });

  test('7. Earth-Moon SYSTEM view supports pinch/drag and preserves spacecraft telemetry', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00.000Z') });
    await openLab(page);
    await openWorkspace(page, 'Simulation');

    await expect(page.getByRole('heading', { name: 'Earth 3D' })).toBeVisible();
    const canvas = page.locator('.earth3d-canvas canvas');
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    const cameraModes = page.locator('[aria-label="Camera modes"]');
    const system = cameraModes.getByRole('button', { name: 'SYSTEM', exact: true });
    await system.click();
    await expect(system).toHaveClass(/active/);
    await expect(page.getByLabel('Show Moon and lunar orbit')).toBeChecked();
    await expect(page.getByText(/EARTH–MOON CENTRES 384,400 km/)).toBeVisible();

    const beforePinch = await canvas.screenshot({ timeout: 15_000 });
    await canvas.evaluate(element => {
      const target = element as HTMLCanvasElement;
      target.setPointerCapture = () => {};
      target.releasePointerCapture = () => {};
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dispatch = (type: string, pointerId: number, clientX: number, clientY: number) => {
        target.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'touch',
          isPrimary: pointerId === 1,
          clientX,
          clientY,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1
        }));
      };
      dispatch('pointerdown', 1, centerX - 30, centerY);
      dispatch('pointerdown', 2, centerX + 30, centerY);
      dispatch('pointermove', 2, centerX + 75, centerY);
      dispatch('pointerup', 2, centerX + 75, centerY);
      dispatch('pointerup', 1, centerX - 30, centerY);
    });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const afterPinch = await canvas.screenshot({ timeout: 15_000 });
    expect(Buffer.compare(beforePinch, afterPinch)).not.toBe(0);

    await canvas.evaluate(element => {
      const target = element as HTMLCanvasElement;
      target.setPointerCapture = () => {};
      target.releasePointerCapture = () => {};
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, pointerType: 'touch', clientX: x, clientY: y, buttons: 1 }));
      target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 3, pointerType: 'touch', clientX: x + 35, clientY: y + 18, buttons: 1 }));
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3, pointerType: 'touch', clientX: x + 35, clientY: y + 18, buttons: 0 }));
    });

    const telemetryBeforeModelChange = await page.locator('.telemetry-panel').innerText();
    await page.getByLabel('Choose spacecraft model').selectOption('iss');
    await expect(page.getByLabel('Choose spacecraft model')).toHaveValue('iss');
    await expect(page.locator('.telemetry-panel')).toHaveText(telemetryBeforeModelChange);

    const track = cameraModes.getByRole('button', { name: 'TRACK', exact: true });
    await track.click();
    await expect(track).toHaveClass(/active/);
    await expect(page.locator('.telemetry-panel')).toHaveText(telemetryBeforeModelChange);
  });

  test('9. Mobile Mission Analysis rejects an Earth-intersecting orbit without showing metrics', async ({ page }) => {
    await openLab(page);
    await openWorkspace(page, 'Mission Analysis');
    await page.getByRole('spinbutton', { name: 'Altitude above Earth in kilometres' }).fill('120');
    await page.getByRole('spinbutton', { name: 'Orbit eccentricity' }).fill('0.99');
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText(/periapsis.*intersects Earth|intersects Earth.*periapsis/i, { timeout: 30_000 });
    await expect(page.getByText(/Analysis completed/)).toHaveCount(0);
  });
});

test.describe('Desktop AppDeploy mission-analysis acceptance', () => {

  test('8. Mission Analysis returns validated 600-second Orekit metrics and state vectors', async ({ page }) => {
    test.setTimeout(120_000);
    await openLab(page);
    await openWorkspace(page, 'Mission Analysis');
    await expect(page.getByRole('heading', { name: 'Orbital Mission Analysis' })).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Propagation time from J2000 TAI (seconds)' }).fill('600');
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();

    await expect(page.getByText(/Analysis completed · Orekit/)).toBeVisible({ timeout: 100_000 });
    await expect(page.getByText(/Propagated state · 600\.0 s/)).toBeVisible();
    await expect(page.getByText(/Frame EME2000/)).toBeVisible();
    await expect(page.getByText('Connected: this result came from the Orekit numerical-propagation service.')).toBeVisible();
    await expect(page.getByText(/Newtonian central gravity/)).toBeVisible();
  });
});
