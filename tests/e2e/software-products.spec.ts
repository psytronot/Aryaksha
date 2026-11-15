import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('software products hub is reachable and presents honest product availability', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Software Products', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Useful software. Open access. Practical outcomes.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Google Maps Scrapper' })).toBeVisible();
  await expect(page.getByText('COMPLIANCE REVIEW', { exact: true })).toBeVisible();
  await expect(page.getByText('Not available as a hosted extraction service')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'First Customer Finder', exact: true })).toBeVisible();
  await expect(page.getByText('PILOT PREPARATION')).toBeVisible();
  await expect(page.getByText('Human-reviewed research; no automated outreach')).toBeVisible();

  await expect(page.getByText('Payments are not enabled yet.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What a First Customer Finder report could look like' })).toBeVisible();
  await expect(page.getByText('Illustrative layout only. These fictional examples are not real companies, researched prospects or endorsements.')).toBeVisible();
  await expect(page.getByText('Northstar Robotics (fictional)')).toBeVisible();
  await expect(page.getByText('ORIGINAL SOURCE')).toBeVisible();
  await expect(page.getByText('EVIDENCE QUALITY')).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'First Customer Finder', exact: true })).toBeVisible();
  await expect(page.getByLabel('What are you offering?')).toBeVisible();
  await expect(page.getByLabel('Upload a business CSV')).toBeVisible();
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
  await expect(page.getByText('Acme Robotics', { exact: true })).toBeVisible();
  await expect(page.getByText('Orbit Learning', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download cleaned CSV' })).toBeVisible();
  await expect(page.getByText('Your file is processed in this browser only; it is not uploaded.')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download cleaned CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('cleaned-business-list.csv');
});


test('CSV cleanup rejects files without a recognised organisation column', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Software Products', exact: true }).click();
  await page.getByLabel('Upload a business CSV').setInputFiles({
    name: 'invalid.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Website,City\nhttps://example.test,Bengaluru')
  });
  await expect(page.getByRole('alert')).toContainText('Add a Company, Business Name or Name column.');
  await expect(page.getByRole('button', { name: 'Download cleaned CSV' })).toHaveCount(0);
});


test('CSV cleanup rejects malformed quoting and inconsistent row widths', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Software Products', exact: true }).click();

  await page.getByLabel('Upload a business CSV').setInputFiles({
    name: 'malformed.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Company,Website\nAcme "Robotics",https://acme.example')
  });
  await expect(page.getByRole('alert')).toContainText('A quoted field must start with a quote');

  await page.getByLabel('Upload a business CSV').setInputFiles({
    name: 'uneven.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Company,Website,City\nAcme Robotics,https://acme.example')
  });
  await expect(page.getByRole('alert')).toContainText('Every CSV row must have the same number of columns');
  await expect(page.getByRole('button', { name: 'Download cleaned CSV' })).toHaveCount(0);
});

test('cleaned CSV neutralizes spreadsheet formula prefixes in exported cells', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Software Products', exact: true }).click();
  await page.getByLabel('Upload a business CSV').setInputFiles({
    name: 'formula.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Company,Website,City\n=HYPERLINK("https://bad.example"),https://safe.example,+Bengaluru')
  });

  await expect(page.getByRole('button', { name: 'Download cleaned CSV' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download cleaned CSV' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const exported = await readFile(path!, 'utf8');
  expect(exported).toContain("'=HYPERLINK");
  expect(exported).toContain("'+Bengaluru");
  expect(exported).not.toContain(',"+Bengaluru"');
});
