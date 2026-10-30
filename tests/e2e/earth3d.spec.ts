import { expect, test } from '@playwright/test';

test('Earth 3D exposes five-upgrade controls and remains usable on touch-sized viewports', async ({ page }) => {
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
  await lunarLayer.uncheck({ force: true });
  await expect(lunarLayer).not.toBeChecked();
  await lunarLayer.check({ force: true });
  await expect(lunarLayer).toBeChecked();

  const timeline = page.getByRole('slider', { name: 'Simulation timeline' });
  await expect(timeline).toBeVisible();
  const speed = page.locator('.earth3d-timeline select[aria-label="Playback speed"]');
  await speed.selectOption('2', { force: true });
  await expect(speed).toHaveValue('2');

  const playPause = page.locator('.earth3d-timeline-actions > button').first();
  await expect(playPause).toBeVisible();
  await playPause.click({ force: true });
  await expect(playPause).toHaveText('PAUSE');
  await playPause.click({ force: true });
  await expect(playPause).toHaveText('PLAY');

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


test('Earth 3D preserves SYSTEM framing, supports pinch, and refits Moon on viewport changes', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  const container = page.locator('.earth3d-canvas');
  const canvas = page.locator('.earth3d-canvas canvas');
  const cameraModes = page.locator('.earth-camera-controls');
  const readDistance = async () => Number(await container.getAttribute('data-camera-distance'));
  await expect(canvas).toBeVisible();

  await cameraModes.getByRole('button', { name: 'SYSTEM', exact: true }).click();
  await expect.poll(readDistance).toBeGreaterThan(500);
  const systemFit = await readDistance();

  await canvas.evaluate((element) => {
    const dispatch = (type: string, pointerId: number, clientX: number, clientY: number) => {
      element.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId, pointerType: 'touch', clientX, clientY
      }));
    };
    dispatch('pointerdown', 11, 100, 100);
    dispatch('pointerdown', 12, 200, 100);
    dispatch('pointermove', 12, 250, 100);
    dispatch('pointerup', 12, 250, 100);
    dispatch('pointerup', 11, 100, 100);
  });
  await expect.poll(readDistance).toBeLessThan(systemFit - 1);

  await page.getByRole('button', { name: 'Reset camera framing' }).click();
  const resetSystem = await readDistance();
  expect(Math.abs(resetSystem - systemFit)).toBeLessThan(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(readDistance).toBeGreaterThan(resetSystem * 1.5);
  const portraitSystem = await readDistance();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(readDistance).toBeLessThan(portraitSystem);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await expect.poll(readDistance).toBeGreaterThan(resetSystem * 0.98);
  await expect.poll(readDistance).toBeLessThan(resetSystem * 1.02);

  await cameraModes.getByRole('button', { name: 'MOON', exact: true }).click();
  await expect.poll(readDistance).toBeGreaterThan(6);
  const desktopMoon = await readDistance();
  await page.evaluate(() => {
    const element = document.querySelector('.earth3d-workspace');
    if (element) window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 64);
  });
  await page.screenshot({ path: 'artifacts/earth3d-moon-desktop-fit.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(readDistance).toBeGreaterThan(desktopMoon * 1.5);
  const portraitMoon = await readDistance();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(readDistance).toBeLessThan(portraitMoon);
  await page.getByRole('button', { name: 'Reset camera framing' }).click();
  const resetMoon = await readDistance();
  expect(resetMoon).toBeGreaterThan(2.5);
  expect(resetMoon).toBeLessThan(portraitMoon);

  await page.getByRole('button', { name: 'Mission', exact: true }).click();
  await expect(page.locator('.earth3d-canvas canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.locator('.earth3d-canvas canvas')).toBeVisible();
});
