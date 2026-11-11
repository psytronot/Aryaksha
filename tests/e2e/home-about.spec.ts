import { expect, test } from '@playwright/test';

test('landing page exposes About the Lab and its educational disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Explore Space/ })).toBeVisible();
  await page.getByRole('button', { name: 'About the Lab', exact: true }).click();
  const about = page.locator('#about-aryaksha');
  await expect(about).toBeVisible();
  await expect(about.getByRole('heading', { name: 'A Space Lab for the Next Generation' })).toBeVisible();
  await expect(about).toContainText('Some tools use public orbital data; simulations are educational models, not flight-certified systems.');
  await expect(about.locator('.about-stewardship')).toContainText('Project author: Anonymous');
  await expect(about.getByLabel('Anonymous authorship')).toContainText('Personal identity intentionally withheld.');
});
