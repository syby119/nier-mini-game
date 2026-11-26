import { englishAdditional, englishCast, japaneseEnsemble, japaneseLeads, type VoiceCredit } from '@/features/credits/VoiceCredits'
import type { CSSProperties } from 'react'
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

// Heights and speed are in pixels in the 640 × 360 reference frame.
const rollHeight = sections.reduce((height, [, staff]) =>
  height + 29 + 19 * (1 + staff.length) + (staff.length ? 6 : 0), 0)
const rollStyle = { '--roll-period': (rollHeight / 48.3) + 's' } as CSSProperties

function StaffList({ repeated = false }: { repeated?: boolean }) {
  return <div className={styles.staff} aria-hidden={repeated || undefined}>
    {sections.map(([heading, staff]) => (
      <section className={styles.department} key={heading}>
        <h2><span data-ink={heading}>{heading}</span></h2>
        {staff.map(person => {
          if (typeof person === 'string') return <div className={styles.center} key={person}><span data-ink={person}>{person}</span></div>
          const [role, name] = person
          return <div className={styles.row} key={name}>
            <small data-ink={role}>{role}</small><span data-ink={name}>{name}</span>
          </div>
        })}
      </section>
    ))}
  </div>
}

export default function OpeningCredits({ frozen, noise }: { frozen: boolean; noise: boolean }) {
  return <div className={styles.field} data-noise={noise} data-frozen={frozen} style={rollStyle}>
    <div className={styles.roll}><div className={styles.repeat}>
      <StaffList /><StaffList repeated />
    </div></div>
  </div>
}
