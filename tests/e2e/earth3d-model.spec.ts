import { expect, test } from '@playwright/test';

test('Earth 3D spacecraft presets update the selected silhouette without replacing the mission state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();

  const canvas = page.locator('.earth3d-canvas canvas');
  await expect(canvas).toBeVisible();

  const model = page.getByRole('combobox', { name: 'Choose spacecraft model' });
  await expect(model).toHaveValue('design');
  await model.selectOption('cubesat3u');
  await expect(model).toHaveValue('cubesat3u');
  await expect(page.getByText('Model choice changes the 3D silhouette only; orbit and telemetry remain the selected mission state.')).toBeVisible();
  await expect(canvas).toBeVisible();

  await model.selectOption('iss');
  await expect(model).toHaveValue('iss');
  await expect(canvas).toBeVisible();
});
