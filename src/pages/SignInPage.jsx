import { useState } from 'react'

function SignInPage({ error, isLoading, onAuthSubmit }) {
  const [mode, setMode] = useState('sign-in')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">ApplyTrack</p>
          <h1>{isSignUp ? 'Create your workspace.' : 'Sign in to your workspace.'}</h1>
          <p>Pick up where your applications, interviews, and follow-ups left off.</p>
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

          {isSignUp && (
            <label>
              Email optional
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane@example.com"
              />
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

          {error && <p className="form-error">{error}</p>}

          <button type="submit" disabled={isLoading}>
            {isLoading
              ? 'Working...'
              : isSignUp
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default SignInPage
