const KEY = 'joining-portal-pin'

// No built-in fallback code. Anything written here ships inside the public
// JavaScript bundle, so a default PIN would be readable by any visitor.
// The real code lives in the STAFF_PIN environment variable and in the
// security settings document; this only remembers what was typed on this
// device so staff are not re-entering it all day.
export function getPin() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw && /^\d{4}$/.test(raw) ? raw : ''
  } catch {
    return ''
  }
}

export function setPin(pin) {
  localStorage.setItem(KEY, pin)
}
