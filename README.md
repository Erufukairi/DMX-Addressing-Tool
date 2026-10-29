# DMX Address Table

A fast, offline, field-friendly tool that answers one question: **"What address does each unit start at?"**

Enter a fixture footprint and a start address. The app lists each unit's start address and how many fixtures fit before address 512. It is an addressing tool, not a patching tool: no universes, fixture profiles, or console channels.

It runs as a Progressive Web App on Android, iPhone, and desktop browsers, with no backend and no network calls at runtime.

See the [design document](docs/dmx-address-table-design.md) for scope, domain rules, and build phases.

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

## License

[MIT](LICENSE)
