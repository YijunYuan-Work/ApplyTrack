function AppLayout({
  children,
  currentPage,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onProfile,
  onSignOut,
  user,
}) {
  return (
    <main className="app-layout">
      <aside className="sidebar">
        <div>
          <p className="sidebar-brand">ApplyTrack</p>
          <p className="sidebar-user">{user.name}</p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <button
            className={currentPage === 'dashboard' ? 'nav-active' : ''}
            type="button"
            onClick={onDashboard}
          >
            Dashboard
          </button>
          <button
            className={currentPage === 'profile' ? 'nav-active' : ''}
            type="button"
            onClick={onProfile}
          >
            Profile
          </button>
          <button
            className={currentPage === 'import' ? 'nav-active' : ''}
            type="button"
            onClick={onImportExcel}
          >
            Import Excel
          </button>
        </nav>

        <div className="sidebar-actions">
          <button type="button" onClick={onAddApplication}>
            Add application
          </button>
        </div>

        <button className="ghost-button sign-out-button" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </aside>

      <section className="app-content">{children}</section>
    </main>
  )
}

export default AppLayout
