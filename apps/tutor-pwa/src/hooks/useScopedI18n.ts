import { useScopedI18n as useScopedI18nImpl } from '@/locales/client'

export function useScopedI18n(scope: string) {
  return useScopedI18nImpl(scope)
}
