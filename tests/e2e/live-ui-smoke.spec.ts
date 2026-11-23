import { expect, test } from '@playwright/test';

test('live deployed UI serves the app shell and report-only CSP', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: /Explore Space/ })).toBeVisible();

  const headers = await response?.allHeaders();
  expect(headers?.['content-security-policy-report-only']).toContain("default-src 'self'");
  expect(headers?.['content-security-policy-report-only']).toContain("connect-src 'self' https://celestrak.org https://assets.science.nasa.gov");
  expect(pageErrors).toEqual([]);
});

test('live deployed UI renders mission analysis against the versioned response contract', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const requestBodies: Array<Record<string, unknown>> = [];
  await page.route('**/api/mission-analysis/orbit', route => {
    requestBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      valid: true,
      engine: 'Orekit',
      engineVersion: '13.1.9',
      fidelity: 'Orekit numerical propagation (two-body)',
      assumptions: ['No J2, drag, solar radiation pressure or third-body forces'],
      orbit: {
        altitudeKm: 550,
        semiMajorAxisKm: 6928.137,
        eccentricity: 0.001,
        inclinationDeg: 97.6,
        periodSeconds: 5738.9928,
        periodMinutes: 95.64988,
        periapsisAltitudeKm: 543.0719,
        apoapsisAltitudeKm: 556.9281,
        circularVelocityKmS: 7.58509,
        specificOrbitalEnergyKm2S2: -28.76678
      },
      state: {
        elapsedSeconds: 600,
        epoch: '2000-01-01T12:09:27.816',
        timeScale: 'TAI',
        frame: 'EME2000',
        positionKm: [123.456, 456.789, 789.012],
        velocityKmS: [1.234567, 2.345678, 3.456789]
      },
      comparison: {
        engineAdapter: 'orekit-http',
        status: 'connected',
        note: 'Results returned by the independently hosted Orekit service.'
      }
    })
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  await page.getByRole('button', { name: 'Mission Analysis', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Propagation time in seconds' }).fill('600');
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();

  await expect(page.getByText(/Analysis completed · Orekit/)).toBeVisible();
  await expect(page.getByText('95.65 min')).toBeVisible();
  await expect(page.getByText(/Epoch 2000-01-01T12:09:27\.816 TAI · Frame EME2000/)).toBeVisible();
  await expect(page.getByText('123.456, 456.789, 789.012')).toBeVisible();
  expect(requestBodies).toHaveLength(1);
  expect(requestBodies[0]).toMatchObject({ elapsedSeconds: 600 });
  expect(pageErrors).toEqual([]);
});

test('live deployed UI loads the lazy simulation, tracking and calculator workspaces', async ({ page }) => {
  const pageErrors: string[] = [];
  const loadedAssets: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/assets/')) loadedAssets.push(response.url());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
  await expect.poll(() => loadedAssets.some(url => /Earth3DScene-[^/]+\.js/.test(url))).toBe(true);

  await page.getByRole('button', { name: 'Satellite Tracking', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Satellite tracking & pass planning' })).toBeVisible();
  await expect.poll(() => loadedAssets.some(url => /SatelliteTrackingView-[^/]+\.js/.test(url))).toBe(true);

  await page.getByRole('button', { name: 'Calculator & Reference', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Engineering tools without leaving the lab.' })).toBeVisible();
  await expect.poll(() => loadedAssets.some(url => /ScientificCalculator-[^/]+\.js/.test(url))).toBe(true);
  expect(pageErrors).toEqual([]);
});


test('CSP report-only audit records no blocked resources across key workspaces', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('orbital-lab-coach-enabled', 'false'));
  await page.addInitScript(() => {
    const target = window as Window & { __cspViolations?: string[] };
    target.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', event => {
      target.__cspViolations?.push(`${event.violatedDirective}: ${event.blockedURI}`);
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mission Analysis', exact: true }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Orbital Mission Analysis' })).toBeVisible();
  await page.waitForTimeout(500);
  const violations = await page.evaluate(() => (window as Window & { __cspViolations?: string[] }).__cspViolations ?? []);
  expect(violations).toEqual([]);
});

test('Earth 3D visible controls expose accessible names and labelled inputs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Earth 3D', exact: true })).toBeVisible();

  const audit = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const unnamedButtons = [...document.querySelectorAll('button')].filter(button =>
      visible(button) && !(button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent?.trim())
    ).map(button => button.outerHTML.slice(0, 160));
    const unlabeledInputs = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(input =>
      visible(input) && !(input.getAttribute('aria-label') || input.getAttribute('aria-labelledby') || (input as HTMLInputElement).labels?.length)
    ).map(input => input.outerHTML.slice(0, 160));
    const imagesWithoutAlt = [...document.querySelectorAll('img')].filter(image => visible(image) && !image.hasAttribute('alt')).map(image => image.src);
    return { unnamedButtons, unlabeledInputs, imagesWithoutAlt };
  });
  expect(audit).toEqual({ unnamedButtons: [], unlabeledInputs: [], imagesWithoutAlt: [] });
});


test('Aerospace Engineering workspace runs the rocket staging optimisation interactively', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  await page.getByRole('button', { name: 'Aerospace Engineering', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Aerospace Engineering Suite' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rocket staging optimisation' })).toBeVisible();
  await expect(page.getByText('7.465', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('77.0%', { exact: true })).toBeVisible();

  const initialResult = await page.locator('.aero-big-result').innerText();
  await page.getByRole('spinbutton', { name: /Stage 2 specific impulse/ }).fill('360');
  await expect.poll(() => page.locator('.aero-big-result').innerText()).not.toBe(initialResult);

  await page.getByRole('button', { name: /Engineering model & assumptions/ }).click();
  await expect(page.getByText(/finite-burn losses/)).toBeVisible();
  expect(pageErrors).toEqual([]);
});


test('Rocket Ascent workspace calculates a trajectory and responds to propulsion changes', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  await page.getByRole('button', { name: 'Rocket Ascent', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Rocket ascent trajectory' })).toBeVisible();
  await expect(page.getByText('MAXIMUM SIMULATED ALTITUDE')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Rocket altitude versus downrange trajectory plot' })).toBeVisible();

  const baseline = await page.locator('.aero-big-result').innerText();
  await page.getByRole('spinbutton', { name: 'Engine thrust' }).fill('700000');
  await expect(page.locator('.aero-big-result')).not.toHaveText(baseline);
  expect(pageErrors).toEqual([]);
});


test('Aerospace Workbench guides users to the three engineering products', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring', exact: true }).click();
  await page.getByRole('button', { name: 'Aerospace Workbench', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Aerospace Engineering Workbench' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Engineering products' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rocket staging optimiser' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rocket ascent simulator' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Satellite orbital transfer' })).toBeVisible();

  await page.getByRole('button', { name: /Open workspace/ }).nth(2).click();
  await expect(page.getByRole('heading', { name: /Satellite orbital transfer \/ Product brief/ })).toBeVisible();
  await page.getByRole('button', { name: 'Engineering workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Satellite orbital transfer designer' })).toBeVisible();
  await page.getByRole('button', { name: 'Mission setup' }).click();
  await page.getByRole('spinbutton', { name: 'Target orbit altitude' }).fill('900');
  await page.getByRole('button', { name: 'Calculate transfer' }).click();
  await expect(page.getByText('TOTAL DELTA-V')).toBeVisible();
  await page.getByRole('button', { name: 'Methodology' }).click();
  await expect(page.getByText(/ideal instantaneous impulses/i)).toBeVisible();
  expect(pageErrors).toEqual([]);
});
