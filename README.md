# DMX Address Table

A fast, offline, field-friendly tool that answers one question: **"What address does each unit start at?"**

Enter a fixture footprint and a start address. The app lists each unit's start address and how many fixtures fit before address 512. It is an addressing tool, not a patching tool: no universes, fixture profiles, or console channels.

It runs as a Progressive Web App on Android, iPhone, and desktop browsers, with no backend and no network calls at runtime.

See the [design document](docs/dmx-address-table-design.md) for scope, domain rules, and build phases.

## Use it

- **GitHub Pages:** https://erufukairi.github.io/DMX-Addressing-Tool/
- **Cloudflare Pages:** https://dmx-addressing-tool.brandon-kitson.workers.dev/
- **Single file:** each [release](../../releases) has a self-contained `.html` file that runs when opened straight from a phone or computer's storage, with no install.

On iPhone, open the site in Safari and use Share → Add to Home Screen. On Android, open it in Chrome and install it from the menu. After the first load it works offline.

## Development

Requires Node.js and npm.

```sh
npm install
```

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run dev:lan` | Dev server reachable from a phone on the same network |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run build:single` | Self-contained single-file HTML build to `dist-single/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the tests once |
| `npm run test:watch` | Run the tests in watch mode |
| `npm run typecheck` | Type-check only |

All addressing math lives in `src/engine/`, a pure TypeScript module with no DOM, storage, or framework imports. Its tests are in `tests/engine/`.

The app version shown in the header comes from `package.json`. Builds that aren't from a version tag add the short commit hash, e.g. `0.1.0+abc1234`.

## Deployment

- **GitHub Pages** (production): [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs tests, type-check, and build on every push to `main`, then deploys `dist/`. A failing test blocks the deploy. Repo **Settings → Pages → Source** must be set to **GitHub Actions**.
- **Cloudflare Pages** (second host and branch previews): connected in the Cloudflare dashboard, with build command `npm run build` and output directory `dist`. `main` deploys to production; every other branch gets a preview URL. Test feature branches on a phone through their preview URL before merging. If the build picks the wrong Node version, set the `NODE_VERSION` environment variable to match [`.nvmrc`](.nvmrc).
- **Releases:** pushing a `v*` tag runs [`.github/workflows/release.yml`](.github/workflows/release.yml), which attaches the single-file build to a GitHub Release.
- **Bad cached release:** see the [service worker kill-switch](docs/kill-switch.md).

Icons in `public/` were drawn by hand as `icon.svg` and rendered once to PNG with headless Edge. There's no icon generator in the build.

## License

[MIT](LICENSE)
