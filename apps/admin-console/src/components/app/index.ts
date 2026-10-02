/**
 * Admin design system + app shell. Import from "@/components/app".
 *
 * - Pages: <Page> → <PageHeader> → <Section>/<Grid>/<SplitLayout>; tables with
 *   <FilterBar> + <DataTable> + <Pagination> driven by useTableState().
 * - Colours come from tokens in globals.css: bg-app, bg-surface, bg-surface-muted,
 *   border-hairline, text-fg / text-fg-muted / text-fg-subtle, text-brand-fg,
 *   bg-brand-solid, bg-brand-soft, {success|warning|danger|info}-{fg|bg|border},
 *   bg-tile-* / text-icon-*. Never hard-code emerald/indigo/blue/amber… in pages.
 * - Server-compatible: Page, PageHeader, Section, Surface/Card, ListGroup/ListRow,
 *   StatCard, EmptyState, Notice, Chip/StatusChip/AdminStatusChip, Money, Skeletons, Atoms.
 * - Client-only: DataTable, Pagination, ColumnToggle, FilterBar, IdCell/CopyButton,
 *   ErrorState, Fields, SegmentedControl, TabNav, Sheet, ConfirmDialog, toast, shell hooks.
 * Full reference: scratchpad/admin-foundation-api.md · live gallery: /dev/ui-kit.
 */

// Shell
export { AdminShell, type AdminShellProps } from "./AdminShell";
export { SIDEBAR_COOKIE, ADMIN_SUMMARY_POLL_MS, fieldControlClass } from "./constants";
export {
  ShellProvider,
  ShellTitle,
  useShell,
  useShellTitle,
  useAdminSession,
  useHasRole,
  type AdminShellUser,
} from "./ShellContext";
export {
  AdminSummaryProvider,
  useAdminOverview,
  useWorkQueues,
  useRefreshAdminSummary,
  overviewKey,
  EMPTY_QUEUES,
  type AdminOverview,
} from "./AdminSummary";
export { Dropdown, type DropdownProps, type DropdownPlacement } from "./Dropdown";
export { ThemeToggle } from "./ThemeToggle";
export { ThemeSegmented } from "./ThemeSegmented";
export { BrandMark } from "./SideNav";
export { EnvBadge } from "./EnvBadge";
export { CountBadge } from "./CountBadge";
export { logout } from "./session";
export {
  NAV_ITEMS,
  NAV_GROUP_LABELS,
  navItemsFor,
  tabItemsFor,
  isNavItemActive,
  getActiveNavItem,
  getBackHref,
  getDefaultTitle,
  isSectionRoot,
  type NavItem,
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

// Tables
export { DataTable, type DataTableColumn, type DataTableProps, type DataTableSelection } from "./DataTable";
export { Pagination, type PaginationProps } from "./Pagination";
export { ColumnToggle, useColumnVisibility } from "./ColumnToggle";
export { FilterBar, type FilterBarProps } from "./FilterBar";
export { IdCell, CopyButton } from "./IdCell";
export { Money } from "./Money";

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
export { AdminStatusChip, type AdminStatusChipProps } from "./AdminStatusChip";

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
export { Toaster } from "./Toast";
export { toast, dismissToast, type ToastTone } from "./toastStore";

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
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmReasonOptions } from "./ConfirmDialog";
