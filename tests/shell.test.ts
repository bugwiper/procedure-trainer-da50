import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('index.html shell', () => {
  it('has the exact viewport meta and no viewport-fit', () => {
    expect(html).toContain('content="width=device-width, initial-scale=1"');
    expect(html).not.toContain('viewport-fit');
  });

  it('uses a data: favicon so nothing requests /favicon.ico at the host root', () => {
    expect(html).toContain('rel="icon" href="data:,"');
  });
});
