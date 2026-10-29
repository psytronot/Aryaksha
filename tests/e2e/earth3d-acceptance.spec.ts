import { expect, test } from '@playwright/test';

test('Earth 3D exposes responsive camera modes and lunar layer controls', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeAttached();
  await expect(page.getByLabel('Interactive 3D Earth with trackable spacecraft')).toBeVisible();

  const cameraModes = page.locator('[aria-label="Camera modes"]');
  await expect(cameraModes.getByRole('button', { name: 'TRACK', exact: true })).toBeVisible();
  await expect(cameraModes.getByRole('button', { name: 'MOON', exact: true })).toBeVisible();
  await expect(cameraModes.getByRole('button', { name: 'SYSTEM', exact: true })).toBeVisible();

  await cameraModes.getByRole('button', { name: 'MOON', exact: true }).click();
  await expect(cameraModes.getByRole('button', { name: 'MOON', exact: true })).toHaveClass(/active/);

  const lunarLayer = page.getByRole('checkbox', { name: 'Show Moon and lunar orbit' });
  await expect(lunarLayer).toBeChecked();
  await lunarLayer.uncheck();
  await expect(lunarLayer).not.toBeChecked();
  await lunarLayer.check();
  await expect(lunarLayer).toBeChecked();

  await cameraModes.getByRole('button', { name: 'TRACK', exact: true }).click();
  await expect(cameraModes.getByRole('button', { name: 'TRACK', exact: true })).toHaveClass(/active/);

  expect(pageErrors).toEqual([]);
});

test('Earth 3D controls remain usable on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await mobileNavigation.getByRole('button', { name: 'Simulation', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeAttached();
  const cameraModes = page.locator('[aria-label="Camera modes"]');
  await cameraModes.getByRole('button', { name: 'MOON', exact: true }).click();
  await expect(cameraModes.getByRole('button', { name: 'MOON', exact: true })).toHaveClass(/active/);

  const lunarLayer = page.getByRole('checkbox', { name: 'Show Moon and lunar orbit' });
  await expect(lunarLayer).toBeVisible();
  await expect(lunarLayer).toBeChecked();
});
