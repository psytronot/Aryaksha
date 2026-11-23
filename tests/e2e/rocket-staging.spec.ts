import { expect, test } from '@playwright/test';

test('rocket staging optimiser supports multistage objectives, validation and report export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  const sidebar = page.locator('aside.sidebar');
  const explore = sidebar.locator('details').filter({ hasText: 'EXPLORE' });
  if (!(await explore.evaluate(element => (element as HTMLDetailsElement).open))) {
    await explore.locator('summary').click();
  }
  await sidebar.getByRole('button', { name: 'Aerospace Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Rocket staging optimiser' }).first().click();
  await page.getByRole('button', { name: 'Engineering workspace' }).click();

  await expect(page.getByRole('heading', { name: 'Rocket staging optimiser', exact: true })).toBeVisible();
  await expect(page.getByText('CONVERGED', { exact: false })).toBeVisible();

  await page.getByLabel('Number of stages').selectOption('3');
  await expect(page.locator('.aero-stage-fieldset')).toHaveCount(3);
  await page.getByLabel('Number of stages').selectOption('4');
  await expect(page.locator('.aero-stage-fieldset')).toHaveCount(4);

  await page.getByRole('button', { name: 'Meet target Δv' }).click();
  await expect(page.getByLabel('Target ideal Δv')).toBeVisible();
  await page.getByLabel('Target ideal Δv').fill('1000');
  await page.getByLabel('Maximum initial wet mass').fill('200000');
  await expect(page.getByText(/NON CONVERGED|EVALUATION LIMIT/)).toBeVisible();

  await page.getByRole('button', { name: 'Maximise ideal Δv' }).click();
  await page.getByRole('button', { name: 'Run Stage 1 Isp sensitivity' }).click();
  await expect(page.getByText('Stage 1 specific impulse sensitivity')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Markdown report' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('aryaksha-rocket-staging-study.md');
  expect(errors).toEqual([]);
});

test('rocket staging workspace rejects invalid values and fits mobile viewports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  const sidebar = page.locator('aside.sidebar');
  const explore = sidebar.locator('details').filter({ hasText: 'EXPLORE' });
  if (!(await explore.evaluate(element => (element as HTMLDetailsElement).open))) {
    await explore.locator('summary').click();
  }
  await sidebar.getByRole('button', { name: 'Aerospace Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Rocket staging optimiser' }).first().click();
  await page.getByRole('button', { name: 'Engineering workspace' }).click();

  await page.getByLabel('Payload mass').fill('0');
  await expect(page.getByRole('alert')).toContainText('Payload mass');
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
});
