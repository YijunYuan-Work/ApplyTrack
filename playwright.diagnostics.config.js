import base from './playwright.functional.config.js'

// Opt-in measurements, never part of the mandatory functional/CI test directory.
export default {
  ...base,
  testDir: './tests/diagnostics',
  outputDir: './test-results/diagnostics',
  reporter: 'list',
  projects: base.projects.filter((project) => project.name === 'chromium'),
}
