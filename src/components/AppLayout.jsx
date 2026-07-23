import {
  BarChart3,
  FileSpreadsheet,
  Grid2X2,
  LogOut,
  Plus,
  SearchCheck,
  User,
} from 'lucide-react'

function AppLayout({
  children,
  currentPage,
  isDemo = false,
  isReadOnly = false,
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
  const navIcons = {
    agent: SearchCheck,
    dashboard: Grid2X2,
    profile: User,
    progress: BarChart3,
    import: FileSpreadsheet,
  }

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', onClick: onDashboard },
    { key: 'profile', label: 'Profile', onClick: onProfile },
    { key: 'progress', label: 'Progress', onClick: onProgress },
    { key: 'agent', label: 'Job Agent', onClick: onJobAgent },
    { key: 'import', label: 'Import Excel', onClick: onImportExcel },
  ]

  return (
    <main className="app-layout">
      <header className="mobile-app-bar">
        <div className="mobile-brand-lockup" aria-label="ApplyTrack">
          <span className="mobile-brand-mark" aria-hidden="true">A</span>
          <span>ApplyTrack</span>
        </div>
        {!isReadOnly && showAddApplication && (
          <button
            aria-label="Add application"
            className="mobile-add-action"
            title="Add application"
            type="button"
            onClick={onAddApplication}
          >
            <Plus aria-hidden="true" size={22} />
          </button>
        )}
      </header>

      <aside className="sidebar">
        <div className="sidebar-identity">
          <div className="brand-lockup" aria-label="ApplyTrack">
            <span className="brand-mark" aria-hidden="true">A</span>
            <p className="sidebar-brand">ApplyTrack</p>
          </div>
          <p className="sidebar-user-row">
            <span>{isDemo ? 'Public demo workspace' : `${user.name}'s workspace`}</span>
          </p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = navIcons[item.key]

            return (
              <button
                aria-current={currentPage === item.key ? 'page' : undefined}
                className={currentPage === item.key ? 'nav-active' : ''}
                key={item.key}
                type="button"
                onClick={item.onClick}
              >
                <Icon className="nav-icon" aria-hidden="true" size={23} />
                <span className="nav-label">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {!isReadOnly && showAddApplication && (
          <div className="sidebar-actions">
            <button className="sidebar-primary-action" type="button" onClick={onAddApplication}>
              <span className="button-plus" aria-hidden="true"></span>
              <span>Add application</span>
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          {isDemo ? (
            <>
              <p className="sidebar-footer-label">Demo mode</p>
              <p className="sidebar-demo-note">Sample data only</p>
            </>
          ) : (
            <>
              <p className="sidebar-footer-label">Account</p>
              <button
                className="ghost-button sign-out-button"
                type="button"
                onClick={onSignOut}
              >
                <LogOut className="sign-out-icon" aria-hidden="true" size={23} />
                Sign out
              </button>
            </>
          )}
        </div>
      </aside>

      <section className="app-content">{children}</section>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = navIcons[item.key]
          const isActive = currentPage === item.key

          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              className={`mobile-nav-item ${isActive ? 'mobile-nav-item-active' : ''}`}
              key={item.key}
              type="button"
              onClick={item.onClick}
            >
              <Icon aria-hidden="true" size={20} />
              <span>
                {item.key === 'import'
                  ? 'Import'
                  : item.key === 'agent'
                    ? 'Agent'
                    : item.label}
              </span>
            </button>
          )
        })}
      </nav>
    </main>
  )
}

export default AppLayout
