import { useCurrentLocale as useCurrentLocaleImpl } from '@/locales/client'

export function useCurrentLocale() {
  return useCurrentLocaleImpl()
}
