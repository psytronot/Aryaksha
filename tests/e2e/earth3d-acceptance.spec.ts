import { expect, test, type Locator } from '@playwright/test';
import { EARTH_CAMERA_MARGIN, fitCameraDistance, MOON_CAMERA_MARGIN, SYSTEM_CAMERA_MARGIN, SYSTEM_DISPLAY_DISTANCE_RATIO } from '../../src/earth3dMath';

async function disableContextCoach(page: import('@playwright/test').Page) {
  const coachOn = page.getByRole('button', { name: /COACH ON/i });
  if (await coachOn.count()) await coachOn.click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('orbital-lab-coach-enabled')))
    .toBe('false');
  const coachOff = page.getByRole('button', { name: /COACH OFF/i });
  // The setting is intentionally hidden in the compact mobile header.
  if (await coachOff.count()) await expect(coachOff).toHaveAttribute('aria-pressed', 'false');
}

async function assertPointerReachable(locator: Locator, label: string) {
  // Scroll and hit-test the same DOM node in one browser task. Separate
  // locator.evaluate calls can race with the simulation's 4 Hz parent updates.
  const hit = await locator.evaluate(element => {
    element.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'instant'
    });
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const centerInViewport = x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight;
    const target = centerInViewport ? document.elementFromPoint(x, y) : null;
    return {
      centerInViewport,
      receivesPointer: Boolean(target && (target === element || element.contains(target))),
      hitTag: target?.tagName ?? null,
      hitId: target?.id ?? null,
      hitClass: target && typeof target.className === 'string' ? target.className : null
    };
  });
  expect(
    hit.centerInViewport && hit.receivesPointer,
    `${label} is not pointer-reachable at its center: ${JSON.stringify(hit)}`
  ).toBe(true);
}


test('Earth 3D exposes responsive camera modes and lunar layer controls', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await disableContextCoach(page);
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Interactive 3D Earth with trackable spacecraft')).toBeVisible();

  const cameraModes = page.locator('[aria-label="Camera modes"]');
  await expect(cameraModes.getByRole('button', { name: 'TRACK', exact: true })).toBeVisible();
  await expect(cameraModes.getByRole('button', { name: 'MOON', exact: true })).toBeVisible();
  await expect(cameraModes.getByRole('button', { name: 'SYSTEM', exact: true })).toBeVisible();

  await cameraModes.getByRole('button', { name: 'MOON', exact: true }).click();
  await expect(cameraModes.getByRole('button', { name: 'MOON', exact: true })).toHaveClass(/active/);

  const referenceGrid = page.getByRole('checkbox', { name: 'Reference grid' });
  const canvasContainer = page.locator('.earth3d-canvas');
  await expect(referenceGrid).not.toBeChecked();
  await expect.poll(() => canvasContainer.getAttribute('data-grid-visible')).toBe('false');
  await referenceGrid.check();
  await expect.poll(() => canvasContainer.getAttribute('data-grid-visible')).toBe('true');
  await referenceGrid.uncheck();
  await expect.poll(() => canvasContainer.getAttribute('data-grid-visible')).toBe('false');

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

  await page.getByRole('button', { name: 'Show mission data panels' }).click();
  const lunarLayer = page.getByRole('checkbox', { name: 'Show Moon and lunar orbit' });
  await expect(lunarLayer).toBeVisible();
  await expect(lunarLayer).toBeChecked();
});

test('AppDeploy PWA install host cannot intercept Earth 3D camera controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const appendInstallHost = () => {
      const host = document.createElement('pwa-install');
      host.id = 'pwa-install';
      Object.assign(host.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        pointerEvents: 'auto'
      });
      document.body.append(host);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', appendInstallHost, { once: true });
    } else {
      appendInstallHost();
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Simulation', exact: true }).click();

  const installHost = page.locator('pwa-install');
  await expect(installHost).toHaveCount(1);
  await expect.poll(() => installHost.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none');
  await expect.poll(() => page.locator('html').evaluate(element =>
    element.classList.contains('earth3d-active')
  )).toBe(true);
  await expect(installHost).toBeHidden();
  const system = page.locator('[aria-label="Camera modes"]')
    .getByRole('button', { name: 'SYSTEM', exact: true });
  await system.click();
  await expect(system).toHaveClass(/active/);
});

test('Earth 3D camera controls are keyboard-operable and fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
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
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await disableContextCoach(page);
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
  const canvas = page.locator('.earth3d-canvas canvas');
  await expect(canvas).toBeVisible();
  const workspace = page.locator('.earth3d-workspace');
  await expect.poll(() => workspace.evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
  )).toBe(2);
  // At 1280px, the two-column workspace leaves a 318px WebGL content box
  // after the main gutter and scene border; assert the measured usable width.
  await expect.poll(() => canvas.evaluate(element => element.getBoundingClientRect().width))
    .toBeGreaterThanOrEqual(318);

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
  expect(initial.cssWidth).toBeGreaterThanOrEqual(318);

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

  // A narrow viewport collapses the desktop side rails into a single column.
  // The canvas may therefore grow relative to its desktop centre column; verify
  // that it fills the available mobile workspace without horizontal overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => canvas.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(320);
  const resized = await canvas.evaluate((element: HTMLCanvasElement) => {
    const rect = element.getBoundingClientRect();
    const workspace = element.closest('.earth3d-workspace') as HTMLElement;
    const workspaceRect = workspace.getBoundingClientRect();
    const workspaceStyle = getComputedStyle(workspace);
    const horizontalPadding = parseFloat(workspaceStyle.paddingLeft) + parseFloat(workspaceStyle.paddingRight);
    const gl = element.getContext('webgl2') ?? element.getContext('webgl');
    return {
      width: element.width,
      height: element.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
      availableWidth: workspaceRect.width - horizontalPadding,
      drawingBufferWidth: gl?.drawingBufferWidth ?? 0,
      drawingBufferHeight: gl?.drawingBufferHeight ?? 0
    };
  });
  expect(resized.width).toBeGreaterThan(0);
  expect(resized.height).toBeGreaterThan(0);
  expect(resized.drawingBufferWidth).toBeGreaterThan(0);
  expect(resized.drawingBufferHeight).toBeGreaterThan(0);
  expect(resized.cssWidth).toBeGreaterThanOrEqual(320);
  expect(resized.cssWidth).toBeLessThanOrEqual(resized.availableWidth + 1);
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
  test.setTimeout(60_000);
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
  const systemExtent = moonDistance * SYSTEM_DISPLAY_DISTANCE_RATIO + moonRadius;
  const fitForContainer = async (extent: number, margin: number) => {
    const size = await container.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
    return fitCameraDistance(size.width, size.height, extent, 42, margin);
  };
  const systemFit = () => fitForContainer(systemExtent, SYSTEM_CAMERA_MARGIN);
  const moonFit = () => fitForContainer(moonRadius, MOON_CAMERA_MARGIN);
  const earthFit = () => fitForContainer(earthRadius, EARTH_CAMERA_MARGIN);
  const limitingFov = async () => {
    const size = await container.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
    const vertical = 42 * Math.PI / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * (size.width / size.height));
    return Math.min(vertical, horizontal);
  };
  const apparentDiameterFraction = (radius: number, distance: number, fov: number) => 2 * Math.asin(radius / distance) / fov;

  await modes.getByRole('button', { name: 'EARTH', exact: true }).click();
  await expect(container).toHaveAttribute('data-camera-mode', 'EARTH');
  const portraitEarthFit = await earthFit();
  await expect.poll(readDistance).toBeCloseTo(portraitEarthFit, 1);
  await modes.getByRole('button', { name: 'Reset camera framing', exact: true }).click();
  await expect.poll(readDistance).toBeCloseTo(portraitEarthFit, 1);
  await page.setViewportSize({ width: 844, height: 390 });
  const landscapeEarthFit = await earthFit();
  await expect.poll(readDistance).toBeCloseTo(landscapeEarthFit, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(readDistance).toBeCloseTo(portraitEarthFit, 1);

  await modes.getByRole('button', { name: 'SYSTEM', exact: true }).click();
  await expect(container).toHaveAttribute('data-camera-mode', 'SYSTEM');
  const portraitSystemFit = await systemFit();
  await expect.poll(readDistance).toBeCloseTo(portraitSystemFit, 1);
  expect(portraitSystemFit).toBeGreaterThan(systemExtent);
  expect(portraitSystemFit).toBeLessThan(300);
  await expect(page.locator('.earth3d-hud-card').filter({ hasText: 'PHYSICAL SCALE' })).toContainText('44.4×');
  const portraitFov = await limitingFov();
  expect(apparentDiameterFraction(earthRadius, portraitSystemFit, portraitFov)).toBeGreaterThan(0.4);
  expect(apparentDiameterFraction(moonRadius, portraitSystemFit, portraitFov)).toBeGreaterThan(0.1);
  await modes.getByRole('button', { name: 'Reset camera framing', exact: true }).click();
  await expect.poll(readDistance).toBeCloseTo(portraitSystemFit, 1);

  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeInViewport();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.4;
  const y = box!.y + box!.height * 0.5;
  expect(y).toBeGreaterThan(0);
  expect(y).toBeLessThan(844);
  // Two simultaneous touch PointerEvents exercise the same handler path used by native pinch input.
  expect(await canvas.evaluate(element => getComputedStyle(element).touchAction)).toBe('none');
  await canvas.dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch', clientX: x - 40, clientY: y, button: 0, buttons: 1 });
  await canvas.dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', clientX: x + 40, clientY: y, button: 0, buttons: 1 });
  await canvas.dispatchEvent('pointermove', { pointerId: 12, pointerType: 'touch', clientX: x + 120, clientY: y, button: 0, buttons: 1 });
  await expect.poll(readDistance).toBeLessThan(portraitSystemFit - 1);
  const pinchedIn = await readDistance();
  await canvas.dispatchEvent('pointermove', { pointerId: 12, pointerType: 'touch', clientX: x + 40, clientY: y, button: 0, buttons: 1 });
  await expect.poll(readDistance).toBeGreaterThan(pinchedIn + 1);
  const pinchedOut = await readDistance();
  const zoomRatio = pinchedOut / portraitSystemFit;
  await canvas.dispatchEvent('pointerup', { pointerId: 12, pointerType: 'touch', clientX: x + 40, clientY: y, button: 0, buttons: 0 });
  await canvas.dispatchEvent('pointerup', { pointerId: 11, pointerType: 'touch', clientX: x - 40, clientY: y, button: 0, buttons: 0 });

  const yawBeforeDrag = await readYaw();
  await canvas.dispatchEvent('pointerdown', { pointerId: 13, pointerType: 'touch', clientX: x, clientY: y, button: 0, buttons: 1 });
  await canvas.dispatchEvent('pointermove', { pointerId: 13, pointerType: 'touch', clientX: x + 45, clientY: y + 10, button: 0, buttons: 1 });
  await canvas.dispatchEvent('pointerup', { pointerId: 13, pointerType: 'touch', clientX: x + 45, clientY: y + 10, button: 0, buttons: 0 });
  await expect.poll(readYaw).not.toBe(yawBeforeDrag);

  await page.setViewportSize({ width: 844, height: 390 });
  const landscapeSize = await container.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
  await expect.poll(async () => container.getAttribute('data-camera-viewport')).toBe(`${landscapeSize.width}x${landscapeSize.height}`);
  const landscapeSystemFit = await systemFit();
  await expect.poll(async () => (await readDistance()) / landscapeSystemFit).toBeCloseTo(zoomRatio, 2);
  const resetAfterResize = modes.getByRole('button', { name: 'Reset camera framing', exact: true });
  await resetAfterResize.scrollIntoViewIfNeeded();
  await expect(resetAfterResize).toBeVisible();
  await resetAfterResize.click({ timeout: 15_000 });
  await expect.poll(readDistance).toBeCloseTo(landscapeSystemFit, 1);

  await modes.getByRole('button', { name: 'MOON', exact: true }).click();
  await expect(container).toHaveAttribute('data-camera-mode', 'MOON');
  const landscapeMoonFit = await moonFit();
  await expect.poll(readDistance).toBeCloseTo(landscapeMoonFit, 1);
  await modes.getByRole('button', { name: 'Reset camera framing', exact: true }).click();
  await expect.poll(readDistance).toBeCloseTo(landscapeMoonFit, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  // Wait for the canvas's ResizeObserver-driven viewport measurement before deriving
  // the portrait fit. A portrait canvas can have a wider horizontal FOV than the
  // narrow/tall intermediate-desktop canvas, so distance is not monotonically larger.
  await expect.poll(async () => {
    const size = await container.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
    return await container.getAttribute('data-camera-viewport') === `${size.width}x${size.height}`;
  }).toBe(true);
  const portraitMoonFit = await moonFit();
  await expect.poll(readDistance).toBeCloseTo(portraitMoonFit, 1);
  expect(pageErrors).toEqual([]);
});

test('Earth 3D mission-control rails stay outside the globe and support full screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    let activeFullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => activeFullscreenElement
    });
    Element.prototype.requestFullscreen = async function () {
      activeFullscreenElement = this;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    document.exitFullscreen = async () => {
      activeFullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
  });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Show mission data panels' }).click();

  const workspace = page.locator('.earth3d-workspace');
  const canvas = page.locator('.earth3d-canvas');
  const leftRail = page.getByRole('complementary', { name: 'Mission setup, state and orbital details' });
  const rightRail = page.getByRole('complementary', { name: 'Simulation controls and live telemetry' });
  await expect(canvas).toBeVisible();
  await expect(leftRail).toBeVisible();
  await expect(rightRail).toBeVisible();
  await expect(page.getByText('SIMULATED MISSION OBJECT')).toBeVisible();
  await expect(page.locator('.earth3d-source-badge')).toHaveText('SIMULATED');
  await expect(page.getByText('TRACKING OBJECT')).toHaveCount(0);
  expect(await leftRail.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  expect(await rightRail.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  const canvasBox = await canvas.boundingBox();
  const leftBox = await leftRail.boundingBox();
  const rightBox = await rightRail.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(leftBox!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height - 1);
  expect(rightBox!.y).toBeGreaterThanOrEqual(leftBox!.y + leftBox!.height - 1);

  await page.getByRole('button', { name: 'Enter full screen' }).click();
  await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await expect(page.getByRole('button', { name: 'Enter full screen' })).toBeVisible();
  await expect(workspace).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(250);
  const mediumCanvasBox = await canvas.boundingBox();
  const mediumLeftBox = await leftRail.boundingBox();
  const mediumRightBox = await rightRail.boundingBox();
  expect(mediumCanvasBox).not.toBeNull();
  expect(mediumLeftBox).not.toBeNull();
  expect(mediumRightBox).not.toBeNull();
  expect(mediumCanvasBox!.width).toBeGreaterThan(350);
  expect(mediumLeftBox!.x + mediumLeftBox!.width).toBeLessThanOrEqual(mediumCanvasBox!.x + 1);
  expect(mediumRightBox!.y).toBeGreaterThanOrEqual(mediumCanvasBox!.y + mediumCanvasBox!.height - 1);
});
test('Earth 3D captures desktop and mobile Earth-Moon visual evidence without shader errors', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const shaderErrors: string[] = [];
  const planetaryProxyRequests: string[] = [];
  const directSvsRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/imagery/')) planetaryProxyRequests.push(url.pathname);
    if (url.hostname === 'svs.gsfc.nasa.gov') directSvsRequests.push(request.url());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|WebGLProgram|WebGLRenderer/i.test(message.text())) shaderErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await page.locator('.earth3d-canvas canvas').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
  await expect(page.locator('.earth3d-canvas canvas')).toBeVisible();
  await expect(page.getByTestId('earth-imagery-status')).toHaveAttribute('data-imagery-state', 'nasa', { timeout: 30_000 });
  await expect(page.getByTestId('earth-imagery-status')).toContainText('NASA Blue Marble');
  await expect(page.getByTestId('earth-imagery-status')).toContainText('NASA Black Marble');
  const imageryCanvas = page.locator('.earth3d-canvas');
  await expect(imageryCanvas).toHaveAttribute('data-earth-atmosphere-model', 'sun-driven-rayleigh-limb-v1');
  await expect(imageryCanvas).toHaveAttribute('data-earth-atmosphere-polar-lighting', 'solar-incidence');
  await expect(imageryCanvas).toHaveAttribute('data-earth-imagery-cloud', /^(nasa-noaa-cpc-clouds-2014-06-02|procedural-cloud-fallback)$/, { timeout: 30_000 });
  await expect(imageryCanvas).toHaveAttribute('data-earth-imagery-moon-color', /^(nasa-lroc-color-2025|procedural-lunar-fallback)$/, { timeout: 30_000 });
  await expect(imageryCanvas).toHaveAttribute('data-earth-imagery-moon-elevation', /^(nasa-lola-elevation-2019|no-elevation-fallback)$/, { timeout: 30_000 });
  const planetarySourceState = await imageryCanvas.evaluate(element => {
    const data = (element as HTMLElement).dataset;
    return {
      clouds: data.earthImageryCloud || '',
      moonColor: data.earthImageryMoonColor || '',
      moonElevation: data.earthImageryMoonElevation || '',
      failures: data.earthImageryPlanetaryFailures || ''
    };
  });
  await test.info().attach('planetary-imagery-source-state.json', {
    body: JSON.stringify(planetarySourceState, null, 2),
    contentType: 'application/json'
  });
  if (planetarySourceState.clouds === 'procedural-cloud-fallback') {
    expect(planetarySourceState.failures).toMatch(/(?:^|;)clouds:/);
    await expect(page.getByTestId('earth-imagery-status')).toContainText('Procedural cloud fallback');
  } else {
    await expect(page.getByTestId('earth-imagery-status')).toContainText('NASA/NOAA CPC clouds');
  }
  if (planetarySourceState.moonColor === 'procedural-lunar-fallback') {
    expect(planetarySourceState.failures).toMatch(/(?:^|;)moonColor:/);
    await expect(page.getByTestId('earth-imagery-status')).toContainText('Procedural lunar fallback');
  } else {
    await expect(page.getByTestId('earth-imagery-status')).toContainText('NASA LROC Moon');
  }
  if (planetarySourceState.moonElevation === 'no-elevation-fallback') {
    expect(planetarySourceState.failures).toMatch(/(?:^|;)moonElevation:/);
  }
  const cameraModes = page.locator('[aria-label="Camera modes"]');
  await cameraModes.getByRole('button', { name: 'EARTH', exact: true }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('.earth3d-workspace')).toBeInViewport();
  const desktopPath = test.info().outputPath('earth3d-desktop-earth-1536x1024.png');
  await page.screenshot({ path: desktopPath, timeout: 60_000, animations: 'disabled' });
  await test.info().attach('earth3d-desktop-earth-1536x1024.png', { path: desktopPath, contentType: 'image/png' });

  await cameraModes.getByRole('button', { name: 'MOON', exact: true }).click();
  await page.waitForTimeout(400);
  const moonPath = test.info().outputPath('earth3d-desktop-moon-1536x1024.png');
  await page.screenshot({ path: moonPath, timeout: 60_000, animations: 'disabled' });
  await test.info().attach('earth3d-desktop-moon-1536x1024.png', { path: moonPath, contentType: 'image/png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await cameraModes.getByRole('button', { name: 'SYSTEM', exact: true }).click();
  const mobileCanvas = page.locator('.earth3d-canvas');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(mobileCanvas).toBeInViewport();
  await page.waitForTimeout(400);
  const mobilePath = test.info().outputPath('earth3d-mobile-system-390x844.png');
  await page.screenshot({ path: mobilePath, timeout: 60_000, animations: 'disabled' });
  await test.info().attach('earth3d-mobile-system-390x844.png', { path: mobilePath, contentType: 'image/png' });

  const mobileCanvasBounds = await mobileCanvas.boundingBox();
  expect(mobileCanvasBounds).not.toBeNull();
  const focalPoint = {
    x: mobileCanvasBounds!.x + mobileCanvasBounds!.width / 2,
    y: mobileCanvasBounds!.y + mobileCanvasBounds!.height / 2
  };
  for (const selector of ['.earth3d-topbar', '.earth3d-left-hud', '.earth3d-right-hud', '.earth3d-bottom-bar']) {
    const overlayBounds = await page.locator(selector).boundingBox();
    if (!overlayBounds) continue;
    const obscuresFocalPoint =
      focalPoint.x >= overlayBounds.x &&
      focalPoint.x <= overlayBounds.x + overlayBounds.width &&
      focalPoint.y >= overlayBounds.y &&
      focalPoint.y <= overlayBounds.y + overlayBounds.height;
    expect(obscuresFocalPoint, `${selector} must not cover the mobile Earth–Moon focal point`).toBe(false);
  }

  expect(planetaryProxyRequests.sort()).toEqual([
    '/api/imagery/nasa-lola-elevation-2019',
    '/api/imagery/nasa-lroc-color-2025',
    '/api/imagery/nasa-noaa-cpc-clouds-2014-06-02'
  ]);
  expect(directSvsRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(shaderErrors).toEqual([]);
});

test('Earth 3D uses deterministic local textures when NASA imagery is blocked by CORS', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('https://assets.science.nasa.gov/**', route => route.abort('blockedbyclient'));
  await page.route('**/api/imagery/**', route => route.abort('blockedbyclient'));
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
  const imageryStatus = page.getByTestId('earth-imagery-status');
  await expect(imageryStatus).toHaveAttribute('data-imagery-state', 'fallback', { timeout: 15_000 });
  await expect(imageryStatus).toContainText('Cartographic fallback');
  const sources = await page.locator('.earth3d-canvas').evaluate(element => ({
    albedo: (element as HTMLElement).dataset.earthImageryAlbedo,
    nightLights: (element as HTMLElement).dataset.earthImageryNightLights
  }));
  expect(sources).toEqual({
    albedo: 'cartographic-fallback',
    nightLights: 'transparent-fallback'
  });
  await expect(page.locator('.earth3d-canvas')).toHaveAttribute('data-earth-imagery-cloud', 'procedural-cloud-fallback');
  await expect(page.locator('.earth3d-canvas')).toHaveAttribute('data-earth-imagery-moon-color', 'procedural-lunar-fallback');
  await expect(page.locator('.earth3d-canvas')).toHaveAttribute('data-earth-imagery-moon-elevation', 'no-elevation-fallback');
  await expect(page.locator('.earth3d-canvas')).toHaveAttribute('data-earth-imagery-planetary-failures', /clouds:|moonColor:|moonElevation:/);
  await expect(page.getByTestId('earth-imagery-status')).toContainText('Procedural cloud fallback');
  await expect(page.getByTestId('earth-imagery-status')).toContainText('Procedural lunar fallback');
  await expect(page.locator('.earth3d-canvas canvas')).toBeVisible();
  expect(pageErrors).toEqual([]);
});


test('Earth 3D desktop timeline is opt-in and never overlays the globe', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  const workspace = page.locator('.earth3d-workspace');
  const canvas = page.locator('.earth3d-canvas');
  const bottomBar = page.locator('.earth3d-bottom-bar');
  const timeline = page.getByRole('region', { name: 'Mission timeline and scene gallery' });
  const toggle = page.getByRole('button', { name: 'Show mission timeline' });
  await expect(timeline).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(workspace).toHaveAttribute('data-timeline-open', 'false');

  await toggle.click();
  await expect(timeline).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide mission timeline' })).toHaveAttribute('aria-expanded', 'true');
  await expect(workspace).toHaveAttribute('data-timeline-open', 'true');

  const canvasBox = await canvas.boundingBox();
  const bottomBarBox = await bottomBar.boundingBox();
  const timelineBox = await timeline.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(bottomBarBox).not.toBeNull();
  expect(timelineBox).not.toBeNull();
  expect(bottomBarBox!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height - 1);
  expect(timelineBox!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height - 1);

  await page.getByRole('button', { name: 'Hide mission timeline' }).click();
  await expect(timeline).toBeHidden();
  await expect(workspace).toHaveAttribute('data-timeline-open', 'false');
});

test('Earth 3D releases its WebGL context on unmount and remounts cleanly', async ({ page }) => {
  test.setTimeout(60_000);
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

test("Earth 3D mission timeline and scene gallery control the shared simulation state", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.addInitScript(() => localStorage.setItem("orbital-lab-coach-enabled", "false"));
  await page.goto("/");
  await disableContextCoach(page);
  await page.getByRole("button", { name: "Simulation", exact: true }).click();

  const timeline = page.getByRole("region", { name: "Mission timeline and scene gallery" });
  const simulationControls = page.getByTestId("earth3d-simulation-controls");
  await expect(timeline).toBeHidden();
  await page.getByRole("button", { name: "Show mission timeline" }).click();
  await expect(timeline).toBeVisible();
  await expect(simulationControls).toBeVisible();
  const canvasLayer = page.locator(".earth3d-canvas");
  await expect.poll(() => canvasLayer.evaluate(element => getComputedStyle(element).position)).toBe("relative");
  await expect.poll(() => timeline.evaluate(element => getComputedStyle(element).zIndex)).toBe("9");
  const clock = timeline.locator(".earth3d-timeline-heading b");
  await expect(clock).toContainText("T+ 0.0 s");
  await timeline.getByRole("button", { name: "Advance simulation by 10 seconds" }).click();
  await expect(clock).toContainText("T+ 10.0 s");

  await simulationControls.getByRole("group", { name: "Simulation playback speed" }).getByRole("button", { name: "Set playback speed 1x" }).click();
  await simulationControls.getByRole("button", { name: "Play simulation" }).click();
  await expect(simulationControls.getByRole("button", { name: "Pause simulation" })).toBeVisible();
  // Let several 250 ms simulation ticks reach the scene before exercising
  // the playback controls; their hit targets must remain stable while telemetry advances.
  await expect.poll(() => clock.textContent()).not.toBe("T+ 10.0 s");
  await simulationControls.getByRole("button", { name: "Pause simulation" }).click();
  await timeline.getByRole("button", { name: "Reset simulation time" }).click();
  await expect(clock).toContainText("T+ 0.0 s");

  const slider = timeline.getByRole("slider", { name: "Simulation timeline" });
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(clock).toContainText("T+ 0.1 s");
  // ArrowLeft from 0.1 s reaches the minimum deterministically in Chromium;
  // Home is not consistently dispatched as an input change for range controls.
  await slider.press("ArrowLeft");
  await expect(clock).toContainText("T+ 0.0 s");

  const speed = simulationControls.getByRole("group", { name: "Simulation playback speed" });
  const speed60 = speed.getByRole("button", { name: "Set playback speed 60x" });
  await expect(speed60).toBeVisible();
  await assertPointerReachable(speed60, '60x playback-speed control');
  await speed60.click();
  await expect(speed60).toBeInViewport();
  await expect(speed.getByRole("button", { name: "Set playback speed 60x" })).toHaveAttribute("aria-pressed", "true");

  await timeline.getByRole("button", { name: "Moon scene", exact: true }).click();
  await expect(page.locator("[aria-label=\"Camera modes\"]").getByRole("button", { name: "MOON", exact: true })).toHaveClass(/active/);
  await expect(timeline.getByRole("button", { name: "Moon scene", exact: true })).toHaveAttribute("aria-pressed", "true");
  const systemSceneButton = timeline.getByRole("button", { name: "Earth and Moon scene" });
  await systemSceneButton.scrollIntoViewIfNeeded();
  await expect(systemSceneButton).toBeInViewport();
  const systemSceneHitTarget = await systemSceneButton.evaluate(button => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || button.contains(hit);
  });
  expect(systemSceneHitTarget).toBe(true);
  await systemSceneButton.click();
  await expect(page.locator("[aria-label=\"Camera modes\"]").getByRole("button", { name: "SYSTEM", exact: true })).toHaveClass(/active/);
  await expect(timeline.getByRole("button", { name: "Earth and Moon scene" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Hide mission timeline" }).click();
  await expect(timeline).toBeHidden();
});

test("Earth 3D Earth scene shortcut selects the Earth camera", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.addInitScript(() => localStorage.setItem("orbital-lab-coach-enabled", "false"));
  await page.goto("/");
  await page.getByRole("button", { name: "Simulation", exact: true }).click();
  const timeline = page.getByRole("region", { name: "Mission timeline and scene gallery" });
  await page.getByRole("button", { name: "Show mission timeline" }).click();
  await timeline.getByRole("button", { name: "Earth scene", exact: true }).click();
  await expect(page.locator("[aria-label=\"Camera modes\"]").getByRole("button", { name: "EARTH", exact: true })).toHaveClass(/active/);
  await expect(timeline.getByRole("button", { name: "Earth scene", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Earth 3D timeline and scene gallery remain touch-usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("orbital-lab-coach-enabled", "false"));
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Simulation", exact: true }).click();

  const timeline = page.getByRole("region", { name: "Mission timeline and scene gallery" });
  await page.getByRole("button", { name: "Show mission timeline" }).click();
  await timeline.scrollIntoViewIfNeeded();
  await expect(timeline).toBeVisible();
  await expect(timeline.getByRole("button", { name: "Earth scene" })).toBeVisible();
  await expect(timeline.getByRole("button", { name: "Moon scene", exact: true })).toBeVisible();
  await expect(timeline.getByRole("button", { name: "Earth and Moon scene" })).toBeVisible();
  const slider = timeline.getByRole("slider", { name: "Simulation timeline" });
  await expect(slider).toBeVisible();
  expect(await slider.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(260);
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, documentWidth: document.documentElement.scrollWidth }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.width);
  const systemSceneButton = timeline.getByRole("button", { name: "Earth and Moon scene", exact: true });
  await systemSceneButton.evaluate(element => element.scrollIntoView({ block: "center", inline: "center", behavior: "auto" }));
  await expect(systemSceneButton).toBeInViewport();
  const systemSceneHit = await systemSceneButton.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      receivesPointer: Boolean(hit && (hit === element || element.contains(hit))),
      hit: hit?.outerHTML.slice(0, 160) ?? "none"
    };
  });
  expect(systemSceneHit.receivesPointer, `SYSTEM scene hit target: ${systemSceneHit.hit}`).toBe(true);
  await page.mouse.click(systemSceneHit.x, systemSceneHit.y);
  await expect(page.locator("[aria-label=\"Camera modes\"]").getByRole("button", { name: "SYSTEM", exact: true })).toHaveClass(/active/);
});


test('Earth 3D Moon camera tracks the Earth-facing hemisphere on desktop and mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.goto('/');
  await disableContextCoach(page);
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  const canvas = page.locator('.earth3d-canvas');
  const webglCanvas = canvas.locator('canvas');
  await expect(webglCanvas).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'MOON', exact: true }).click();
  const facingDot = () => canvas.getAttribute('data-moon-earth-facing-dot').then(value => Number(value));
  await expect.poll(facingDot, { timeout: 10000 }).toBeGreaterThan(0.999);

  await webglCanvas.scrollIntoViewIfNeeded();
  const box = await webglCanvas.boundingBox();
  if (!box) throw new Error('Moon canvas has no measurable desktop bounds.');
  const dragX = box.x + box.width * 0.48;
  const dragY = box.y + box.height * 0.5;
  await webglCanvas.dispatchEvent('pointerdown', { pointerId: 21, pointerType: 'mouse', clientX: dragX, clientY: dragY, button: 0, buttons: 1 });
  await webglCanvas.dispatchEvent('pointermove', { pointerId: 21, pointerType: 'mouse', clientX: dragX + 60, clientY: dragY, button: 0, buttons: 1 });
  await webglCanvas.dispatchEvent('pointerup', { pointerId: 21, pointerType: 'mouse', clientX: dragX + 60, clientY: dragY, button: 0, buttons: 0 });
  await expect.poll(facingDot, { timeout: 10000 }).toBeLessThan(0.999);

  await page.getByRole('button', { name: 'Reset camera framing' }).click();
  await expect.poll(facingDot, { timeout: 10000 }).toBeGreaterThan(0.999);
  const timeline = page.getByRole('region', { name: 'Mission timeline and scene gallery' });
  await page.getByRole('button', { name: 'Show mission timeline' }).click();
  await timeline.getByRole('button', { name: 'Advance simulation by 10 seconds' }).click();
  await expect.poll(facingDot, { timeout: 10000 }).toBeGreaterThan(0.999);
  const workspace = page.locator('.earth3d-workspace');
  await workspace.evaluate(element => window.scrollTo(0, Math.max(0, window.scrollY + element.getBoundingClientRect().top - 72)));
  await page.screenshot({ path: testInfo.outputPath('moon-facing-desktop.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(facingDot, { timeout: 10000 }).toBeGreaterThan(0.999);
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, documentWidth: document.documentElement.scrollWidth }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.width);
  await workspace.evaluate(element => window.scrollTo(0, Math.max(0, window.scrollY + element.getBoundingClientRect().top - 72)));
  await page.screenshot({ path: testInfo.outputPath('moon-facing-mobile.png'), fullPage: false });
});


test('mobile Earth–Moon mission data panels collapse without hiding scale disclosure', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Simulation', exact: true }).click();

  const modes = page.locator('[aria-label="Camera modes"]');
  await modes.getByRole('button', { name: 'SYSTEM', exact: true }).click();
  const canvas = page.locator('.earth3d-canvas');
  const workspace = page.locator('.earth3d-workspace');
  const leftHud = page.locator('#earth3d-left-hud');
  const rightHud = page.locator('#earth3d-right-hud');
  const toggle = page.getByRole('button', { name: 'Show mission data panels' });

  await expect(canvas.locator('canvas')).toBeVisible();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(leftHud).toBeHidden();
  await expect(rightHud).toBeHidden();
  await expect(page.getByTestId('earth3d-scale-note')).toBeVisible();
  await expect(page.getByTestId('earth3d-scale-note')).toContainText('44.4×');
  const collapsedDistance = Number(await canvas.getAttribute('data-camera-distance'));
  expect(Number.isFinite(collapsedDistance)).toBe(true);

  const focusPath = test.info().outputPath('earth3d-mobile-system-focus-390x844.png');
  await workspace.screenshot({ path: focusPath, animations: 'disabled' });
  await test.info().attach('earth3d-mobile-system-focus-390x844.png', { path: focusPath, contentType: 'image/png' });

  await toggle.click();
  const closeToggle = page.getByRole('button', { name: 'Hide mission data panels' });
  await expect(closeToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(leftHud).toBeVisible();
  await expect(rightHud).toBeVisible();
  await expect(leftHud.getByText('PHYSICAL SCALE · REFERENCE VALUES')).toBeVisible();
  await expect(rightHud.getByText('LIVE TELEMETRY')).toBeVisible();
  const canvasBounds = await canvas.boundingBox();
  const leftBounds = await leftHud.boundingBox();
  const rightBounds = await rightHud.boundingBox();
  expect(canvasBounds).not.toBeNull();
  expect(leftBounds).not.toBeNull();
  expect(rightBounds).not.toBeNull();
  expect(leftBounds!.y).toBeGreaterThanOrEqual(canvasBounds!.y + canvasBounds!.height - 1);
  expect(rightBounds!.y).toBeGreaterThanOrEqual(canvasBounds!.y + canvasBounds!.height - 1);
  expect(Number(await canvas.getAttribute('data-camera-distance'))).toBeCloseTo(collapsedDistance, 6);

  const expandedPath = test.info().outputPath('earth3d-mobile-system-data-open-390x844.png');
  await workspace.screenshot({ path: expandedPath, animations: 'disabled' });
  await test.info().attach('earth3d-mobile-system-data-open-390x844.png', { path: expandedPath, contentType: 'image/png' });

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);

  await closeToggle.click();
  await expect(leftHud).toBeHidden();
  await expect(rightHud).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show mission data panels' })).toHaveAttribute('aria-expanded', 'false');
  expect(pageErrors).toEqual([]);
});


test('Earth 3D reference dashboard connects mission setup, controls and derived data on desktop', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await disableContextCoach(page);
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  const setup = page.getByTestId('earth3d-mission-setup');
  const controls = page.getByTestId('earth3d-simulation-controls');
  const bottom = page.getByTestId('earth3d-bottom-panels');
  await expect(setup).toBeVisible();
  await expect(setup.getByText('MISSION SETUP', { exact: true })).toBeVisible();
  await expect(controls).toBeVisible();
  await expect(controls.getByText('SIMULATION CONTROLS', { exact: true })).toBeVisible();
  await expect(page.getByText('LIVE TELEMETRY', { exact: true })).toBeVisible();
  await expect(bottom.getByText('2D Ground Track', { exact: true })).toBeVisible();
  await expect(bottom.getByText('Orbit Parameters', { exact: true })).toBeVisible();
  await expect(bottom.getByText('Mission Info', { exact: true })).toBeVisible();
  await expect(bottom.getByText('SIMULATED · KEPLER', { exact: true })).toBeVisible();

  const preset = setup.getByRole('button', { name: /ISS.*420 km LEO/ });
  await preset.click();
  await expect(preset).toHaveAttribute('aria-pressed', 'true');
  await setup.getByRole('tab', { name: 'CUSTOM ORBIT' }).click();
  await expect(setup.getByRole('spinbutton', { name: 'Mission setup altitude' })).toHaveValue('420');
  const altitude = setup.getByRole('spinbutton', { name: 'Mission setup altitude' });
  await altitude.fill('600');
  await expect(altitude).toHaveValue('600');
  const inclination = setup.getByRole('spinbutton', { name: 'Mission setup inclination' });
  await inclination.fill('98.2');
  await expect(inclination).toHaveValue('98.2');
  const raan = setup.getByRole('spinbutton', { name: 'Mission setup RAAN' });
  await raan.fill('15');
  await expect(raan).toHaveValue('15');
  await expect(bottom.getByText('98.20°', { exact: true })).toBeVisible();

  // Keep the simulation running long enough to exercise the live pause control
  // under CI load; playback speed is tested separately below.
  await controls.getByRole('group', { name: 'Simulation playback speed' }).getByRole('button', { name: 'Set playback speed 1x' }).click();
  await setup.getByRole('button', { name: 'Start simulation' }).click();
  const pauseControl = page.getByRole('button', { name: 'Pause simulation' });
  await expect(pauseControl).toBeVisible();
  await assertPointerReachable(pauseControl, 'pause simulation control');
  // Exercise the control after live telemetry has advanced, not only on its
  // first stable frame.
  const dashboardClock = controls.locator('.earth3d-simulation-clock span');
  await expect.poll(() => dashboardClock.textContent()).not.toBe('T+ 0.0 s');
  await pauseControl.click();
  await expect(pauseControl).toBeHidden();
  const desktopSpeed = page.getByRole('group', { name: 'Simulation playback speed' });
  const desktopSpeed60 = desktopSpeed.getByRole('button', { name: 'Set playback speed 60x' });
  await expect(desktopSpeed60).toBeVisible();
  await assertPointerReachable(desktopSpeed60, 'desktop 60x playback-speed control');
  await desktopSpeed60.click();
  await expect(desktopSpeed60).toBeInViewport();
  await expect(controls.getByRole('group', { name: 'Simulation playback speed' }).getByRole('button', { name: 'Set playback speed 60x' })).toHaveAttribute('aria-pressed', 'true');

  // Capture the full Earth disc, not the default TRACK close-up.
  const referenceEarthCamera = page.locator('.earth-camera-controls').getByRole('button', { name: 'EARTH', exact: true });
  await referenceEarthCamera.click();
  const referenceEarthCanvas = page.locator('.earth3d-canvas');
  await expect(referenceEarthCanvas).toHaveAttribute('data-camera-mode', 'EARTH');
  const referenceEarthSize = await referenceEarthCanvas.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
  const referenceEarthFit = fitCameraDistance(referenceEarthSize.width, referenceEarthSize.height, 5.15, 42, EARTH_CAMERA_MARGIN);
  await expect.poll(async () => Number(await referenceEarthCanvas.getAttribute('data-camera-distance'))).toBeCloseTo(referenceEarthFit, 1);

  const missionScreenshot = testInfo.outputPath('earth3d-reference-dashboard-desktop-1536x1024.png');
  // Capture the actual 1536×1024 browser viewport. Element screenshots wait for
  // layout stability; the continuously rendered WebGL canvas never becomes
  // stable, so that API can consume the entire E2E timeout.
  await page.getByRole('region', { name: 'Interactive 3D Earth with trackable spacecraft' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: missionScreenshot, animations: 'disabled' });
  await testInfo.attach('earth3d-reference-dashboard-desktop-1536x1024.png', { path: missionScreenshot, contentType: 'image/png' });

  await setup.getByRole('button', { name: 'Open full orbit design' }).click();
  await expect(page.getByRole('heading', { name: 'Make the orbital mechanics visible.' })).toBeVisible();
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  // The Orbit workspace can leave the document scrolled near its previous
  // lower controls. Restore the document viewport before exercising the
  // mission-setup action; retain a normal, hit-tested Playwright click.
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
  });
  const editMission = page.getByTestId('earth3d-mission-setup')
    .getByRole('button', { name: 'Edit mission requirements' });
  await assertPointerReachable(editMission, 'edit mission requirements control');
  await editMission.click();
  await expect(page.getByRole('heading', { name: 'Start with the engineering problem.' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Earth 3D reference dashboard reflows to a globe-first mobile layout', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await disableContextCoach(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Simulation', exact: true }).click();

  const canvas = page.locator('.earth3d-canvas');
  const setup = page.getByTestId('earth3d-mission-setup');
  const controls = page.getByTestId('earth3d-simulation-controls');
  const bottom = page.getByTestId('earth3d-bottom-panels');
  await expect(canvas.locator('canvas')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-camera-mode', 'EARTH');
  await expect(page.locator('[aria-label="Camera modes"]').getByRole('button', { name: 'EARTH', exact: true })).toHaveClass(/active/);
  const mobileEarthSize = await canvas.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
  const mobileEarthFit = fitCameraDistance(mobileEarthSize.width, mobileEarthSize.height, 5.15, 42, EARTH_CAMERA_MARGIN);
  await expect.poll(async () => Number(await canvas.getAttribute('data-camera-distance'))).toBeCloseTo(mobileEarthFit, 1);
  const mobileDisclosure = page.locator('.earth3d-page-header > div > small:last-child');
  await expect(mobileDisclosure).toBeVisible();
  const mobileDisclosureFontSize = await mobileDisclosure.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(mobileDisclosureFontSize).toBeGreaterThanOrEqual(9);
  await expect(setup).toBeHidden();
  await expect(controls).toBeHidden();
  await page.getByRole('button', { name: 'Show mission data panels' }).click();
  await expect(setup).toBeVisible();
  await expect(controls).toBeVisible();
  await controls.getByRole('button', { name: 'Play simulation' }).click();
  await expect(controls.getByRole('button', { name: 'Pause simulation' })).toBeVisible();
  await controls.getByRole('button', { name: 'Pause simulation' }).click();
  const mobileSpeed = controls.getByRole('group', { name: 'Simulation playback speed' });
  await mobileSpeed.getByRole('button', { name: 'Set playback speed 10x' }).click();
  await expect(mobileSpeed.getByRole('button', { name: 'Set playback speed 10x' })).toHaveAttribute('aria-pressed', 'true');
  await expect(bottom.getByText('2D Ground Track', { exact: true })).toBeVisible();
  await expect(bottom.getByText('Orbit Parameters', { exact: true })).toBeVisible();
  await expect(bottom.getByText('Mission Info', { exact: true })).toBeVisible();

  const layout = await bottom.evaluate(element => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(layout.columns).toBe(1);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  const canvasBounds = await canvas.boundingBox();
  const setupBounds = await setup.boundingBox();
  expect(canvasBounds).not.toBeNull();
  expect(setupBounds).not.toBeNull();
  expect(setupBounds!.y).toBeGreaterThanOrEqual(canvasBounds!.y + canvasBounds!.height - 1);

  const mobileScreenshot = testInfo.outputPath('earth3d-reference-dashboard-mobile-390x844.png');
  // Keep this as a viewport capture (390×844), not a full-height element image.
  // The WebGL canvas remains animated, so page.screenshot avoids the element
  // stability wait while preserving the actual mobile composition.
  await page.getByRole('region', { name: 'Interactive 3D Earth with trackable spacecraft' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: mobileScreenshot, animations: 'disabled' });
  await testInfo.attach('earth3d-reference-dashboard-mobile-390x844.png', { path: mobileScreenshot, contentType: 'image/png' });

  await setup.getByRole('tab', { name: 'CUSTOM ORBIT' }).click();
  await setup.getByRole('spinbutton', { name: 'Mission setup altitude' }).fill('650');
  await expect(setup.getByRole('spinbutton', { name: 'Mission setup altitude' })).toHaveValue('650');
  expect(pageErrors).toEqual([]);
});


test('Earth 3D desktop shell matches the reference three-column mission-control hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await disableContextCoach(page);
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  const primaryNav = page.getByTestId('simulation-primary-nav');
  const canvas = page.locator('.earth3d-canvas');
  const bottom = page.getByTestId('earth3d-bottom-panels');
  const earthCamera = page.locator('.earth-camera-controls').getByRole('button', { name: 'EARTH', exact: true });
  await earthCamera.click();
  await expect(canvas).toHaveAttribute('data-camera-mode', 'EARTH');
  const desktopEarthSize = await canvas.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
  const desktopEarthFit = fitCameraDistance(desktopEarthSize.width, desktopEarthSize.height, 5.15, 42, EARTH_CAMERA_MARGIN);
  await expect.poll(async () => Number(await canvas.getAttribute('data-camera-distance'))).toBeCloseTo(desktopEarthFit, 1);
  await expect(primaryNav).toBeVisible();
  await expect(primaryNav.getByRole('button', { name: 'Earth 3D', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.mission-strip')).toBeHidden();
  await expect(page.locator('.simulation-page > .page-header')).toBeHidden();
  const provenanceHeader = page.locator('.earth3d-page-header');
  await expect(provenanceHeader).toBeVisible();
  await expect(provenanceHeader.locator('[data-testid="earth-imagery-status"]')).toContainText('NASA Blue Marble');
  await expect(provenanceHeader).toContainText('Scale disclosure:');
  await expect(canvas.locator('canvas')).toBeVisible();
  await expect(bottom.getByText('2D Ground Track', { exact: true })).toBeVisible();
  await expect(bottom.getByText('Orbit Parameters', { exact: true })).toBeVisible();
  await expect(bottom.getByText('Mission Info', { exact: true })).toBeVisible();
  const groundTrackHeading = bottom.locator('.earth3d-ground-track-panel .card-head');
  await expect(groundTrackHeading).toBeVisible();
  const timelineToggle = page.getByRole('button', { name: 'Show mission timeline' });
  await expect(timelineToggle).toBeVisible();
  await expect(page.getByText('DRAG TO ORBIT · WHEEL TO ZOOM · SYSTEM FRAMES EARTH + MOON · TRACK FOLLOWS SATELLITE', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Mission timeline and scene gallery' })).toBeHidden();

  // Take one atomic, read-only layout snapshot after visibility checks. Separate
  // locator geometry calls can trigger repeated selector resolution/scroll work
  // while the WebGL scene is rendering; a single DOM read avoids that instability
  // without relaxing any viewport or pointer-target assertion.
  const layout = await page.evaluate(() => {
    const rectFor = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const groundTrackButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-testid="simulation-primary-nav"] button')
    ).find(button => button.textContent?.trim() === 'Ground Track');
    const navRect = groundTrackButton?.getBoundingClientRect();
    const navHit = navRect
      ? document.elementFromPoint(navRect.left + navRect.width / 2, navRect.top + navRect.height / 2)
      : null;
    return {
      groundTrackHeading: rectFor('[data-testid="earth3d-bottom-panels"] .earth3d-ground-track-panel .card-head'),
      canvas: rectFor('.earth3d-canvas'),
      workspace: rectFor('.earth3d-workspace'),
      bottom: rectFor('[data-testid="earth3d-bottom-panels"]'),
      timelineToggle: rectFor('.earth3d-timeline-toggle'),
      navButton: navRect ? { x: navRect.x, y: navRect.y, width: navRect.width, height: navRect.height } : null,
      navHitTarget: Boolean(groundTrackButton && navHit && (navHit === groundTrackButton || groundTrackButton.contains(navHit)))
    };
  });
  const groundTrackHeadingBounds = layout.groundTrackHeading;
  const canvasBounds = layout.canvas;
  const workspaceBounds = layout.workspace;
  const bottomBounds = layout.bottom;
  const legendBounds = layout.timelineToggle;
  expect(groundTrackHeadingBounds).not.toBeNull();
  expect(canvasBounds).not.toBeNull();
  expect(workspaceBounds).not.toBeNull();
  expect(bottomBounds).not.toBeNull();
  expect(legendBounds).not.toBeNull();
  expect(layout.navButton).not.toBeNull();
  expect(canvasBounds!.width).toBeGreaterThan(700);
  expect(canvasBounds!.height).toBeGreaterThan(600);
  expect(workspaceBounds!.height).toBeLessThanOrEqual(681);
  expect(bottomBounds!.y).toBeLessThan(850);
  expect(groundTrackHeadingBounds!.x).toBeGreaterThanOrEqual(0);
  expect(groundTrackHeadingBounds!.y).toBeGreaterThanOrEqual(0);
  expect(groundTrackHeadingBounds!.x + groundTrackHeadingBounds!.width).toBeLessThanOrEqual(1536);
  expect(groundTrackHeadingBounds!.y + groundTrackHeadingBounds!.height).toBeLessThanOrEqual(1024);
  expect(legendBounds!.x).toBeGreaterThanOrEqual(canvasBounds!.x);
  expect(legendBounds!.x + legendBounds!.width).toBeLessThanOrEqual(canvasBounds!.x + canvasBounds!.width + 1);

  // Verify a real pointer lands on the visible navigation control, then use the
  // measured centre so Playwright does not need a second moving-layout scan.
  const groundTrackButton = primaryNav.getByRole('button', { name: 'Ground Track', exact: true });
  await expect(groundTrackButton).toBeVisible();
  await expect(groundTrackButton).toHaveText('Ground Track');
  expect(layout.navHitTarget).toBe(true);
  await page.mouse.click(layout.navButton!.x + layout.navButton!.width / 2, layout.navButton!.y + layout.navButton!.height / 2);
  const bottomPanels = page.getByTestId('earth3d-bottom-panels');
  await expect(bottomPanels).toBeVisible();
  await expect(groundTrackHeading).toBeVisible();
  await expect(groundTrackHeading).toBeInViewport();
  await expect(groundTrackHeading.getByText('2D Ground Track', { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Earth 3D mobile shell keeps the globe visible and retains navigation in the drawer', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await disableContextCoach(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Simulation', exact: true }).click();

  const canvas = page.locator('.earth3d-canvas');
  await expect(canvas.locator('canvas')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.mission-strip')).toBeHidden();
  await expect(page.locator('.simulation-page > .page-header')).toBeHidden();
  await expect(page.getByTestId('simulation-primary-nav')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();

  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeLessThan(440);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  expect(bounds!.height).toBeGreaterThanOrEqual(320);
  await expect(page.locator('.earth3d-page-header')).toContainText('Scale disclosure:');
  await expect(page.getByTestId('earth-imagery-status')).toContainText('NASA Blue Marble');
  const mobileControlColumns = await page.locator('.earth-camera-controls').evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length
  );
  expect(mobileControlColumns).toBe(4);

  const screenshot = testInfo.outputPath('earth3d-reference-mobile-topnav-390x844.png');
  await page.screenshot({ path: screenshot, animations: 'disabled' });
  await testInfo.attach('earth3d-reference-mobile-topnav-390x844.png', { path: screenshot, contentType: 'image/png' });

  await page.getByRole('button', { name: 'Open navigation' }).click();
  const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobileNav).toBeVisible();
  await mobileNav.getByRole('button', { name: 'Mission', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Start with the engineering problem.' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});


test('Earth imagery provenance and physical-scale disclosures remain legible at desktop and mobile sizes', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  const status = page.getByTestId('earth-imagery-status');
  const scale = page.locator('.earth3d-page-header > div > small:last-child');
  const canvas = page.locator('.earth3d-canvas canvas');
  await expect(canvas).toBeVisible();
  await expect(status).toBeVisible();
  await expect(status).toContainText('NASA');
  await expect(scale).toBeVisible();
  await expect(scale).toContainText('Scale disclosure:');

  const readDisclosureMetrics = async () => page.evaluate(() => {
    const statusElement = document.querySelector<HTMLElement>('[data-testid="earth-imagery-status"]');
    const scaleElement = document.querySelector<HTMLElement>('.earth3d-page-header > div > small:last-child');
    if (!statusElement || !scaleElement) throw new Error('Required Earth provenance/scale disclosures are missing.');
    const statusStyle = getComputedStyle(statusElement);
    const scaleStyle = getComputedStyle(scaleElement);
    return {
      statusFontSize: Number.parseFloat(statusStyle.fontSize),
      scaleFontSize: Number.parseFloat(scaleStyle.fontSize),
      statusVisible: statusElement.getBoundingClientRect().height > 0,
      scaleVisible: scaleElement.getBoundingClientRect().height > 0,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth
    };
  });
  const desktop = await readDisclosureMetrics();
  expect(desktop.statusFontSize).toBeGreaterThanOrEqual(9);
  expect(desktop.scaleFontSize).toBeGreaterThanOrEqual(9);
  expect(desktop.statusVisible).toBe(true);
  expect(desktop.scaleVisible).toBe(true);
  expect(desktop.pageWidth).toBeLessThanOrEqual(desktop.viewportWidth);
  await page.evaluate(() => window.scrollTo(0, 0));
  const desktopPath = testInfo.outputPath('earth3d-disclosures-desktop-1536x1024.png');
  await page.screenshot({ path: desktopPath, fullPage: false, animations: 'disabled' });
  await testInfo.attach('earth3d-disclosures-desktop-1536x1024.png', { path: desktopPath, contentType: 'image/png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(status).toBeVisible();
  await expect(scale).toBeVisible();
  const mobile = await readDisclosureMetrics();
  expect(mobile.statusFontSize).toBeGreaterThanOrEqual(8);
  expect(mobile.scaleFontSize).toBeGreaterThanOrEqual(8);
  expect(mobile.statusVisible).toBe(true);
  expect(mobile.scaleVisible).toBe(true);
  expect(mobile.pageWidth).toBeLessThanOrEqual(mobile.viewportWidth);
  const mobileCanvasBox = await page.locator('.earth3d-canvas').boundingBox();
  expect(mobileCanvasBox).not.toBeNull();
  expect(mobileCanvasBox!.y).toBeLessThan(440);
  const mobilePath = testInfo.outputPath('earth3d-disclosures-mobile-390x844.png');
  await page.screenshot({ path: mobilePath, fullPage: false, animations: 'disabled' });
  await testInfo.attach('earth3d-disclosures-mobile-390x844.png', { path: mobilePath, contentType: 'image/png' });
  expect(pageErrors).toEqual([]);
});
