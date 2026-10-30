import { expect, test, type Page } from '@playwright/test';

const issTle = [
  'ISS (ZARYA)',
  '1 25544U 98067A   24001.50000000  .00016717  00000+0  30163-3 0  9990',
  '2 25544  51.6416  17.0426 0004105  61.5794  53.7712 15.50000000432109'
].join('\n') + '\n';

async function stubCelesTrak(page: Page) {
  await page.route('https://celestrak.org/**', route => route.fulfill({
    status: 200,
    contentType: 'text/plain',
    body: issTle
  }));
}

test('primary engineering workflow connects design, simulation, analysis, verification and report', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Start with the engineering problem.' })).toBeVisible();

  const workspaces = [
    { button: 'Payload', heading: 'Turn the payload into spacecraft constraints.' },
    { button: 'Spacecraft', heading: 'Build the vehicle around the mission.' },
    { button: 'Orbit & Maneuver', heading: 'Make the orbital mechanics visible.' },
    { button: 'Simulation', heading: 'Run the spacecraft, not a picture of it.' },
    { button: 'Engineering Analysis', heading: 'See where the spacecraft succeeds or fails.' },
    { button: 'Verification', heading: 'Prove the design meets the requirements.' },
    { button: 'Design Report', heading: 'A traceable preliminary spacecraft design.' }
  ];
  for (const workspace of workspaces) {
    await page.getByRole('button', { name: workspace.button, exact: true }).click();
    await expect(page.getByRole('heading', { name: workspace.heading, exact: true })).toBeVisible();
  }

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/engineering-report\.txt$/);
});

test('satellite tracking validates TLEs and exposes SGP4 look angles and Doppler estimates', async ({ page }) => {
  await page.clock.install({ time: new Date('2024-01-01T12:00:00.000Z') });
  await stubCelesTrak(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Satellite Tracking', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Satellite tracking & pass planning' })).toBeVisible();
  await expect(page.getByText('Live data loaded · 1 objects · Space stations')).toBeVisible();
  await expect(page.getByText('SGP4 / TEME')).toBeVisible();
  await expect(page.locator('.sat-track-doppler-grid').getByText(/km\/s$/)).toBeVisible();
  await expect(page.locator('.sat-track-doppler-wide b')).toHaveText(/145\.\d{6} MHz/);

  await page.getByPlaceholder(/ISS \(ZARYA\)/).fill('ISS (ZARYA)\nnot-a-line\nnot-a-line');
  await page.getByRole('button', { name: 'Load manual TLE' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid TLE format');

  await page.getByPlaceholder(/ISS \(ZARYA\)/).fill(issTle);
  await page.getByRole('button', { name: 'Load manual TLE' }).click();
  await expect(page.getByText('Manual orbital elements loaded · SGP4 active')).toBeVisible();
  await page.getByLabel('NOMINAL FREQUENCY · MHz').fill('437.5');
  await expect(page.locator('.sat-track-doppler-wide b')).toHaveText(/437\.\d{6} MHz/);
});

test('mobile tracking supports catalogue groups, name filtering and pass CSV export', async ({ page }) => {
  await page.clock.install({ time: new Date('2024-01-01T12:00:00.000Z') });
  await stubCelesTrak(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Satellite Tracking', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Satellite tracking & pass planning' })).toBeVisible();
  const group = page.locator('.sat-track-field').filter({ hasText: 'CATALOG GROUP' }).locator('select');
  await group.selectOption('active');
  await expect(page.getByText('Live data loaded · 1 objects · Active satellites')).toBeVisible();

  await page.getByPlaceholder('Filter by satellite name').fill('ISS');
  await expect(page.locator('.sat-track-field').filter({ hasText: 'SELECTED OBJECT' }).locator('select option')).toHaveCount(1);

  await page.getByLabel('LATITUDE · DEG').fill('0');
  await page.getByLabel('LONGITUDE · DEG').fill('0');
  await page.getByLabel('MIN ELEVATION · DEG').fill('0');
  await page.getByRole('button', { name: 'Predict next 24 hours' }).click();
  await expect(page.locator('.sat-track-pass-card .sat-track-count')).not.toHaveText('0 passes · 24 h', { timeout: 15000 });

  await expect(page.getByRole('img', { name: '24-hour timeline of predicted satellite passes' })).toBeVisible();
  await expect(page.locator('.sat-track-world-current')).toBeVisible();
  await expect(page.locator('.sat-track-world-station')).toBeVisible();
  const firstTimelinePass = page.getByRole('button', { name: 'Select pass 1' });
  await expect(firstTimelinePass).toBeVisible();
  await firstTimelinePass.click();
  await expect(firstTimelinePass).toHaveClass(/selected/);

  await expect(page.getByRole('img', { name: 'Polar sky plot with north at the top and elevation rings' })).toBeVisible();
  await expect(page.locator('.sat-track-sky-path')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export pass predictions as CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('orbital-lab-pass-predictions.csv');
});
