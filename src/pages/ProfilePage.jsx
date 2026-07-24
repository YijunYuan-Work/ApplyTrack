import { useState } from 'react'
import { Eye, EyeOff, LogOut } from 'lucide-react'
import AppLayout from '../components/AppLayout'

function getProfileEmail(user) {
  const savedProfileEmail = user.user_metadata?.profileEmail

  if (savedProfileEmail) {
    return savedProfileEmail
  }

  const legacyEmail = user.user_metadata?.email || user.email || ''
  const projectHost = new URL(import.meta.env.VITE_SUPABASE_URL).hostname

  return legacyEmail.endsWith(`@${projectHost}`) ? '' : legacyEmail
}

function ProfilePage({
  onAddApplication,
  onDashboard,
  onImportExcel,
  onJobAgent,
  onProfile,
  onProgress,
  onSignOut,
  onUpdatePassword,
  onUpdateProfileEmail,
  user,
}) {
  const username = user.user_metadata?.username || user.name
  const savedEmail = getProfileEmail(user)
  const [email, setEmail] = useState(savedEmail)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const hasEmailChanges = email.trim() !== savedEmail.trim()

  async function handleEmailSubmit(event) {
    event.preventDefault()
    setEmailError('')
    setEmailSuccess('')
    setIsSavingEmail(true)

    try {
      await onUpdateProfileEmail(email)
      setEmailSuccess(
        email.trim()
          ? 'Recovery email updated successfully.'
          : 'Recovery email removed.',
      )
    } catch (error) {
      setEmailError(error.message)
    } finally {
      setIsSavingEmail(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setIsSavingPassword(true)

    try {
      await onUpdatePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Password updated successfully.')
    } catch (error) {
      setPasswordError(error.message)
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <AppLayout
      currentPage="profile"
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onJobAgent={onJobAgent}
      onProfile={onProfile}
      onProgress={onProgress}
      onSignOut={onSignOut}
      user={user}
    >
      <header className="app-header compact">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>{username}</h1>
          <p>Manage your workspace identity and account security.</p>
        </div>
      </header>

      <section className="profile-section">
        <div className="profile-settings-grid">
          <form className="profile-form" onSubmit={handleEmailSubmit}>
            <div>
              <p className="eyebrow">Recovery</p>
              <h2>Recovery email</h2>
              <p>Optional email used only when you need to reset your password.</p>
            </div>

            <label>
              Recovery email
              <input
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setEmailError('')
                  setEmailSuccess('')
                }}
                placeholder="jane@example.com"
              />
            </label>

            <button
              type="submit"
              disabled={isSavingEmail || !hasEmailChanges}
            >
              {isSavingEmail ? 'Saving...' : 'Save recovery email'}
            </button>

            {emailSuccess && (
              <p className="form-success" role="status">
                {emailSuccess}
              </p>
            )}
            {emailError && (
              <p className="form-error" role="alert">
                {emailError}
              </p>
            )}
          </form>

          <form className="profile-form" onSubmit={handlePasswordSubmit}>
            <div>
              <p className="eyebrow">Security</p>
              <h2>Password</h2>
              <p>Choose a new password for your account.</p>
            </div>

            <div className="profile-field">
              <label htmlFor="new-password">New password</label>
              <span className="password-input-wrap">
                <input
                  autoComplete="new-password"
                  id="new-password"
                  minLength="6"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value)
                    setPasswordError('')
                    setPasswordSuccess('')
                  }}
                  placeholder="At least 6 characters"
                  required
                />
                <button
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  className="password-visibility-button"
                  type="button"
                  onClick={() => setShowNewPassword((isVisible) => !isVisible)}
                >
                  {showNewPassword ? (
                    <EyeOff aria-hidden="true" size={19} />
                  ) : (
                    <Eye aria-hidden="true" size={19} />
                  )}
                </button>
              </span>
            </div>

            <div className="profile-field">
              <label htmlFor="confirm-password">Confirm password</label>
              <span className="password-input-wrap">
                <input
                  autoComplete="new-password"
                  id="confirm-password"
                  minLength="6"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    setPasswordError('')
                    setPasswordSuccess('')
                  }}
                  placeholder="Repeat your new password"
                  required
                />
                <button
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirmed password'
                      : 'Show confirmed password'
                  }
                  className="password-visibility-button"
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((isVisible) => !isVisible)
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff aria-hidden="true" size={19} />
                  ) : (
                    <Eye aria-hidden="true" size={19} />
                  )}
                </button>
              </span>
            </div>

            <button
              type="submit"
              disabled={
                isSavingPassword || !newPassword || !confirmPassword
              }
            >
              {isSavingPassword ? 'Saving...' : 'Update password'}
            </button>

            {passwordSuccess && (
              <p className="form-success" role="status">
                {passwordSuccess}
              </p>
            )}
            {passwordError && (
              <p className="form-error" role="alert">
                {passwordError}
              </p>
            )}
          </form>
        </div>

        <button
          className="mobile-profile-sign-out ghost-button"
          type="button"
          onClick={onSignOut}
        >
          <LogOut aria-hidden="true" size={20} />
          Sign out
        </button>
      </section>
    </AppLayout>
  )
}

export default ProfilePage
