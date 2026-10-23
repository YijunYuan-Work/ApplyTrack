import base from './playwright.audit.config.js'

export default {
  ...base,
  grep: /@smoke/,
  workers: 1,
  outputDir: './test-results/smoke',
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report/smoke', open: 'never' }],
  ],
  projects: base.projects.filter(({ name }) => ['firefox', 'webkit'].includes(name)),
}
