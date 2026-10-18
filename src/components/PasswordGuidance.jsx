import { CheckCircle2, Circle } from 'lucide-react'

export function PasswordStrength({ password }) {
  const level = !password
    ? 0
    : password.length < 6
      ? 1
      : password.length < 10
        ? 2
        : /\d/.test(password) && /[^a-z0-9]/i.test(password)
          ? 4
          : 3
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][level]
  return (
    <div className="password-guidance">
      <div
        className={`password-strength strength-${level}`}
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={level}
        aria-valuetext={label || 'Not entered'}
      >
        {[1, 2, 3, 4].map((part) => (
          <span className={part <= level ? 'filled' : ''} key={part} />
        ))}
      </div>
      <span className="password-strength-label">{label}</span>
    </div>
  )
}

export function PasswordRequirements({ password, confirmation }) {
  return (
    <div className="password-requirements">
      {[
        ['At least 6 characters', password.length >= 6],
        ['Passwords match', password.length > 0 && password === confirmation],
      ].map(([label, met]) => (
        <span key={label} className={met ? 'met' : ''}>
          {met ? (
            <CheckCircle2 aria-hidden="true" size={18} />
          ) : (
            <Circle aria-hidden="true" size={18} />
          )}
          <span className="visually-hidden">{met ? 'Met: ' : 'Not met: '}</span>
          {label}
        </span>
      ))}
    </div>
  )
}
