import { Check, Clipboard, Mail } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

function AddressField({ address }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const lifecycle = useRef({ active: true, busy: false, timer: null })
  useEffect(() => {
    const current = lifecycle.current
    current.active = true
    return () => {
      current.active = false
      clearTimeout(current.timer)
    }
  }, [])

  async function copyAddress() {
    const current = lifecycle.current
    if (!address || current.busy) return
    current.busy = true
    setError('')
    setCopied(false)
    clearTimeout(current.timer)
    try {
      await navigator.clipboard.writeText(address)
      if (!current.active) return
      setCopied(true)
      clearTimeout(current.timer)
      current.timer = setTimeout(() => setCopied(false), 1800)
    } catch {
      if (current.active) setError('Could not copy the address. Select it and copy it manually.')
    } finally {
      current.busy = false
    }
  }

  return (
    <div className="agent-address-field">
      <div className="agent-forwarding-address">
        <span className="agent-mail-icon">
          <Mail aria-hidden="true" size={20} />
        </span>
        <div>
          <span>Forwarding address</span>
          <strong title={address || undefined}>{address || 'No forwarding address yet'}</strong>
        </div>
        {address && (
          <button className="ui-button ui-button-ghost" type="button" onClick={copyAddress}>
            {copied ? (
              <Check aria-hidden="true" size={16} />
            ) : (
              <Clipboard aria-hidden="true" size={16} />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      {copied && (
        <span className="visually-hidden" role="status">
          Forwarding address copied.
        </span>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default function JobAlertAddress({ inbox }) {
  const domain = String(import.meta.env.VITE_JOB_ALERT_INBOUND_DOMAIN || '')
    .trim()
    .replace(/^@/, '')
  const address = inbox?.address || (inbox && domain ? `${inbox.addressAlias}@${domain}` : '')
  return <AddressField key={address} address={address} />
}
