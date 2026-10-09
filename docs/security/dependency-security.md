# Dependency security baseline

Last reviewed: 2026-10-09.

## Baseline and remediation

The repository initially reported 12 npm audit vulnerabilities: 8 high and
4 moderate. After updating compatible dependency resolutions in
`package-lock.json`, the audit reports **0 high**, **0 critical**, and
**3 moderate** advisory entries. These are audit *entries*, not three separate
confirmed exploitable application paths.

The locked upgrades include patched releases of `pdfjs-dist`, `vite`,
`@xmldom/xmldom`, `browserslist`, `postcss` and other transitive packages.

## Remaining advisory chain

The remaining moderate reports describe one inherited dependency chain:

`mammoth` -> `argparse@1.0.10` -> `sprintf-js@1.0.3`

The reported issue concerns unbounded precision specifiers in `sprintf-js`
(GHSA-hp3w-g68c-fv3c). The npm audit suggested resolution is to downgrade
`mammoth` to `0.3.29`, a major and potentially functionality-breaking change,
so it was intentionally **not** applied.

The current browser-based resume importer limits input files to 5 MB, but
file-size restrictions alone do not remove the inherited library advisory.
The project should evaluate a supported dependency-tree upgrade, an upstream
fix, or a safer replacement for DOCX text extraction, with automated tests
covering PDF, DOCX, and TXT parsing before changing this component.

## Enforcement

`.github/workflows/dependency-audit.yml` runs `npm audit --audit-level=high`
for dependency changes on pull requests, matching changes on `main`, and
manual runs. High/critical advisories fail that check. Moderate advisories
are reported but do **not** currently fail CI; this is a conscious and
temporary policy, not a claim that moderate findings are harmless.

Revisit the remaining chain during the resume-ingestion hardening work.
