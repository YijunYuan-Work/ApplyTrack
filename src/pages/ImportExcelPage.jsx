import AppLayout from '../components/AppLayout'
import ExcelImportPanel from '../components/ExcelImportPanel'

function ImportExcelPage({
  applications,
  demoRows = [],
  isDemo = false,
  onAddApplication,
  onDashboard,
  onImportExcel,
  onImportApplications,
  onJobAgent,
  onProfile,
  onProgress,
  onSignOut,
  user,
}) {
  return (
    <AppLayout
      currentPage="import"
      isDemo={isDemo}
      onAddApplication={onAddApplication}
      onDashboard={onDashboard}
      onImportExcel={onImportExcel}
      onJobAgent={onJobAgent}
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
          demoRows={demoRows}
          onImportApplications={onImportApplications}
        />
      </section>
    </AppLayout>
  )
}

export default ImportExcelPage
