import { useState } from 'react'
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { PasswordRequirements, PasswordStrength } from '../components/PasswordGuidance'

function ResetPasswordPage({ onContinue, onUpdatePassword }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSaving(true)

    try {
      await onUpdatePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Your password has been updated.')
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AuthLayout>
      <div className="account-security-heading">
        <span className="account-shield">
          <ShieldCheck aria-hidden="true" size={20} />
        </span>
        <div>
          <p className="eyebrow">ApplyTrack</p>
          <h1>Choose a new password.</h1>
          <p>Set a fresh password for your workspace.</p>
        </div>
      </div>

      {success ? (
        <div className="auth-form">
          <p className="form-success" role="status">
            {success}
          </p>
          <button className="ui-button ui-button-add" type="button" onClick={onContinue}>
            Continue to dashboard
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={isSaving}
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            visibilityLabel="new password"
          />
          <PasswordStrength password={newPassword} />
          <PasswordField
            label="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isSaving}
            visible={showConfirmation}
            onToggle={() => setShowConfirmation((v) => !v)}
            visibilityLabel="confirmed password"
            placeholder="Repeat your new password"
          />
          <PasswordRequirements password={newPassword} confirmation={confirmPassword} />

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="ui-button ui-button-add"
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
          >
            {isSaving && <LoaderCircle className="account-spinner" aria-hidden="true" size={18} />}
            {isSaving ? 'Saving...' : 'Update password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

export default ResetPasswordPage
