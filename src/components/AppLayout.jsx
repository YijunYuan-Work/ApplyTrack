import {
  BarChart3,
  ChevronDown,
  FileSpreadsheet,
  Grid2X2,
  LogOut,
  Sun,
  User,
} from 'lucide-react'

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
  themePreference = 'light',
  user,
}) {
  const navIcons = {
    dashboard: Grid2X2,
    profile: User,
    progress: BarChart3,
    import: FileSpreadsheet,
  }

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
          <p className="sidebar-user-row">
            <span>{user.name}'s workspace</span>
            <ChevronDown className="sidebar-user-chevron" aria-hidden="true" size={18} />
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

        <div className="sidebar-actions">
          <button className="sidebar-primary-action" type="button" onClick={onAddApplication}>
            <span className="button-plus" aria-hidden="true"></span>
            <span>Add application</span>
          </button>
        </div>

        <div className="sidebar-footer">
          <p className="sidebar-footer-label">Account</p>
          <button
            className="theme-toggle-button"
            type="button"
            aria-label={`Switch to ${
              themePreference === 'dark' ? 'light' : 'dark'
            } mode`}
            aria-pressed={themePreference === 'light'}
            onClick={onToggleTheme}
          >
            <Sun className="theme-toggle-icon" aria-hidden="true" size={25} />
            <span className="theme-toggle-label">
              {themePreference === 'dark' ? 'Dark mode' : 'Light mode'}
            </span>
          </button>

          <button
            className="ghost-button sign-out-button"
            type="button"
            onClick={onSignOut}
          >
            <LogOut className="sign-out-icon" aria-hidden="true" size={23} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="app-content">{children}</section>
    </main>
  )
}

export default AppLayout
