import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const notFound = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8');

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
});
