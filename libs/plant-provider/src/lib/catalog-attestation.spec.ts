import { describe, expect, it } from 'vitest';
import { RELEASE_WORKFLOW } from './catalog-attestation';

describe('the catalog signer', () => {
  const workflow = 'https://github.com/thedude459/open-garden-data/.github/workflows/release.yml';

  it('is the release workflow run on main (v0.2.3 on) or for a version tag (to v0.2.2)', () => {
    expect(RELEASE_WORKFLOW.test(`${workflow}@refs/heads/main`)).toBe(true);
    expect(RELEASE_WORKFLOW.test(`${workflow}@refs/tags/v0.2.2`)).toBe(true);
  });

  it('is not another branch, tag, workflow, or repository', () => {
    expect(RELEASE_WORKFLOW.test(`${workflow}@refs/heads/feature`)).toBe(false);
    expect(RELEASE_WORKFLOW.test(`${workflow}@refs/heads/main-old`)).toBe(false);
    expect(RELEASE_WORKFLOW.test(`${workflow}@refs/tags/latest`)).toBe(false);
    expect(
      RELEASE_WORKFLOW.test(
        'https://github.com/thedude459/open-garden-data/.github/workflows/ci.yml@refs/heads/main',
      ),
    ).toBe(false);
    expect(
      RELEASE_WORKFLOW.test(
        'https://github.com/someone/open-garden-data/.github/workflows/release.yml@refs/heads/main',
      ),
    ).toBe(false);
  });
});
