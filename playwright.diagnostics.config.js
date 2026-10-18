import base from './playwright.audit.config.js'

// Opt-in measurements, never part of the mandatory functional/CI test directory.
export default {
  ...base,
  testDir: './tests/diagnostics',
  projects: base.projects.filter((project) => project.name === 'chromium'),
}
