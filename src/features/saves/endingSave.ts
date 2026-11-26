import type { EndingSave } from './saveTypes'

const pendingKey = 'nier.pendingSaveDonation'

function keyFor(profileId?: string) {
  return profileId && profileId !== 'legacy' ? pendingKey + '.' + profileId : pendingKey
}

export function rememberDonation(run: EndingSave) {
  try { localStorage.setItem(keyFor(run.profileId), JSON.stringify(run)) }
  catch { /* The current transfer can still complete in this tab. */ }
}

export function forgetDonation(run: EndingSave) {
  try { localStorage.removeItem(keyFor(run.profileId)) }
  catch { /* Retrying an acknowledged transfer is idempotent. */ }
}

export function pendingDonation(profileId?: string): EndingSave | null {
  try {
    const keys = profileId ? [keyFor(profileId)] : Object.keys(localStorage)
      .filter(key => key === pendingKey || key.startsWith(pendingKey + '.'))
    for (const key of keys) {
      let value
      try { value = JSON.parse(localStorage.getItem(key) || 'null') } catch { continue }
      if (value && typeof value.name === 'string' && typeof value.points === 'number') {
        // Pending uploads saved by the single-slot game use its original server cookie.
        if (!value.profileId && localStorage.getItem('nier.endingSave')) value.profileId = 'legacy'
        return value
      }
    }
  } catch { /* No recoverable transfer. */ }
  return null
}
