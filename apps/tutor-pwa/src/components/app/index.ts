/**
 * Tutor design system + app shell. Import from "@/components/app".
 *
 * - Pages: <Page> → <PageHeader> → <Section>/<Grid>/<SplitLayout> blocks.
 * - Colours come from tokens in globals.css (redesign 2026-11): bg-app, bg-surface,
 *   bg-surface-muted, border-clay-rim (every card), border-hairline, text-fg /
 *   text-fg-muted / text-fg-subtle, text-brand-fg, bg-brand-solid + text-on-brand
 *   (never text-white), bg-brand-soft + text-brand-soft-fg, {success|warning|danger|
 *   info}-{fg|bg|border}, bg-tile-* / text-icon-*, ink-* (wallet hero only),
 *   answer-* (presenter only). Never hard-code palette classes or hex in pages.
 * - Type roles: type-page / type-greet / type-hero-* (Kodchasan, titles and hero
 *   numbers only), type-section / type-card / type-body / type-label / type-caption /
 *   type-stat (Noto Sans Thai).
 * - Server-compatible: Page, PageHeader, Section, Surface/Card, ListGroup/ListRow,
 *   StatCard, StatStrip, WalletHero, NextClassCard, SessionList/SessionRow,
 *   DataTable, EmptyState, Notice, Chip/StatusChip, Skeletons, Atoms, BrandMark.
 * - Client-only: ErrorState, Fields, SegmentedControl, TabNav, Sheet, ConfirmDialog,
 *   Toaster/toast, ThemeToggle, shells and hooks.
 * Spec: docs/design/redesign-2026-11 · live gallery (light + dark): /dev/ui-kit.
 */

// Shells
export { AppShell, type AppShellProps } from "./AppShell";
export { SIDEBAR_COOKIE, HELP_URL, fieldControlClass } from "./constants";
export { LessonShell, LessonBarActions, LessonDock, LessonContent, useLessonExitGuard, type LessonShellProps } from "./LessonShell";
export {
  ShellProvider,
  ShellTitle,
  useShell,
  useShellTitle,
  useAppBarAction,
  useTutor,
  type ShellUser,
  type AppBarAction,
} from "./ShellContext";
export { NotificationsProvider, useNotifications, NOTIFICATIONS_POLL_MS, type NotificationsSummary } from "./Notifications";
export { NotificationBell, CountBadge } from "./NotificationBell";
export { Dropdown, type DropdownProps, type DropdownPlacement } from "./Dropdown";
export { ThemeToggle } from "./ThemeToggle";
export { ThemeSegmented } from "./ThemeSegmented";
export { BrandMark, TA_MARK_LETTERS_PATH, type BrandMarkProps } from "./BrandMark";
export { logout } from "./session";
export {
  NAV_ITEMS,
  TAB_ITEMS,
  MORE_ITEMS,
  NAV_GROUP_LABELS,
  isNavItemActive,
  getActiveNavItem,
  getBackHref,
  getDefaultTitle,
  isSectionRoot,
  type NavItem,
  type NavItemId,
} from "./navigation";

// Page structure
export {
  Page,
  PageHeader,
  Section,
  SectionHeader,
  Toolbar,
  Grid,
  SplitLayout,
  StickyActions,
  type PageProps,
  type PageWidth,
  type PageHeaderProps,
  type SectionProps,
  type SectionHeaderProps,
} from "./Page";

// Surfaces & lists
export {
  Surface,
  Card,
  CardHeader,
  ListGroup,
  ListRow,
  DescriptionList,
  cardTapClass,
  type SurfaceProps,
  type SurfaceTone,
  type CardHeaderProps,
  type ListGroupProps,
  type ListRowProps,
  type DescriptionItem,
} from "./Surface";
export { StatCard, type StatCardProps } from "./StatCard";
export {
  WalletHero,
  StatStrip,
  NextClassCard,
  SessionList,
  SessionRow,
  AvatarStack,
  type WalletHeroProps,
  type WalletHeroGoal,
  type StatStripItem,
  type NextClassCardProps,
  type SessionRowProps,
  type SessionTimeColumn,
} from "./Compositions";
export { DataTable, type DataTableColumn, type DataTableProps, type DataTableBreakpoint } from "./DataTable";

// Atoms
export {
  Chip,
  StatusChip,
  statusTone,
  LevelChip,
  Count,
  levelTone,
  levelIconClass,
  IconTile,
  UserAvatar,
  getInitials,
  Spinner,
  ProgressBar,
  clampPercent,
  tileToneClass,
  toneToTile,
  type Tone,
  type TileTone,
  type ChipProps,
  type StatusChipProps,
  type LevelChipProps,
  type IconTileProps,
  type UserAvatarProps,
  type ProgressBarProps,
} from "./Atoms";

// Feedback & loading
export { EmptyState, Notice, type EmptyStateProps, type NoticeProps, type NoticeTone } from "./Feedback";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export {
  Skeleton,
  SkeletonText,
  PageHeaderSkeleton,
  StatGridSkeleton,
  ListSkeleton,
  TableSkeleton,
  CardSkeleton,
  PageSkeleton,
  LoadingAnnouncement,
} from "./Skeletons";
export { toast, Toaster, dismissToast, type ToastTone } from "./Toast";

// Controls
export {
  SegmentedControl,
  TabNav,
  type SegmentedControlProps,
  type SegmentedItem,
  type TabNavItem,
  type TabNavOption,
  type TabNavProps,
} from "./Segmented";
export {
  Field,
  TextField,
  TextAreaField,
  SelectField,
  SearchField,
  type FieldProps,
  type TextFieldProps,
  type TextAreaFieldProps,
  type SelectFieldProps,
  type SelectOption,
  type SearchFieldProps,
} from "./Fields";

// Overlays
export { Sheet, BottomSheet, type SheetProps } from "./Sheet";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
