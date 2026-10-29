import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { versionString } from './build/version.ts';

const THEME_COLOR = '#121417';

function localGitHash(): string | undefined {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return undefined;
  }
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// `vite build --mode single` produces one self-contained HTML file (design doc §2a).
// It has no service worker: the PWA plugin is left out and its register hook is stubbed.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(versionString(pkg.version, process.env, localGitHash)),
    },
    resolve: single
      ? {
          alias: {
            'virtual:pwa-register/preact': fileURLToPath(new URL('./src/ui/pwaStub.ts', import.meta.url)),
          },
        }
      : undefined,
    plugins: [
      preact(),
      ...(single
        ? [viteSingleFile()]
        : [
            VitePWA({
              strategies: 'generateSW',
              registerType: 'prompt',
              injectRegister: false,
              includeAssets: ['icon.svg', 'apple-touch-icon.png'],
              manifest: {
                name: 'DMX Address Table',
                short_name: 'DMX Addr',
                description: 'Start address for each fixture in a DMX universe.',
                start_url: './',
                scope: './',
                display: 'standalone',
                theme_color: THEME_COLOR,
                background_color: THEME_COLOR,
                icons: [
                  { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                  { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                  { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
                cleanupOutdatedCaches: true,
              },
            }),
          ]),
    ],
    build: {
      outDir: single ? 'dist-single' : 'dist',
    },
    test: {
      include: ['tests/**/*.test.ts'],
    },
  };
});
