import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1536, height: 1024, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true }
] as const;

async function openSimulation(page: Page, mobile: boolean) {
  if (mobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('button', { name: 'Simulation', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  }
}

async function openMission(page: Page, mobile: boolean) {
  if (mobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('button', { name: 'Mission', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Mission', exact: true }).click();
  }
}

async function instrumentWebGlLifecycle(page: Page) {
  await page.addInitScript(() => {
    const state = { contextLossCalls: 0, resourceDeleteCalls: 0 };
    (window as Window & { __earth3dLifecycle?: typeof state }).__earth3dLifecycle = state;

    const constructors = [
      window.WebGLRenderingContext,
      window.WebGL2RenderingContext
    ];
    const patched = new Set<object>();
    for (const Constructor of constructors) {
      const prototype = Constructor?.prototype as (WebGLRenderingContext & Record<string, any>) | undefined;
      if (!prototype || patched.has(prototype)) continue;
      patched.add(prototype);

      for (const method of ['deleteBuffer', 'deleteTexture', 'deleteProgram', 'deleteShader', 'deleteRenderbuffer', 'deleteFramebuffer']) {
        if (!Object.prototype.hasOwnProperty.call(prototype, method)) continue;
        const original = prototype[method];
        if (typeof original !== 'function') continue;
        prototype[method] = function (...args: unknown[]) {
          state.resourceDeleteCalls += 1;
          return original.apply(this, args);
        };
      }

      if (Object.prototype.hasOwnProperty.call(prototype, 'getExtension')) {
        const originalGetExtension = prototype.getExtension;
        prototype.getExtension = function (name: string) {
          const extension = originalGetExtension.call(this, name);
          if (name !== 'WEBGL_lose_context' || !extension || typeof extension.loseContext !== 'function') {
            return extension;
          }
          const originalLoseContext = extension.loseContext.bind(extension);
          return new Proxy(extension, {
            get(target, property) {
              if (property === 'loseContext') {
                return () => {
                  state.contextLossCalls += 1;
                  return originalLoseContext();
                };
              }
              const value = Reflect.get(target, property, target);
              return typeof value === 'function' ? value.bind(target) : value;
            }
          });
        };
      }
    }
  });
}

for (const viewport of viewports) {
  test('Earth 3D recovers interrupted pointer gestures (' + viewport.name + ')', async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
    await page.goto('/');
    await openSimulation(page, viewport.mobile);

    const container = page.locator('.earth3d-canvas');
    const canvas = container.locator('canvas');
    const modes = page.locator('[aria-label="Camera modes"]');
    await expect(canvas).toBeVisible();
    await modes.getByRole('button', { name: 'SYSTEM', exact: true }).click();
    await expect(container).toHaveAttribute('data-camera-mode', 'SYSTEM');

    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    const centerX = bounds!.x + bounds!.width / 2;
    const centerY = bounds!.y + bounds!.height / 2;
    const readYaw = async () => Number(await container.getAttribute('data-camera-yaw'));
    const initialYaw = await readYaw();

    // Losing one finger's capture during a two-pointer gesture must rebase the
    // remaining finger as a drag rather than leaving the camera gesture stuck.
    await canvas.dispatchEvent('pointerdown', {
      pointerId: 31, pointerType: 'touch', clientX: centerX - 30, clientY: centerY, button: 0, buttons: 1
    });
    await canvas.dispatchEvent('pointerdown', {
      pointerId: 32, pointerType: 'touch', clientX: centerX + 30, clientY: centerY, button: 0, buttons: 1
    });
    await canvas.dispatchEvent('lostpointercapture', {
      pointerId: 32, pointerType: 'touch', clientX: centerX + 30, clientY: centerY, button: 0, buttons: 0
    });
    await canvas.dispatchEvent('pointermove', {
      pointerId: 32, pointerType: 'touch', clientX: centerX + 90, clientY: centerY, button: 0, buttons: 1
    });
    await canvas.dispatchEvent('pointermove', {
      pointerId: 31, pointerType: 'touch', clientX: centerX + 45, clientY: centerY + 8, button: 0, buttons: 1
    });
    await expect.poll(readYaw).not.toBe(initialYaw);
    await canvas.dispatchEvent('pointerup', {
      pointerId: 31, pointerType: 'touch', clientX: centerX + 45, clientY: centerY + 8, button: 0, buttons: 0
    });

    // pointercancel must also clear the active pointer so later stale moves do
    // not rotate the camera after the browser or operating system cancels input.
    const yawBeforeCancel = await readYaw();
    await canvas.dispatchEvent('pointerdown', {
      pointerId: 33, pointerType: 'touch', clientX: centerX, clientY: centerY, button: 0, buttons: 1
    });
    await canvas.dispatchEvent('pointercancel', {
      pointerId: 33, pointerType: 'touch', clientX: centerX, clientY: centerY, button: 0, buttons: 0
    });
    await canvas.dispatchEvent('pointermove', {
      pointerId: 33, pointerType: 'touch', clientX: centerX + 80, clientY: centerY, button: 0, buttons: 1
    });
    await expect.poll(readYaw).toBe(yawBeforeCancel);
    expect(pageErrors).toEqual([]);
  });

  test('Earth 3D releases WebGL resources on unmount and reinitializes (' + viewport.name + ')', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await instrumentWebGlLifecycle(page);
    await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
    await page.goto('/');
    await openSimulation(page, viewport.mobile);

    const container = page.locator('.earth3d-canvas');
    const canvas = container.locator('canvas');
    await expect(canvas).toBeVisible();
    await page.locator('[aria-label="Camera modes"]').getByRole('button', { name: 'SYSTEM', exact: true }).click();
    await expect(container).toHaveAttribute('data-camera-mode', 'SYSTEM');
    await page.screenshot({
      path: testInfo.outputPath('earth3d-lifecycle-' + viewport.name + '.png'),
      fullPage: false
    });

    await openMission(page, viewport.mobile);
    await expect(canvas).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => {
      const state = (window as Window & {
        __earth3dLifecycle?: { contextLossCalls: number; resourceDeleteCalls: number }
      }).__earth3dLifecycle;
      return (state?.contextLossCalls ?? 0) + (state?.resourceDeleteCalls ?? 0);
    })).toBeGreaterThan(0);

    await openSimulation(page, viewport.mobile);
    await expect(canvas).toBeVisible();
    const hasFreshContext = await canvas.evaluate(element => {
      const gl = (element as HTMLCanvasElement).getContext('webgl2') ??
        (element as HTMLCanvasElement).getContext('webgl');
      return Boolean(gl && gl.getContextAttributes());
    });
    expect(hasFreshContext).toBe(true);
    expect(pageErrors).toEqual([]);
  });
}
