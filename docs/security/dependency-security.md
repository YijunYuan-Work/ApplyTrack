# Dependency Security

This guide describes repository policy, not a fresh vulnerability scan. Recheck
advisories when dependencies change; historical audit counts are not current
security guarantees.

## Current Dependency Surface

- [package.json](../../package.json) pins SheetJS Community Edition 0.20.3 from the
  official SheetJS CDN, rather than the obsolete npm registry release 0.18.5.
  The Excel importer accepts `.xlsx` / `.xls`, limits files to 5 MB and validates
  expected columns. Size limits do not eliminate parser vulnerabilities.
- Resume upload is not an active product feature. Dormant file-extraction helpers
  in the retained [resume utility](../../src/utils/resumeParser.js) reference
  `mammoth` and `pdfjs-dist`; there is no reachable resume-import form. Existing
  unit tests cover skill detection, not PDF/DOCX extraction. This does not justify
  ignoring installed dependency risk.
- The earlier review recorded GHSA-hp3w-g68c-fv3c through
  `mammoth -> argparse@1.0.10 -> sprintf-js@1.0.3`; this chain is still present
  in the lockfile. Reassess current advisories and compatible fixes rather than
  applying the historical suggested breaking Mammoth downgrade.
- The Edge Function's `npm:@supabase/supabase-js@2` import floats within a major
  version independently of the frontend lockfile. Backend releases need native
  dependency/type and runtime checks, not just an npm audit.

## Checks and Handling

```powershell
npm ci
npm audit --audit-level=high
```

The [dependency audit workflow](../../.github/workflows/dependency-audit.yml) runs
on dependency/workflow changes in PRs and `main`, and on manual invocation.
High/critical findings fail the check; moderate findings remain visible but do not
fail that threshold. It is not a scheduled scan or a complete supply-chain audit.

Monitor SheetJS advisories separately: a CDN tarball is not covered like an npm
registry package. Do not use `npm audit fix --force` or downgrade a parser blindly.
Review reachability and compatibility, test affected formats, commit the lockfile,
and obtain separate approval for any production release. Never attach real
resumes, spreadsheets, job-search records or secrets to security evidence.
