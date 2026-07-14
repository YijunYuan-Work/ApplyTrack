import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { navigate } from '../utils/routes'

function SignInPage({
  error,
  isLoading,
  onAuthSubmit,
  onPasswordResetRequest,
}) {
  const [mode, setMode] = useState('sign-in')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [isRequestingReset, setIsRequestingReset] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoverySuccess, setRecoverySuccess] = useState('')
  const isSignUp = mode === 'sign-up'

  function handleSubmit(event) {
    event.preventDefault()

    onAuthSubmit({
      email: email.trim(),
      mode,
      password,
      username: username.trim(),
    })
  }

  async function handleRecoverySubmit(event) {
    event.preventDefault()
    setRecoveryError('')
    setRecoverySuccess('')
    setIsRequestingReset(true)

    try {
      await onPasswordResetRequest(email.trim())
      setRecoverySuccess(
        'If an account uses that recovery email, a reset link is on its way.',
      )
    } catch (requestError) {
      setRecoveryError(requestError.message)
    } finally {
      setIsRequestingReset(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">ApplyTrack</p>
          <h1>
            {isRecoveryMode
              ? 'Recover your workspace.'
              : isSignUp
                ? 'Create your workspace.'
                : 'Sign in to your workspace.'}
          </h1>
          <p>Manage applications, interviews, and follow-ups in one focused workspace.</p>
        </div>

        {isRecoveryMode ? (
          <form className="auth-form" onSubmit={handleRecoverySubmit}>
            <p className="auth-form-copy">
              Enter the recovery email associated with your account.
            </p>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane@example.com"
                required
              />
            </label>

            {recoverySuccess && <p className="form-success">{recoverySuccess}</p>}
            {recoveryError && <p className="form-error">{recoveryError}</p>}

            <button type="submit" disabled={isRequestingReset}>
              {isRequestingReset ? 'Sending...' : 'Send reset link'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setIsRecoveryMode(false)
                setRecoveryError('')
                setRecoverySuccess('')
              }}
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-toggle" aria-label="Authentication mode">
              <button
                className={mode === 'sign-in' ? 'toggle-active' : ''}
                type="button"
                onClick={() => setMode('sign-in')}
              >
                Sign in
              </button>
              <button
                className={mode === 'sign-up' ? 'toggle-active' : ''}
                type="button"
                onClick={() => setMode('sign-up')}
              >
                Sign up
              </button>
            </div>

            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="jane"
                required
              />
            </label>

            {isSignUp && (
              <label>
                Recovery email optional
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="jane@example.com"
                />
                <span className="field-hint">
                  Used only if you need to reset your password.
                </span>
              </label>
            )}

            <label>
              Password
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  required
                />
                <button
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="password-visibility"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" size={20} />
                  ) : (
                    <Eye aria-hidden="true" size={20} />
                  )}
                </button>
              </span>
            </label>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" disabled={isLoading}>
              {isLoading
                ? 'Working...'
                : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
            </button>

            {!isSignUp && (
              <button
                className="auth-link-button"
                type="button"
                onClick={() => setIsRecoveryMode(true)}
              >
                Forgot password?
              </button>
            )}

            <div className="auth-divider" aria-hidden="true">
              <span>or</span>
            </div>
            <button
              className="ghost-button auth-demo-button"
              type="button"
              onClick={() => navigate('/demo')}
            >
              View public demo
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

export default SignInPage
