import { useState } from 'react'
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
  onProfile,
  onProgress,
  onSignOut,
  onUpdatePassword,
  onUpdateProfileEmail,
  user,
}) {
  const username = user.user_metadata?.username || user.name
  const [email, setEmail] = useState(() => getProfileEmail(user))
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  async function handleEmailSubmit(event) {
    event.preventDefault()
    setEmailError('')
    setEmailSuccess('')
    setIsSavingEmail(true)

    try {
      await onUpdateProfileEmail(email)
      setEmailSuccess(email.trim() ? 'Email updated successfully.' : 'Email removed.')
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
        <article className="profile-card">
          <div>
            <span>Username</span>
            <strong>{username}</strong>
          </div>
        </article>

        <div className="profile-settings-grid">
          <form className="profile-form" onSubmit={handleEmailSubmit}>
            <div>
              <p className="eyebrow">Contact</p>
              <h2>Email</h2>
              <p>Optional account contact email.</p>
            </div>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane@example.com"
              />
            </label>

            <button type="submit" disabled={isSavingEmail}>
              {isSavingEmail ? 'Saving...' : 'Save email'}
            </button>

            {emailSuccess && <p className="form-success">{emailSuccess}</p>}
            {emailError && <p className="form-error">{emailError}</p>}
          </form>

          <form className="profile-form" onSubmit={handlePasswordSubmit}>
            <div>
              <p className="eyebrow">Security</p>
              <h2>Password</h2>
              <p>Choose a new password for your account.</p>
            </div>

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

            <button type="submit" disabled={isSavingPassword}>
              {isSavingPassword ? 'Saving...' : 'Update password'}
            </button>

            {passwordSuccess && <p className="form-success">{passwordSuccess}</p>}
            {passwordError && <p className="form-error">{passwordError}</p>}
          </form>
        </div>
      </section>
    </AppLayout>
  )
}

export default ProfilePage
