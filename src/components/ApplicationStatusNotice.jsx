import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

function ApplicationStatusNotice({ applications }) {
  const [previous, setPrevious] = useState(applications)
  const [notice, setNotice] = useState(null)
  if (previous !== applications) {
    const before = new Map(previous.map((application) => [application.id, application.status]))
    const changed = applications.find(
      (application) =>
        before.has(application.id) && before.get(application.id) !== application.status,
    )
    setPrevious(applications)
    // Applications contains confirmed/reconciled records, never the pending select value.
    if (changed) setNotice({ text: `${changed.company} moved to ${changed.status}` })
  }
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 2600)
    return () => clearTimeout(timer)
  }, [notice])
  return notice ? (
    <div className="application-notification" role="status" aria-live="polite">
      <span key={notice.text}>
        <Check size={17} aria-hidden="true" />
        {notice.text}
      </span>
    </div>
  ) : null
}

export default ApplicationStatusNotice
