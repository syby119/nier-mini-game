import { useTranslations } from 'next-intl'
import type { PodLanguage } from './podLanguage'

export function usePodSubtitle(sequence: 'opening' | 'finale', language: PodLanguage) {
  const t = useTranslations(sequence)
  return (cue: number | 'request', values?: { name: string }) => {
    // A few sentences span different cues in the two recordings.
    const localized = `${language}.${cue}`
    return t(t.has(localized) ? localized : String(cue), values)
  }
}
