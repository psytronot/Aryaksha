import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1366, height: 900 }]) {
  test(`responsive workspaces fit ${viewport.width}px viewport without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    if (viewport.width <= 800) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page.getByRole('navigation', { name: 'Mobile navigation' })
        .getByRole('button', { name: 'Simulation', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Simulation', exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
    await expect(page.locator('.earth3d-canvas canvas')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      canvasWidth: document.querySelector('.earth3d-canvas')?.getBoundingClientRect().width ?? 0
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.canvasWidth).toBeGreaterThan(0);
    const camera = page.locator('[aria-label="Camera modes"]');
    await expect(camera.getByRole('button', { name: 'EARTH', exact: true })).toBeVisible();
    await expect(camera.getByRole('button', { name: 'MOON', exact: true })).toBeVisible();
  });
}
