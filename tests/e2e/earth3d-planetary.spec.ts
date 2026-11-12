import { expect, test } from '@playwright/test';


async function prepareViewportScreenshot(page: import('@playwright/test').Page, viewport: import('@playwright/test').Locator) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    for (const element of document.querySelectorAll<HTMLElement>(
      '.earth3d-left-hud, .earth3d-right-hud, .earth3d-timeline, .earth3d-scene-gallery'
    )) {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    }
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() =>
    document.scrollingElement?.scrollTop ?? window.scrollY
  )).toBe(0);
  const heading = page.getByRole('heading', { name: 'Earth 3D', exact: true });
  await expect(heading).toBeInViewport();
  await expect(viewport).toBeInViewport();
  await expect.poll(async () => {
    const bounds = await viewport.boundingBox();
    const height = await page.evaluate(() => window.innerHeight);
    return Boolean(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height + 1);
  }).toBe(true);
}

async function openSimulation(page: import('@playwright/test').Page, mobile: boolean) {
  if (mobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('button', { name: 'Simulation', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible({ timeout: 15_000 });
}

test('desktop solar-system overview exposes all bodies, Saturn rings and preserves mission telemetry', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  const pageErrors: string[] = [];
  const shaderErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|webgl|three/i.test(message.text())) shaderErrors.push(message.text());
  });

  await page.goto('/');
  await openSimulation(page, false);
  const viewport = page.locator('.earth3d-canvas');
  await expect(viewport.locator('canvas')).toBeVisible();
  await expect(viewport).toHaveAttribute('data-planetary-body-count', '9');
  await expect(viewport).toHaveAttribute('data-planetary-orbit-count', '8');
  await expect(viewport).toHaveAttribute('data-planetary-ring-count', '1');
  await expect(viewport).toHaveAttribute('data-planetary-provenance', 'simulated-reference-bodies');

  const telemetryRow = page.locator('.earth3d-telemetry-row').filter({ hasText: 'ECI X / Y / Z' });
  const telemetryLabel = telemetryRow.locator('span');
  const telemetryValue = telemetryRow.locator('b');
  await expect(telemetryLabel).toHaveText('ECI X / Y / Z');
  const telemetryBefore = await telemetryValue.innerText();
  // The scene gallery is intentionally opt-in so it cannot cover the reference globe.
  // Open its disclosure before querying the gallery's scene buttons.
  const timeline = page.getByRole('region', { name: 'Mission timeline and scene gallery' });
  await page.getByRole('button', { name: 'Show mission timeline' }).click();
  await expect(timeline).toBeVisible();
  const solarSystemScene = timeline.getByRole('button', { name: 'Solar system scene', exact: true });
  await solarSystemScene.click();

  await expect(viewport).toHaveAttribute('data-camera-mode', 'PLANETS');
  await expect(viewport).toHaveAttribute('data-planetary-visible', 'true');
  await expect(page.locator('.earth3d-planetary-disclosure')).toBeVisible();
  await expect(viewport).toHaveAttribute('data-planetary-scale-disclosure', 'schematic-not-to-scale-not-ephemeris');
  await prepareViewportScreenshot(page, viewport);
  await page.screenshot({ path: testInfo.outputPath('earth3d-planets-overview-desktop-1536x1024.png'), fullPage: false });

  const planetaryControls = page.getByTestId('earth3d-planetary-controls');
  await planetaryControls.scrollIntoViewIfNeeded();
  const target = planetaryControls.getByRole('combobox', { name: 'Choose planetary camera target' });
  await target.selectOption('Saturn');
  await expect(viewport).toHaveAttribute('data-planetary-selected-body', 'Saturn');
  await expect(viewport).toHaveAttribute('data-camera-mode', 'PLANETS');
  await page.getByRole('button', { name: 'Reset camera framing' }).click();
  await expect(viewport).toHaveAttribute('data-camera-pitch', '0.620000');
  await expect(telemetryLabel).toHaveText('ECI X / Y / Z');
  await expect(telemetryValue).toHaveText(telemetryBefore);
  await prepareViewportScreenshot(page, viewport);
  await page.screenshot({ path: testInfo.outputPath('earth3d-saturn-rings-desktop-1536x1024.png'), fullPage: false });

  // Reload forces Earth3DScene unmount/remount after the planetary group has been allocated.
  await page.reload();
  await openSimulation(page, false);
  const remountedViewport = page.locator('.earth3d-canvas');
  await expect(remountedViewport.locator('canvas')).toBeVisible();
  await expect(remountedViewport).toHaveAttribute('data-planetary-body-count', '9');
  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
});

test('mobile planetary controls remain reachable without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await openSimulation(page, true);
  const viewport = page.locator('.earth3d-canvas');
  await expect(viewport.locator('canvas')).toBeVisible();

  await page.getByRole('button', { name: 'Show mission data panels' }).click();
  const planetaryControls = page.getByTestId('earth3d-planetary-controls');
  await expect(planetaryControls).toBeVisible();
  const enabled = planetaryControls.getByRole('checkbox', { name: 'Enable schematic solar system' });
  await expect(enabled).toBeChecked();
  await enabled.uncheck();
  await expect(viewport).toHaveAttribute('data-camera-mode', 'EARTH');
  await enabled.check();
  await expect(viewport).toHaveAttribute('data-camera-mode', 'PLANETS');
  await expect(viewport).toHaveAttribute('data-planetary-visible', 'true');
  await expect(page.locator('.earth3d-planetary-disclosure')).toBeVisible();
  await page.getByRole('button', { name: 'Hide mission data panels' }).click();
  await expect(page.getByTestId('earth3d-planetary-scale-note')).toBeVisible();
  await prepareViewportScreenshot(page, viewport);
  await page.screenshot({ path: testInfo.outputPath('earth3d-planets-overview-mobile-390x844.png'), fullPage: false });

  await page.getByRole('button', { name: 'Show mission data panels' }).click();
  const target = planetaryControls.getByRole('combobox', { name: 'Choose planetary camera target' });
  await target.selectOption('Jupiter');
  await expect(viewport).toHaveAttribute('data-planetary-selected-body', 'Jupiter');
  await page.getByRole('button', { name: 'Hide mission data panels' }).click();
  const portraitDistance = Number(await viewport.getAttribute('data-camera-distance'));
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => Number(await viewport.getAttribute('data-camera-distance'))).not.toBe(portraitDistance);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(viewport).toHaveAttribute('data-planetary-visible', 'true');
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await prepareViewportScreenshot(page, viewport);
  await page.screenshot({ path: testInfo.outputPath('earth3d-jupiter-mobile-390x844.png'), fullPage: false });
  expect(pageErrors).toEqual([]);
});
