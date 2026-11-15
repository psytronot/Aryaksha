import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const notFound = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8');
const unslop = readFileSync(new URL('../.agents/skills/unslop/SKILL.md', import.meta.url), 'utf8');
const unslopAttribution = readFileSync(new URL('../.agents/skills/unslop/ATTRIBUTION.md', import.meta.url), 'utf8');
const unslopAudit = readFileSync(new URL('../docs/design/UNSLOP-AUDIT.md', import.meta.url), 'utf8');

describe('website quality checklist', () => {
  it('declares the branded favicon', () => {
    expect(html).toContain('rel="icon"');
    expect(html).toContain('/favicon.svg');
  });

  it('provides a branded static 404 page with a route home', () => {
    expect(notFound).toContain('Page not found');
    expect(notFound).toContain('href="/"');
    expect(notFound).toContain('Return to homepage');
  });

  it('shows a current-year copyright and an accessible status region', () => {
    expect(app).toContain('new Date().getFullYear()');
    expect(app).toContain('className="app-footer"');
    expect(app).toContain('role="status" aria-live="polite"');
  });

  it('applies the unslop pass without replacing the aerospace-lab identity', () => {
    expect(css).toContain('--cyan:#8bbdcc');
    expect(css).toContain('.card{background:var(--panel);box-shadow:none');
    expect(css).toContain('.engine-status span,.dot{box-shadow:none}');
    expect(css).toContain('.page-header p{font-size:14px');
  });

  it('ships the attributed product-specific unslop workflow', () => {
    expect(unslop).toContain('Fix in nine passes, in order');
    expect(unslopAttribution).toContain('Damir Sokolovsky');
    expect(unslopAttribution).toContain('CC BY 4.0');
    expect(unslopAudit).toContain('focused unslop pass was warranted and applied');
  });
});
