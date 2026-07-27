export function useScopedI18n(scope: string) {
  return (key: string, params?: Record<string, any>) => {
    return key;
  };
}

export function useI18n() {
  return (key: string, params?: Record<string, any>) => {
    return key;
  };
}

export function useCurrentLocale() {
  return "th";
}
