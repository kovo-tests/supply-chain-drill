# supply-chain-drill
Synthetic supply-chain gate drill fixture (Refs kovo-sh/kovo-cloud#1933). No real code.

This private repository contains the public npm security-drill fixture
`@kovo-internal-testing/drill-canary` and a synthetic consumer in `app/`.
It contains no customer code. The package has no functionality.

| Version | Fixed variant |
| --- | --- |
| 0.1.0 | vulnerable (synthetic advisory subject) |
| 0.1.1 | fixed (also the late-detection subject) |
| 0.1.2 | malicious (inert package-local marker only) |
| 0.2.0 | clean-fixed |
| 0.2.1 | clean-fixed |

Only `.github/workflows/drill-publish.yml` publishes versions. After independent
DEEP Claude review and merge, ops-delivery dispatches it on `main`, selecting one
explicit version. The `drill` environment must allow only `main`. Version input
is independently checked against the fixed mapping before the publish step.
Node 22 and npm 11.5.1 are used; the npm token is exposed only to that step.
Publishing skips lifecycle scripts and does not execute the marker.

The `tests` check validates all five packed variants and the consumer JSON and
lockfile shape without installing the consumer or executing install scripts.
To validate locally, run `node scripts/validate-fixtures.mjs` and
`npm pack ./packages/drill-canary --dry-run --ignore-scripts` in a credential-free
worker. No registry access is needed for these checks.

The consumer deliberately pins `0.1.0`. Its initial lockfile describes the
future registry tarball and omits integrity because the version is unpublished;
it is a static fixture, not evidence of a registry install. After publishing,
ops-delivery can regenerate registry metadata in a worker using
`cd app && npm install --package-lock-only --ignore-scripts` and deliver that
lockfile update through review before real-registry CLI verification.

Production advisory and hold writes, autopilot configuration, the 24-hour
publication gate, late-detection recovery and dependency-gate verification are
owned by ops-delivery. Use only reviewed operator paths; stop if no path exists
or an unexpected PR appears outside this repository. Counts, IDs and timestamps
belong only on kovo-sh/kovo-cloud#1933 (and #1133 for dependency-gate evidence).

Cleanup is the owner's step: deprecate all five versions with the message
`security drill fixture`, using the owner's npm session. This repository does
not expose the environment token to a cleanup job. Retract synthetic advisories
and holds through the reviewed operator paths. These operations have not been
run by adding this repository content.
