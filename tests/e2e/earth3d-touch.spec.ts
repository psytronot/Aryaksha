import { expect, test } from '@playwright/test';
import { fitCameraDistance, SYSTEM_CAMERA_MARGIN, SYSTEM_DISPLAY_DISTANCE_RATIO } from '../../src/earth3dMath';

test('Earth 3D responds to native two-pointer touch pinch on mobile Chromium', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.goto('/');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Simulation', exact: true }).click();

  const modes = page.locator('[aria-label="Camera modes"]');
  const container = page.locator('.earth3d-canvas');
  const canvas = page.locator('.earth3d-canvas canvas');
  await expect(canvas).toBeVisible();
  await modes.getByRole('button', { name: 'SYSTEM', exact: true }).click();
  await expect(container).toHaveAttribute('data-camera-mode', 'SYSTEM');

  const readDistance = async () => Number(await container.getAttribute('data-camera-distance'));
  const earthRadius = 5.15;
  const moonRadius = earthRadius * (1737.4 / 6378.137);
  const moonDistance = earthRadius * (384400 / 6378.137);
  const systemExtent = moonDistance * SYSTEM_DISPLAY_DISTANCE_RATIO + moonRadius;
  const viewport = await container.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
  const expectedFit = fitCameraDistance(viewport.width, viewport.height, systemExtent, 42, SYSTEM_CAMERA_MARGIN);
  const initialDistance = await readDistance();
  expect(initialDistance).toBeCloseTo(expectedFit, 1);
  expect(initialDistance).toBeGreaterThan(systemExtent);
  expect(await canvas.evaluate(element => getComputedStyle(element).touchAction)).toBe('none');

  await canvas.evaluate(element => {
    const events: Array<{ type: string; pointerType: string; pointerId: number }> = [];
    (window as Window & { __earth3dTouchEvents?: typeof events }).__earth3dTouchEvents = events;
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      element.addEventListener(type, event => {
        const pointer = event as PointerEvent;
        events.push({ type, pointerType: pointer.pointerType, pointerId: pointer.pointerId });
      });
    }
  });

  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const centerX = bounds!.x + bounds!.width / 2;
  const centerY = bounds!.y + bounds!.height / 2;
  const client = await page.context().newCDPSession(page);
  const dispatch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Array<{ id: number; x: number; y: number; radiusX: number; radiusY: number; force: number }>) =>
    client.send('Input.dispatchTouchEvent', { type, touchPoints });

  await dispatch('touchStart', [
    { id: 1, x: centerX - 30, y: centerY, radiusX: 4, radiusY: 4, force: 1 },
    { id: 2, x: centerX + 30, y: centerY, radiusX: 4, radiusY: 4, force: 1 }
  ]);
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __earth3dTouchEvents?: Array<{ type: string; pointerType: string }> })
      .__earth3dTouchEvents?.filter(event => event.type === 'pointerdown' && event.pointerType === 'touch').length ?? 0
  )).toBe(2);

  await dispatch('touchMove', [
    { id: 1, x: centerX - 30, y: centerY, radiusX: 4, radiusY: 4, force: 1 },
    { id: 2, x: centerX + 120, y: centerY, radiusX: 4, radiusY: 4, force: 1 }
  ]);
  await expect.poll(readDistance).toBeLessThan(initialDistance - 1);
  const pinchedInDistance = await readDistance();

  await dispatch('touchMove', [
    { id: 1, x: centerX - 30, y: centerY, radiusX: 4, radiusY: 4, force: 1 },
    { id: 2, x: centerX + 30, y: centerY, radiusX: 4, radiusY: 4, force: 1 }
  ]);
  await expect.poll(readDistance).toBeGreaterThan(pinchedInDistance + 1);
  const pinchedOutDistance = await readDistance();
  expect(pinchedOutDistance).toBeCloseTo(initialDistance, 1);

  await dispatch('touchEnd', []);
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __earth3dTouchEvents?: Array<{ type: string; pointerType: string }> })
      .__earth3dTouchEvents?.filter(event => event.type === 'pointerup' && event.pointerType === 'touch').length ?? 0
  )).toBe(2);

  // The PLANETS camera reuses the same two-pointer handler but has its own
  // fit-distance baseline; verify native touch pinch in both directions.
  // The scene gallery is opt-in; expose it before selecting the planetary view.
  const timeline = page.getByRole('region', { name: 'Mission timeline and scene gallery' });
  await page.getByRole('button', { name: 'Show mission timeline' }).click();
  await expect(timeline).toBeVisible();
  const solarSystemScene = timeline.getByRole('button', { name: 'Solar system scene', exact: true });
  await solarSystemScene.click();
  await expect(container).toHaveAttribute('data-camera-mode', 'PLANETS');
  await expect(container).toHaveAttribute('data-planetary-visible', 'true');
  await canvas.scrollIntoViewIfNeeded();
  const planetaryBounds = await canvas.boundingBox();
  expect(planetaryBounds).not.toBeNull();
  const planetaryCenterX = planetaryBounds!.x + planetaryBounds!.width / 2;
  const planetaryCenterY = planetaryBounds!.y + planetaryBounds!.height / 2;
  const planetaryInitialDistance = await readDistance();

  await dispatch('touchStart', [
    { id: 3, x: planetaryCenterX - 30, y: planetaryCenterY, radiusX: 4, radiusY: 4, force: 1 },
    { id: 4, x: planetaryCenterX + 30, y: planetaryCenterY, radiusX: 4, radiusY: 4, force: 1 }
  ]);
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __earth3dTouchEvents?: Array<{ type: string; pointerType: string }> })
      .__earth3dTouchEvents?.filter(event => event.type === 'pointerdown' && event.pointerType === 'touch').length ?? 0
  )).toBe(4);

  await dispatch('touchMove', [
    { id: 3, x: planetaryCenterX - 30, y: planetaryCenterY, radiusX: 4, radiusY: 4, force: 1 },
    { id: 4, x: planetaryCenterX + 120, y: planetaryCenterY, radiusX: 4, radiusY: 4, force: 1 }
  ]);
  await expect.poll(readDistance).toBeLessThan(planetaryInitialDistance - 1);
  const planetaryPinchedInDistance = await readDistance();

  await dispatch('touchMove', [
    { id: 3, x: planetaryCenterX - 30, y: planetaryCenterY, radiusX: 4, radiusY: 4, force: 1 },
    { id: 4, x: planetaryCenterX + 30, y: planetaryCenterY, radiusX: 4, radiusY: 4, force: 1 }
  ]);
  await expect.poll(readDistance).toBeGreaterThan(planetaryPinchedInDistance + 1);
  expect(await readDistance()).toBeCloseTo(planetaryInitialDistance, 1);
  await dispatch('touchEnd', []);
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __earth3dTouchEvents?: Array<{ type: string; pointerType: string }> })
      .__earth3dTouchEvents?.filter(event => event.type === 'pointerup' && event.pointerType === 'touch').length ?? 0
  )).toBe(4);

  const eventSummary = await page.evaluate(() => {
    const events = (window as Window & { __earth3dTouchEvents?: Array<{ type: string; pointerType: string }> })
      .__earth3dTouchEvents ?? [];
    return {
      touchPointerTypes: [...new Set(events.map(event => event.pointerType))],
      moveCount: events.filter(event => event.type === 'pointermove' && event.pointerType === 'touch').length,
      downCount: events.filter(event => event.type === 'pointerdown' && event.pointerType === 'touch').length,
      upCount: events.filter(event => event.type === 'pointerup' && event.pointerType === 'touch').length
    };
  });
  expect(eventSummary.touchPointerTypes).toEqual(['touch']);
  expect(eventSummary.downCount).toBe(4);
  expect(eventSummary.moveCount).toBeGreaterThan(0);
  expect(eventSummary.upCount).toBe(4);
  expect(pageErrors).toEqual([]);
  test.info().annotations.push({
    type: 'Touch-input evidence',
    description: 'Chromium CDP Input.dispatchTouchEvent generated touch PointerEvents and exercised pinch-in/pinch-out in SYSTEM and PLANETS camera modes. This is browser-emulated touch input, not a physical-device test.'
  });
  await client.detach();
});
