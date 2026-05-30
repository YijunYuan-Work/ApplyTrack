import { useState } from 'react'

function ResetPasswordPage({ onContinue, onUpdatePassword }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState('')

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
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">ApplyTrack</p>
          <h1>Choose a new password.</h1>
          <p>Set a fresh password for your workspace.</p>
        </div>

        {success ? (
          <div className="auth-form">
            <p className="form-success">{success}</p>
            <button type="button" onClick={onContinue}>
              Continue to dashboard
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              New password
              <input
                minLength="6"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </label>

            <label>
              Confirm password
              <input
                minLength="6"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
                required
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Update password'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

export default ResetPasswordPage
