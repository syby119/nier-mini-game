// Approximate entrances in seconds from each group in the Ending E shooting sequence.
// The opening staff roll uses the same role and performer spellings.
export type VoiceCredit = [time: number, role: string, performer: string]

export const japaneseLeads: VoiceCredit[] = [
  [0, '2B', 'Yui Ishikawa'],
  [0.4, '9S', 'Natsuki Hanae'],
  [0.8, 'A2', 'Ayaka Suwa'],
]

export const japaneseEnsemble: VoiceCredit[] = [
  [0, 'Eve', 'Tatsuhisa Suzuki'],
  [0.3, 'Adam', 'Daisuke Namikawa'],
  [1, 'Commander', 'Chiaki Kanou'],
  [4.4, 'Pod 042', 'Hiroki Yasumoto'],
  [5.2, 'Pod 153', 'Kaoru Akiyama'],
  [6.6, 'Emil', 'Mai Kadowaki'],
  [8.4, 'Pascal', 'Aoi Yuki'],
  [9.7, 'Devola / Popola', 'Ryoko Shiraishi'],
  [10.4, 'Terminal α / Terminal β', 'Jouji Nakata'],
  [11.5, 'Anemone, Operator 21O', 'Mary Hatsumi'],
  [13.2, 'Operator 6O', 'Keiko Isobe'],
  [14.1, 'Simone, Jackass', 'Kaori Kawabuchi'],
  [15, 'Announcement, Resource Recovery Unit', 'Ruka Endo'],
  [16.2, 'Additional Voices', 'Katsuyuki Yamazaki'],
  [16.9, '', 'Yuka Nagayoshi'],
  [17.2, '', 'Saori Okamoto'],
  [17.5, '', 'Yu Seki'],
  [17.9, '', 'Kenichi Hoshino'],
  [18.2, '', 'Takuya Inagaki'],
  [18.5, '', 'Saki Yonemoto'],
  [18.8, '', 'Tomohiro Fujitaka'],
  [19.2, '', 'Aki Nagao'],
]

export const englishCast: VoiceCredit[] = [
  [3.3, '2B', 'Kira Buckland'],
  [3.7, '9S', 'Kyle McCarley'],
  [4, 'A2', 'Cherami Leigh'],
  [5.5, 'Adam', 'Greg Chun'],
  [6.5, 'Eve', 'Ray Chase'],
  [7, 'Pod 042', 'DC Douglas'],
  [7.8, 'Pod 153', 'Abby Trott'],
  [10.1, 'Emil', 'Julie Ann Taylor'],
  [11, 'Pascal', 'Alexis Tipton'],
  [11.8, 'Devola / Popola', 'Claudia Lenz'],
  [12.7, 'Terminal α / Terminal β', 'Darin De Paul'],
  [14, 'Anemone', 'Erica Lindbeck'],
  [15.1, 'Operator 6O', 'Cassandra Lee Morris'],
  [16.4, 'Operator 21O', 'Connor Kelly'],
  [18, 'Simone', 'Erin Fitzgerald'],
  [18.6, 'Jackass', 'Amanda Miller'],
]

export const englishAdditional: VoiceCredit[] = [
  [0, 'Additional Voices', 'Robbie Daymond'],
  [0.6, '', 'Ben Diskin'],
  [1.1, '', 'Kyle Hebert'],
  [2, '', 'David Keefir'],
  [2.4, '', 'Carrie Keranen'],
  [3, '', 'Lauren Landa'],
  [3.6, '', 'Wendee Lee'],
  [4.1, '', 'Julie Maddalena'],
  [4.7, '', 'Matt Mercer'],
  [5.4, '', 'Max Mittelman'],
  [6.2, '', 'Russell Nash'],
  [6.6, '', 'Bryce Papenbrook'],
  [7, '', 'Nicolas Roye'],
  [7.5, '', 'Michelle Ruff'],
  [8, '', 'Tara Sands'],
  [8.6, '', 'Rena Strober'],
  [9.1, '', 'Sarah Ann Williams'],
]
