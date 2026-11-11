import { expect, test } from '@playwright/test';

test('desktop tutor reopens on hover after the user dismisses it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring' }).click();
  await page.locator('.sidebar').getByRole('button', { name: 'Mission', exact: true }).click();
  const coach = page.getByRole('complementary', { name: 'On-board tutor' });
  await expect(coach).toBeVisible();
  await coach.getByRole('button', { name: 'Close tutor' }).click();
  await expect(coach).toHaveCount(0);
  const field = page.locator('[data-context-label] input:visible, [data-context-label] select:visible').first();
  await expect(field).toBeVisible();
  await field.scrollIntoViewIfNeeded();
  await field.hover();
  await expect(coach).toBeVisible();
  await expect(coach.locator('.coach-location small')).toContainText('POINTING AT:');
});
