import { expect, test } from '@playwright/test';

test('Earth 3D exposes five-upgrade controls and remains usable on touch-sized viewports', async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors: string[] = [];
  const shaderErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|WebGLProgram|WebGLRenderer/i.test(message.text())) shaderErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D' })).toBeAttached();
  await expect(page.locator('.earth3d-workspace')).toBeVisible();
  await expect(page.locator('.earth3d-canvas canvas')).toBeVisible();
  const playPause = page.locator('.earth3d-timeline-actions > button').first();
  await expect(playPause).toHaveText('PLAY');
  await playPause.focus();
  await page.keyboard.press('Enter');
  await expect(playPause).toHaveText('PAUSE');
  await page.keyboard.press('Enter');
  await expect(playPause).toHaveText('PLAY');
  const workspace = page.locator('.earth3d-workspace');
  await page.evaluate(() => { const element = document.querySelector('.earth3d-workspace'); if (element) window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 64); });
  await expect(page.getByText('ORBIT PARAMETERS', { exact: true })).toBeVisible();
  await expect(page.getByText('MISSION INFO', { exact: true })).toBeVisible();
  await expect(page.getByText(/2D Ground Track/)).toBeVisible();
  await page.waitForTimeout(300);

  await expect(page.getByRole('button', { name: 'PLANETS', exact: true })).toBeVisible();
  const target = page.getByRole('combobox', { name: 'Choose camera target' });
  await target.selectOption('Saturn');
  await expect(target).toHaveValue('Saturn');
  await expect(page.getByText(/Planetary view is a labelled schematic, not ephemeris or physical scale/)).toBeVisible();
  await page.getByRole('button', { name: 'SOLAR SYSTEM', exact: true }).click();
  await expect(target).toHaveValue('Overview');
  await page.evaluate(() => { const element = document.querySelector('.earth3d-workspace'); if (element) window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 64); });
  await page.screenshot({ path: 'artifacts/earth3d-planets.png' });
  await page.getByRole('button', { name: 'EARTH + MOON', exact: true }).click();

  await page.locator('.earth-camera-controls').getByRole('button', { name: 'MOON', exact: true }).click();
  await expect(target).toHaveValue('Moon');
  await expect(page.getByText(/EARTH–MOON CENTRES 384,400 km/)).toHaveText(/EARTH–MOON CENTRES 384,400 km/);
  await page.evaluate(() => { const element = document.querySelector('.earth3d-workspace'); if (element) window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 64); });
  await page.screenshot({ path: 'artifacts/earth3d-moon.png' });
  await page.getByRole('button', { name: 'TRACK', exact: true }).click();
  await expect(page.getByText(/SIMULATED · TWO-BODY KEPLER/)).toBeVisible();

  const grid = page.getByRole('checkbox', { name: 'Earth grid / coordinate frame' });
  await expect(grid).toBeVisible();
  await grid.check();
  await expect(grid).toBeChecked();
  const lunarLayer = page.getByRole('checkbox', { name: 'Show Moon and lunar orbit' });
  await expect(lunarLayer).toBeChecked();

  const timeline = page.getByRole('slider', { name: 'Simulation timeline' });
  await expect(timeline).toBeVisible();
  const speed = page.locator('.earth3d-timeline select[aria-label="Playback speed"]');
  await speed.selectOption('2', { force: true });
  await expect(speed).toHaveValue('2');

  await page.locator('.earth-camera-controls').getByRole('button', { name: 'EARTH', exact: true }).click();
  await page.evaluate(() => { const element = document.querySelector('.earth3d-workspace'); if (element) window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 64); });
  await page.screenshot({ path: 'artifacts/earth3d-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(workspace).toBeVisible();
  const workspaceWidth = await workspace.evaluate(element => element.getBoundingClientRect().width);
  expect(workspaceWidth).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: 'PLANETS', exact: true })).toBeVisible();
  await page.evaluate(() => { const element = document.querySelector('.earth3d-workspace'); if (element) window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 64); });
  await page.screenshot({ path: 'artifacts/earth3d-mobile.png' });
  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
});


test('Earth 3D preserves SYSTEM framing, responds to two-pointer touch pinch, and refits after orientation changes', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('button', { name: 'Simulation', exact: true }).click();

    const container = page.locator('.earth3d-canvas');
    const canvas = page.locator('.earth3d-canvas canvas');
    const cameraModes = page.locator('.earth-camera-controls');
    const readDistance = async () => Number(await container.getAttribute('data-camera-distance'));
    await expect(canvas).toBeVisible();

    await cameraModes.getByRole('button', { name: 'SYSTEM', exact: true }).click();
    await expect.poll(readDistance).toBeGreaterThan(500);
    const portraitSystemFit = await readDistance();

    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Earth 3D canvas has no touchable viewport bounds.');
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    await page.evaluate(({ startX, endX, y }) => {
      const canvasElement = document.querySelector('.earth3d-canvas canvas');
      if (!(canvasElement instanceof HTMLCanvasElement)) throw new Error('Earth 3D canvas is unavailable for touch input.');
      const makeTouch = (identifier: number, clientX: number) => new Touch({
        identifier,
        target: canvasElement,
        clientX,
        clientY: y,
        pageX: clientX,
        pageY: y,
        screenX: clientX,
        screenY: y
      });
      const startTouches = [makeTouch(1, startX - 35), makeTouch(2, startX + 35)];
      canvasElement.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: startTouches, targetTouches: startTouches, changedTouches: startTouches }));
      const movedTouches = [makeTouch(1, endX - 65), makeTouch(2, endX + 65)];
      canvasElement.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: movedTouches, targetTouches: movedTouches, changedTouches: movedTouches }));
      canvasElement.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: movedTouches }));
    }, { startX: centerX, endX: centerX, y: centerY });

    // Fail at the event boundary with useful evidence before asserting camera response.
    await expect.poll(() => container.getAttribute('data-touch-start-count')).toBe('1');
    await expect.poll(() => container.getAttribute('data-touch-move-count')).toBe('1');
    await expect(container).toHaveAttribute('data-touch-move-touches', '2');

    await expect.poll(readDistance).toBeLessThan(portraitSystemFit - 1);
    const pinchedSystemDistance = await readDistance();
    await page.getByRole('button', { name: 'Reset camera framing' }).click();
    await expect.poll(readDistance).toBeGreaterThan(pinchedSystemDistance + 1);
    const resetPortraitSystem = await readDistance();
    expect(Math.abs(resetPortraitSystem - portraitSystemFit)).toBeLessThan(1);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(readDistance).toBeLessThan(resetPortraitSystem);
    const landscapeSystemFit = await readDistance();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(readDistance).toBeGreaterThan(landscapeSystemFit);

    await cameraModes.getByRole('button', { name: 'MOON', exact: true }).click();
    await expect.poll(readDistance).toBeGreaterThan(6);
    const portraitMoonFit = await readDistance();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(readDistance).toBeLessThan(portraitMoonFit);
    await page.getByRole('button', { name: 'Reset camera framing' }).click();
    const resetLandscapeMoon = await readDistance();
    expect(resetLandscapeMoon).toBeGreaterThan(2.5);
    expect(resetLandscapeMoon).toBeLessThan(portraitMoonFit);
  } finally {
    await context.close();
  }
});

test('Earth 3D releases its WebGL context on unmount and remounts cleanly', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeAttached();
  const canvas = page.locator('.earth3d-canvas canvas');
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await canvas.evaluate(element => {
    const htmlCanvas = element as HTMLCanvasElement;
    const context = htmlCanvas.getContext('webgl2') ?? htmlCanvas.getContext('webgl');
    if (!context) throw new Error('WebGL context is unavailable for lifecycle verification.');
    (window as any).__earth3dUnmountContext = context;
  });

  await page.locator('.mission-top-nav')
    .getByRole('button', { name: 'Mission', exact: true }).click();
  await expect(canvas).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__earth3dUnmountContext?.isContextLost())), { timeout: 10000 }).toBe(true);

  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeAttached();
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
