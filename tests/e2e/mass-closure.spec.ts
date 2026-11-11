import { expect, test } from '@playwright/test';

test('spacecraft mass closure updates with mission limit and exports a traceable breakdown', async ({ page }) => {
  await page.goto('/');
  await page.locator('.sidebar').getByRole('button', { name: 'Spacecraft', exact: true }).click();
  const closure = page.getByTestId('spacecraft-mass-closure');
  await expect(closure).toContainText('WET MASS: 14.20 kg');
  await expect(closure).toContainText('LIMIT 50 kg · PASS');
  await expect(closure).toContainText('MARGIN 35.80 kg');

  await page.locator('.sidebar').getByRole('button', { name: 'Mission', exact: true }).click();
  await page.getByLabel('MAX MASS').fill('10');
  await page.getByRole('button', { name: 'Spacecraft', exact: true }).click();
  await expect(closure).toContainText('LIMIT 10 kg · FAIL');
  await expect(closure).toContainText('MARGIN -4.20 kg');

  await page.locator('.sidebar').getByRole('button', { name: 'Engineering Analysis', exact: true }).click();
  const massModule = page.locator('.analysis-card').filter({ hasText: 'Mass closure' });
  await expect(massModule.locator('.status')).toHaveText('FAIL');
  await expect(massModule).toContainText('Wet mass');
  await expect(massModule).toContainText('Mass margin');

  await page.locator('.sidebar').getByRole('button', { name: 'Design Report', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/engineering-report\.txt$/);
  const stream = await download.createReadStream();
  let report = '';
  if (stream) for await (const chunk of stream) report += chunk.toString();
  expect(report).toContain('MASS CLOSURE');
  expect(report).toContain('Mass margin: -4.20 kg');
  expect(report).toContain('Mass closure status: FAIL');
});
