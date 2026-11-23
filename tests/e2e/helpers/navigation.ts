import { expect, type Page } from '@playwright/test';

const workspaceGroups: Record<string, string> = {
  'Mission': 'Plan', 'Payload': 'Design', 'Spacecraft': 'Design',
  'Orbit & Maneuver': 'Design', 'Simulation': 'Analyse',
  'Mission Analysis': 'Analyse', 'Engineering Analysis': 'Analyse',
  'Verification': 'Analyse', 'Satellite Tracking': 'Explore',
  'Aerospace Workbench': 'Explore', 'Design Report': 'Output',
  'Instructions & Glossary': 'Learn & Tools',
  'Calculator & Reference': 'Learn & Tools', 'Software Products': 'Learn & Tools'
};

export async function openWorkspace(page: Page, label: string) {
  const groupName = workspaceGroups[label];
  if (!groupName) throw new Error(`Unknown workspace label: ${label}`);
  const sidebar = page.locator('aside.sidebar');
  const group = sidebar.locator('details.nav-group').filter({ has: sidebar.getByText(groupName, { exact: true }) });
  if (!(await group.evaluate(element => (element as HTMLDetailsElement).open))) {
    await group.locator('summary').click();
  }
  const button = sidebar.getByRole('button', { name: label, exact: true });
  await expect(button).toBeVisible();
  await button.click();
}
