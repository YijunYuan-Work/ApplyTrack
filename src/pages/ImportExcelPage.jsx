import AppLayout from '../components/AppLayout'
import ExcelImportPanel from '../components/ExcelImportPanel'

function ImportExcelPage({
  onAddApplication,
  onDashboard,
  onImportExcel,
  onImportApplications,
  onProfile,
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
        <ExcelImportPanel onImportApplications={onImportApplications} />
      </section>
    </AppLayout>
  )
}

export default ImportExcelPage
