// Plain (non-React) language state so data helpers such as toAr() can read it.
export type Lang = 'ar' | 'en'

export const LANG_KEY = 'sahsah.lang'

const read = (): Lang => {
  try {
    return globalThis.localStorage?.getItem(LANG_KEY) === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

let current: Lang = read()

export const currentLang = () => current
export const setCurrentLang = (lang: Lang) => {
  current = lang
}
