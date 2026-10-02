// The bottom TabBar is rendered once by the root layout and shows only on
// /classes itself (not on /classes/[id]), so this layout no longer needs to
// be a client component.
//
// No `.page-content` wrapper: at ≥640px it adds `padding-inline: 24px
// !important` (globals.css), which insets the sticky AppBar/BottomActionBar of
// /classes/[id] from the column edges. <Screen> already provides the gutter.
export default function ClassesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
