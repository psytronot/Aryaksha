import { expect, test } from '@playwright/test';

test('software products hub is reachable and presents honest product availability', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Software Products', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Useful software. Open access. Practical outcomes.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Google Maps Scrapper' })).toBeVisible();
  await expect(page.getByText('COMPLIANCE REVIEW')).toBeVisible();
  await expect(page.getByText('Not available as a hosted extraction service')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'First Customer Finder' })).toBeVisible();
  await expect(page.getByText('PILOT PREPARATION')).toBeVisible();
  await expect(page.getByText('Human-reviewed research; no automated outreach')).toBeVisible();

  await expect(page.getByText('Payments are not enabled yet.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What a First Customer Finder report could look like' })).toBeVisible();
  await expect(page.getByText('Illustrative layout only. These fictional examples are not real companies, researched prospects or endorsements.')).toBeVisible();
  await expect(page.getByText('Northstar Robotics (fictional)')).toBeVisible();
  await expect(pageErrors).toEqual([]);
});

test('software products hub remains reachable through mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();

  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation.getByRole('button', { name: 'Software Products', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Useful software. Open access. Practical outcomes.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First Customer Finder' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
});


test('First Customer Finder validates and prepares a research brief without inventing prospects', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Software Products', exact: true }).click();

  await page.getByRole('button', { name: 'Prepare research brief' }).click();
  await expect(page.getByText('Add your offer, intended customer and geography to continue.')).toBeVisible();

  await page.getByLabel('What are you offering?').fill('A low-cost satellite imagery analysis workshop');
  await page.getByLabel('Who should benefit?').fill('Engineering colleges and student space clubs');
  await page.getByLabel('Where should we research?').fill('India');
  await page.getByRole('button', { name: 'Prepare research brief' }).click();

  await expect(page.getByRole('heading', { name: 'Research brief ready' })).toBeVisible();
  await expect(page.getByText('No live research was run and no prospects have been invented.')).toBeVisible();
  await expect(page.getByText('A low-cost satellite imagery analysis workshop')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download research brief' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('first-customer-research-brief.md');
});


test('user-supplied business CSV is processed locally and duplicate rows are reported', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Software Products', exact: true }).click();

  await page.getByLabel('Upload a business CSV').setInputFiles({
    name: 'prospects.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Company,Website,City\nAcme Robotics,https://acme.example,Bengaluru\nAcme Robotics,https://acme.example,Bengaluru\nOrbit Learning,https://orbit.example,Pune')
  });

  await expect(page.getByText('3 data rows found')).toBeVisible();
  await expect(page.getByText('2 unique organisations')).toBeVisible();
  await expect(page.getByText('1 duplicate row excluded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download cleaned CSV' })).toBeVisible();
  await expect(page.getByText('Your file is processed in this browser only; it is not uploaded.')).toBeVisible();
});
