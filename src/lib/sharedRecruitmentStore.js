const ENDPOINT = '/.netlify/functions/joining-data'
const STAFF_PIN_SESSION_KEY = 'joining-portal-staff-pin'

async function request(body) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The joining database request failed.')
  return result
}

export const createFamilyToken = () => {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export function rememberStaffPin(pin) {
  sessionStorage.setItem(STAFF_PIN_SESSION_KEY, pin)
}

export function forgetStaffPin() {
  sessionStorage.removeItem(STAFF_PIN_SESSION_KEY)
}

export const currentStaffPin = () => sessionStorage.getItem(STAFF_PIN_SESSION_KEY) || ''

export const syncFamily = (family) => request({ action: 'sync-family', family, token: family?._portalToken, pin: currentStaffPin() })
export const deleteSharedFamily = (family) => request({ action: 'delete-family', familyId: family?.id, token: family?._portalToken, pin: currentStaffPin() })
export const loadSharedFamily = (familyId, token) => request({ action: 'load-family', familyId, token, pin: currentStaffPin() })
export const loadStaffSnapshot = () => request({ action: 'staff-snapshot', pin: currentStaffPin() })
export const saveSharedOpenNight = (openNightId, management) => request({ action: 'save-open-night', openNightId, management, pin: currentStaffPin() })
export const validateSharedStaffPin = (pin) => request({ action: 'validate-staff', pin })
export const saveSharedSetting = (key, value) => request({ action: 'save-setting', key, value, pin: currentStaffPin() })
export const changeSharedStaffPin = (newPin) => request({ action: 'change-pin', newPin, pin: currentStaffPin() })
export const requestFamilyAccess = (email) => request({ action: 'request-family-access', email })
export const redeemJoiningCode = (email, code) => request({ action: 'redeem-joining-code', email, code })
export const createDirectJoiner = (details) => request({ action: 'create-direct-joiner', ...details, pin: currentStaffPin() })
