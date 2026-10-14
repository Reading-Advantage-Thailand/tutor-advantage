import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /** @deprecated Ignored: pages no longer animate in (calmer, and no client JS). */
  variant?: "slide-up" | "fade" | "scale";
  /** @deprecated Ignored. */
  stagger?: boolean;
}

/**
 * @deprecated Plain wrapper kept so unmigrated pages compile. It used to be a
 * client component that animated every page in (and staggered children);
 * the tutor design system drops page-entrance motion. Migrated pages should
 * use <Page> from "@/components/app" instead.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  return <div className={cn(className)}>{children}</div>;
}

/** @deprecated Plain wrapper (no stagger animation any more). */
export function StaggerGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(className)}>{children}</div>;
}
