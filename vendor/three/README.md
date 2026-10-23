Three.js 0.165.0 (MIT) and the five locally used modules are vendored unchanged
from the official npm package. `LICENSE` contains the upstream license and
`manifest.json` records the source URL and each shipped file's SHA-256.

The preview loads these same-origin files in production as well as during
browser review. It does not require a CDN connection or a change to certificate
trust. Update the version and manifest together when upgrading Three.js.
