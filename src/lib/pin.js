const KEY = 'joining-portal-pin'
const DEFAULT_PIN = '1918'

export function getPin() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw && /^\d{4}$/.test(raw) ? raw : DEFAULT_PIN
  } catch {
    return DEFAULT_PIN
  }
}

export function setPin(pin) {
  localStorage.setItem(KEY, pin)
}
