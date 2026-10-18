import { useState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { navigate } from '../utils/routes'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'

function SignInPage({ error, isLoading, onAuthSubmit }) {
  const [mode, setMode] = useState('sign-in')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const isSignUp = mode === 'sign-up'

  function handleSubmit(event) {
    event.preventDefault()
    if (isLoading) return

    onAuthSubmit({
      mode,
      password,
      username: username.trim(),
    })
  }

  return (
    <AuthLayout>
      <div>
        <p className="eyebrow">ApplyTrack</p>
        <h1>{isSignUp ? 'Create your workspace.' : 'Sign in to your workspace.'}</h1>
        <p>Manage applications, interviews, and follow-ups in one focused workspace.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-toggle" role="group" aria-label="Authentication mode">
          <button
            className={mode === 'sign-in' ? 'toggle-active' : ''}
            aria-pressed={!isSignUp}
            disabled={isLoading}
            type="button"
            onClick={() => setMode('sign-in')}
          >
            Sign in
          </button>
          <button
            className={mode === 'sign-up' ? 'toggle-active' : ''}
            aria-pressed={isSignUp}
            disabled={isLoading}
            type="button"
            onClick={() => setMode('sign-up')}
          >
            Sign up
          </button>
        </div>

        <label className="account-field">
          <span>Username</span>
          <input
            autoComplete="username"
            disabled={isLoading}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="jane"
            required
          />
        </label>

        <PasswordField
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          visible={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          minLength={0}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          disabled={isLoading}
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="ui-button ui-button-add"
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading && <LoaderCircle aria-hidden="true" className="account-spinner" size={18} />}
          {isLoading ? 'Working...' : isSignUp ? 'Create account' : 'Sign in'}
        </button>

        <div className="auth-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <button
          className="ui-button ui-button-ghost auth-demo-button"
          type="button"
          disabled={isLoading}
          onClick={() => navigate('/demo')}
        >
          View public demo
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </form>
    </AuthLayout>
  )
}

export default SignInPage
