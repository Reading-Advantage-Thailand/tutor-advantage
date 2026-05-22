"use client";

import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /** Animation type: 'slide-up' | 'fade' | 'scale' */
  variant?: "slide-up" | "fade" | "scale";
  /** Enable staggered animation for children */
  stagger?: boolean;
}

/**
 * Page transition wrapper that adds entrance animations.
 * Uses CSS animations from globals.css — no Framer Motion needed.
 *
 * Usage:
 * ```tsx
 * <PageTransition stagger>
 *   <StatCard />
 *   <StatCard />
 *   <Chart />
 * </PageTransition>
 * ```
 */
export function PageTransition({
  children,
  className,
  variant = "slide-up",
  stagger = false,
}: PageTransitionProps) {
  const animationClass = {
    "slide-up": "animate-slide-up",
    fade: "animate-fade-in",
    scale: "animate-scale-in",
  }[variant];

  return (
    <div
      className={cn(
        animationClass,
        stagger && "stagger",
        className
      )}
    >
      {children}
    </div>
  );
}

interface StaggerGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper for staggered child animations.
 * Each direct child will animate in with increasing delay.
 */
export function StaggerGroup({ children, className }: StaggerGroupProps) {
  return (
    <div className={cn("stagger", className)}>
      {children}
    </div>
  );
}
