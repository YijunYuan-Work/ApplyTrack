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
      <ExcelImportPanel
        applications={applications}
        demoRows={demoRows}
        onImportApplications={onImportApplications}
        onDashboard={onDashboard}
      />
    </AppLayout>
  )
}

export default ImportExcelPage
