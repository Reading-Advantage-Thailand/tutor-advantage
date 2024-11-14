import { createLocalizedPathnamesNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "th", "zh"],
  defaultLocale: "en",
  pathnames: {
    "/": "/",

    "/login": {
      en: "/login",
      th: "/login",
      zh: "/login",
    },
    "/about": {
      en: "/about",
      th: "/about",
      zh: "/about",
    },
  },
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];

export const { locales, defaultLocale, pathnames } = routing;

export const { Link, getPathname, redirect, usePathname, useRouter } =
  createLocalizedPathnamesNavigation(routing);
