import { englishAdditional, englishCast, japaneseEnsemble, japaneseLeads, type VoiceCredit } from '@/features/credits/VoiceCredits'
import { useLayoutEffect, useRef } from 'react'
import { CreditSignal, type CreditMotion, type CreditNoise } from './CreditSignal'
import styles from './OpeningCredits.module.css'

type Staff = string | [role: string, name: string]

function voiceStaff(credits: VoiceCredit[]): Staff[] {
  return credits.map(([, role, performer]) => [role, performer])
}

const sections: [heading: string, staff: Staff[]][] = [
  ['DIRECTOR', ['YOKO TARO']],
  ['Japanese Voices', voiceStaff([...japaneseLeads, ...japaneseEnsemble])],
  ['English Voices', voiceStaff([...englishCast, ...englishAdditional])],
  ['PlatinumGames Inc.', []],
  ['EXECUTIVE PRODUCER', ['Atsushi Inaba']],
  ['PRODUCER', ['Eijiro Nishimura']],
  ['GAME DESIGN', [
    ['Senior Game Designer', 'Takahisa Taura'], ['Lead Game Designer', 'Isao Negishi'],
    ['Game Designer', 'Mari Fujita'], ['Game Designer', 'Shohei Takada'], ['Game Designer', 'Kazuhide Kawamura'],
    ['Game Designer', 'Maho Miyata'],
  ]],
  ['CONCEPT ART', [
    ['Environment Concept Artist', 'Kazuma Koda'], ['Enemy and Environment Concept Artist', 'Yuki Suda'],
    ['Costume Illustrator', 'Tomoko Nishii'], ['Weapon Concept Artist', 'Yonghee Cho'],
  ]],
  ['CHARACTER MODELING', [
    ['Lead Character Modeler', 'Kazunori Tazaki'], ['Character Modeler', 'Hito Matsudaira'],
    ['Character Modeler', 'Yoshikaze Matsushita'], ['Character Modeler', 'Eiji Funahashi'],
  ]],
  ['ENVIRONMENT', [
    ['Lead Environment Artist', 'Yasuyuki Kaji'], ['Lighting Artist', 'Shohei Kameoka'],
    ['Environment Artist', 'Junpei Mashiba'], ['Environment Artist', 'Kana Yamamoto'], ['Environment Artist', 'Namie Higa'],
    ['Environment Artist', 'Naoya Yokoyama'], ['Environment Artist', 'Tatsuya Ohigashi'],
  ]],
  ['ANIMATION', [['Lead Animator', 'Takayuki Muranaka']]],
  ['VISUAL EFFECTS', [['Lead VFX Artist', 'Shion Nakajima'], ['VFX Artist', 'Naoki Tsuta'], ['VFX Artist', 'Koji Tanaka'], ['VFX Artist', 'Takuo Yamamoto']]],
  ['UI DESIGN', [['Lead UI Artist / Machine Concept Artist', 'Hisayoshi Kijima'], ['UI Artist', 'Kenta Okura']]],
  ['PROGRAMMING', [
    ['Lead Programmer', 'Ryo Onishi'], ['Programmer', 'Takashi Wagatsuma'], ['Programmer', 'Kazunori Inoue'],
    ['Programmer', 'Shuhei Rokumoto'], ['Programmer', 'Shuichiro Chiboshi'], ['Programmer', 'Takenobu Okabe'],
    ['Programmer', 'Shoichi Hirakawa'], ['Programmer', 'Yicheng Xiao'],
  ]],
]

// Layout distances are in the 640 × 360 reference frame.
const rollHeight = sections.reduce((height, [, staff]) =>
  height + 29 + 19 * (1 + staff.length) + (staff.length ? 6 : 0), 0)
const rollDelay = 18500
const rollSpeed = 48.3
// The data check holds the last programmer at the top edge of the shot.
const endInset = 40

function StaffList() {
  return <div className={styles.staff}>
    {sections.map(([heading, staff]) => (
      <section className={styles.department} key={heading}>
        <h2 data-credit={heading}>{heading}</h2>
        {staff.map(person => {
          if (typeof person === 'string') return <div className={styles.center} key={person} data-credit={person}>{person}</div>
          const [role, name] = person
          return <div className={styles.row} key={name} data-credit={name}>
            <small>{role}</small><span>{name}</span>
          </div>
        })}
      </section>
    ))}
  </div>
}

export default function OpeningCredits({ motion, noise }: { motion: CreditMotion, noise: CreditNoise }) {
  const strip = useRef<HTMLDivElement>(null)
  const travel = useRef<Animation | null>(null)

  useLayoutEffect(() => {
    const animation = strip.current!.animate([
      { transform: 'translateY(0)' },
      { transform: `translateY(calc(100% - ${endInset} * var(--unit)))` },
    ], { delay: rollDelay, duration: (rollHeight - endInset) / rollSpeed * 1000, fill: 'both' })
    travel.current = animation
    return () => animation.cancel()
  }, [])

  useLayoutEffect(() => {
    const animation = travel.current!
    if (motion === 'hold') animation.pause()
    if (motion === 'rewind' && Number(animation.currentTime) > rollDelay &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // In the recording the very same rows go back up at 64–65 px per 30 fps frame.
      animation.playbackRate = -40
      animation.play()
    }
  }, [motion])

  return <div className={styles.field} data-noise={noise}>
    <div className={styles.roll} ref={strip}><StaffList /></div>
    <CreditSignal strip={strip} motion={motion} noise={noise} endInset={endInset} rollSpeed={rollSpeed} />
  </div>
}
