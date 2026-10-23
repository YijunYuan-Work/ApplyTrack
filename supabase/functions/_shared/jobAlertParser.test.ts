import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import { detectAlertProvider, parseJobAlert, type EmailAnchor } from './jobAlertParser.ts'
import { salaryCases, rejectedSalaryCases } from '../../../tests/fixtures/salaryCases.js'
import { getJobLeadPresentation } from '../../../src/data/jobAgent.js'

function anchorsFromHtml(html: string): EmailAnchor[] {
  const { document } = parseHTML(html)

  return [...document.querySelectorAll('a[href]')].map((anchor) => {
    let container = anchor.parentElement

    while (container?.parentElement && container.textContent.trim().length < 30) {
      container = container.parentElement
    }

    return {
      href: anchor.getAttribute('href') || '',
      segments: [...(container || anchor).querySelectorAll('h1,h2,h3,h4,p,span,td')]
        .map((node) => node.textContent)
        .filter(Boolean),
      text: anchor.textContent,
    }
  })
}

test('parses and deduplicates LinkedIn job alert links', () => {
  const anchors = anchorsFromHtml(`
    <article>
      <a href="https://www.linkedin.com/jobs/view/frontend-developer-4123456789">Frontend Developer</a>
      <p>Acme Labs</p><p>Toronto, Ontario</p><p>Full-time</p>
    </article>
    <a href="https://www.linkedin.com/jobs/view/frontend-developer-4123456789">Frontend Developer</a>
    <a href="https://www.linkedin.com/help/linkedin">Manage alerts</a>
  `)
  const result = parseJobAlert({ anchors, from: 'jobs-noreply@linkedin.com' })

  assert.equal(result.provider, 'linkedin')
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].externalId, '4123456789')
  assert.equal(result.jobs[0].company, 'Acme Labs')
  assert.equal(result.jobs[0].location, 'Toronto, Ontario')
})

test('parses Indeed tracking links and ignores unrelated links', () => {
  const anchors = anchorsFromHtml(`
    <section>
      <a href="https://ca.indeed.com/rc/clk?jk=abc123&amp;from=jobalert">Software Engineer</a>
      <p>Northwind</p><p>Remote · Canada</p><p>Contract</p>
    </section>
    <a href="https://example.com/preferences">Manage preferences</a>
    <footer>
      <a href="https://ca.indeed.com/legal">Privacy Policy</a>
      <a href="https://ca.indeed.com/legal#tos">Terms</a>
      <a href="https://support.indeed.com/hc/en-ca">Help Centre</a>
      <a href="https://subscriptions.indeed.com/job-alerts">Manage job alerts</a>
      <a href="https://ca.indeed.com/account/login">Sign in</a>
    </footer>
  `)
  const result = parseJobAlert({ anchors, subject: 'Indeed Job Alert' })

  assert.equal(result.provider, 'indeed')
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].externalId, 'abc123')
  assert.equal(result.jobs[0].contractType, 'contract')
})

test('extracts annual salary from an Indeed preview', () => {
  const anchors = anchorsFromHtml(`
    <section>
      <a href="https://ca.indeed.com/rc/clk?jk=salary123&amp;from=jobalert">
        Power Platform Solutions Consultant
      </a>
      <p>Osserva</p>
      <p>Remote</p>
      <p>$90,000 - $120,000 a year · Easily apply · Build business applications.</p>
    </section>
  `)
  const result = parseJobAlert({ anchors, subject: 'Indeed Job Alert' })

  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].salaryMin, 90000)
  assert.equal(result.jobs[0].salaryMax, 120000)
})

test('rejects Indeed footer links even when nearby text resembles job metadata', () => {
  const anchors = anchorsFromHtml(`
    <footer>
      <div>
        <a href="https://ca.indeed.com/legal">Privacy Policy</a>
        <span>Terms</span><span>Canada</span>
      </div>
      <div>
        <a href="https://ca.indeed.com/legal#tos">Privacy Policy | Terms</a>
        <span>Indeed</span><span>Help Centre</span>
      </div>
    </footer>
  `)
  const result = parseJobAlert({ anchors, subject: 'Indeed Job Alert' })

  assert.equal(result.provider, 'indeed')
  assert.deepEqual(result.jobs, [])
})

test('reports unknown for unrelated mail', () => {
  assert.equal(
    detectAlertProvider({
      anchors: [{ href: 'https://example.com', segments: [], text: 'Read more' }],
      from: 'newsletter@example.com',
    }),
    'unknown',
  )
})

for (const [text, minimum, maximum, period] of salaryCases) {
  test(`Job alert parser: email annual fields and presentation agree for ${text}`, () => {
    for (const source of ['linkedin', 'indeed']) {
      const href = source === 'linkedin' ? 'https://www.linkedin.com/jobs/view/123' : 'https://ca.indeed.com/viewjob?jk=salary123'
      const result = parseJobAlert({ anchors: [{ href, text: 'Engineer', segments: ['Synthetic Company', 'Toronto', text] }] })
      assert.equal(result.jobs.length, 1)
      const job = result.jobs[0]
      assert.equal(job.salaryMin, period === 'year' ? minimum : null)
      assert.equal(job.salaryMax, period === 'year' ? maximum : null)
      assert.equal(getJobLeadPresentation(job).salaryLabel, text)
      assert.equal(getJobLeadPresentation({ description: text }).salaryLabel, text)
    }
  })
}

for (const text of rejectedSalaryCases) {
  test(`Job alert parser: email rejects incomplete/ambiguous salary ${text}`, () => {
    const { jobs } = parseJobAlert({ anchors: [{ href: 'https://ca.indeed.com/viewjob?jk=salary123', text: 'Engineer', segments: ['Synthetic Company', 'Toronto', text] }] })
    assert.equal(jobs[0].salaryMin, null)
    assert.equal(jobs[0].salaryMax, null)
    assert.equal(jobs[0].description, text)
    assert.equal(getJobLeadPresentation(jobs[0]).salaryLabel, null)
  })
}

test('Job alert parser: LinkedIn and Indeed HTML alerts preserve explicit currency and hourly units', () => {
  for (const [href, salary, minimum] of [
    ['https://www.linkedin.com/jobs/view/123', 'USD $90k - $120k a year', 90000],
    ['https://ca.indeed.com/viewjob?jk=salary123', '$40 per hour', null],
  ] as const) {
    const { jobs } = parseJobAlert({ anchors: anchorsFromHtml(`<article><a href="${href}">Engineer</a><p>Synthetic Company</p><p>Toronto</p><p>${salary} · Easily apply</p></article>`) })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].salaryMin, minimum)
    assert.equal(getJobLeadPresentation(jobs[0]).salaryLabel, salary)
    assert.deepEqual(getJobLeadPresentation(jobs[0]).highlights, ['Easy Apply'])
  }
})
