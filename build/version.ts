// Build-time version string (design doc §2a). Build config, not addressing math, so it lives outside src/engine/.

export interface VersionEnv {
  GITHUB_REF_TYPE?: string;
  GITHUB_SHA?: string;
  CF_PAGES_COMMIT_SHA?: string;
}

/**
 * "0.2.0" for release (tag) builds, "0.2.0+abc1234" otherwise.
 * Commit sources, in order: GITHUB_SHA, CF_PAGES_COMMIT_SHA, then the local git hash.
 */
export function versionString(
  pkgVersion: string,
  env: VersionEnv,
  localGitHash: () => string | undefined,
): string {
  if (env.GITHUB_REF_TYPE === 'tag') return pkgVersion;
  const sha = env.GITHUB_SHA || env.CF_PAGES_COMMIT_SHA || localGitHash();
  return sha ? `${pkgVersion}+${sha.trim().slice(0, 7)}` : pkgVersion;
}
