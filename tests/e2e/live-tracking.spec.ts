import { expect, test } from '@playwright/test';

test('satellite tracking retrieves the live CelesTrak station catalogue and predicts passes', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Satellite Tracking', exact: true }).click();
  const catalogStatus = page.getByText(/Live data loaded|Live data unavailable/);
  await expect(catalogStatus).toBeVisible({ timeout: 30_000 });
  const statusText = await catalogStatus.innerText();
  test.info().annotations.push({ type: 'live CelesTrak catalogue', description: statusText });
  expect(statusText, 'The tracking workspace must retrieve the live CelesTrak station catalogue.')
    .toMatch(/^Live data loaded · \d+ objects · Space stations$/);
  await expect(page.getByText('SGP4 / TEME')).toBeVisible();
  await page.getByRole('button', { name: 'Predict next 24 hours' }).click();
  await expect(page.locator('.sat-track-pass-card .sat-track-count'))
    .not.toHaveText('0 passes · 24 h', { timeout: 20_000 });
  await expect(page.getByRole('img', { name: '24-hour timeline of predicted satellite passes' })).toBeVisible();
});
