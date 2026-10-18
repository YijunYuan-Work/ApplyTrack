import '../styles/account.css'

function Brand() {
  return (
    <div className="account-brand">
      <span aria-hidden="true">A</span>
      <strong>ApplyTrack</strong>
    </div>
  )
}

export default function AuthLayout({ children }) {
  return (
    <main className="auth-shell auth-workspace">
      <aside className="auth-brand-panel" aria-label="ApplyTrack">
        <Brand />
        <div className="auth-brand-copy">
          <h2>Every application, interview and follow-up in one place.</h2>
          <div className="auth-stage-chips" aria-label="Application stages">
            <span>Applied</span>
            <span>Interview</span>
            <span>Offer</span>
          </div>
        </div>
        <p>Your job search workspace</p>
      </aside>
      <div className="auth-content">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <section className="auth-panel">{children}</section>
      </div>
    </main>
  )
}
