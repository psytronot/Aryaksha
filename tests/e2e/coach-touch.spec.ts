import { expect, test } from '@playwright/test';

test('touch users can explain engineering results, dismiss the tutor and reopen it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await mobileNavigation.getByRole('button', { name: 'Engineering Analysis', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'See where the spacecraft succeeds or fails.' })).toBeVisible();
  const coach = page.getByRole('complementary', { name: 'On-board tutor' });
  await expect(coach).toBeVisible();

  const metric = page.locator('.analysis-metric[data-context-label]').first();
  await expect(metric).toBeVisible();
  const label = await metric.getAttribute('data-context-label');
  expect(label).toBeTruthy();
  await metric.tap();
  await expect(coach.locator('.coach-location small')).toHaveText('POINTING AT: ' + label);

  for (const name of ['Pin guidance', 'Close tutor']) {
    const button = coach.getByRole('button', { name });
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(40);
    expect(box?.height).toBeGreaterThanOrEqual(40);
  }

  await coach.getByRole('button', { name: 'Close tutor' }).tap();
  await expect(coach).toHaveCount(0);

  await metric.tap();
  await expect(coach).toBeVisible();
  await expect(coach.locator('.coach-location small')).toHaveText('POINTING AT: ' + label);
});
