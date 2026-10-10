import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { navigate } from '../utils/routes'

function SignInPage({ error, isLoading, onAuthSubmit }) {
  const [mode, setMode] = useState('sign-in')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const isSignUp = mode === 'sign-up'

  function handleSubmit(event) {
    event.preventDefault()

    onAuthSubmit({
      mode,
      password,
      username: username.trim(),
    })
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">ApplyTrack</p>
          <h1>
            {isSignUp ? 'Create your workspace.' : 'Sign in to your workspace.'}
          </h1>
          <p>Manage applications, interviews, and follow-ups in one focused workspace.</p>
        </div>

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
            {isLoading ? 'Working...' : isSignUp ? 'Create account' : 'Sign in'}
          </button>

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
      </section>
    </main>
  )
}

export default SignInPage
