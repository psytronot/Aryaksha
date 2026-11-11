test('desktop tutor reopens on hover after the user dismisses it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const coach = page.getByRole('complementary', { name: 'On-board tutor' });
  await expect(coach).toBeVisible();
  await coach.getByRole('button', { name: 'Close tutor' }).click();
  await expect(coach).toHaveCount(0);

  const field = page.locator('[data-context-label] input, [data-context-label] select').first();
  await field.hover();
  await expect(coach).toBeVisible();
  await expect(coach.locator('.coach-location small')).toContainText('POINTING AT:');
});
