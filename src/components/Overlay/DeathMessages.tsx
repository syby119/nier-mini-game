import { CSSProperties } from 'react'
import { useNetworkStore, SupportMessage } from '../../store/NetworkStore'
import styles from './ContinueOverlay.module.css'

// The offline messages are taken from the finale recording. Keep the original
// languages and signatures where they are legible in the footage.
const recorded: (SupportMessage & { translation?: string })[] = [
  { name: 'Honoka', content: 'My voice may not reach you. All the same, I’m in your corner.', region: 'Italy', translation: '也許我的聲音傳不到你那裡。即使如此，我仍然支持你。' },
  { name: 'Colton', content: 'It was hard for me as well. In other words, we’ve got this!' },
  { name: '', content: 'I like Emil! In other words, I want to help.' },
  { name: '', content: 'It was hard for me as well. But… don’t give up.' },
  { name: '', content: '貴方はこのゲームが好きか？だったら、もう一度だ。', region: '並行世界', translation: 'Do you like this game? In which case, give it one more go.' },
  { name: 'RoksAtlas', content: 'Feel like running away?' },
  { name: '', content: 'It’s amazing if you cleared this alone. But, try to stay cool.', region: 'Japan' },
  { name: '', content: '僕はがんばった。いつだって、応援している。', region: 'アメリカ', translation: 'I did my best. One thing is certain: I’m rooting for you.' },
  { name: 'SYEDAHMEDPS', content: 'I’ve walked the same road as you. In other words, don’t give up here!', region: 'USA' },
  { name: 'Jan', content: 'This world is rife with hardship. In the end, suffering makes people grow.', region: 'Heaven' },
  { name: '', content: '一人でここまで来たのはすごいよ。冷静になってみよう。', region: '日本' },
  { name: 'Fbb', content: 'Do not avert your eyes from difficulties. Why? Because if you won’t do it, who will?', region: 'The Aerie' },
  { name: 'Bran', content: 'You’re thinking this is impossible.' },
]

// Each new group joins the older, fainter messages at a different depth.
// Coordinates are percentages of the full frame, sizes are pixels at 640 × 360.
const placements = [
  { x: 43, y: 42, size: 5.8, opacity: .27 },
  { x: 36, y: 62, size: 8.2, opacity: .81 },
  { x: 96, y: 37, size: 6.5, opacity: .44 },
  { x: 93, y: 21, size: 7.2, opacity: .52 },
  { x: 39, y: 60, size: 9.1, opacity: .86 },
  { x: 97, y: 48, size: 6.1, opacity: .48 },
  { x: 26, y: 71, size: 7.5, opacity: .75 },
  { x: 29, y: 80, size: 7.4, opacity: .6 },
  { x: 70, y: 32, size: 8, opacity: .79 },
  { x: 27, y: 20, size: 7, opacity: .73 },
  { x: 18, y: 67, size: 6.1, opacity: .57 },
  { x: 61, y: 12, size: 8, opacity: .66 },
  { x: 96, y: 58, size: 7.8, opacity: .7 },
]

export default function DeathMessages({ deathCount, visible }: { deathCount: number, visible: boolean }) {
  const live = useNetworkStore(state => state.supportMessages)
  const count = Math.min(1 + (deathCount - 2) * 3, placements.length)
  const messages = [...live, ...recorded].slice(0, count)
  return (
    <div className={styles.messages} data-visible={visible} aria-hidden="true">
      {messages.map((message, index) => {
        const { x, y, size, opacity } = placements[index]
        const text = [message.name, '“' + message.content + '”', message.region].filter(Boolean).join('  ')
        const translation = 'translation' in message ? message.translation : undefined
        const style = {
          left: x + '%', top: y + '%', fontSize: 'calc(' + size + ' * var(--unit))', opacity,
          filter: size < 7 ? 'blur(calc(.28 * var(--unit)))' : undefined,
          '--delay': (.8 + (index % 5) * .46) + 's',
          '--reveal': Math.min(5.5, Array.from(text).length * .045) + 's',
          '--letters': Math.max(1, Array.from(text).length),
        } as CSSProperties
        return (
          <p key={index + text} className={styles.message} style={style}>
            <span>{text}{typeof translation === 'string' && <small>{translation}</small>}</span>
          </p>
        )
      })}
    </div>
  )
}
