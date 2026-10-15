import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { queryClipboardDiagnostics, readBrowserClipboard, writeBrowserClipboard } from '../services/clipboard-diagnostics.js';

describe('Progressive Web App (PWA) & Manifest', () => {
  const publicDir = join(import.meta.dir, '../public');

  it('validates web app manifest structure and required PWA fields', () => {
    const rawManifest = readFileSync(join(publicDir, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(rawManifest) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      background_color: string;
      theme_color: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
      shortcuts: Array<{ name: string; url: string }>;
    };

    expect(manifest.name).toBe('ClipSync — Universal Clipboard');
    expect(manifest.short_name).toBe('ClipSync');
    expect(manifest.start_url).toBe('/dashboard');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#0f172a');
    expect(manifest.theme_color).toBe('#0284c7');

    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(manifest.shortcuts.some((s) => s.url === '/history')).toBe(true);
    expect(manifest.shortcuts.some((s) => s.url === '/transfers')).toBe(true);
  });

  it('verifies service worker precaching list and offline fallback events', () => {
    const swContent = readFileSync(join(publicDir, 'sw.js'), 'utf8');

    expect(swContent).toContain('CACHE_NAME');
    expect(swContent).toContain('/dashboard');
    expect(swContent).toContain('/history');
    expect(swContent).toContain('/manifest.json');
    expect(swContent).toContain("addEventListener('install'");
    expect(swContent).toContain("addEventListener('activate'");
    expect(swContent).toContain("addEventListener('fetch'");
    expect(swContent).toContain("addEventListener('push'");
    expect(swContent).toContain("addEventListener('notificationclick'");
  });

  it('handles clipboard diagnostics gracefully in non-browser/headless environment', async () => {
    const diagnostics = await queryClipboardDiagnostics();
    expect(diagnostics.readPermission).toBe('unsupported');
    expect(diagnostics.isSecureContext).toBe(false);

    const readResult = await readBrowserClipboard();
    expect(readResult.text).toBeNull();
    expect(readResult.error).toBeDefined();

    const writeResult = await writeBrowserClipboard('Sample');
    expect(writeResult.success).toBe(false);
    expect(writeResult.error).toBeDefined();
  });
});
