# Changelog

## [1.0.1] - 2026-11-05

### Security
- Cleared 7 moderate advisories in the dependency tree. Previously the `overrides` block pinned exact versions of `qs`, `ip-address` and `fast-uri` that later received advisories (GHSA-6pq8-jhm2-2vcw, GHSA-rxp7-6hxx-x8q5, GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp). Now the overrides are minimum-version ranges (`qs ^6.17.1`, `ip-address ^10.7.6`, `fast-uri ^3.1.9`, `hono ^4.13.16`), so future patch releases are picked up instead of frozen out.
- `@modelcontextprotocol/sdk` raised from `^1.32.1` to `^1.32.2`.

No tool behaviour changed. `npm audit` reports 0 vulnerabilities.

## [1.0.0]

- First public release.
