import { expect, test } from '@playwright/test';

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
