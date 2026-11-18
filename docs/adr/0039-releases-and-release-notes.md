# ADR 0039: Releases and release notes

## Status

Accepted.

## Context

Open Garden had one release, v0.1.0, whose notes were GitHub's generated list
of every merged pull request, Dependabot bumps included. Households install a
`compose.yaml` that pins an image version, so 230 commits of features since
then reached nobody. The OpenSSF Best Practices criterion `release_notes_vulns`
asks that release notes name every publicly known vulnerability in the
project's own code, with a CVE or similar, that the release fixes; it applies
here because households update the software themselves. The maintainer asked
for notes in The Good Docs Project's release notes layout, written
automatically at release time, in both repositories.

## Decision

1. **Cadence.** A minor release when a roadmap step's pull requests are
   merged; a patch release for a fix that should not wait; release
   candidates only to try a release first.
2. **CHANGELOG.md is the source.** Its Unreleased entry has the template's
   headings: Summary, New features, Improvements, Bug fixes, Security, Known
   issues, Deprecated features. Every pull request adds its line under one
   of them; the `changelog` CI job fails a pull request that does not, except
   Dependabot's and those labelled `skip-changelog` (CI, tests, roadmap).
   `node scripts/ci/release-notes.js cut <version> <date>` renames Unreleased
   to the version in a release pull request, where the Summary is written.
3. **The notes' layout.** Title ("Open Garden v0.2.0 release notes"), the
   notes' own version and release date, Summary, then each section in order,
   saying "None" when empty, an install line, and a compare link to the
   previous release. A corrected entry gets `Release notes version: 2`.
4. **Security.** The section names fixed vulnerabilities in Open Garden's own
   code by CVE or GHSA id; dependency vulnerabilities are left to Dependabot
   and OSV-Scanner. The Release workflow reads the repository's published
   security advisories and refuses to release a version that an advisory
   lists as patched unless its id is in the section.
5. **One workflow releases.** Actions → Release with a version, on `main`:
   checks, a draft GitHub Release with the notes, the images built, signed,
   scanned, and pushed, `compose.yaml` attached, then the release published
   (which creates the tag). A draft keeps a half-built release from showing.
   A release published by hand no longer builds images.
6. **open-garden-data** follows the same layout and the same Release
   workflow (no images; its generated list of data changes follows the
   template sections). Its Security section says "Not applicable": a dataset
   release is data, with no code that runs.

## Consequences

- Every pull request author writes one plain-language line; release time is a
  Summary and a button.
- Release notes say nothing about who merged what; the compare link has the
  full history.
- Publishing a release by hand on GitHub skips the images, so the workflow is
  the only supported way to release.
