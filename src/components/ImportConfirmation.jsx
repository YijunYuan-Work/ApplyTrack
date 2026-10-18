import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FileSpreadsheet, Info } from 'lucide-react'

export default function ImportConfirmation({ count, duplicateCount, onCancel, onConfirm }) {
  const noun = count === 1 ? 'application' : 'applications'
  const dialog = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    element.querySelector('button').focus()
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(
    <dialog
      ref={dialog}
      className="import-confirmation"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        const rect = dialog.current.getBoundingClientRect()
        if (
          event.target === dialog.current &&
          (event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom)
        )
          onCancel()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = [...dialog.current.querySelectorAll('button')]
        const first = controls[0],
          last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
    >
      <div className="import-confirm-heading">
        <span className="import-icon">
          <FileSpreadsheet aria-hidden="true" size={22} />
        </span>
        <div>
          <h2 id={titleId}>
            Import {count} selected {noun}?
          </h2>
          <p id={descriptionId}>They'll be added to your application list.</p>
        </div>
      </div>
      {duplicateCount > 0 && (
        <p className="import-duplicate-notice">
          <Info aria-hidden="true" size={18} />
          Includes {duplicateCount} possible {duplicateCount === 1 ? 'duplicate' : 'duplicates'}.
          {duplicateCount === 1
            ? ' It will be added as a separate application.'
            : ' They will be added as separate applications.'}
        </p>
      )}
      <div className="import-confirm-actions">
        <button type="button" className="ui-button ui-button-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="ui-button ui-button-add" onClick={onConfirm}>
          Import {count} {noun}
        </button>
      </div>
    </dialog>,
    document.body,
  )
}
