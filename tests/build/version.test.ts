import { describe, expect, it } from 'vitest';
import { versionString } from '../../build/version';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const noGit = () => undefined;

describe('versionString', () => {
  it('shows only the package version for tag builds', () => {
    expect(versionString('1.2.3', { GITHUB_REF_TYPE: 'tag', GITHUB_SHA: SHA }, () => 'fedcba9')).toBe('1.2.3');
  });

  it('appends the short GitHub commit for branch builds', () => {
    expect(versionString('1.2.3', { GITHUB_REF_TYPE: 'branch', GITHUB_SHA: SHA }, noGit)).toBe('1.2.3+0123456');
  });

  it('prefers GITHUB_SHA over CF_PAGES_COMMIT_SHA and local git', () => {
    expect(versionString('1.2.3', { GITHUB_SHA: SHA, CF_PAGES_COMMIT_SHA: 'bbbbbbbbbb' }, () => 'ccccccc')).toBe(
      '1.2.3+0123456',
    );
  });

  it('falls back to CF_PAGES_COMMIT_SHA', () => {
    expect(versionString('1.2.3', { CF_PAGES_COMMIT_SHA: 'bbbbbbbbbb' }, () => 'ccccccc')).toBe('1.2.3+bbbbbbb');
  });

  it('falls back to the local git hash', () => {
    expect(versionString('1.2.3', {}, () => 'ccccccc\n')).toBe('1.2.3+ccccccc');
  });

  it('treats empty env values as missing', () => {
    expect(versionString('1.2.3', { GITHUB_SHA: '', CF_PAGES_COMMIT_SHA: '' }, () => 'ccccccc')).toBe('1.2.3+ccccccc');
  });

  it('shows the bare version when no commit is known', () => {
    expect(versionString('1.2.3', {}, noGit)).toBe('1.2.3');
  });
});
