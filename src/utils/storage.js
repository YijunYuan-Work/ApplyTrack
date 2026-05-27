import {
  applicationsKey,
  initialApplications,
  normalizeApplication,
  userKey,
} from '../data/applications'

export function loadApplications() {
  const savedApplications = localStorage.getItem(applicationsKey)

  if (!savedApplications) {
    return initialApplications
  }

  try {
    const parsedApplications = JSON.parse(savedApplications)

    if (!Array.isArray(parsedApplications)) {
      return initialApplications
    }

    return parsedApplications.map(normalizeApplication)
  } catch {
    return initialApplications
  }
}

export function saveApplications(applications) {
  localStorage.setItem(applicationsKey, JSON.stringify(applications))
}

export function loadUser() {
  const savedUser = localStorage.getItem(userKey)

  if (!savedUser) {
    return null
  }

  try {
    const parsedUser = JSON.parse(savedUser)

    if (!parsedUser?.name) {
      return null
    }

    return parsedUser
  } catch {
    return null
  }
}

export function saveUser(user) {
  if (!user) {
    localStorage.removeItem(userKey)
    return
  }

  localStorage.setItem(userKey, JSON.stringify(user))
}
