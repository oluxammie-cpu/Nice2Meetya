import { supabase } from '../lib/supabase.js'
import * as mock from './mock.js'

// Preview mode: no backend configured, or forced with VITE_REG_MOCK=1
export const MOCK = import.meta.env.VITE_REG_MOCK === '1' || !import.meta.env.VITE_SUPABASE_URL

async function invoke(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    let message = 'Connection problem. Try again.'
    try { message = (await error.context.json()).error || message } catch {}
    throw new Error(message)
  }
  return data
}

export const reg = (action, body = {}) =>
  MOCK ? mock.reg(action, body) : invoke('registration', { action, ...body })

export const host = (action, body = {}) =>
  MOCK ? mock.host(action, body) : invoke('registration-host', { action, slug: 'ix', ...body })

export const naira = kobo =>
  '₦' + Math.round((kobo || 0) / 100).toLocaleString('en-NG')

export const siteUrl = () => window.location.origin
export const alumniLink = t => `${siteUrl()}/ix/${t}`
export const guestLink  = t => `${siteUrl()}/ix/g/${t}`

export function waLink(text, phone) {
  return `https://wa.me/${phone || ''}?text=${encodeURIComponent(text)}`
}
