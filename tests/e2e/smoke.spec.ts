import { expect, test } from '@playwright/test';

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
