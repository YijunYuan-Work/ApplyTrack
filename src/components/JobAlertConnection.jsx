import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Mail,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react'
import { formatJobAgentDate } from '../data/jobAgent'
import JobAlertAddress from './JobAlertAddress'

function providerStatus(messages, provider) {
  const latest = messages.find((message) => message.provider === provider)

  if (!latest) {
    return { detail: 'No alert received yet', state: 'waiting' }
  }

  if (latest.status === 'failed' || latest.status === 'partial') {
    return { detail: latest.errorSummary || 'Needs attention', state: 'attention' }
  }

  return {
    detail: `Last received ${formatJobAgentDate(latest.receivedAt)}`,
    state: 'connected',
  }
}

function JobAlertConnection({ inbox, isManaging, messages, onCreate, onRotate, onToggle }) {
  const inboundDomain = String(import.meta.env.VITE_JOB_ALERT_INBOUND_DOMAIN || '')
    .trim()
    .replace(/^@/, '')
  const address =
    inbox?.address || (inbox && inboundDomain ? `${inbox.addressAlias}@${inboundDomain}` : '')
  const linkedInStatus = providerStatus(messages, 'linkedin')
  const indeedStatus = providerStatus(messages, 'indeed')

  return (
    <section className="agent-panel agent-alert-panel">
      <div className="agent-panel-heading">
        <div>
          <p className="eyebrow">Job alerts</p>
          <h2>Connect LinkedIn and Indeed</h2>
          <p>
            Forward job alert emails to a private ApplyTrack address. No account passwords are
            shared.
          </p>
        </div>
        {!inbox && (
          <button
            className="ui-button ui-button-primary"
            disabled={isManaging || !inboundDomain}
            type="button"
            onClick={onCreate}
          >
            <Mail aria-hidden="true" size={18} />
            {isManaging ? 'Creating...' : 'Create forwarding address'}
          </button>
        )}
      </div>

      {!address && !inboundDomain ? (
        <p className="form-error" role="alert">
          Job alert forwarding is not configured. Please try again later.
        </p>
      ) : inbox ? (
        <>
          <JobAlertAddress inbox={inbox} />
          <p className={`agent-inbox-state ${inbox.enabled ? 'enabled' : 'paused'}`} role="status">
            {inbox.enabled ? 'Imports active' : 'Imports paused'}
          </p>

          <div className="agent-provider-grid">
            {[
              ['LinkedIn', linkedInStatus],
              ['Indeed', indeedStatus],
            ].map(([label, status]) => (
              <div className={`agent-provider-status ${status.state}`} key={label}>
                {status.state === 'connected' ? (
                  <CheckCircle2 aria-hidden="true" size={20} />
                ) : status.state === 'attention' ? (
                  <AlertCircle aria-hidden="true" size={20} />
                ) : (
                  <Clock aria-hidden="true" size={20} />
                )}
                <div>
                  <strong>{label}</strong>
                  <span>
                    {status.state === 'connected'
                      ? 'Connected'
                      : status.state === 'attention'
                        ? 'Needs attention'
                        : 'Waiting for an alert'}
                  </span>
                  <small>{status.detail}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="agent-alert-controls">
            <button
              className="ui-button ui-button-ghost"
              disabled={isManaging}
              type="button"
              onClick={() => onToggle(!inbox.enabled)}
            >
              {inbox.enabled ? (
                <Pause aria-hidden="true" size={17} />
              ) : (
                <Play aria-hidden="true" size={17} />
              )}
              {inbox.enabled ? 'Pause imports' : 'Resume imports'}
            </button>
            <button
              className="ui-button ui-button-ghost"
              disabled={isManaging}
              type="button"
              onClick={onRotate}
            >
              <RotateCcw aria-hidden="true" size={17} />
              Replace address
            </button>
          </div>
          {isManaging && (
            <p className="agent-connection-pending" role="status">
              Updating connection...
            </p>
          )}

          <details className="agent-alert-instructions">
            <summary>
              How to forward your job alerts <ChevronDown aria-hidden="true" size={18} />
            </summary>
            <ol>
              <li>Create or edit a job alert on LinkedIn or Indeed.</li>
              <li>In your email provider, forward those alert emails to the address above.</li>
              <li>Send one test alert. Its jobs will appear under Matches after processing.</li>
            </ol>
            <p>Replacing the address immediately disables forwarding to the old one.</p>
          </details>
        </>
      ) : (
        <div className="agent-empty-inline">
          <Mail aria-hidden="true" size={24} />
          <span>Create an address, then use it only for LinkedIn and Indeed job alerts.</span>
        </div>
      )}
    </section>
  )
}

export default JobAlertConnection
