/**
 * Mobile design system for the student LINE mini-app.
 *
 * Import from "@/components/mobile". Conventions:
 * - Screens: <Screen> → <AppBar back …> (pushed) or <PageHeader> (tab root)
 *   → content in a `px-4` container → optional <BottomActionBar> last.
 * - Primitives assume the 16px page gutter (HScroll / non-inset ListGroup
 *   bleed out of it with -mx-4). From 640px `.page-content` adds
 *   --page-inset (24px) on top; globals.css widens the HScroll bleed to match.
 * - Colour utilities from globals.css tokens (redesign 2026-11): bg-app (paper),
 *   bg-surface, bg-surface-muted, border-clay-rim (every card), border-hairline,
 *   text-fg / text-fg-muted / text-fg-subtle, text-brand-fg, bg-brand-solid +
 *   text-on-brand (never a raw white text class), bg-brand-soft + text-brand-soft-fg,
 *   bg-accent-solid + text-on-accent (rewards only), {success|warning|danger|info}-{fg|bg|border},
 *   bg-tile-*, text-icon-*, bg-press, bg-fill-muted, bg-track; helpers `pressable`, `clay-press`.
 * - Type: font-heading = Kodchasan (titles, buttons, chips; never under 14px,
 *   never list rows or ticking numbers), font-sans = Noto Sans Thai Looped.
 * - The BottomSheet drawer code is lazy-loaded; everything else is light.
 */

// Shell / navigation
export { AppBar, type AppBarProps, type AppBarVariant } from "./AppBar";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { Screen, type ScreenProps } from "./Screen";
export { useBackNavigation } from "./useBackNavigation";
export {
  TAB_ROOTS,
  type TabRoot,
  isTabRootPath,
  getActiveTab,
  canGoBackInApp,
  decideBackAction,
} from "./navigation";

// Lists & sections
export {
  ListGroup,
  ListRow,
  ListRowSkeleton,
  type ListGroupProps,
  type ListRowProps,
  type ListRowSkeletonProps,
} from "./List";
export { SectionHeader, type SectionHeaderProps, type SectionHeaderAction } from "./SectionHeader";
export { Surface, type SurfaceProps, type SurfaceTone } from "./Surface";
export { ToneHero, HeroOverlap, classLevelTone, type ToneHeroProps } from "./Hero";

// Visual atoms
export { IconTile, iconTileToneClass, type IconTileProps, type IconTileTone, type IconTileSize } from "./IconTile";
export { IconButton, type IconButtonProps, type IconButtonVariant } from "./IconButton";
export {
  Chip,
  FilterChip,
  HScroll,
  type ChipProps,
  type ChipTone,
  type FilterChipProps,
  type HScrollProps,
} from "./Chip";
export { LevelChip, type LevelChipProps } from "./LevelChip";
export { UserAvatar, type UserAvatarProps, type UserAvatarSize } from "./UserAvatar";
export { getInitials, getAvatarTone, AVATAR_TONES, type AvatarTone } from "./avatarInitials";
export { Spinner, type SpinnerProps } from "./Spinner";
export { ProgressBar, clampPercent, type ProgressBarProps, type ProgressBarTone } from "./ProgressBar";

// Inputs & controls
export {
  TextField,
  TextArea,
  SearchField,
  type TextFieldProps,
  type TextAreaProps,
  type SearchFieldProps,
} from "./Fields";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedControlItem,
} from "./SegmentedControl";
export { Switch, SwitchRow, type SwitchProps, type SwitchRowProps } from "./Switch";

// Overlays
export { BottomSheet, ConfirmSheet, type BottomSheetProps, type ConfirmSheetProps } from "./BottomSheet";

// Feedback & states
export {
  EmptyState,
  ErrorState,
  StatusScreen,
  Notice,
  StatTile,
  StatStrip,
  BottomActionBar,
  type EmptyStateProps,
  type ErrorStateProps,
  type StatusScreenProps,
  type NoticeProps,
  type NoticeTone,
  type StatTileProps,
  type StatStripProps,
  type StatStripItem,
  type BottomActionBarProps,
} from "./Feedback";
export { OfflineBanner, useOnlineStatus } from "./OfflineBanner";

// Loading
export { Skeleton } from "@/components/ui/skeleton";
export {
  SkeletonText,
  CardSkeleton,
  LoadingAnnouncement,
  type SkeletonTextProps,
  type CardSkeletonProps,
} from "./Skeletons";
