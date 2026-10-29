import { describe, expect, it } from 'vitest';

// Architecture rule (§3): the engine imports nothing outside src/engine/.
const sources = import.meta.glob<string>('../../src/engine/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('engine purity', () => {
  it('finds the engine sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
  });

  for (const [path, source] of Object.entries(sources)) {
    it(`${path} only imports from within src/engine`, () => {
      const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(
        (m) => m[1],
      );
      for (const spec of specifiers) {
        expect(spec, `${path} imports ${spec}`).toMatch(/^\.\/[\w.-]+$/);
      }
    });
  }
});
