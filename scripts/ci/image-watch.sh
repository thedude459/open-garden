#!/usr/bin/env bash
# Daily image watch (ADR 0041), run by .github/workflows/image-scan.yml once
# open-garden-$IMAGE:main is built from main. Scans it for fixable HIGH and
# CRITICAL vulnerabilities. If it has any, rebuilds it on every base-image
# tag allowed in .github/base-images.json (and on the newest digest of the
# tag it uses) and scans each, so the report can say which base is clean.
# Writes image-watch-$IMAGE.md for the report job; its first line is
# "<!-- findings: N -->". Exits 0 unless the scan itself cannot run.
#
#   scripts/ci/image-watch.sh api|web YYYY-MM-DD
set -euo pipefail

image="$1"
today="$2"
out="image-watch-${image}.md"
dockerfile="Dockerfile.${image}"

scan() {
  trivy image --quiet --severity HIGH,CRITICAL --ignore-unfixed --scanners vuln \
    --ignorefile .trivyignore --format json "$1"
}
count() { jq '[.Results[]?.Vulnerabilities[]?] | length'; }
rows() {
  jq -r '.Results[]?.Vulnerabilities[]?
    | "| \(.PkgName) | \(.VulnerabilityID) | \(.Severity) | \(.InstalledVersion) | \(.FixedVersion) |"' |
    sort -u
}

report="$(scan "open-garden-${image}:main")"
found="$(count <<<"${report}")"
{
  echo "<!-- findings: ${found} -->"
  echo "### ${image}"
  echo
} >"${out}"

if [[ "${found}" == 0 ]]; then
  echo "No fixable HIGH or CRITICAL vulnerabilities in the ${image} image built from main." >>"${out}"
  exit 0
fi

base="$(jq -r --arg i "${image}" '.[$i].image' .github/base-images.json)"
pinned="$(grep -oE "${base}:[^@[:space:]]+@sha256:[0-9a-f]{64}" "${dockerfile}" | tail -n 1)"
{
  echo "${found} fixable HIGH or CRITICAL vulnerabilities in the image built from main, on \`${pinned}\`:"
  echo
  echo "| Package | Vulnerability | Severity | Installed | Fixed in |"
  echo "|---|---|---|---|---|"
  rows <<<"${report}"
  echo
  echo "The same image rebuilt on each allowed base (\`.github/base-images.json\`):"
  echo
  echo "| Base | Findings |"
  echo "|---|---|"
} >>"${out}"

clean=""
for tag in $(jq -r --arg i "${image}" '.[$i].tags[]' .github/base-images.json); do
  digest="$(docker buildx imagetools inspect "${base}:${tag}" --format '{{json .Manifest}}' | jq -r .digest)"
  candidate="${base}:${tag}@${digest}"
  if [[ "${candidate}" == "${pinned}" ]]; then
    echo "| \`${candidate}\` (in use) | ${found} |" >>"${out}"
    continue
  fi
  sed -E "s#${base}:[^@[:space:]]+@sha256:[0-9a-f]{64}#${candidate}#g" "${dockerfile}" \
    >"${RUNNER_TEMP:-/tmp}/Dockerfile.candidate"
  if ! docker buildx build --quiet --load --build-arg "OS_PACKAGES_DATE=${today}" \
    -f "${RUNNER_TEMP:-/tmp}/Dockerfile.candidate" -t "open-garden-${image}:candidate" . >/dev/null; then
    echo "| \`${candidate}\` | does not build |" >>"${out}"
    continue
  fi
  left="$(scan "open-garden-${image}:candidate" | count)"
  echo "| \`${candidate}\` | ${left} |" >>"${out}"
  if [[ "${left}" == 0 && -z "${clean}" ]]; then clean="${candidate}"; fi
done

{
  echo
  if [[ -n "${clean}" ]]; then
    echo "**Fix:** in \`${dockerfile}\`, change the base to \`${clean}\`, then check the image runs."
  else
    echo "**No allowed base is clean yet.** If one does not appear soon, add each finding to"
    echo "\`.trivyignore\` with this issue's link and an expiry at most 30 days ahead (ADR 0041)."
  fi
} >>"${out}"
