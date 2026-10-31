import { expect, test } from '@playwright/test';
import { fitCameraDistance, MOON_CAMERA_MARGIN, SYSTEM_CAMERA_MARGIN } from '../../src/earth3dMath';

test('Earth 3D exposes responsive camera modes and lunar layer controls', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible({ timeout: 15_000 });
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

  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
  const cameraModes = page.locator('[aria-label="Camera modes"]');
  await cameraModes.getByRole('button', { name: 'MOON', exact: true }).click();
  await expect(cameraModes.getByRole('button', { name: 'MOON', exact: true })).toHaveClass(/active/);

  const lunarLayer = page.getByRole('checkbox', { name: 'Show Moon and lunar orbit' });
  await expect(lunarLayer).toBeVisible();
  await expect(lunarLayer).toBeChecked();
});

test('Earth 3D camera controls are keyboard-operable and fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Simulation', exact: true }).click();

  await expect(page.getByLabel('Interactive 3D Earth with trackable spacecraft')).toBeVisible();
  const cameraModes = page.locator('[aria-label="Camera modes"]');
  const moon = cameraModes.getByRole('button', { name: 'MOON', exact: true });
  await moon.focus();
  await expect(moon).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(moon).toHaveClass(/active/);

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(pageErrors).toEqual([]);
});

test('Earth 3D creates a live WebGL canvas and keeps its drawing buffer sized to the viewport', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const navigationStart = Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
  const canvas = page.locator('.earth3d-canvas canvas');
  await expect(canvas).toBeVisible();

  const initial = await canvas.evaluate((element: HTMLCanvasElement) => {
    const gl = element.getContext('webgl2') ?? element.getContext('webgl');
    return {
      width: element.width,
      height: element.height,
      cssWidth: element.getBoundingClientRect().width,
      cssHeight: element.getBoundingClientRect().height,
      hasWebGL: Boolean(gl && gl.getContextAttributes()),
      drawingBufferWidth: gl?.drawingBufferWidth ?? 0,
      drawingBufferHeight: gl?.drawingBufferHeight ?? 0
    };
  });
  expect(initial.hasWebGL).toBe(true);
  expect(initial.width).toBeGreaterThan(0);
  expect(initial.height).toBeGreaterThan(0);
  expect(initial.drawingBufferWidth).toBeGreaterThan(0);
  expect(initial.drawingBufferHeight).toBeGreaterThan(0);

  const frameCount = await canvas.evaluate(async () => {
    let frames = 0;
    await new Promise<void>(resolve => {
      const start = performance.now();
      const sample = (now: number) => {
        frames += 1;
        if (now - start >= 700) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return frames;
  });
  expect(frameCount).toBeGreaterThan(0);

  // Shrink the viewport: the Earth canvas lives inside a deliberately
  // bounded workspace, so widening the browser does not necessarily widen it.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => canvas.evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(initial.cssWidth);
  const resized = await canvas.evaluate((element: HTMLCanvasElement) => {
    const rect = element.getBoundingClientRect();
    const gl = element.getContext('webgl2') ?? element.getContext('webgl');
    return {
      width: element.width,
      height: element.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
      drawingBufferWidth: gl?.drawingBufferWidth ?? 0,
      drawingBufferHeight: gl?.drawingBufferHeight ?? 0
    };
  });
  expect(resized.width).toBeGreaterThan(0);
  expect(resized.height).toBeGreaterThan(0);
  expect(resized.drawingBufferWidth).toBeGreaterThan(0);
  expect(resized.drawingBufferHeight).toBeGreaterThan(0);
  expect(resized.cssWidth).toBeLessThan(initial.cssWidth);
  expect(resized.cssWidth).toBeGreaterThan(0);
  expect(resized.cssHeight).toBeGreaterThan(0);

  const startupMs = Date.now() - navigationStart;
  test.info().annotations.push({
    type: 'Earth 3D browser baseline',
    description: JSON.stringify({ startupMs, rafCallbacksIn700ms: frameCount, measurementScope: 'Browser requestAnimationFrame callbacks only; not renderer FPS or a physical-device benchmark.', initial, resized })
  });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(message => /WebGL|THREE\.WebGLRenderer|context lost/i.test(message))).toEqual([]);
});

test('Earth 3D reports a recoverable viewport state when WebGL context is lost', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  const canvas = page.locator('.earth3d-canvas canvas');
  await expect(canvas).toBeVisible();

  const lossTriggered = await canvas.evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2') ??
      (element as HTMLCanvasElement).getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  test.skip(!lossTriggered, 'WEBGL_lose_context is unavailable in this browser runtime');
  await expect(page.getByRole('alert')).toContainText('GPU WebGL context was lost');
  await expect(page.getByRole('button', { name: 'Retry GPU Init' })).toBeVisible();
});



test('Earth 3D SYSTEM and MOON reset, pinch, resize and drag preserve fitted framing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Simulation', exact: true }).click();

  const modes = page.locator('[aria-label="Camera modes"]');
  const container = page.locator('.earth3d-canvas');
  const canvas = page.locator('.earth3d-canvas canvas');
  const readDistance = async () => Number(await container.getAttribute('data-camera-distance'));
  const readYaw = async () => Number(await container.getAttribute('data-camera-yaw'));
  const earthRadius = 5.15;
  const moonRadius = earthRadius * (1737.4 / 6378.137);
  const moonDistance = earthRadius * (384400 / 6378.137);
  const systemExtent = moonDistance + moonRadius;
  const fitForContainer = async (extent: number, margin: number) => {
    const size = await container.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
    return fitCameraDistance(size.width, size.height, extent, 42, margin);
  };
  const systemFit = () => fitForContainer(systemExtent, SYSTEM_CAMERA_MARGIN);
  const moonFit = () => fitForContainer(moonRadius, MOON_CAMERA_MARGIN);

  await modes.getByRole('button', { name: 'SYSTEM', exact: true }).click();
  await expect(container).toHaveAttribute('data-camera-mode', 'SYSTEM');
  await expect.poll(readDistance).toBeGreaterThan(500);
  const portraitSystemFit = await systemFit();
  expect(await readDistance()).toBeCloseTo(portraitSystemFit, 1);
  await modes.getByRole('button', { name: 'Reset camera framing', exact: true }).click();
  await expect.poll(readDistance).toBeCloseTo(portraitSystemFit, 1);

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.4;
  const y = box!.y + box!.height * 0.5;
  await canvas.dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch', clientX: x - 40, clientY: y });
  await canvas.dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', clientX: x + 40, clientY: y });
  await canvas.dispatchEvent('pointermove', { pointerId: 12, pointerType: 'touch', clientX: x + 120, clientY: y });
  await expect.poll(readDistance).toBeLessThan(portraitSystemFit - 1);
  const pinchedIn = await readDistance();
  await canvas.dispatchEvent('pointermove', { pointerId: 12, pointerType: 'touch', clientX: x + 40, clientY: y });
  await expect.poll(readDistance).toBeGreaterThan(pinchedIn + 1);
  const pinchedOut = await readDistance();
  const zoomRatio = pinchedOut / portraitSystemFit;
  await canvas.dispatchEvent('pointerup', { pointerId: 12, pointerType: 'touch', clientX: x + 40, clientY: y });
  await canvas.dispatchEvent('pointerup', { pointerId: 11, pointerType: 'touch', clientX: x - 40, clientY: y });

  const yawBeforeDrag = await readYaw();
  await canvas.dispatchEvent('pointerdown', { pointerId: 13, pointerType: 'touch', clientX: x, clientY: y });
  await canvas.dispatchEvent('pointermove', { pointerId: 13, pointerType: 'touch', clientX: x + 45, clientY: y + 10 });
  await canvas.dispatchEvent('pointerup', { pointerId: 13, pointerType: 'touch', clientX: x + 45, clientY: y + 10 });
  await expect.poll(readYaw).not.toBe(yawBeforeDrag);

  await page.setViewportSize({ width: 844, height: 390 });
  const landscapeSystemFit = await systemFit();
  await expect.poll(readDistance).toBeLessThan(pinchedOut);
  expect((await readDistance()) / landscapeSystemFit).toBeCloseTo(zoomRatio, 2);
  await modes.getByRole('button', { name: 'Reset camera framing', exact: true }).click();
  await expect.poll(readDistance).toBeCloseTo(landscapeSystemFit, 1);

  await modes.getByRole('button', { name: 'MOON', exact: true }).click();
  await expect(container).toHaveAttribute('data-camera-mode', 'MOON');
  const landscapeMoonFit = await moonFit();
  await expect.poll(readDistance).toBeCloseTo(landscapeMoonFit, 1);
  await modes.getByRole('button', { name: 'Reset camera framing', exact: true }).click();
  await expect.poll(readDistance).toBeCloseTo(landscapeMoonFit, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(readDistance).toBeGreaterThan(landscapeMoonFit);
  const portraitMoonFit = await moonFit();
  await expect.poll(readDistance).toBeCloseTo(portraitMoonFit, 1);
  expect(pageErrors).toEqual([]);
});

test('Earth 3D captures desktop and mobile Earth-Moon visual evidence without shader errors', async ({ page }) => {
  const pageErrors: string[] = [];
  const shaderErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|WebGLProgram|WebGLRenderer/i.test(message.text())) shaderErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
  await expect(page.locator('.earth3d-canvas canvas')).toBeVisible();
  await page.locator('[aria-label="Camera modes"]').getByRole('button', { name: 'EARTH', exact: true }).click();
  await page.waitForTimeout(400);
  const desktop = await page.screenshot();
  await test.info().attach('earth3d-desktop-1536x1024.png', { body: desktop, contentType: 'image/png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[aria-label="Camera modes"]').getByRole('button', { name: 'SYSTEM', exact: true }).click();
  await page.waitForTimeout(400);
  const mobile = await page.screenshot({ fullPage: true });
  await test.info().attach('earth3d-mobile-system-390x844.png', { body: mobile, contentType: 'image/png' });

  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
});

test('Earth 3D releases its WebGL context on unmount and remounts cleanly', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  const canvas = page.locator('.earth3d-canvas canvas');
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await canvas.evaluate(element => {
    const htmlCanvas = element as HTMLCanvasElement;
    const context = htmlCanvas.getContext('webgl2') ?? htmlCanvas.getContext('webgl');
    if (!context) throw new Error('WebGL context is unavailable for lifecycle verification.');
    (window as any).__earth3dUnmountContext = context;
  });

  await page.getByRole('button', { name: 'Satellite Tracking', exact: true }).click();
  await expect(canvas).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__earth3dUnmountContext?.isContextLost())), { timeout: 10000 }).toBe(true);

  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await canvas.evaluate(element => {
    const htmlCanvas = element as HTMLCanvasElement;
    const context = htmlCanvas.getContext('webgl2') ?? htmlCanvas.getContext('webgl');
    if (!context) throw new Error('WebGL context did not reinitialize after remount.');
    (window as any).__earth3dRemountContext = context;
  });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__earth3dRemountContext && !(window as any).__earth3dRemountContext.isContextLost())), { timeout: 10000 }).toBe(true);
  expect(pageErrors).toEqual([]);
});
