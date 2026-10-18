import { useLayoutEffect, useRef } from 'react'
import {
  BarChart3,
  FileSpreadsheet,
  Grid2X2,
  LogOut,
  Plus,
  SearchCheck,
  User,
} from 'lucide-react'
import './AppLayout.css'

// Pages own their existing layouts; retain only the indicator's visual origin across mounts.
let previousNavigation = { scope: null, index: null }

function AppLayout({
  children,
  currentPage,
  isDemo = false,
  isReadOnly = false,
  isSigningOut = false,
  signOutError = '',
  onAddApplication,
  onDashboard,
  onImportExcel,
  onJobAgent,
  onProfile,
  onProgress,
  onSignOut,
  showAddApplication = true,
  user,
}) {
  const indicators = useRef(null)
  const signOutAlert = useRef(null)
  useLayoutEffect(() => {
    if (signOutError) signOutAlert.current?.focus()
  }, [signOutError])
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', short: 'Dashboard', icon: Grid2X2, onClick: onDashboard },
    { key: 'profile', label: 'Profile', short: 'Profile', icon: User, onClick: onProfile },
    { key: 'progress', label: 'Progress', short: 'Progress', icon: BarChart3, onClick: onProgress },
    { key: 'agent', label: 'Job Agent', short: 'Agent', icon: SearchCheck, onClick: onJobAgent },
    { key: 'import', label: 'Import Excel', short: 'Import', icon: FileSpreadsheet, onClick: onImportExcel },
  ]
  const activeIndex = navItems.findIndex((item) => item.key === currentPage)

  useLayoutEffect(() => {
    const scope = isDemo ? 'demo' : 'account'
    const from = previousNavigation.scope === scope ? previousNavigation.index : activeIndex
    previousNavigation = { scope, index: activeIndex }
    if (activeIndex < 0 || from < 0 || from === activeIndex ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const motion = getComputedStyle(indicators.current)
    const timing = {
      duration: parseFloat(motion.getPropertyValue('--motion-nav')),
      easing: motion.getPropertyValue('--ease-ui').trim(),
    }
    indicators.current.querySelector('.sidebar-indicator').animate(
      [{ transform: `translateY(${from * 48}px)` }, { transform: `translateY(${activeIndex * 48}px)` }], timing,
    )
    indicators.current.querySelector('.mobile-nav-indicator').animate(
      [{ transform: `translateX(${from * 100}%)` }, { transform: `translateX(${activeIndex * 100}%)` }], timing,
    )
  }, [activeIndex, isDemo])

  return (
    <main className="app-layout" ref={indicators} style={{ '--active-nav': Math.max(0, activeIndex) }}>
      <header className="mobile-app-bar">
        <div className="mobile-brand-lockup" aria-label="ApplyTrack">
          <span className="mobile-brand-mark" aria-hidden="true">A</span>
          <span>ApplyTrack</span>
        </div>
        {!isReadOnly && showAddApplication && (
          <button
            aria-label="Add application"
            className="mobile-add-action ui-button ui-button-primary"
            title="Add application"
            type="button"
            onClick={onAddApplication}
          >
            <Plus aria-hidden="true" size={20} />
          </button>
        )}
      </header>

      <aside className="sidebar" aria-label="Workspace">
        <div className="sidebar-identity">
          <span className="brand-mark" aria-hidden="true">A</span>
          <div className="sidebar-identity-copy">
            <p className="sidebar-brand">ApplyTrack</p>
            <p className="sidebar-user-row" title={isDemo ? 'Public demo workspace' : `${user.name}'s workspace`}>
              {isDemo ? 'Public demo workspace' : `${user.name}'s workspace`}
            </p>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          <span className="sidebar-indicator" aria-hidden="true" hidden={activeIndex < 0} />
          {navItems.map(({ key, label, icon: Icon, onClick }) => (
            <button
              aria-current={currentPage === key ? 'page' : undefined}
              aria-label={label}
              title={label}
              className={currentPage === key ? 'nav-active' : ''}
              key={key}
              type="button"
              onClick={onClick}
            >
              <Icon className="nav-icon" aria-hidden="true" size={20} />
              <span className="nav-label">{label}</span>
              <span className="rail-tooltip" aria-hidden="true">{label}</span>
            </button>
          ))}
        </nav>
        {!isReadOnly && showAddApplication && (
          <button
            aria-label="Add application"
            title="Add application"
            className="sidebar-primary-action ui-button"
            type="button"
            onClick={onAddApplication}
          >
            <Plus aria-hidden="true" size={18} />
            <span className="nav-label">Add application</span>
            <span className="rail-tooltip" aria-hidden="true">Add application</span>
          </button>
        )}
        <div className="sidebar-footer">
          {isDemo ? (
            <>
              <p className="sidebar-footer-label">Demo mode</p>
              <p className="sidebar-demo-note" title="Sample data only">
                <span className="demo-indicator" aria-hidden="true" />
                <span className="nav-label">Sample data only</span>
              </p>
            </>
          ) : (
            <>
              <p className="sidebar-footer-label">Account</p>
              <button
                aria-label="Sign out"
                title="Sign out"
                className="sign-out-button ui-button ui-button-ghost"
                type="button"
                onClick={onSignOut}
                disabled={isSigningOut}
                aria-busy={isSigningOut}
              >
                <LogOut aria-hidden="true" size={20} />
                <span className="nav-label">Sign out</span>
                <span className="rail-tooltip" aria-hidden="true">Sign out</span>
              </button>
            </>
          )}
        </div>
      </aside>

      <section className="app-content">
        {!isDemo && signOutError && (
          <p className="form-error" role="alert" tabIndex={-1} ref={signOutAlert}>
            {signOutError}
          </p>
        )}
        {children}
      </section>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <span className="mobile-nav-indicator" aria-hidden="true" hidden={activeIndex < 0} />
        {navItems.map(({ key, label, short, icon: Icon, onClick }) => (
          <button
            aria-current={currentPage === key ? 'page' : undefined}
            aria-label={short}
            title={label}
            className={`mobile-nav-item ${currentPage === key ? 'mobile-nav-item-active' : ''}`}
            key={key}
            type="button"
            onClick={onClick}
          >
            <Icon aria-hidden="true" size={21} />
            <span>{short}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}

export default AppLayout
