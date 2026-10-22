// Client presentations run without a server unless service mode is requested.
export const DEMO_MODE = import.meta.env?.VITE_DEMO_MODE !== 'false'
export const UI_STORAGE_KEY = DEMO_MODE ? 'sahsah.demo.ui.v1' : 'sahsah.v1'
