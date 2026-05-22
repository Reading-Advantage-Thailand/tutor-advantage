"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { t } from "@/lib/i18n";

interface ThemeToggleProps {
  className?: string;
  size?: number;
}

export function ThemeToggle({ className = "", size = 22 }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? t("app.lightMode") : t("app.darkMode")}
      className={`theme-toggle-btn ${className}`}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "1.5px solid var(--surface-border)",
        background: "var(--surface-card)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.25s ease",
        flexShrink: 0,
        WebkitTapHighlightColor: "transparent",
        color: "var(--neutral-700)",
      }}
    >
      {isDark ? (
        // Sun icon
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "#f59e0b" }}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon icon
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--neutral-600)" }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
