import { expect, test } from '@playwright/test';

test('Earth 3D exposes five-upgrade controls and remains usable on touch-sized viewports', async ({ page }) => {
  const pageErrors: string[] = [];
  const shaderErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|WebGLProgram|WebGLRenderer/i.test(message.text())) shaderErrors.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Earth 3D', exact: true })).toBeVisible();
  await expect(page.locator('.earth3d-canvas canvas')).toBeVisible();
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
  await page.locator('.earth3d-workspace').screenshot({ path: 'artifacts/earth3d-planets.png' });
  await page.getByRole('button', { name: 'EARTH + MOON', exact: true }).click();

  await page.locator('.earth-camera-controls').getByRole('button', { name: 'MOON', exact: true }).click();
  await expect(page.getByText(/EARTH–MOON CENTRES 384,400 km/)).toBeVisible();
  await page.locator('.earth3d-workspace').screenshot({ path: 'artifacts/earth3d-moon.png' });
  await page.getByRole('button', { name: 'TRACK', exact: true }).click();
  await expect(page.getByText(/SIMULATED · TWO-BODY KEPLER/)).toBeVisible();

  const grid = page.getByRole('checkbox', { name: 'Earth grid / coordinate frame' });
  await grid.check();
  await expect(grid).toBeChecked();
  const orbit = page.getByRole('checkbox', { name: 'Spacecraft orbit path' });
  await orbit.uncheck();
  await expect(orbit).not.toBeChecked();

  const timeline = page.getByRole('slider', { name: 'Simulation timeline' });
  await expect(timeline).toBeVisible();
  const speed = page.getByRole('combobox', { name: 'Playback speed' });
  await speed.selectOption('2');
  await expect(speed).toHaveValue('2');

  const playPause = page.locator('.earth3d-timeline-actions button').first();
  const before = (await playPause.innerText()).trim();
  await playPause.click();
  await expect(playPause).toHaveText(before === 'PLAY' ? 'PAUSE' : 'PLAY');

  await page.locator('.earth-camera-controls').getByRole('button', { name: 'EARTH', exact: true }).click();
  const workspace = page.locator('.earth3d-workspace');
  await workspace.screenshot({ path: 'artifacts/earth3d-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(workspace).toBeVisible();
  const workspaceWidth = await workspace.evaluate(element => element.getBoundingClientRect().width);
  expect(workspaceWidth).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: 'PLANETS', exact: true })).toBeVisible();
  await workspace.screenshot({ path: 'artifacts/earth3d-mobile.png' });
  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
});
