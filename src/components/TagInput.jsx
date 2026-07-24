import { Plus, X } from 'lucide-react'
import { useState } from 'react'

function TagInput({ ariaLabel, onChange, placeholder, values }) {
  const [draft, setDraft] = useState('')

  function addValue(rawValue) {
    const value = rawValue.trim()

    if (!value) {
      return
    }

    const alreadyExists = values.some(
      (item) => item.toLocaleLowerCase() === value.toLocaleLowerCase(),
    )

    if (!alreadyExists) {
      onChange([...values, value])
    }

    setDraft('')
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addValue(draft)
    }

    if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="tag-input" aria-label={ariaLabel} role="group">
      <div className="tag-input-values">
        {values.map((value) => (
          <span className="tag-chip" key={value}>
            {value}
            <button
              aria-label={`Remove ${value}`}
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-input-entry">
        <input
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={draft}
          onBlur={() => addValue(draft)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          aria-label={`Add ${ariaLabel.toLowerCase()}`}
          disabled={!draft.trim()}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => addValue(draft)}
        >
          <Plus aria-hidden="true" size={17} />
        </button>
      </div>
    </div>
  )
}

export default TagInput
