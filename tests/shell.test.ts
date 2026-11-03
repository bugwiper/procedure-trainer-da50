import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('index.html shell', () => {
  it('has the exact viewport meta and no viewport-fit', () => {
    expect(html).toContain('content="width=device-width, initial-scale=1"');
    expect(html).not.toContain('viewport-fit');
  });

  it('names its favicon through the base so nothing requests /favicon.ico at the host root', () => {
    // 08-02 replaced the empty data: favicon by a PNG; the link is the base-prefixed one.
    expect(html).toMatch(/<link rel="icon"[^>]*href="%BASE_URL%icons\/favicon-32\.png"/);
    expect(html).not.toMatch(/<link rel="icon"[^>]*href="\//);
  });
});
