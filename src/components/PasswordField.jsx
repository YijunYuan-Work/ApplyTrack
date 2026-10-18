import { Eye, EyeOff } from 'lucide-react'
import { useId } from 'react'

export default function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  visibilityLabel = 'password',
  disabled,
  minLength = 6,
  placeholder = 'At least 6 characters',
  autoComplete = 'new-password',
}) {
  const inputId = useId()
  const toggleLabel = `${visible ? 'Hide' : 'Show'} ${visibilityLabel}`
  return (
    <div className="account-field">
      <label htmlFor={inputId}>{label}</label>
      <span className="password-input-wrap">
        <input
          id={inputId}
          autoComplete={autoComplete}
          minLength={minLength}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          disabled={disabled}
        />
        <button
          aria-label={toggleLabel}
          title={toggleLabel}
          className="password-visibility-button"
          type="button"
          disabled={disabled}
          onClick={onToggle}
        >
          {visible ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
        </button>
      </span>
    </div>
  )
}
