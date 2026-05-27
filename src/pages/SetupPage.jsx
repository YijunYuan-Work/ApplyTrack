function SetupPage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel setup-panel">
        <div>
          <p className="eyebrow">Supabase setup</p>
          <h1>Connect your project keys.</h1>
          <p>
            Add your Supabase URL and publishable key to a local environment
            file, then restart the dev server.
          </p>
        </div>

        <div className="setup-steps">
          <p>Create `.env.local` in the project root:</p>
          <pre>
            <code>
              VITE_SUPABASE_URL=https://your-project.supabase.co{'\n'}
              VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
            </code>
          </pre>
          <p>Run the SQL in `supabase/schema.sql` inside Supabase SQL Editor.</p>
        </div>
      </section>
    </main>
  )
}

export default SetupPage
