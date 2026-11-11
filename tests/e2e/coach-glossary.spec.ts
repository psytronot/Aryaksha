import { expect, test } from '@playwright/test';

test('on-board coach follows focused engineering fields, pins explanations and respects opt-out', async ({ page }) => {
  await page.goto('/');
  const coachToggle = page.getByRole('button', { name: 'COACH ON', exact: true });
  await expect(coachToggle).toHaveAttribute('aria-pressed', 'true');
  const firstField = page.locator('[data-context-label] input, [data-context-label] select').first();
  await expect(firstField).toBeVisible();
  await firstField.focus();
  const coach = page.getByRole('complementary', { name: 'On-board tutor' });
  await expect(coach).toBeVisible();
  await expect(coach.getByText('Context Coach')).toBeVisible();
  await coach.getByRole('button', { name: 'Pin guidance' }).click();
  await expect(coach.getByText('PINNED')).toBeVisible();
  await coach.getByRole('button', { name: 'Model assumptions' }).click();
  await expect(coach.getByText('Model Fidelity', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'COACH ON', exact: true }).click();
  await expect(page.getByRole('button', { name: 'COACH OFF', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(coach).toHaveCount(0);
  await page.getByRole('button', { name: 'COACH OFF', exact: true }).click();
  await expect(page.getByRole('button', { name: 'COACH ON', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('engineering instructions and glossary support searchable definitions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'HELP · DEFINITIONS' }).click();
  await expect(page.getByRole('heading', { name: 'How Aryaksha works.' })).toBeVisible();
  await expect(page.getByText('The one mathematical source of truth')).toBeVisible();
  await expect(page.getByText('Model fidelity: what the numbers claim')).toBeVisible();
  const search = page.getByRole('textbox', { name: 'Search engineering definitions' });
  await search.fill('RAAN');
  await expect(page.locator('.glossary-row').filter({ hasText: 'RAAN' })).toHaveCount(1);
  await search.fill('this-term-does-not-exist');
  await expect(page.getByText('Engineering dictionary · 0 terms')).toBeVisible();
  await expect(page.locator('.glossary-row')).toHaveCount(0);
  await search.clear();
  await expect(page.locator('.glossary-row').first()).toBeVisible();
});
