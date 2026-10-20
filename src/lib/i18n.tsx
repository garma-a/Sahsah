import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { currentLang, LANG_KEY, setCurrentLang, type Lang } from './lang'

// Two formats: Arabic (RTL) and "English" written in Franco-Arabic (LTR, Latin script only).
type Ctx = { lang: Lang; setLang: (lang: Lang) => void }
const C = createContext<Ctx>({ lang: 'ar', setLang: () => {} })

const apply = (lang: Lang) => {
  document.documentElement.lang = lang === 'ar' ? 'ar' : 'en'
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}
if (typeof document !== 'undefined') apply(currentLang())

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(currentLang)
  setCurrentLang(lang)
  useLayoutEffect(() => {
    apply(lang)
  }, [lang])
  const setLang = useCallback((next: Lang) => {
    setCurrentLang(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      /* Private mode: the choice lasts for this visit only. */
    }
    setState(next)
  }, [])
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useLang() {
  const { lang, setLang } = useContext(C)
  const ar = lang === 'ar'
  // t('عربي', 'Franco') — inline pairs keep each string next to its translation.
  const t = useCallback((arabic: string, franco: string) => (ar ? arabic : franco), [ar])
  return { lang, setLang, ar, t, dir: (ar ? 'rtl' : 'ltr') as 'rtl' | 'ltr' }
}
