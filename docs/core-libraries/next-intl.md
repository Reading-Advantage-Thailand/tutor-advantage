# next-intl Documentation

## Overview

next-intl is our internationalization (i18n) solution for handling multiple languages (English and Thai) in the Tutor Advantage platform. This document outlines our implementation standards and best practices.

## Setup and Configuration

### 1. Installation

```bash
npm install next-intl
```

### 2. Basic Configuration

```typescript
// middleware.ts
import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  // A list of all locales that are supported
  locales: ["en", "th"],

  // Default locale when no locale matches
  defaultLocale: "en",

  // Domains can be used for language-specific domains
  domains: [
    {
      domain: "tutoradvantage.com",
      defaultLocale: "en",
    },
    {
      domain: "tutoradvantage.co.th",
      defaultLocale: "th",
    },
  ],
});

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Static files
  // - _next
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

### 3. Messages Structure

```typescript
// messages/en.json
{
  "common": {
    "welcome": "Welcome to Tutor Advantage",
    "login": "Log In",
    "signup": "Sign Up",
    "email": "Email",
    "password": "Password"
  },
  "navigation": {
    "home": "Home",
    "courses": "Courses",
    "tutors": "Tutors",
    "profile": "Profile"
  },
  "errors": {
    "required": "{field} is required",
    "invalidEmail": "Please enter a valid email address",
    "passwordLength": "Password must be at least 8 characters"
  }
}

// messages/th.json
{
  "common": {
    "welcome": "ยินดีต้อนรับสู่ Tutor Advantage",
    "login": "เข้าสู่ระบบ",
    "signup": "สมัครสมาชิก",
    "email": "อีเมล",
    "password": "รหัสผ่าน"
  },
  "navigation": {
    "home": "หน้าแรก",
    "courses": "คอร์สเรียน",
    "tutors": "ติวเตอร์",
    "profile": "โปรไฟล์"
  },
  "errors": {
    "required": "กรุณากรอก {field}",
    "invalidEmail": "กรุณากรอกอีเมลให้ถูกต้อง",
    "passwordLength": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
  }
}
```

## Implementation Patterns

### 1. Page Components

```typescript
// app/[locale]/page.tsx
import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("common");

  return (
    <div>
      <h1>{t("welcome")}</h1>
      <div className="flex gap-4">
        <button>{t("login")}</button>
        <button>{t("signup")}</button>
      </div>
    </div>
  );
}
```

### 2. Dynamic Translation Keys

```typescript
// components/FormField.tsx
import { useTranslations } from "next-intl";

interface FormFieldProps {
  name: string;
  required?: boolean;
  error?: string;
}

export function FormField({ name, required, error }: FormFieldProps) {
  const t = useTranslations();

  return (
    <div>
      <label>
        {t(`fields.${name}`)}
        {required && <span className="text-red-500">*</span>}
      </label>
      {error && (
        <p className="text-red-500">
          {t(`errors.${error}`, {
            field: t(`fields.${name}`),
          })}
        </p>
      )}
    </div>
  );
}
```

### 3. Date and Number Formatting

```typescript
// components/DateDisplay.tsx
import { useFormatter } from "next-intl";

interface DateDisplayProps {
  date: Date;
}

export function DateDisplay({ date }: DateDisplayProps) {
  const format = useFormatter();

  return (
    <time dateTime={date.toISOString()}>
      {format.dateTime(date, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
    </time>
  );
}

// components/PriceDisplay.tsx
export function PriceDisplay({ amount }: { amount: number }) {
  const format = useFormatter();

  return (
    <span>
      {format.number(amount, {
        style: "currency",
        currency: "THB",
      })}
    </span>
  );
}
```

### 4. Language Switcher

```typescript
// components/LanguageSwitcher.tsx
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next-intl/client";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const toggleLocale = () => {
    const newLocale = locale === "en" ? "th" : "en";
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <button onClick={toggleLocale} className="flex items-center gap-2">
      <span>{locale === "en" ? "🇬🇧" : "🇹🇭"}</span>
      <span>{locale === "en" ? "ภาษาไทย" : "English"}</span>
    </button>
  );
}
```

## Advanced Features

### 1. Rich Text Translation

```typescript
// lib/rich-text.tsx
import { useTranslations } from 'next-intl';
import { Fragment } from 'react';

export function RichText({ id, values }: { id: string; values?: any }) {
  const t = useTranslations();

  const content = t.rich(id, {
    b: (chunks) => <strong>{chunks}</strong>,
    i: (chunks) => <em>{chunks}</em>,
    link: (chunks) => <a href={values?.href}>{chunks}</a>,
    ...values
  });

  return <Fragment>{content}</Fragment>;
}

// Usage in messages
{
  "rich": {
    "welcome": "Welcome to <b>Tutor Advantage</b>. Start your <link>learning journey</link> today!"
  }
}
```

### 2. Pluralization

```typescript
// messages/en.json
{
  "lessons": {
    "count": {
      "one": "You have {count} lesson",
      "other": "You have {count} lessons"
    }
  }
}

// components/LessonCount.tsx
import { useTranslations } from 'next-intl';

export function LessonCount({ count }: { count: number }) {
  const t = useTranslations('lessons');

  return (
    <div>
      {t('count', { count })}
    </div>
  );
}
```

### 3. Message Namespacing

```typescript
// lib/createNamespacedTranslations.ts
import { useTranslations } from "next-intl";

export function createNamespacedTranslations(namespace: string) {
  return function useNamespacedTranslations() {
    return useTranslations(namespace);
  };
}

// Usage
const useAuthTranslations = createNamespacedTranslations("auth");
const useProfileTranslations = createNamespacedTranslations("profile");
```

## Best Practices

### 1. Type Safety

```typescript
// types/messages.ts
import { Messages } from "next-intl";

declare interface TranslationMessages extends Messages {
  common: {
    welcome: string;
    login: string;
    signup: string;
  };
  errors: {
    required: string;
    invalidEmail: string;
  };
}

// Usage with type checking
const t = useTranslations<TranslationMessages>();
const welcome = t("common.welcome"); // Type safe
```

### 2. Message Organization

```typescript
// Organize messages by feature
{
  "auth": {
    "login": {},
    "register": {},
    "passwordReset": {}
  },
  "courses": {
    "listing": {},
    "details": {},
    "enrollment": {}
  },
  "profile": {
    "settings": {},
    "progress": {}
  }
}
```

### 3. Error Handling

```typescript
// lib/translation-error-boundary.tsx
import { ErrorBoundary } from "react-error-boundary";

export function TranslationErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={<div>Translation Error</div>}
      onError={(error) => {
        console.error("Translation error:", error);
        // Log to error tracking service
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

## Testing

### 1. Component Testing

```typescript
// __tests__/components/Welcome.test.tsx
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";

describe("Welcome", () => {
  it("displays welcome message", () => {
    const { getByText } = render(
      <NextIntlClientProvider messages={messages} locale="en">
        <Welcome />
      </NextIntlClientProvider>
    );

    expect(getByText("Welcome to Tutor Advantage")).toBeInTheDocument();
  });
});
```

### 2. Message Coverage

```typescript
// scripts/check-translation-coverage.ts
import en from "../messages/en.json";
import th from "../messages/th.json";

function checkCoverage(source: any, target: any, path = ""): string[] {
  const missing: string[] = [];

  Object.keys(source).forEach((key) => {
    const currentPath = path ? `${path}.${key}` : key;

    if (!(key in target)) {
      missing.push(currentPath);
    } else if (
      typeof source[key] === "object" &&
      typeof target[key] === "object"
    ) {
      missing.push(...checkCoverage(source[key], target[key], currentPath));
    }
  });

  return missing;
}

const missingTranslations = checkCoverage(en, th);
console.log("Missing translations:", missingTranslations);
```

## Performance Considerations

### 1. Message Loading

```typescript
// app/[locale]/layout.tsx
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("title"),
    description: t("description"),
  };
}
```

### 2. Dynamic Loading

```typescript
// components/DynamicContent.tsx
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

const DynamicComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => {
    const t = useTranslations();
    return <div>{t("common.loading")}</div>;
  },
});
```

## Maintenance

### 1. Translation Management

- Use a translation management system (TMS)
- Implement a review process for translations
- Maintain a glossary for consistency
- Document context for translators

### 2. Version Control

- Track changes to translation files
- Use meaningful commit messages
- Review translation changes carefully
- Maintain backup of translations
