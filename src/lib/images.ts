import hero from '../assets/img/hero.webp'
import cinema from '../assets/img/cinema.webp'
import music from '../assets/img/music.webp'
import football from '../assets/img/football.webp'
import general from '../assets/img/general.webp'
import ramadan from '../assets/img/ramadan.webp'
import comedy from '../assets/img/comedy.webp'
import ancient from '../assets/img/ancient.webp'
import street from '../assets/img/street.webp'
import travel from '../assets/img/travel.webp'
import childhood from '../assets/img/childhood.webp'
import alex from '../assets/img/alex.webp'
import crafts from '../assets/img/crafts.webp'
import coins from '../assets/img/coins.webp'
import flow from '../assets/img/flow.webp'
import contact from '../assets/img/contact.webp'
import herowide from '../assets/img/herowide.webp'
import fq1 from '../assets/img/fq1.webp'
import fq2 from '../assets/img/fq2.webp'
import fq3 from '../assets/img/fq3.webp'
import fq4 from '../assets/img/fq4.webp'
import fq5 from '../assets/img/fq5.webp'
import fq6 from '../assets/img/fq6.webp'
import badge from '../assets/logo/badge.png'
import plaque from '../assets/logo/plaque.png'
import wordmark from '../assets/logo/wordmark.png'
import square from '../assets/logo/square.png'
import script from '../assets/logo/script.png'
import bubble from '../assets/logo/bubble.png'
import divider from '../assets/logo/divider.png'
import boardMusic from '../assets/board/music.png'
import boardCrafts from '../assets/board/crafts.png'
import boardRamadan from '../assets/board/ramadan.png'
import boardFootball from '../assets/board/football.png'
import boardComedy from '../assets/board/comedy.png'
import boardTravel from '../assets/board/travel.png'
import boardAncient from '../assets/board/ancient.png'
import boardAlex from '../assets/board/alex.png'
import boardGeneral from '../assets/board/general.png'
import boardStreet from '../assets/board/street.png'
import boardChildhood from '../assets/board/childhood.png'

export const PHOTO: Record<string, string> = {
  person: `${import.meta.env.BASE_URL}game-modes/person.webp`,
  color: `${import.meta.env.BASE_URL}game-modes/color.webp`,
  riddle: `${import.meta.env.BASE_URL}game-modes/riddle.webp`,
  voice: `${import.meta.env.BASE_URL}game-modes/voice.webp`,
  memory: `${import.meta.env.BASE_URL}game-modes/memory.webp`,
  hero,
  cinema,
  music,
  football,
  general,
  ramadan,
  comedy,
  ancient,
  street,
  travel,
  childhood,
  alex,
  crafts,
  coins,
  flow,
  contact,
  herowide,
}
export const LOGO = { badge, plaque, wordmark, square, script, bubble, divider }

// Full-resolution landscape artwork supplied for the question board.
export const BOARD_PHOTO: Readonly<Record<string, string>> = {
  music: boardMusic,
  crafts: boardCrafts,
  ramadan: boardRamadan,
  football: boardFootball,
  comedy: boardComedy,
  travel: boardTravel,
  ancient: boardAncient,
  alex: boardAlex,
  general: boardGeneral,
  street: boardStreet,
  childhood: boardChildhood,
}

// Hide only the outer white canvas in the display viewport. Keep the original
// files intact, with a small margin around the complete decorative frame.
export const BOARD_IMAGE_PADDING: Readonly<
  Partial<Record<string, { top: number; bottom: number }>>
> = {
  alex: { top: 131, bottom: 126 },
  general: { top: 118, bottom: 90 },
  street: { top: 130, bottom: 125 },
  childhood: { top: 130, bottom: 85 },
}

// Football question photos, by question row. pos = focal point for the cropped (mobile) frame.
import qph from '../assets/img/qph.webp'

export const QUESTION_PLACEHOLDER = { src: qph, pos: '50% 38%' }

export const FOOTBALL_Q = [
  { src: fq1, pos: '50% 38%' },
  { src: fq2, pos: '50% 30%' },
  { src: fq3, pos: '50% 62%' },
  { src: fq4, pos: '50% 55%' },
  { src: fq5, pos: '60% 40%' },
  { src: fq6, pos: '50% 45%' },
]
