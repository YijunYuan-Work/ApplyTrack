export function getRoute() {
  const hashRoute = window.location.hash.replace('#', '')
  return hashRoute || '/sign-in'
}

export function navigate(nextRoute) {
  window.location.hash = nextRoute
}

export function getEditingApplicationId(route) {
  if (!route.startsWith('/applications/') || !route.endsWith('/edit')) {
    return null
  }

  return Number(route.split('/')[2])
}
