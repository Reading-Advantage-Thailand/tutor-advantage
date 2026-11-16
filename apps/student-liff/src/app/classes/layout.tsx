// The bottom TabBar is rendered once by the root layout and shows only on
// /classes itself (not on /classes/[id]), so this layout no longer needs to
// be a client component.
//
// `.page-content` adds the tablet gutter from 640px; the sticky AppBar, the
// class hero and the BottomActionBar of /classes/[id] still span the app
// column (globals.css breaks them out of the gutter).
export default function ClassesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
    </div>
  );
}
