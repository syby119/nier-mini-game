export type PodLanguage = 'ja' | 'en'

const japaneseDubRegions = new Set(['JP', 'CN', 'HK', 'MO', 'TW'])

export function selectPodLanguage(override: string | string[] | undefined, country: string | null,
  acceptLanguage: string | null): PodLanguage {
  if (override === 'ja' || override === 'en') return override
  const region = country?.trim().toUpperCase()
  if (region && /^[A-Z]{2}$/.test(region) && region !== 'XX') {
    return japaneseDubRegions.has(region) ? 'ja' : 'en'
  }

  let preferred: Intl.Locale | undefined
  let best = 0
  for (const entry of (acceptLanguage || '').split(',')) {
    const [tag, quality = '1'] = entry.trim().split(/\s*;\s*q=/i)
    const weight = Number(quality)
    if (!(weight > best && weight <= 1)) continue
    try {
      preferred = new Intl.Locale(tag)
      best = weight
    } catch {
      // A wildcard or invalid tag does not identify a language or region.
    }
  }
  return preferred?.language === 'ja' || preferred?.language === 'zh' || japaneseDubRegions.has(preferred?.region ?? '') ? 'ja' : 'en'
}
