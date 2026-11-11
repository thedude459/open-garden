import { bundleFromJSON } from '@sigstore/bundle';
import { TrustedRoot } from '@sigstore/protobuf-specs';
import { toSignedEntity, toTrustMaterial, Verifier } from '@sigstore/verify';
import tufSeeds from '@sigstore/tuf/seeds.json';

/** Only the data repository's release workflow, run for a vX.Y.Z tag, may sign a catalog. */
const RELEASE_WORKFLOW =
  /^https:\/\/github\.com\/thedude459\/open-garden-data\/\.github\/workflows\/release\.yml@refs\/tags\/v\d+\.\d+\.\d+$/;
const GITHUB_ACTIONS_ISSUER = 'https://token.actions.githubusercontent.com';

/**
 * Checks the release's build provenance attestation (the `.sigstore.json`
 * bundle the data repo's release workflow attaches): Sigstore signed it for
 * the release workflow, and the statement it signs names this file's SHA-256.
 * Throws when any of that fails. Runs offline.
 */
export function verifyCatalogAttestation(bundleJson: unknown, sha256: string): void {
  const bundle = bundleFromJSON(bundleJson);
  const verifier = new Verifier(toTrustMaterial(sigstoreTrustedRoot()));
  verifier.verify(toSignedEntity(bundle), {
    subjectAlternativeName: RELEASE_WORKFLOW,
    extensions: { issuer: GITHUB_ACTIONS_ISSUER },
  });
  if (bundle.content.$case !== 'dsseEnvelope') {
    throw new Error('Catalog attestation is not a signed statement');
  }
  const statement = JSON.parse(bundle.content.dsseEnvelope.payload.toString('utf8')) as {
    subject?: Array<{ digest?: { sha256?: string } }>;
  };
  if (!statement.subject?.some((s) => s.digest?.sha256 === sha256)) {
    throw new Error('Catalog attestation is for a different file');
  }
}

/**
 * ponytail: the Sigstore public-good trust root shipped inside @sigstore/tuf,
 * so verification works offline. A Sigstore key rotation newer than that
 * package needs a dependency bump (Dependabot); the upgrade path is refreshing
 * it over TUF (`getTrustedRoot`) when the API has network access.
 */
function sigstoreTrustedRoot(): TrustedRoot {
  const seeds: Record<string, { targets: Record<string, string> }> = tufSeeds;
  const encoded = seeds['https://tuf-repo-cdn.sigstore.dev']?.targets['trusted_root.json'];
  if (!encoded) throw new Error('Sigstore trust root is missing');
  return TrustedRoot.fromJSON(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')));
}
