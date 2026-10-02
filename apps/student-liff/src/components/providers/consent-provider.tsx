"use client";

import dynamic from "next/dynamic";

/**
 * The PDPA gate UI is only downloaded when this student has not accepted the
 * terms yet; everyone else gets a pass-through provider with no extra JS.
 */
const ConsentGate = dynamic(() => import("./ConsentGate"), {
  ssr: false,
  loading: () => <ConsentGateFallback />,
});

interface ConsentProviderProps {
  children: React.ReactNode;
  /** From the root layout: the student accepted TERMS_AND_PRIVACY (or there is no session). */
  hasConsent: boolean;
}

/** Renders the app when consent is granted, otherwise only the full-screen consent gate. */
export function ConsentProvider({ children, hasConsent }: ConsentProviderProps) {
  if (hasConsent) {
    return <>{children}</>;
  }
  return <ConsentGate />;
}

/** Opaque placeholder with the gate's shape while its chunk loads (no spinner). */
function ConsentGateFallback() {
  return (
    <div aria-busy="true" className="fixed inset-0 z-[var(--z-consent)] flex flex-col bg-app">
      <div className="h-[calc(var(--appbar-h)+var(--safe-top))] shrink-0 bg-surface" />
      <div className="flex flex-col items-center px-4 pt-6">
        <div className="skeleton-block size-16 rounded-full" />
        <div className="skeleton-block mt-5 h-5 w-3/4 rounded-full" />
        <div className="skeleton-block mt-3 h-4 w-2/3 rounded-full" />
        <div className="skeleton-block mt-6 h-48 w-full rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
