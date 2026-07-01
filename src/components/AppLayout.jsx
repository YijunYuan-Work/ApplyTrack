function AppLayout({
  children,
  currentPage,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onProfile,
  onProgress,
  onSignOut,
  onToggleTheme = () => {},
  themePreference = 'dark',
  user,
}) {
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', onClick: onDashboard },
    { key: 'profile', label: 'Profile', onClick: onProfile },
    { key: 'progress', label: 'Progress', onClick: onProgress },
    { key: 'import', label: 'Import Excel', onClick: onImportExcel },
  ]

  return (
    <main className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-identity">
          <div className="brand-lockup" aria-label="ApplyTrack">
            <span className="brand-mark" aria-hidden="true">A</span>
            <p className="sidebar-brand">ApplyTrack</p>
          </div>
          <p className="sidebar-user">Workspace for {user.name}</p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              aria-current={currentPage === item.key ? 'page' : undefined}
              className={currentPage === item.key ? 'nav-active' : ''}
              key={item.key}
              type="button"
              onClick={item.onClick}
            >
              <span className="nav-dot" aria-hidden="true"></span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-actions">
          <button type="button" onClick={onAddApplication}>
            <span className="button-plus" aria-hidden="true"></span>
            Add application
          </button>
        </div>

        <div className="sidebar-footer">
          <button
            className="theme-toggle-button"
            type="button"
            aria-label={`Switch to ${
              themePreference === 'dark' ? 'light' : 'dark'
            } mode`}
            aria-pressed={themePreference === 'light'}
            onClick={onToggleTheme}
          >
            <span className="theme-toggle-icon" aria-hidden="true"></span>
            <span className="theme-toggle-label">
              {themePreference === 'dark' ? 'Dark mode' : 'Light mode'}
            </span>
          </button>

          <button className="ghost-button sign-out-button" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <section className="app-content">{children}</section>
    </main>
  )
}

export default AppLayout
