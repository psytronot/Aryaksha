import { expect, test } from '@playwright/test';

type DrawMetric = { durationMs: number; method: string };
declare global {
  interface Window {
    __orbitalDrawMetrics?: DrawMetric[];
  }
}

test('accessibility audit: critical and serious axe violations are absent in key workspaces', async ({ page }) => {
  const results: Array<{ workspace: string; violations: Array<{ id: string; impact: string; description: string; nodes: Array<{ target: string[]; failureSummary: string }> }> }> = [];

  const workspaces = [
    { name: 'Home', open: async () => { await page.goto('/'); } },
    { name: 'Simulation / Earth 3D', open: async () => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Simulation', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
    } },
    { name: 'Satellite Tracking', open: async () => {
      await page.getByRole('button', { name: 'Satellite Tracking', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Satellite tracking & pass planning' })).toBeVisible();
    } },
    { name: 'Mission Analysis', open: async () => {
      await page.getByRole('button', { name: 'Mission Analysis', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Orbital Mission Analysis' })).toBeVisible();
    } }
  ];

  for (const workspace of workspaces) {
    await workspace.open();
    await page.addScriptTag({ path: `${process.cwd()}/node_modules/axe-core/axe.min.js` });
    const report = await page.evaluate(async () => {
      const axe = (window as Window & { axe?: { run: (context: Document, options: object) => Promise<{ violations: Array<{ id: string; impact: string; description: string; nodes: Array<{ target: string[]; failureSummary?: string }> }> }> } }).axe;
      if (!axe) throw new Error('axe-core did not load');
      return axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    });
    results.push({
      workspace: workspace.name,
      violations: report.violations
        .filter(item => item.impact === 'critical' || item.impact === 'serious')
        .map(item => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary ?? '' })) }))
    });
  }

  test.info().annotations.push({ type: 'axe accessibility audit', description: JSON.stringify(results) });
  expect(results.flatMap(item => item.violations.map(v => ({ workspace: item.workspace, ...v }))), JSON.stringify(results, null, 2)).toEqual([]);
});

test('reduced-motion preference suppresses non-essential CSS motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const motion = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'animation: pulse 2s infinite; transition: opacity 2s;';
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const result = {
      preference: matchMedia('(prefers-reduced-motion: reduce)').matches,
      animationDuration: style.animationDuration,
      animationIterationCount: style.animationIterationCount,
      transitionDuration: style.transitionDuration,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior
    };
    probe.remove();
    return result;
  });
  expect(motion.preference).toBe(true);
  expect(motion.animationDuration).toBe('1e-05s');
  expect(motion.animationIterationCount).toBe('1');
  expect(motion.transitionDuration).toBe('1e-05s');
  expect(motion.scrollBehavior).toBe('auto');
});

test('Earth 3D desktop profiling records WebGL draw submission timings and resource dimensions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const target = window as Window & { __orbitalDrawMetrics?: Array<{ durationMs: number; method: string }> };
    target.__orbitalDrawMetrics = [];
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = (prototype as unknown as Record<string, unknown>)[method];
        if (typeof original !== 'function') continue;
        (prototype as unknown as Record<string, unknown>)[method] = function (...args: unknown[]) {
          const start = performance.now();
          try {
            return (original as (...values: unknown[]) => unknown).apply(this, args);
          } finally {
            target.__orbitalDrawMetrics?.push({ durationMs: performance.now() - start, method });
          }
        };
      }
    }
  });

  const start = Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  const canvas = page.locator('.earth3d-canvas canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(5000);

  const metrics = await page.evaluate((startedAt) => {
    const samples = (window.__orbitalDrawMetrics ?? []).map(item => item.durationMs).sort((a, b) => a - b);
    const percentile = (p: number) => samples.length ? samples[Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)] : null;
    const element = document.querySelector('.earth3d-canvas canvas') as HTMLCanvasElement | null;
    const rect = element?.getBoundingClientRect();
    const gl = element?.getContext('webgl2') ?? element?.getContext('webgl');
    return {
      elapsedMs: Date.now() - startedAt,
      drawCalls: samples.length,
      drawSubmissionMedianMs: percentile(0.5),
      drawSubmissionP95Ms: percentile(0.95),
      drawSubmissionMaxMs: samples.length ? samples[samples.length - 1] : null,
      canvas: element ? { bufferWidth: element.width, bufferHeight: element.height, cssWidth: rect?.width ?? 0, cssHeight: rect?.height ?? 0 } : null,
      webglContextAvailable: Boolean(gl && gl.getContextAttributes())
    };
  }, start);

  test.info().annotations.push({
    type: 'Desktop WebGL profiling (CPU submission only)',
    description: JSON.stringify({ ...metrics, device: 'GitHub Actions Chromium Linux virtual runner', viewport: '1440x900', limitation: 'CPU-side WebGL draw-call submission timings; not GPU frame time, true renderer FPS, thermal behavior, or physical-device performance.' })
  });
  expect(metrics.webglContextAvailable).toBe(true);
  expect(metrics.drawCalls).toBeGreaterThan(0);
  expect(metrics.canvas?.bufferWidth).toBeGreaterThan(0);
  expect(metrics.canvas?.bufferHeight).toBeGreaterThan(0);
});


test('Spacecraft engineering inputs expose explicit accessible labels', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Spacecraft', exact: true }).click();

  for (const label of ['TX POWER', 'FREQUENCY', 'THRUST', 'THERMAL AREA', 'BATTERY EFFICIENCY', 'BATTERY DoD']) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole('button', { name: 'Explain Communications Link Budget' })).toBeVisible();
});
