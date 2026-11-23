import { expect, test } from '@playwright/test';

test('default mission verification exposes real pointing and communications shortfalls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Verification', exact: true }).click();
  const checks = page.locator('.verification-table');
  await expect(checks).toBeVisible();
  const pointing = checks.locator('.verification-row').filter({ hasText: 'ADCS-POINT' });
  await expect(pointing.locator('.fail-text')).toHaveText('FAIL');
  await expect(pointing).toContainText('1919.870');
  await expect(pointing).toContainText('2.500');
  const communications = checks.locator('.verification-row').filter({ hasText: 'COMMS-LINK' });
  await expect(communications.locator('.fail-text')).toHaveText('FAIL');
  await expect(communications).toContainText('-53.702');
});
