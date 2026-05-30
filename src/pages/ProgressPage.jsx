import { useMemo } from 'react'
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts'
import AppLayout from '../components/AppLayout'

const flowColors = {
  applications: '#64748b',
  interviewed: '#31766b',
  offer: '#5f965e',
  pending: '#7b8fa1',
  rejected: '#bd5d67',
  rejectedBeforeInterview: '#d97745',
}

function ProgressNode({ height, payload, width, x, y }) {
  const labelAbove = payload.name === 'Reached interview'
  const labelOnLeft = !labelAbove && x < 150
  const labelX = labelAbove ? x + width / 2 : labelOnLeft ? x - 14 : x + width + 14
  const textAnchor = labelAbove ? 'middle' : labelOnLeft ? 'end' : 'start'
  const labelY = y + height / 2

  return (
    <g>
      <rect
        fill={payload.color}
        height={Math.max(height, 8)}
        rx="3"
        width={width}
        x={x}
        y={y}
      />
      <text
        className="progress-node-count"
        textAnchor={textAnchor}
        x={labelX}
        y={labelAbove ? y - 26 : labelY - 4}
      >
        {payload.count}
      </text>
      <text
        className="progress-node-name"
        textAnchor={textAnchor}
        x={labelX}
        y={labelAbove ? y - 7 : labelY + 18}
      >
        {payload.name}
      </text>
    </g>
  )
}

function buildProgressData(applications) {
  const nodes = [
    {
      name: 'Applications',
      count: applications.length,
      color: flowColors.applications,
    },
  ]
  const links = []

  function addBranch(source, name, count, color) {
    if (count === 0) {
      return null
    }

    const target = nodes.length
    nodes.push({ name, count, color })
    links.push({ source, target, value: count })
    return target
  }

  const hasInterview = (application) =>
    Number(application.interviewCount || 0) > 0 ||
    application.status === 'Interview' ||
    application.status === 'Offer'

  const interviewedApplications = applications.filter(hasInterview)
  const rejectedBeforeInterview = applications.filter(
    (application) => application.status === 'Rejected' && !hasInterview(application),
  ).length
  const awaitingInterview =
    applications.length - interviewedApplications.length - rejectedBeforeInterview
  const offers = interviewedApplications.filter(
    (application) => application.status === 'Offer',
  ).length
  const rejectedAfterInterview = interviewedApplications.filter(
    (application) => application.status === 'Rejected',
  ).length
  const activeAfterInterview =
    interviewedApplications.length - offers - rejectedAfterInterview

  const interviewedNode = addBranch(
    0,
    'Reached interview',
    interviewedApplications.length,
    flowColors.interviewed,
  )

  if (interviewedNode !== null) {
    addBranch(interviewedNode, 'Offers', offers, flowColors.offer)
    addBranch(
      interviewedNode,
      'Rejected after interview',
      rejectedAfterInterview,
      flowColors.rejected,
    )
    addBranch(
      interviewedNode,
      'Still in progress',
      activeAfterInterview,
      flowColors.pending,
    )
  }

  addBranch(0, 'No interview yet', awaitingInterview, flowColors.pending)
  addBranch(
    0,
    'Rejected before interview',
    rejectedBeforeInterview,
    flowColors.rejectedBeforeInterview,
  )

  return {
    data: { nodes, links },
    summary: {
      applications: applications.length,
      interviewEvents: applications.reduce(
        (total, application) => total + Number(application.interviewCount || 0),
        0,
      ),
      interviewedApplications: interviewedApplications.length,
      offers,
    },
  }
}

function ProgressPage({
  applications,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onProfile,
  onProgress,
  onSignOut,
  user,
}) {
  const { data, summary } = useMemo(
    () => buildProgressData(applications),
    [applications],
  )

  return (
    <AppLayout
      currentPage="progress"
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onProfile={onProfile}
      onProgress={onProgress}
      onSignOut={onSignOut}
      user={user}
    >
      <header className="app-header compact">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>Your application flow.</h1>
          <p>See how your job search is moving from application to outcome.</p>
        </div>
      </header>

      <section className="progress-section" aria-label="Application progress">
        <div className="progress-summary">
          <article>
            <span>Applications</span>
            <strong>{summary.applications}</strong>
          </article>
          <article>
            <span>Interviews held</span>
            <strong>{summary.interviewEvents}</strong>
          </article>
          <article>
            <span>Reached interview</span>
            <strong>{summary.interviewedApplications}</strong>
          </article>
          <article>
            <span>Offers</span>
            <strong>{summary.offers}</strong>
          </article>
        </div>

        <div className="progress-chart-panel">
          <div className="progress-chart-heading">
            <p className="eyebrow">Pipeline map</p>
            <h2>Applications by outcome</h2>
          </div>

          {applications.length === 0 ? (
            <div className="empty-state">
              <h3>No applications to chart yet.</h3>
              <p>Add an application and your progress map will appear here.</p>
            </div>
          ) : (
            <div className="progress-chart-scroll">
              <div className="progress-chart">
                <ResponsiveContainer height="100%" width="100%">
                  <Sankey
                    data={data}
                    link={{ stroke: '#94a3b8', strokeOpacity: 0.42 }}
                    linkCurvature={0.55}
                    margin={{ bottom: 48, left: 188, right: 188, top: 48 }}
                    node={<ProgressNode />}
                    nodePadding={42}
                    nodeWidth={14}
                    verticalAlign="top"
                  >
                    <Tooltip formatter={(value) => [`${value} applications`, 'Flow']} />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </section>
    </AppLayout>
  )
}

export default ProgressPage
