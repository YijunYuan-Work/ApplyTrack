import { useState } from 'react'

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
          <p>Pick up where your applications, interviews, and follow-ups left off.</p>
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
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </label>

            {!isSignUp && (
              <button
                className="auth-link-button"
                type="button"
                onClick={() => setIsRecoveryMode(true)}
              >
                Forgot password?
              </button>
            )}

            {error && <p className="form-error">{error}</p>}

            <button type="submit" disabled={isLoading}>
              {isLoading
                ? 'Working...'
                : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

export default SignInPage
