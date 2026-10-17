import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Trash2, X } from 'lucide-react'
import ApplicationStatusControl from './ApplicationStatusControl'

function ApplicationDetailDrawer({
  application,
  isReadOnly,
  isDeleting,
  deleteError,
  mutation,
  onClose,
  onDelete,
  onEdit,
  onStatusChange,
}) {
  const dialog = useRef(null)
  const closing = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.getAnimations().forEach((animation) => animation.cancel())
      element.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
      else document.querySelector('.view-toggle button.active')?.focus({ preventScroll: true })
    }
  }, [])

  function close() {
    if (closing.current) return
    closing.current = true
    const element = dialog.current
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    const mobile = window.matchMedia('(width < 640px)').matches
    const motion = getComputedStyle(element)
    const animation = element.animate(
      [
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: mobile ? 'translateY(100%)' : 'translateX(100%)', opacity: 0 },
      ],
      {
        duration: parseFloat(motion.getPropertyValue('--motion-nav')),
        easing: motion.getPropertyValue('--ease-ui').trim(),
        fill: 'forwards',
      },
    )
    animation.finished.then(onClose, () => {})
  }

  function handleKeyDown(event) {
    if (event.key !== 'Tab') return
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), a[href]')]
    const first = controls[0],
      last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const fields = [
    ['location', 'Location', application.location],
    ['applied', 'Applied', application.date],
    ['follow-up', 'Follow-up', application.followUp],
    ['interviews', 'Interviews', application.interviewCount],
    ['contact', 'Contact', application.contact],
    ['salary', 'Salary', application.salary],
    ['cover-letter', 'Cover letter', application.coverLetter],
    ['referral', 'Referral', application.referral],
    ['updated', 'Last updated', application.lastUpdated],
    ['rejected', 'Last rejection recorded', application.rejectedDate],
  ]
  return createPortal(
    <dialog
      className="application-drawer"
      ref={dialog}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          const box = dialog.current.getBoundingClientRect()
          if (
            event.clientX < box.left ||
            event.clientY < box.top ||
            event.clientX > box.right ||
            event.clientY > box.bottom
          )
            close()
        }
      }}
    >
      <header className="application-drawer-header">
        <div>
          <p className="company">{application.company}</p>
          <h2 id={titleId}>{application.role}</h2>
        </div>
        <button
          className="ui-button ui-button-ghost ui-icon-button"
          type="button"
          aria-label="Close application details"
          title="Close application details"
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      <div className="application-drawer-body">
        {deleteError && (
          <p className="form-error" role="alert">
            {deleteError}
          </p>
        )}
        {isDeleting && <p role="status">Deleting applications...</p>}
        <section aria-label="Application status">
          <p className="ui-eyebrow">Status</p>
          <ApplicationStatusControl
            application={application}
            mutation={mutation}
            onStatusChange={onStatusChange}
            buttons
            readOnly={isReadOnly}
          />
        </section>
        <dl className="application-record-details">
          {fields.map(([key, label, value]) => (
            <div className={`detail-${key}`} key={key}>
              <dt>{label}</dt>
              <dd>{value === 0 ? 0 : value || 'Not set'}</dd>
            </div>
          ))}
        </dl>
        <section className="notes-block" aria-label="Application notes">
          <h3 className="ui-eyebrow">Notes</h3>
          <p>{application.notes || 'No notes yet.'}</p>
        </section>
      </div>
      <footer className="application-drawer-actions">
        {!isReadOnly && (
          <button
            className="ui-button ui-button-primary"
            type="button"
            onClick={() => onEdit(application.id)}
          >
            Edit application
          </button>
        )}
        {application.jobUrl && (
          <a
            className="ui-button ui-button-ghost"
            href={application.jobUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} aria-hidden="true" />
            Open job
          </a>
        )}
        {!isReadOnly && (
          <button
            className="ui-button ui-button-remove ui-icon-button"
            type="button"
            aria-label="Delete application"
            title="Delete application"
            disabled={isDeleting}
            aria-busy={isDeleting}
            onClick={() => onDelete(application.id)}
          >
            <Trash2 size={17} />
          </button>
        )}
      </footer>
    </dialog>,
    document.body,
  )
}

export default ApplicationDetailDrawer
