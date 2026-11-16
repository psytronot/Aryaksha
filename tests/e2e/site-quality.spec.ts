import { expect, test } from '@playwright/test';

test('mobile navigation remains usable without horizontal page overflow', async ({ page }) => {
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');

    const initialWidth = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    expect(initialWidth.document, `document overflows at ${width}px`).toBeLessThanOrEqual(initialWidth.viewport);
    expect(initialWidth.body, `body overflows at ${width}px`).toBeLessThanOrEqual(initialWidth.viewport);

  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNavigation).toBeVisible();
    await mobileNavigation.getByRole('button', { name: 'Software Products', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Useful software. Open access. Practical outcomes.' })).toBeVisible();
    const hubWidth = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    expect(hubWidth.document, `software hub overflows at ${width}px`).toBeLessThanOrEqual(hubWidth.viewport);
    expect(hubWidth.body, `software hub body overflows at ${width}px`).toBeLessThanOrEqual(hubWidth.viewport);
  }
});

test('desktop software hub remains within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  await page.getByRole('button', { name: 'Software Products', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'First Customer Finder', exact: true })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
});
