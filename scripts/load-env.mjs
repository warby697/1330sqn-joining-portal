// Loads .env into process.env so the admin scripts can be run as plain node commands.
//
// Netlify stores GOCARDLESS_ACCESS_TOKEN, STRIPE_SECRET_KEY and RESEND_API_KEY as secrets,
// which cannot be read back out again, by design. Anything that has to talk to GoCardless
// or Stripe from here therefore needs its own copy of the key in .env, which is in
// .gitignore and never leaves this machine.
//
// Values already in the environment win, so a one-off
//   GOCARDLESS_ACCESS_TOKEN=... node scripts/whatever.mjs
// still overrides the file.
import { readFileSync } from 'node:fs'

export function loadEnv(path = new URL('../.env', import.meta.url)) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return
  }
  // Strip the byte order mark Windows editors like to add, or the first key gets a
  // non-printing character stuck on the front of its name and silently never matches.
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const split = trimmed.indexOf('=')
    if (split < 1) continue
    const key = trimmed.slice(0, split).trim()
    if (process.env[key] !== undefined) continue
    let value = trimmed.slice(split + 1).trim()
    if (value.length > 1 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value[0])) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}
