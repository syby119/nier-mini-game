const separators = new RegExp('[\\s\\p{P}\\p{Cf}]+', 'gu')
const placeholder = /^(?:([a-z])\1{2,}|(?:test|testing|測試|测试)\d*)$/i

export function isSupportMessageText(content: unknown): content is string {
  if (typeof content !== 'string') return false
  // Check a comparison copy so short cheers, emoji and the writer's punctuation survive.
  const text = content.normalize('NFKC').replace(separators, '')
  return text.length > 0 && !placeholder.test(text)
}
