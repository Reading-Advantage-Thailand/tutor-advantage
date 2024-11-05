# Tailwind CSS Documentation

## Overview

Tailwind CSS is our utility-first CSS framework for styling the Tutor Advantage platform. This document outlines our theming configuration, component patterns, and best practices.

## Configuration

### 1. Theme Configuration

```typescript
// tailwind.config.ts
import { type Config } from 'tailwindcss';

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Thai', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
```

### 2. CSS Variables

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;

    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;

    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
```

## Component Patterns

### 1. Layout Components

```typescript
// components/Container.tsx
export function Container({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("container mx-auto px-4 sm:px-6 lg:px-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// components/Grid.tsx
export function Grid({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

### 2. Typography Components

```typescript
// components/Typography.tsx
const variants = {
  h1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
  h2: "scroll-m-20 text-3xl font-semibold tracking-tight",
  h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
  p: "leading-7 [&:not(:first-child)]:mt-6",
  blockquote: "mt-6 border-l-2 pl-6 italic",
  list: "my-6 ml-6 list-disc [&>li]:mt-2",
};

export function Typography({
  variant = "p",
  children,
  className,
  ...props
}: {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
}) {
  const Component = variant;

  return (
    <Component className={cn(variants[variant], className)} {...props}>
      {children}
    </Component>
  );
}
```

### 3. Card Components

```typescript
// components/Card.tsx
export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

Card.Header = function CardHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props}>
      {children}
    </div>
  );
};

Card.Content = function CardContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6 pt-0", className)} {...props}>
      {children}
    </div>
  );
};
```

## Utility Patterns

### 1. Responsive Design

```typescript
// components/ResponsiveContainer.tsx
export function ResponsiveContainer({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Base styles
        "w-full p-4",
        // Responsive padding
        "sm:p-6 md:p-8 lg:p-10",
        // Responsive width
        "max-w-[90rem] mx-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

### 2. Spacing System

```typescript
// components/Stack.tsx
export function Stack({
  children,
  className,
  space = "4",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  space?: "2" | "4" | "6" | "8";
}) {
  return (
    <div
      className={cn(
        "flex flex-col",
        {
          "space-y-2": space === "2",
          "space-y-4": space === "4",
          "space-y-6": space === "6",
          "space-y-8": space === "8",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

## Best Practices

### 1. Class Organization

```typescript
// Recommended class order
const classOrder = {
  layout: "flex flex-col items-center",
  spacing: "gap-4 p-6",
  typography: "text-lg font-semibold",
  colors: "bg-primary text-white",
  borders: "rounded-lg border",
  effects: "shadow-md hover:shadow-lg",
  states: "hover:bg-primary-dark focus:ring-2",
  responsive: "sm:flex-row md:gap-6 lg:p-8",
};

// Example usage
<div
  className={cn(
    // Layout
    "flex flex-col items-center",
    // Spacing
    "gap-4 p-6",
    // Typography
    "text-lg font-semibold",
    // Colors
    "bg-primary text-white",
    // Borders
    "rounded-lg border",
    // Effects
    "shadow-md hover:shadow-lg",
    // States
    "hover:bg-primary-dark focus:ring-2",
    // Responsive
    "sm:flex-row md:gap-6 lg:p-8"
  )}
>
  {children}
</div>;
```

### 2. Custom Utilities

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<div className={cn("base-class", condition && "conditional-class", className)}>
  {children}
</div>;
```

## Dark Mode Support

### 1. Dark Mode Toggle

```typescript
// components/ThemeToggle.tsx
"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className={cn(
        "rounded-lg p-2",
        "bg-secondary hover:bg-secondary/80",
        "dark:bg-secondary-dark dark:hover:bg-secondary-dark/80"
      )}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
```

### 2. Dark Mode Classes

```typescript
// Example dark mode styles
const darkModeExample = {
  card: cn(
    // Light mode
    'bg-white text-gray-900',
    // Dark mode
    'dark:bg-gray-800 dark:text-gray-100'
  ),
  button: cn(
    // Light mode
    'bg-primary text-white',
    // Dark mode
    'dark:bg-primary-dark dark:text-gray-100'
  ),
};
```

## Performance Optimization

### 1. Purging Unused Styles

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production'
      ? {
          '@fullhuman/postcss-purgecss': {
            content: ['./pages/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
            defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
          },
        }
      : {}),
  },
};
```

### 2. Dynamic Classes

```typescript
// Avoid dynamic class names
// ❌ Bad
<div className={`text-${size}`}>

// ✅ Good
<div className={cn({
  'text-sm': size === 'small',
  'text-base': size === 'medium',
  'text-lg': size === 'large',
})}>
```

## Accessibility

### 1. Focus Styles

```typescript
// components/Button.tsx
export function Button({ children, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        // Base styles
        "px-4 py-2 rounded-lg",
        // Focus styles
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        // Dark mode focus styles
        "dark:focus:ring-primary-dark dark:focus:ring-offset-gray-900",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

### 2. Color Contrast

```typescript
// Ensure sufficient color contrast
const accessibleColors = {
  text: {
    primary: 'text-gray-900 dark:text-gray-100', // 16:1 contrast
    secondary: 'text-gray-700 dark:text-gray-300', // 7:1 contrast
    muted: 'text-gray-500 dark:text-gray-400', // 4.5:1 contrast
  },
};
```

## Responsive Design

### 1. Breakpoint System

```typescript
// Consistent breakpoint usage
const breakpoints = {
  sm: "640px",   // Small devices
  md: "768px",   // Medium devices
  lg: "1024px",  // Large devices
  xl: "1280px",  // Extra large devices
  "2xl": "1536px" // 2X Extra large devices
};

// Usage
<div className="
  // Mobile first
  grid grid-cols-1
  // Tablet
  sm:grid-cols-2
  // Desktop
  lg:grid-cols-3
  // Large desktop
  xl:grid-cols-4
">
```

### 2. Container Queries

```typescript
// components/ContainerQuery.tsx
export function ContainerQuery({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Base styles
        "w-full",
        // Container query classes
        "@container",
        className
      )}
      {...props}
    >
      <div
        className="
        // Container-based responsive design
        @[400px]:grid-cols-2
        @[600px]:grid-cols-3
        @[800px]:grid-cols-4
      "
      >
        {children}
      </div>
    </div>
  );
}
```
