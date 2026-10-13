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

export const PHOTO: Record<string, string> = { hero, cinema, music, football, general, ramadan, comedy, ancient, street, travel, childhood, alex, crafts, coins, flow, contact, herowide }
export const LOGO = { badge, plaque, wordmark, square, script, bubble, divider }

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
