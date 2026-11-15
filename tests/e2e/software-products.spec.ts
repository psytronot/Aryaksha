import { expect, test } from '@playwright/test';

test('software products hub is reachable and presents honest product availability', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Software Products', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Useful software. Open access. Practical outcomes.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Google Maps Scrapper' })).toBeVisible();
  await expect(page.getByText('COMPLIANCE REVIEW')).toBeVisible();
  await expect(page.getByText('Not available as a hosted extraction service')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'First Customer Finder' })).toBeVisible();
  await expect(page.getByText('PILOT PREPARATION')).toBeVisible();
  await expect(page.getByText('Human-reviewed research; no automated outreach')).toBeVisible();

  await expect(page.getByText('Payments are not enabled yet.')).toBeVisible();
  await expect(pageErrors).toEqual([]);
});

test('software products hub remains reachable through mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();

  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation.getByRole('button', { name: 'Software Products', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Useful software. Open access. Practical outcomes.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First Customer Finder' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
});
