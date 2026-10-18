import { useState } from 'react'
import { LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import PasswordField from '../components/PasswordField'
import { PasswordRequirements, PasswordStrength } from '../components/PasswordGuidance'
import '../styles/account.css'

function ProfilePage({
  isDemo = false,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onJobAgent,
  onProfile,
  onProgress,
  onSignOut,
  onUpdatePassword,
  user,
}) {
  const username = user.user_metadata?.username || user.name
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

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

  const created = user.created_at ? new Date(user.created_at) : null
  const identity = [
    ['Username', username],
    ['Workspace', isDemo ? 'Public demo workspace' : `${user.name || username}'s workspace`],
    ...(!isDemo && created && Number.isFinite(created.getTime())
      ? [
          [
            'Member since',
            new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(created),
          ],
        ]
      : []),
  ]
  const clearFeedback = () => {
    setPasswordError('')
    setPasswordSuccess('')
  }

  return (
    <AppLayout
      currentPage="profile"
      isDemo={isDemo}
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onJobAgent={onJobAgent}
      onProfile={onProfile}
      onProgress={onProgress}
      onSignOut={onSignOut}
      user={user}
    >
      <div className="profile-page">
        <header className="profile-header">
          <span className="profile-avatar" aria-hidden="true">
            {String(username || '')
              .split(/[\s._-]+/)
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <p className="eyebrow">Profile</p>
            <h1>{username}</h1>
            <p>
              {isDemo
                ? 'Public demo workspace. No personal account.'
                : 'Manage your workspace identity and account security.'}
            </p>
          </div>
        </header>
        <div className="profile-settings-grid">
          <div className="profile-identity">
            <section className="profile-card" aria-labelledby="identity-heading">
              <div>
                <p className="eyebrow">Account</p>
                <h2 id="identity-heading">Workspace identity</h2>
              </div>
              <dl>
                {identity.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="profile-session">
              <div>
                <h2>Session</h2>
                <p>
                  {isDemo ? 'Sample data only. No personal account.' : 'Signed in on this browser.'}
                </p>
              </div>
              {!isDemo && (
                <button
                  className="mobile-profile-sign-out ghost-button ui-button ui-button-ghost"
                  type="button"
                  onClick={onSignOut}
                >
                  <LogOut aria-hidden="true" size={18} />
                  Sign out
                </button>
              )}
            </section>
          </div>
          {isDemo ? (
            <section className="profile-form" aria-labelledby="demo-password-heading">
              <div className="account-security-heading">
                <span className="account-shield">
                  <ShieldCheck aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className="eyebrow">Security</p>
                  <h2 id="demo-password-heading">Password</h2>
                </div>
              </div>
              <p>
                Password changes are unavailable in Demo mode because this workspace does not use a
                personal account.
              </p>
            </section>
          ) : (
            <form className="profile-form" onSubmit={handlePasswordSubmit}>
              <div className="account-security-heading">
                <span className="account-shield">
                  <ShieldCheck aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className="eyebrow">Security</p>
                  <h2>Password</h2>
                  <p>Choose a new password for your account.</p>
                </div>
              </div>
              <PasswordField
                label="New password"
                value={newPassword}
                disabled={isSavingPassword}
                visible={showNewPassword}
                visibilityLabel="new password"
                onToggle={() => setShowNewPassword((v) => !v)}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  clearFeedback()
                }}
              />
              <PasswordStrength password={newPassword} />
              <PasswordField
                label="Confirm password"
                value={confirmPassword}
                disabled={isSavingPassword}
                visible={showConfirmPassword}
                visibilityLabel="confirmed password"
                onToggle={() => setShowConfirmPassword((v) => !v)}
                placeholder="Repeat your new password"
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  clearFeedback()
                }}
              />
              <PasswordRequirements password={newPassword} confirmation={confirmPassword} />
              <button
                className="ui-button ui-button-primary"
                type="submit"
                disabled={isSavingPassword || !newPassword || !confirmPassword}
                aria-busy={isSavingPassword}
              >
                {isSavingPassword && (
                  <LoaderCircle className="account-spinner" aria-hidden="true" size={18} />
                )}
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
          )}
        </div>
      </div>
    </AppLayout>
  )
}

export default ProfilePage
