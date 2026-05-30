import { supabase } from '../lib/supabase'

function createAuthEmail(username) {
  const projectHost = new URL(import.meta.env.VITE_SUPABASE_URL).hostname
  const normalizedUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${normalizedUsername}@${projectHost}`
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return data.user
}

export async function signInWithEmail(username, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: createAuthEmail(username),
    password,
  })

  if (error) {
    throw error
  }

  return data.user
}

export async function signUpWithEmail(username, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: createAuthEmail(username),
    password,
    options: {
      data: {
        name: username,
        profileEmail: email.trim(),
        username,
      },
    },
  })

  if (error) {
    throw error
  }

  return data.user
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function requestPasswordReset(email) {
  const { data, error } = await supabase.functions.invoke('request-password-reset', {
    body: {
      email: email.trim(),
      redirectTo: `${window.location.origin}/?recovery=1`,
    },
  })

  if (error) {
    throw new Error('Password recovery is unavailable right now. Please try again later.')
  }

  if (!data.exists) {
    throw new Error('There is no account associated with this email.')
  }
}

export async function updateProfileEmail(email) {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      profileEmail: email.trim(),
    },
  })

  if (error) {
    throw error
  }

  return data.user
}

export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    throw error
  }

  return data.user
}
