import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, Locale } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  if (!routing.locales.includes(locale as Locale)) notFound();

  // Import all message files for the locale
  const [common, header, home, about, login] = await Promise.all([
    import(`../../messages/${locale}/common.json`),
    import(`../../messages/${locale}/header.json`),
    import(`../../messages/${locale}/home.json`),
    import(`../../messages/${locale}/about.json`),
    import(`../../messages/${locale}/login.json`)
  ]);

  // Merge all messages
  const messages = {
    ...common.default,
    ...header.default,
    ...home.default,
    ...about.default,
    ...login.default
  };

  return {
    messages,
  };
});
