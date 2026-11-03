import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// PLT-02 (install half), D-06 to D-08, T-08-04, T-08-05: the manifest, the icons, the iOS tags of
// index.html and the icon generator are checked as files. The built page and the offline answers
// are in e2e/pwa-install.spec.ts. Nothing here knows how many icons exist: the list comes from the
// manifest itself, the declared sizes from its entries.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

interface ManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}
interface Manifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
  prefer_related_applications?: boolean;
}

const manifestText = read('public/manifest.webmanifest');
const manifest = JSON.parse(manifestText) as Manifest;
const indexHtml = read('index.html');
const generator = read('scripts/make-icons.mjs');

/** Width and height in the IHDR chunk, or null when the bytes are no PNG. */
function pngSize(bytes: Buffer): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** A URL a manifest may carry without knowing the host or the base path. */
const isRelative = (url: string): boolean =>
  !url.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(url);

describe('web app manifest', () => {
  it('parses and carries the installability fields', () => {
    expect(manifest.name).not.toBe('');
    expect(manifest.short_name).not.toBe('');
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
    expect(manifest.prefer_related_applications).not.toBe(true);
    expect(manifest.background_color).toBe(manifest.theme_color);
  });

  it('holds only relative URLs, so it works under any base path', () => {
    const urls = [
      manifest.id,
      manifest.start_url,
      manifest.scope,
      ...manifest.icons.map((i) => i.src),
    ];
    expect(urls.length).toBeGreaterThan(3);
    for (const url of urls) expect(isRelative(url), url).toBe(true);
  });

  it('has an any-purpose icon of 192 and of 512 by its declared sizes', () => {
    const anyIcons = manifest.icons.filter((icon) =>
      (icon.purpose ?? 'any').split(/\s+/).includes('any'),
    );
    for (const side of [192, 512]) {
      expect(anyIcons.some((icon) => icon.sizes.split(/\s+/).includes(`${side}x${side}`))).toBe(
        true,
      );
    }
  });

  it('declares the maskable icon as its own file, different from the any-purpose 512', () => {
    const maskable = manifest.icons.filter((icon) =>
      (icon.purpose ?? '').split(/\s+/).includes('maskable'),
    );
    expect(maskable).toHaveLength(1);
    const plain = manifest.icons.find(
      (icon) => icon.sizes === maskable[0]?.sizes && !(icon.purpose ?? 'any').includes('maskable'),
    );
    expect(plain).toBeDefined();
    expect(plain?.src).not.toBe(maskable[0]?.src);
    expect(
      readFileSync(join(root, 'public', plain?.src ?? '')).equals(
        readFileSync(join(root, 'public', maskable[0]?.src ?? '')),
      ),
    ).toBe(false);
  });

  it('points at icon files that are PNGs of the declared size and carry real art', () => {
    for (const icon of manifest.icons) {
      const bytes = readFileSync(join(root, 'public', icon.src));
      const size = pngSize(bytes);
      expect(size, `${icon.src} is a PNG`).not.toBeNull();
      expect(icon.sizes, icon.src).toBe(`${size?.width}x${size?.height}`);
      // A flat-colour PNG of this size is the deflated zero image plus a small fixed overhead.
      const flat =
        deflateSync(Buffer.alloc(((size?.width ?? 0) * 4 + 1) * (size?.height ?? 0))).length + 120;
      expect(bytes.length, `${icon.src} is no flat image`).toBeGreaterThan(flat * 3);
    }
  });
});

describe('index.html tags', () => {
  const tag = (pattern: RegExp) => pattern.exec(indexHtml)?.[0] ?? '';
  const content = (name: string) =>
    new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(indexHtml)?.[1];

  it('links the manifest, the apple touch icon and the PNG favicon through the base', () => {
    for (const rel of ['manifest', 'apple-touch-icon', 'icon']) {
      const link = tag(new RegExp(`<link rel="${rel}"[^>]*>`));
      expect(link, rel).toContain('href="%BASE_URL%');
    }
    expect(indexHtml).not.toContain('href="data:');
  });

  it('declares the iOS standalone metas, the title and the status bar style', () => {
    expect(content('apple-mobile-web-app-capable')).toBe('yes');
    expect(content('mobile-web-app-capable')).toBe('yes');
    expect(content('apple-mobile-web-app-title')).toBe(manifest.short_name);
    expect(content('apple-mobile-web-app-status-bar-style')).toBe('black');
  });

  it('points the apple touch icon at a 180 by 180 PNG', () => {
    const href = /<link rel="apple-touch-icon"[^>]*href="%BASE_URL%([^"]+)"/.exec(indexHtml)?.[1];
    expect(href).toBeDefined();
    expect(pngSize(readFileSync(join(root, 'public', href ?? '')))).toEqual({
      width: 180,
      height: 180,
    });
  });

  it('keeps theme-color equal to the manifest and adds no viewport-fit', () => {
    expect(content('theme-color')).toBe(manifest.theme_color);
    expect(indexHtml).not.toMatch(/viewport-fit/i);
    expect(content('viewport')).toBe('width=device-width, initial-scale=1');
  });
});

describe('brand rule and generator input (T-08-04, T-08-05)', () => {
  // The same names as tests/brand.test.ts plus the RUBIN mark; the generator and the manifest are
  // new surfaces of the same rule (content policy section 7).
  const makerNames = /garmin|diamond|rubin|\bG1000\b|\bNXi\b/i;

  it.each([
    ['public/manifest.webmanifest', manifestText],
    ['index.html', indexHtml],
    ['scripts/make-icons.mjs', generator],
  ])('%s names no maker and no RUBIN mark', (_name, text) => {
    expect(makerNames.test(text)).toBe(false);
  });

  it('the name check bites', () => {
    expect(makerNames.test('<meta name="author" content="Diamond">')).toBe(true);
    expect(makerNames.test('RUBIN')).toBe(true);
  });

  it('the generator writes the type name and the panel mark only', () => {
    expect(generator).toContain('DA50RG');
    expect(generator).toContain('GO-AROUND');
  });

  it('the generator never reads the private input folder or a photo', () => {
    expect(generator).not.toMatch(/\.input/);
    expect(generator).not.toMatch(/\.(jpe?g|heic|webp)\b/i);
  });
});
