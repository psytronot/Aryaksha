import { expect, test } from '@playwright/test';

const EARTH_RADIUS_SCENE_UNITS = 5.15;
const REFERENCE_ORBIT_ALTITUDE_KM = 550;
const EARTH_RADIUS_KM = 6378.137;
const CAMERA_FOV_DEGREES = 42;

function projectedDiameterFraction(distance: number, width: number, height: number) {
  const verticalFov = CAMERA_FOV_DEGREES * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (width / height));
  const limitingFov = Math.min(verticalFov, horizontalFov);
  return {
    fraction: Math.tan(Math.asin(EARTH_RADIUS_SCENE_UNITS / distance)) / Math.tan(limitingFov / 2),
    limitingFov
  };
}

test('Earth reference framing fills desktop and mobile viewports while retaining the 550 km orbit', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));

  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();

  const canvas = page.locator('.earth3d-canvas');
  const rendererCanvas = canvas.locator('canvas');
  const cameraModes = page.locator('[aria-label="Camera modes"]');
  await expect(rendererCanvas).toBeVisible();
  await cameraModes.getByRole('button', { name: 'EARTH', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-camera-mode', 'EARTH');

  const readViewport = async () => {
    const value = await canvas.getAttribute('data-camera-viewport');
    if (!value) return null;
    const [width, height] = value.split('x').map(Number);
    return { width, height, key: value };
  };
  const readDistance = async () => Number(await canvas.getAttribute('data-camera-distance'));

  await expect.poll(readViewport).not.toBeNull();
  const desktopViewport = await readViewport();
  const desktopDistance = await readDistance();
  expect(desktopViewport).not.toBeNull();
  const desktopProjection = projectedDiameterFraction(desktopDistance, desktopViewport!.width, desktopViewport!.height);
  const referenceOrbitRadius = EARTH_RADIUS_SCENE_UNITS * (1 + REFERENCE_ORBIT_ALTITUDE_KM / EARTH_RADIUS_KM);
  expect(desktopProjection.fraction).toBeGreaterThan(0.86);
  expect(desktopProjection.fraction).toBeLessThan(0.9);
  expect(Math.asin(referenceOrbitRadius / desktopDistance)).toBeLessThan(desktopProjection.limitingFov / 2);
  await testInfo.attach('earth-reference-scale-desktop-1536x1024', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });

  // A portrait resize must recompute the fit, not retain the desktop distance.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await readViewport())?.key).not.toBe(desktopViewport!.key);
  await expect.poll(readDistance).toBeGreaterThan(desktopDistance);
  await expect(canvas).toHaveAttribute('data-camera-mode', 'EARTH');
  const mobileViewport = await readViewport();
  const mobileDistance = await readDistance();
  expect(mobileViewport).not.toBeNull();
  const mobileProjection = projectedDiameterFraction(mobileDistance, mobileViewport!.width, mobileViewport!.height);
  expect(mobileProjection.fraction).toBeGreaterThan(0.86);
  expect(mobileProjection.fraction).toBeLessThan(0.9);
  expect(Math.asin(referenceOrbitRadius / mobileDistance)).toBeLessThan(mobileProjection.limitingFov / 2);
  await testInfo.attach('earth-reference-scale-mobile-390x844', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });

  expect(pageErrors).toEqual([]);
  test.info().annotations.push({
    type: 'Visual-scale basis',
    description: 'Earth camera framing targets approximately 88% of the limiting viewport dimension. The 550 km reference orbit remains inside the 42° camera frustum. Physical Earth and spacecraft scale disclosures are unchanged.'
  });
});
