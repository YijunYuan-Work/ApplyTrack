import AppLayout from '../components/AppLayout'
import ExcelImportPanel from '../components/ExcelImportPanel'

function ImportExcelPage({
  applications,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onImportApplications,
  onProfile,
  onProgress,
  onSignOut,
  user,
}) {
  return (
    <AppLayout
      currentPage="import"
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onProfile={onProfile}
      onProgress={onProgress}
      onSignOut={onSignOut}
      user={user}
    >
      <header className="app-header compact">
        <div>
          <p className="eyebrow">Import Excel</p>
          <h1>Bring in your existing tracker.</h1>
          <p>Upload a spreadsheet and add its rows to your application list.</p>
        </div>
      </header>

      <section className="form-page">
        <ExcelImportPanel
          applications={applications}
          onImportApplications={onImportApplications}
        />
      </section>
    </AppLayout>
  )
}

export default ImportExcelPage
