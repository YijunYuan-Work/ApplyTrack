import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import JobAlertConnection from './JobAlertConnection'

function JobAgentSetup({
  inbox,
  isManagingAlerts,
  messages = [],
  onCreateInbox,
  onRotateInbox,
  onToggleInbox,
}) {
  const readiness = useMemo(
    () => [
      {
        complete: Boolean(inbox?.enabled),
        label: 'Private forwarding address active',
      },
      {
        complete: messages.some((message) => message.provider === 'linkedin'),
        label: 'LinkedIn alert received',
      },
      {
        complete: messages.some((message) => message.provider === 'indeed'),
        label: 'Indeed alert received',
      },
    ],
    [inbox?.enabled, messages],
  )

  return (
    <div className="agent-setup-layout">
      <aside className="agent-readiness" aria-label="Job alert connection status">
        <div>
          <p className="eyebrow">Connection</p>
          <h2>Job alert readiness</h2>
        </div>
        <ul>
          {readiness.map((item) => (
            <li className={item.complete ? 'complete' : ''} key={item.label}>
              <CheckCircle2 aria-hidden="true" size={18} />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <p className="agent-privacy-note">
          <ShieldCheck aria-hidden="true" size={18} />
          ApplyTrack only receives the alert emails you forward. It never connects to or stores your LinkedIn or Indeed credentials.
        </p>
      </aside>

      <div className="agent-setup-main">
        <JobAlertConnection
          inbox={inbox}
          isManaging={isManagingAlerts}
          messages={messages}
          onCreate={onCreateInbox}
          onRotate={onRotateInbox}
          onToggle={onToggleInbox}
        />
      </div>
    </div>
  )
}

export default JobAgentSetup
