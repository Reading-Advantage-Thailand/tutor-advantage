/**
 * Tutor design system + app shell. Import from "@/components/app".
 *
 * - Pages: <Page> → <PageHeader> → <Section>/<Grid>/<SplitLayout> blocks.
 * - Colours come from tokens in globals.css: bg-app, bg-surface, bg-surface-muted,
 *   border-hairline, text-fg / text-fg-muted / text-fg-subtle, text-brand-fg,
 *   bg-brand-solid, bg-brand-soft, {success|warning|danger|info}-{fg|bg|border},
 *   bg-tile-* / text-icon-*. Never hard-code emerald/indigo/violet… in app pages.
 * - Server-compatible: Page, PageHeader, Section, Surface/Card, ListGroup/ListRow,
 *   StatCard, DataTable, EmptyState, Notice, Chip/StatusChip, Skeletons, Atoms.
 * - Client-only: ErrorState, Fields, SegmentedControl, TabNav, Sheet, ConfirmDialog,
 *   Toaster/toast, ThemeToggle, shells and hooks.
 * Full reference: scratchpad/tutor-foundation-api.md · live gallery: /dev/ui-kit.
 */

// Shells
export { AppShell, type AppShellProps } from "./AppShell";
export { SIDEBAR_COOKIE, HELP_URL, fieldControlClass } from "./constants";
export { LessonShell, LessonBarActions, LessonDock, LessonContent, type LessonShellProps } from "./LessonShell";
export { ShellProvider, ShellTitle, useShell, useShellTitle, useTutor, type ShellUser } from "./ShellContext";
export { NotificationsProvider, useNotifications, NOTIFICATIONS_POLL_MS, type NotificationsSummary } from "./Notifications";
export { NotificationBell, CountBadge } from "./NotificationBell";
export { Dropdown, type DropdownProps, type DropdownPlacement } from "./Dropdown";
export { ThemeToggle } from "./ThemeToggle";
export { ThemeSegmented } from "./ThemeSegmented";
export { BrandMark } from "./SideNav";
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
  type SurfaceProps,
  type SurfaceTone,
  type CardHeaderProps,
  type ListGroupProps,
  type ListRowProps,
  type DescriptionItem,
} from "./Surface";
export { StatCard, type StatCardProps } from "./StatCard";
export { DataTable, type DataTableColumn, type DataTableProps } from "./DataTable";

// Atoms
export {
  Chip,
  StatusChip,
  statusTone,
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
