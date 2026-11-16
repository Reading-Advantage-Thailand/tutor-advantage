"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CircleCheck,
  Download,
  FilePenLine,
  GraduationCap,
  History,
  Inbox,
  MoreHorizontal,
  Plus,
  Presentation,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  AdminStatusChip,
  Breadcrumb,
  BrandMark,
  Chip,
  ColumnToggle,
  ConfirmDialog,
  CountBadge,
  DataTable,
  DescriptionList,
  Dropdown,
  EmptyState,
  EnvBadge,
  ErrorState,
  FilterBar,
  IconTile,
  IdCell,
  IdentityCell,
  KpiStrip,
  ListGroup,
  ListRow,
  ListSkeleton,
  Money,
  Notice,
  NotificationBell,
  Page,
  PageHeader,
  Pagination,
  ProgressBar,
  SearchField,
  Section,
  SegmentedControl,
  SelectField,
  Sheet,
  Spinner,
  StatCard,
  StatGridSkeleton,
  Surface,
  CardHeader,
  TabNav,
  TableSkeleton,
  TextAreaField,
  TextField,
  ThemeSegmented,
  ThemeToggle,
  ToastCard,
  UserAvatar,
  toast,
  useColumnVisibility,
  type DataTableColumn,
  type TileTone,
  type Tone,
} from "@/components/app";
import { NavList } from "@/components/app/SideNav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as UiCard, CardContent, CardDescription, CardHeader as UiCardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatThaiDate, formatThaiDateTime } from "@/lib/format";
import { ADMIN_STATUS, type StatusDomain } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { SweepInventory } from "./sweepInventory";

/* ─── Real fixtures (local seed users, README §5 item 13) ─────────────── */

/** 60 characters: the long-email stress case (truncation + title). */
const LONG_EMAIL = "local-2ae4f32e-1d0c-46fe-8c98-9e1ba88c80ae@mail.example.test";
const LONG_THAI_NAME = "ปุณณ์ชนิดา ศรีสวัสดิ์วงศ์";
const CLASS_NAME = "English · Primary Origins 2 (A0)";

type Person = {
  id: string;
  name: string;
  email: string | null;
  role: "TUTOR" | "STUDENT";
  docs: { tone: Tone; label: string } | null;
  account: { tone: Tone; label: string };
  classes: number;
  joined: string;
};

const ACTIVE = { tone: "success" as Tone, label: "ใช้งานอยู่" };
const NO_GUARDIAN = { tone: "warning" as Tone, label: "ยังไม่มีผู้ปกครองยืนยัน" };
const NO_EMAIL = "ไม่มีอีเมล (สมัครผ่าน LINE)";

const PEOPLE: Person[] = [
  { id: "5eed0000-0000-4000-8000-000000000101", name: "T.นกเอี้ยง", email: "t.nokeiang@example.com", role: "TUTOR", docs: { tone: "neutral", label: "ยังไม่ส่งเอกสาร" }, account: ACTIVE, classes: 1, joined: "2026-11-02" },
  { id: "5eed0000-0000-4000-8000-000000000102", name: "Passport Sim Tutor", email: "passport-sim-tutor@local.test", role: "TUTOR", docs: { tone: "warning", label: "รอตรวจสอบ 1 รายการ" }, account: ACTIVE, classes: 0, joined: "2026-10-16" },
  { id: "5eed0000-0000-4000-8000-000000000103", name: "Dev Tutor", email: "dev-tutor@localhost", role: "TUTOR", docs: { tone: "neutral", label: "ยังไม่ส่งเอกสาร" }, account: ACTIVE, classes: 0, joined: "2026-10-02" },
  { id: "5eed0000-0000-4000-8000-000000000104", name: "Reedy Sim Student", email: "reedy-sim-student@local.test", role: "STUDENT", docs: NO_GUARDIAN, account: ACTIVE, classes: 2, joined: "2026-09-30" },
  { id: "5eed0000-0000-4000-8000-000000000105", name: "Dev Student", email: "dev-student@localhost", role: "STUDENT", docs: NO_GUARDIAN, account: ACTIVE, classes: 2, joined: "2026-09-29" },
  { id: "5eed0000-0000-4000-8000-000000000106", name: "Local Student 008", email: null, role: "STUDENT", docs: NO_GUARDIAN, account: ACTIVE, classes: 2, joined: "2026-09-15" },
  { id: "5eed0000-0000-4000-8000-000000000107", name: "Local Student 039", email: null, role: "STUDENT", docs: null, account: { tone: "neutral", label: "ระงับชั่วคราว" }, classes: 1, joined: "2026-09-13" },
  { id: "5eed0000-0000-4000-8000-000000000108", name: LONG_THAI_NAME, email: null, role: "STUDENT", docs: null, account: ACTIVE, classes: 1, joined: "2026-09-06" },
  { id: "5eed0000-0000-4000-8000-000000000109", name: "Local Admin 020", email: "local-admin-020@local.test", role: "TUTOR", docs: null, account: ACTIVE, classes: 1, joined: "2026-08-23" },
  { id: "5eed0000-0000-4000-8000-000000000110", name: "Local Tutor 010", email: LONG_EMAIL, role: "TUTOR", docs: { tone: "danger", label: "เอกสารหมดอายุ" }, account: ACTIVE, classes: 1, joined: "2026-08-03" },
];

const ACTIVITY = [
  { id: "a0000000-0000-4000-8000-000000000201", action: "นักเรียนใช้โค้ดส่วนลด", context: "โค้ดส่วนลดคลาส", actor: "Dev Student", at: "2026-11-02T09:14:00+07:00" },
  { id: "a0000000-0000-4000-8000-000000000202", action: "ออกโค้ดส่วนลดคลาส", context: "โค้ดส่วนลดคลาส", actor: "Local Admin 020", at: "2026-11-02T08:40:00+07:00" },
  { id: "a0000000-0000-4000-8000-000000000203", action: "สร้างคลาสให้ครู", context: CLASS_NAME, actor: "Local Admin 020", at: "2026-11-02T08:12:00+07:00" },
  { id: "a0000000-0000-4000-8000-000000000204", action: "แก้ไขบัญชีรับเงิน Omise", context: "Passport Sim Tutor", actor: "Local Admin 020", at: "2026-10-16T15:02:00+07:00" },
];

/* ─── Layout helpers ──────────────────────────────────────────────────── */

const SECTIONS = [
  { id: "tokens", title: "สีและโทเคน" },
  { id: "type", title: "ตัวอักษร" },
  { id: "brand", title: "โลโก้ ป้ายสภาพแวดล้อม และตัวนับ" },
  { id: "shell", title: "แถบบนและเมนูข้าง" },
  { id: "buttons", title: "ปุ่ม" },
  { id: "status", title: "ป้ายสถานะ" },
  { id: "kpi", title: "แถบตัวเลขสำคัญ" },
  { id: "cards", title: "การ์ด รายการ และอะตอม" },
  { id: "table", title: "ตารางข้อมูล" },
  { id: "forms", title: "ฟอร์มและตัวควบคุม" },
  { id: "feedback", title: "การแจ้งเตือนและสถานะว่าง" },
  { id: "loading", title: "สถานะกำลังโหลด" },
  { id: "overlays", title: "หน้าต่าง เมนู และ Toast" },
  { id: "sweep", title: "รายการตรวจการย้ายสี" },
] as const;

function Block({ id, title, only, children }: { id: string; title: string; only?: string; children: ReactNode }) {
  if (only && only !== id) return null;
  return (
    <Section id={id} title={title}>
      {children}
    </Section>
  );
}

/**
 * Alias tokens (shadcn names, retired names, composite shadows) are declared
 * once on :root as var(--semantic-token). A custom property is resolved on the
 * element that declares it, so a nested .dark pane would inherit the light
 * results. Re-declaring them on the pane resolves them against the pane's own
 * tokens; in the app .dark sits on <html> itself, so this is gallery-only.
 */
const PANE_ALIASES = {
  "--background": "var(--surface-bg)",
  "--foreground": "var(--text-primary)",
  "--card": "var(--surface-card)",
  "--card-foreground": "var(--text-primary)",
  "--popover": "var(--surface-elevated)",
  "--popover-foreground": "var(--text-primary)",
  "--primary": "var(--brand-solid)",
  "--primary-foreground": "var(--on-brand)",
  "--secondary": "var(--surface-muted)",
  "--secondary-foreground": "var(--text-primary)",
  "--muted": "var(--surface-muted)",
  "--muted-foreground": "var(--text-secondary)",
  "--accent": "var(--surface-muted)",
  "--accent-foreground": "var(--text-primary)",
  "--destructive": "var(--danger-solid)",
  "--destructive-foreground": "var(--on-danger)",
  "--border": "var(--hairline)",
  "--input": "var(--field-border)",
  "--ring": "var(--focus-ring)",
  "--sidebar": "var(--surface-sidebar)",
  "--gradient-brand": "linear-gradient(var(--brand-solid), var(--brand-solid))",
  "--hero-bg": "linear-gradient(var(--hero-bg-base), var(--hero-bg-base))",
  "--shadow-tap": "var(--shadow-card)",
  "--nav-glass-bg": "var(--surface-nav)",
  "--nav-glass-border": "var(--hairline)",
  "--nav-active-bg": "var(--brand-soft)",
} as CSSProperties;

/**
 * Renders a demo twice: a light pane (.theme-light re-applies the light
 * tokens) and a dark pane (.dark). Side by side from 1280px unless `stack`.
 */
function ThemePair({ children, stack }: { children: (theme: "light" | "dark") => ReactNode; stack?: boolean }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3", !stack && "xl:grid-cols-2")}>
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          data-theme-pane={theme}
          style={PANE_ALIASES}
          className={cn(theme === "light" ? "theme-light" : "dark", "min-w-0 rounded-(--radius-card) border border-clay-rim bg-app p-4 text-fg")}
        >
          <p className="mb-3 text-xs font-semibold text-fg-subtle">{theme === "light" ? "ธีมสว่าง" : "ธีมมืด"}</p>
          {children(theme)}
        </div>
      ))}
    </div>
  );
}

function Swatch({ token, label }: { token: string; label?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="size-8 shrink-0 rounded-(--radius-ctl) border border-hairline" style={{ background: `var(--${token})` }} />
      <code className="truncate text-xs text-fg-muted">{label ?? token}</code>
    </div>
  );
}

const SWATCHES = [
  "surface-bg", "surface-card", "surface-muted", "surface-elevated", "surface-sidebar", "clay-rim",
  "hairline", "field-border", "text-primary", "text-secondary", "text-tertiary", "track",
  "brand-solid", "brand-solid-pressed", "brand-soft", "brand-fg", "brand-vivid", "logo-bg",
  "success-bg", "success-fg", "warning-bg", "warning-fg", "danger-bg", "danger-fg",
  "danger-solid", "info-bg", "info-fg", "neutral-bg", "accent-solid", "accent-fg",
  "row-hover", "row-selected", "focus-ring", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
];

const TILE_TONES: TileTone[] = ["brand", "teal", "blue", "amber", "orange", "purple", "pink", "red", "neutral"];

/* ─── Shell ───────────────────────────────────────────────────────────── */

function ShellDemo({ theme }: { theme: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-14 items-center gap-2 rounded-(--radius-ctl) border border-hairline bg-app pr-3 pl-5">
        <Breadcrumb crumbs={[{ label: "การเงิน" }, { label: "ภาพรวม" }]} className="flex-1" />
        <ThemeToggle />
        <NotificationBell id={`bell-${theme}`} />
      </div>
      <div className="flex h-14 items-center gap-2 rounded-(--radius-ctl) border border-hairline bg-app pr-3 pl-5">
        <Breadcrumb
          crumbs={[{ label: "ผู้ใช้และความเสี่ยง" }, { label: "ผู้ใช้งาน", href: "/users" }, { label: "Passport Sim Tutor" }]}
          className="flex-1"
        />
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <div className="@container w-62 rounded-(--radius-ctl) border border-hairline bg-surface-sidebar py-3">
          <div className="flex items-center gap-2.5 px-4 pb-3">
            <BrandMark />
            <span className="min-w-0">
              <span className="block text-[0.9375rem] leading-snug font-semibold whitespace-nowrap">Tutor Advantage</span>
              <span className="block text-xs text-fg-muted">คอนโซลผู้ดูแลระบบ</span>
            </span>
          </div>
          <div className="px-3 pb-1.5">
            <EnvBadge environment="development" block />
          </div>
          <div className="px-3">
            <NavList pathname="/users" />
          </div>
        </div>
        <div className="@container w-18 rounded-(--radius-ctl) border border-hairline bg-surface-sidebar py-3">
          <div className="flex justify-center pb-3">
            <BrandMark />
          </div>
          <div className="px-3 pb-1.5">
            <EnvBadge environment="development" block />
          </div>
          <div className="px-3">
            <NavList pathname="/" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Table ───────────────────────────────────────────────────────────── */

function RoleCell({ role }: { role: Person["role"] }) {
  const Icon = role === "TUTOR" ? Presentation : GraduationCap;
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-muted">
      <Icon aria-hidden="true" className="size-4" />
      {role === "TUTOR" ? "ครู" : "นักเรียน"}
    </span>
  );
}

function UsersTableDemo({ theme }: { theme: "light" | "dark" }) {
  const [tab, setTab] = useState<"all" | "tutor" | "student" | "review">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const columns: DataTableColumn<Person>[] = useMemo(
    () => [
      {
        key: "user",
        header: "ผู้ใช้",
        sortable: true,
        alwaysVisible: true,
        mobile: "primary",
        cell: (p) => <IdentityCell name={p.name} seed={p.id} secondary={p.email ?? NO_EMAIL} />,
      },
      { key: "role", header: "บทบาท", cell: (p) => <RoleCell role={p.role} />, mobile: "secondary" },
      {
        key: "docs",
        header: "เอกสารยืนยันตัวตน",
        cell: (p) => (p.docs ? <Chip tone={p.docs.tone} dot>{p.docs.label}</Chip> : <span className="text-fg-subtle">ไม่ต้องยืนยัน</span>),
        mobile: "hidden",
      },
      { key: "account", header: "บัญชี", cell: (p) => <Chip tone={p.account.tone} dot>{p.account.label}</Chip>, mobile: "trailing" },
      { key: "classes", header: "คลาส", align: "right", cell: (p) => p.classes, mobile: "hidden" },
      { key: "joined", header: "สมัครเมื่อ", sortable: true, cell: (p) => formatThaiDate(p.joined), mobile: "hidden" },
    ],
    [],
  );
  const visibility = useColumnVisibility("ui-kit-users", columns);
  const rows = PEOPLE.filter(
    (p) =>
      (tab === "all" || (tab === "tutor" && p.role === "TUTOR") || (tab === "student" && p.role === "STUDENT") || (tab === "review" && p.docs?.tone === "warning")) &&
      (!q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.email ?? "").includes(q)),
  );
  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        tabs={
          <SegmentedControl
            aria-label="กรองตามบทบาท"
            value={tab}
            onValueChange={setTab}
            items={[
              { value: "all", label: "ทั้งหมด", count: 41 },
              { value: "tutor", label: "ติวเตอร์", count: 12 },
              { value: "student", label: "นักเรียน", count: 29 },
              { value: "review", label: "รอตรวจเอกสาร", count: 1 },
            ]}
          />
        }
        search={{ value: q, onValueChange: setQ, placeholder: "ค้นหาชื่อ อีเมล หรือรหัสผู้ใช้", label: "ค้นหาผู้ใช้" }}
        isFiltered={Boolean(q) || tab !== "all"}
        onReset={() => {
          setQ("");
          setTab("all");
        }}
        actions={<ColumnToggle id={`ui-kit-columns-${theme}`} columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />}
      >
        <SelectField
          aria-label="สถานะเอกสาร"
          containerClassName="w-full sm:w-40"
          defaultValue=""
          options={[
            { value: "", label: "ทุกสถานะเอกสาร" },
            { value: "review", label: "รอตรวจสอบ" },
          ]}
        />
        <SelectField
          aria-label="สถานะบัญชี"
          containerClassName="w-full sm:w-40"
          defaultValue=""
          options={[
            { value: "", label: "ทุกสถานะบัญชี" },
            { value: "active", label: "ใช้งานอยู่" },
          ]}
        />
      </FilterBar>
      <DataTable
        caption="รายชื่อผู้ใช้งาน (ตัวอย่าง)"
        rows={rows}
        columns={columns}
        getRowKey={(p) => p.id}
        rowHref={() => "#table"}
        activeRowKey={PEOPLE[1].id}
        sort={{ key: "joined", dir: "desc" }}
        onSortChange={() => toast.info("ตัวอย่าง: การเรียงลำดับทำที่เซิร์ฟเวอร์")}
        hiddenColumns={visibility.hidden}
        empty={<EmptyState compact as="h3" icon={Search} title="ไม่พบผู้ใช้" description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />}
        footer={<Pagination page={page} pageSize={pageSize} total={41} onPageChange={setPage} onPageSizeChange={setPageSize} />}
      />
    </div>
  );
}

function AuditTableDemo() {
  const [selected, setSelected] = useState<Set<string>>(new Set([ACTIVITY[0].id]));
  const columns: DataTableColumn<(typeof ACTIVITY)[number]>[] = [
    { key: "at", header: "เวลา", cell: (a) => <span className="tabular">{formatThaiDateTime(a.at)}</span>, mobile: "secondary" },
    { key: "action", header: "การกระทำ", cell: (a) => a.action, mobile: "primary" },
    { key: "context", header: "รายการ", cell: (a) => <span className="block max-w-64 truncate" title={a.context}>{a.context}</span> },
    { key: "actor", header: "ผู้ทำ", cell: (a) => a.actor },
    { key: "id", header: "รหัสอ้างอิง", cell: (a) => <IdCell id={a.id} /> },
  ];
  return (
    <DataTable
      caption="ประวัติกิจกรรม (ตัวอย่าง ตารางแถวเดี่ยว 40px)"
      density="compact"
      rows={ACTIVITY}
      columns={columns}
      getRowKey={(a) => a.id}
      selection={{ selected, onChange: setSelected }}
      bulkActions={(count) => (
        <Button size="sm" variant="outline" onClick={() => toast.success(`ส่งออก ${count} รายการ`)}>
          <Download aria-hidden="true" /> ส่งออกที่เลือก
        </Button>
      )}
    />
  );
}

/**
 * A "จัดการ" row menu in a table cell: Dropdown strategy="fixed" escapes the
 * table's scroller and card clip (lower rows flip their menu above).
 */
function RowMenuTableDemo({ theme }: { theme: "light" | "dark" }) {
  const columns: DataTableColumn<(typeof ACTIVITY)[number]>[] = [
    { key: "action", header: "การกระทำ", cell: (a) => a.action, mobile: "primary" },
    { key: "actor", header: "ผู้ทำ", cell: (a) => a.actor, mobile: "secondary" },
    { key: "at", header: "เวลา", cell: (a) => <span className="tabular">{formatThaiDateTime(a.at)}</span> },
    {
      key: "menu",
      header: <span className="sr-only">จัดการ</span>,
      label: "จัดการ",
      align: "right",
      mobile: "actions",
      cell: (a) => (
        <Dropdown
          id={`ui-kit-row-menu-${theme}-${a.id}`}
          strategy="fixed"
          label={`จัดการ ${a.action}`}
          panelClassName="w-52"
          className="inline-block"
          trigger={({ triggerProps }) => (
            <Button size="icon-sm" variant="ghost" aria-label={`จัดการ ${a.action}`} title="จัดการ" {...triggerProps}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          )}
        >
          {(close) => (
            <div className="flex flex-col p-1.5">
              {["ดูรายละเอียด", "คัดลอกรหัสอ้างอิง"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    close();
                    toast.success(label);
                  }}
                  className="flex min-h-10 items-center rounded-(--radius-ctl-sm) px-2.5 text-left text-sm text-fg hover:bg-press pointer-coarse:min-h-11"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      ),
    },
  ];
  return <DataTable caption="เมนูจัดการในแถว (ตัวอย่าง)" density="compact" rows={ACTIVITY} columns={columns} getRowKey={(a) => a.id} />;
}

/* ─── Overlays ────────────────────────────────────────────────────────── */

function StaticSheet({ title, description, children, footer, width = 400, side }: { title: string; description?: string; children: ReactNode; footer: ReactNode; width?: number; side?: boolean }) {
  return (
    <div
      className="sheet-popup max-h-none"
      style={{ "--sheet-width": `${width}px`, ...(side ? { borderRadius: "var(--radius-card) 0 0 var(--radius-card)" } : null) } as CSSProperties}
      data-has-footer=""
    >
      <div className="sheet-handle" aria-hidden="true" />
      <div className="flex shrink-0 items-start gap-2 pt-2 pr-3 pb-3 pl-5 md:pt-4">
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-lg leading-[1.45] font-semibold text-fg">{title}</p>
          {description ? <p className="mt-1 text-sm leading-[1.6] text-fg-muted">{description}</p> : null}
        </div>
        <Button variant="ghost" size="icon" aria-label="ปิด (ตัวอย่าง)">
          <X aria-hidden="true" className="size-5" />
        </Button>
      </div>
      <div className="sheet-body">{children}</div>
      <div className="sheet-footer">{footer}</div>
    </div>
  );
}

function OverlaysLive() {
  const [sheet, setSheet] = useState<"none" | "form" | "detail">("none");
  const [confirm, setConfirm] = useState<"none" | "brand" | "danger" | "fail">("none");
  const person = PEOPLE[1];
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setSheet("form")}>
        เปิด Sheet (ฟอร์ม)
      </Button>
      <Button variant="outline" onClick={() => setSheet("detail")}>
        เปิด Sheet ด้านขวา (รายละเอียด)
      </Button>
      <Button onClick={() => setConfirm("brand")}>ยืนยันทั่วไป</Button>
      <Button variant="danger" onClick={() => setConfirm("danger")}>
        ยืนยันการโอนเงิน (พิมพ์ + เหตุผล)
      </Button>
      <Button variant="destructive" onClick={() => setConfirm("fail")}>
        ยืนยันที่ล้มเหลว
      </Button>
      <Button variant="ghost" onClick={() => toast.success("บันทึกแล้ว")}>
        Toast สำเร็จ
      </Button>
      <Button variant="ghost" onClick={() => toast.error("บันทึกไม่สำเร็จ", { description: "เซิร์ฟเวอร์ไม่ตอบสนอง" })}>
        Toast ผิดพลาด
      </Button>

      <Sheet
        open={sheet === "form"}
        onOpenChange={(open) => !open && setSheet("none")}
        title="สร้างคูปองชั่วโมงสอน"
        description="คูปองใช้ได้ครั้งเดียว"
        width={480}
        footer={
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <Button variant="outline" onClick={() => setSheet("none")}>
              ยกเลิก
            </Button>
            <Button onClick={() => setSheet("none")}>สร้างคูปอง</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="จำนวนชั่วโมง" inputMode="numeric" required endAddon="ชม." />
          <TextAreaField label="หมายเหตุ" optional />
        </div>
      </Sheet>
      <Sheet
        open={sheet === "detail"}
        onOpenChange={(open) => !open && setSheet("none")}
        side="right"
        title={person.name}
        description="ครู · สมัครเมื่อ 16 ต.ค. 2569"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="warning" dot>
              รอตรวจสอบ 1 รายการ
            </Chip>
            <Chip tone="success" dot>
              ใช้งานอยู่
            </Chip>
          </div>
          <DescriptionList
            items={[
              { label: "อีเมล", value: person.email },
              { label: "รหัสผู้ใช้", value: <IdCell id={person.id} /> },
              { label: "คลาส", value: "0" },
              { label: "ยอดสะสมเดือนนี้", value: <Money baht={0} /> },
            ]}
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirm === "brand"}
        onOpenChange={(open) => !open && setConfirm("none")}
        title="ส่งรอบจ่ายเงิน สิงหาคม 2569 ให้ตรวจสอบ?"
        description="ผู้ตรวจสอบการเงินจะได้รับแจ้งเพื่ออนุมัติ"
        confirmLabel="ส่งตรวจสอบ"
        onConfirm={() => new Promise((resolve) => setTimeout(resolve, 800))}
      />
      <ConfirmDialog
        open={confirm === "danger"}
        onOpenChange={(open) => !open && setConfirm("none")}
        tone="danger"
        title="โอนเงินให้ครู 12 ราย?"
        description="ระบบจะสั่งโอนผ่าน Omise ทันทีหลังยืนยัน"
        irreversible
        details={
          <DescriptionList
            columns={2}
            items={[
              { label: "รอบเดือน", value: "สิงหาคม 2569" },
              { label: "ยอดรวม", value: <Money satang={4_512_000} /> },
            ]}
          />
        }
        requireText="2026-08"
        reason
        confirmLabel="ยืนยันการโอน"
        onConfirm={() => new Promise<void>((resolve) => setTimeout(resolve, 800))}
      />
      <ConfirmDialog
        open={confirm === "fail"}
        onOpenChange={(open) => !open && setConfirm("none")}
        tone="danger"
        title="ระงับบัญชีผู้ใช้?"
        confirmLabel="ระงับบัญชี"
        reason={{ minLength: 3 }}
        onConfirm={() => Promise.reject(new Error("คุณไม่มีสิทธิ์ทำรายการนี้"))}
      />
    </div>
  );
}

/* ─── Sweep inventory ─────────────────────────────────────────────────── */

// Built from parts so this gallery does not count itself in the inventory.
const TW = ["text", "white"].join("-");
const PALETTE_EXAMPLE = ["bg", "emerald", "600"].join("-");

function SweepCount({ value }: { value: number }) {
  return <span className={cn("tabular", value > 0 ? "font-semibold text-danger-fg" : "text-fg-subtle")}>{value}</span>;
}

function SweepDemo({ inventory }: { inventory: SweepInventory | null }) {
  if (!inventory) return <Notice tone="info">เปิด /dev/ui-kit (ไม่ระบุ section) หรือ ?section=sweep เพื่อสร้างรายการ</Notice>;
  return (
    <div className="flex flex-col gap-4">
      <Notice tone="info" title="สร้างจากซอร์สโค้ดทุกครั้งที่เปิดหน้านี้">
        นับ {TW}, คลาสสีดิบของ Tailwind (เช่น {PALETTE_EXAMPLE}) และค่าสี hex ในแต่ละเส้นทาง (ไม่รวมโฟลเดอร์เกมและไฟล์ทดสอบ)
        เส้นทางที่ทั้งสามค่าเป็นศูนย์ถือว่าย้ายเสร็จแล้ว
      </Notice>
      <Surface padding="none" className="overflow-hidden">
        <table className="data-table" data-density="compact">
          <caption className="sr-only">ไฟล์ที่เคยใช้ {TW} บนพื้นสีแบรนด์ (README §5 ข้อ 4)</caption>
          <thead>
            <tr>
              <th scope="col">ไฟล์ (README §5 ข้อ 4)</th>
              <th scope="col" className="text-right">{TW}</th>
              <th scope="col">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {inventory.brandFiles.map((file) => (
              <tr key={file.file}>
                <td>
                  <code className="text-[0.8125rem]">{file.file}</code>
                </td>
                <td className="text-right">
                  <SweepCount value={file.textWhite} />
                </td>
                <td>{file.textWhite ? <Chip tone="warning" dot>ยังเหลือ</Chip> : <Chip tone="success" dot>ย้ายแล้ว</Chip>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
      <Surface padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" data-density="compact">
            <caption className="sr-only">รายการตรวจการย้ายสีแยกตามเส้นทาง</caption>
            <thead>
              <tr>
                <th scope="col">เส้นทาง</th>
                <th scope="col" className="text-right">ไฟล์</th>
                <th scope="col" className="text-right">{TW}</th>
                <th scope="col" className="text-right">คลาสสีดิบ</th>
                <th scope="col" className="text-right">hex</th>
                <th scope="col">สถานะ</th>
                <th scope="col">ไฟล์ที่ยังเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {inventory.routes.map((route) => {
                const clean = route.textWhite + route.palette + route.hex === 0;
                return (
                  <tr key={route.route}>
                    <td>
                      <code className="text-[0.8125rem]">{route.route}</code>
                    </td>
                    <td className="text-right tabular">{route.files}</td>
                    <td className="text-right">
                      <SweepCount value={route.textWhite} />
                    </td>
                    <td className="text-right">
                      <SweepCount value={route.palette} />
                    </td>
                    <td className="text-right">
                      <SweepCount value={route.hex} />
                    </td>
                    <td>{clean ? <Chip tone="success" dot>ย้ายแล้ว</Chip> : <Chip tone="warning" dot>ยังเหลือ</Chip>}</td>
                    <td className="text-[0.8125rem] text-fg-muted">
                      {route.offenders.map((file) => (
                        <span key={file.file} className="block">
                          <code>{file.file}</code>
                          {` · hex ${file.hex} · สีดิบ ${file.palette} · ${TW} ${file.textWhite}`}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="font-semibold">รวม</td>
                <td className="text-right tabular">{inventory.totals.files}</td>
                <td className="text-right">
                  <SweepCount value={inventory.totals.textWhite} />
                </td>
                <td className="text-right">
                  <SweepCount value={inventory.totals.palette} />
                </td>
                <td className="text-right">
                  <SweepCount value={inventory.totals.hex} />
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Surface>
      <p className="text-[0.8125rem] text-fg-muted">
        hex ที่เหลือเป็นข้อยกเว้นที่ตั้งใจ: โลโก้ Google ในหน้าเข้าสู่ระบบ (สีของแบรนด์ Google), theme-color ของเบราว์เซอร์ใน layout
        และหน้า global-error ซึ่งแสดงโดยไม่มี CSS ของแอป
      </p>
    </div>
  );
}

/* ─── Gallery ─────────────────────────────────────────────────────────── */

export function UiKitGallery({ only, inventory = null }: { only?: string; inventory?: SweepInventory | null }) {
  const [segment, setSegment] = useState<"month" | "last" | "custom">("month");
  const [checked, setChecked] = useState(true);
  const domains = Object.keys(ADMIN_STATUS) as StatusDomain[];
  return (
    <Page>
      <PageHeader
        title="ชุดคอมโพเนนต์ผู้ดูแลระบบ"
        description="คอมโพเนนต์กลางของคอนโซลหลังปรับดีไซน์ 2026-11 ทุกชิ้นแสดงทั้งธีมสว่างและธีมมืด ด้วยข้อมูลจริงจากชุดข้อมูลทดสอบ"
        actions={
          <>
            <ThemeSegmented />
            <Button>
              <Plus aria-hidden="true" /> ปุ่มหลัก
            </Button>
          </>
        }
      />
      {!only ? (
        <nav aria-label="หมวด" className="flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex h-8 items-center justify-center rounded-(--radius-chip) border border-clay-rim bg-surface px-3 text-[0.8125rem] font-medium text-fg-muted hover:text-fg pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              {s.title}
            </a>
          ))}
        </nav>
      ) : null}

      <Block id="tokens" title="สีและโทเคน" only={only}>
        <ThemePair>
          {() => (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
              {SWATCHES.map((token) => (
                <Swatch key={token} token={token} />
              ))}
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="type" title="ตัวอักษร" only={only}>
        <ThemePair>
          {() => (
            <div className="flex flex-col gap-2.5">
              <p className="text-2xl leading-[1.35] font-semibold">หัวข้อหน้า Noto 600 24 · ผู้ใช้งาน</p>
              <p className="text-base leading-normal font-semibold">หัวข้อส่วน 600 16 · งานที่รอดำเนินการ</p>
              <p className="text-sm">เนื้อหา 400 14: ผู้ตรวจสอบการเงินอนุมัติรอบจ่ายเงินเดือนสิงหาคม 2569 แล้ว</p>
              <p className="text-[0.8125rem] text-fg-muted">ข้อความรอง 13 · {LONG_THAI_NAME} · {CLASS_NAME}</p>
              <p className="text-[0.8125rem] font-semibold text-fg-muted">หัวตาราง 600 13 · สมัครเมื่อ</p>
              <p className="text-sm tabular">ตัวเลขตาราง 14 tabular · ฿1,234,567.89 · 1111 / 0000</p>
              <p className="text-2xl leading-[1.3] font-semibold tabular">ตัวเลข KPI 600 24 · ฿3,000</p>
              <p className="text-xs text-fg-subtle">คำอธิบาย 12 · อัปเดต 12:22 น.</p>
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="brand" title="โลโก้ ป้ายสภาพแวดล้อม และตัวนับ" only={only}>
        <ThemePair>
          {() => (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <BrandMark />
                <BrandMark size={48} />
                <span className="flex items-center gap-2.5">
                  <BrandMark />
                  <span>
                    <span className="block text-[0.9375rem] leading-snug font-semibold">Tutor Advantage</span>
                    <span className="block text-xs text-fg-muted">คอนโซลผู้ดูแลระบบ</span>
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <EnvBadge environment="development" />
                <EnvBadge environment="staging" />
                <span className="text-xs text-fg-subtle">(ระบบจริงไม่แสดงป้าย)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CountBadge count={2} />
                <CountBadge count={41} tone="neutral" />
                <CountBadge count={7} tone="brand" />
                <CountBadge count={120} />
              </div>
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="shell" title="แถบบนและเมนูข้าง" only={only}>
        <ThemePair stack>{(theme) => <ShellDemo theme={theme} />}</ThemePair>
      </Block>

      <Block id="buttons" title="ปุ่ม" only={only}>
        <ThemePair>
          {() => (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button>บันทึก</Button>
                <Button variant="outline">
                  <Download aria-hidden="true" /> ส่งออก CSV
                </Button>
                <Button variant="tonal">เริ่มตรวจ</Button>
                <Button variant="ghost">ดูทั้งหมด</Button>
                <Button variant="link">ลิงก์</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="danger">ยืนยันการโอน</Button>
                <Button variant="destructive">ปฏิเสธ</Button>
                <Button loading>กำลังบันทึก</Button>
                <Button disabled>ปิดใช้งาน</Button>
                <Button variant="outline" size="icon" aria-label="รีเฟรชข้อมูล">
                  <RefreshCw />
                </Button>
                <Button variant="ghost" size="icon" aria-label="ปิด">
                  <X />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="xs">xs 28</Button>
                <Button size="sm">sm 32</Button>
                <Button>default 36</Button>
                <Button size="lg">lg 40</Button>
                <Button size="xl">xl 48</Button>
              </div>
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="status" title="ป้ายสถานะ" only={only}>
        <ThemePair>
          {() => (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="success" dot>ใช้งานอยู่</Chip>
                <Chip tone="warning" dot>รอตรวจสอบ 1 รายการ</Chip>
                <Chip tone="danger" dot>เอกสารหมดอายุ</Chip>
                <Chip tone="info" dot>กำลังสอน</Chip>
                <Chip tone="neutral" dot>ระงับชั่วคราว</Chip>
                <Chip tone="brand" dot>ใหม่</Chip>
                <Chip tone="success" icon={CircleCheck}>ไม่มีงานค้าง</Chip>
                <Chip tone="warning" size="sm" dot>size sm</Chip>
                <span className="self-center text-sm text-fg-subtle">ไม่ต้องยืนยัน</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge>Badge</Badge>
                <Badge variant="warning">warning</Badge>
                <Badge variant="danger">danger</Badge>
                <Badge variant="outline">outline</Badge>
                <Badge variant="solid">solid</Badge>
              </div>
              <Separator />
              {domains.map((domain) => (
                <div key={domain} className="flex flex-col gap-1.5 md:flex-row md:items-start md:gap-3">
                  <code className="w-36 shrink-0 pt-0.5 text-xs text-fg-muted">{domain}</code>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(ADMIN_STATUS[domain]).map((status) => (
                      <AdminStatusChip key={status} domain={domain} status={status} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="kpi" title="แถบตัวเลขสำคัญ" only={only}>
        <ThemePair stack>
          {() => (
            <div className="flex flex-col gap-3">
              <KpiStrip aria-label="ตัวเลขสำคัญ">
                <StatCard label="ยอดโอนรออนุมัติ" value="฿0" icon={Wallet} tone="brand" hint="ไม่มีรอบจ่ายรออนุมัติ" />
                <StatCard
                  label="ยอดชำระสำเร็จ 30 วัน"
                  value="฿3,000"
                  icon={CircleCheck}
                  tone="teal"
                  hint="1 รายการ · PromptPay 1 · บัตร 0"
                  bar={[{ value: 100, tone: "chart-1" }]}
                  barLabel="PromptPay 100% บัตร 0%"
                />
                <StatCard
                  label="ความเสี่ยงสูง/วิกฤต"
                  value="1"
                  icon={ShieldAlert}
                  tone="red"
                  hint="จากเคสเปิดทั้งหมด 2 เคส"
                  risk
                  bar={[{ value: 50 }]}
                  barLabel="1 จาก 2 เคส"
                />
                <StatCard label="รอบจ่ายที่สร้าง 30 วัน" value="0" icon={ReceiptText} tone="blue" hint="รวมทุกสถานะ" />
              </KpiStrip>
              <KpiStrip aria-label="ตัวอย่างลิงก์และการเปลี่ยนแปลง" columns={3}>
                <StatCard label="รอตรวจเอกสาร" value="1" icon={UserCheck} tone="teal" href="#kpi" actionLabel="ดูรายการ" />
                <StatCard
                  label="ยอดจ่ายเดือนนี้"
                  value={<Money satang={45_120_000} />}
                  icon={Wallet}
                  tone="brand"
                  delta={{ value: "+12%", direction: "up" }}
                  hint="เทียบเดือนก่อน"
                  bar={[
                    { value: 72, tone: "chart-1" },
                    { value: 28, tone: "chart-2" },
                  ]}
                  barLabel="PromptPay 72% บัตร 28%"
                />
                <StatCard label="นักเรียนในคลาส" value="29" icon={GraduationCap} tone="purple" hint={CLASS_NAME} />
              </KpiStrip>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatCard label="การ์ดเดี่ยว" value="฿3,000" icon={Wallet} hint="StatCard นอกแถบ" />
                <StatCard label="ความเสี่ยงเปิดอยู่" value="4" icon={ShieldAlert} tone="red" risk delta={{ value: "-1", direction: "down", positive: true }} />
              </div>
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="cards" title="การ์ด รายการ และอะตอม" only={only}>
        <ThemePair>
          {() => (
            <div className="flex flex-col gap-4">
              <ListGroup header="งานที่รอดำเนินการ" headerAction={<span className="text-[0.8125rem] text-fg-muted">7 รายการใน 4 คิว</span>}>
                <ListRow
                  href="#cards"
                  leading={<IconTile icon={ReceiptText} tone="neutral" size="sm" />}
                  title="รอบจ่ายรออนุมัติ"
                  subtitle="ตรวจยอดและอนุมัติโอนเงินครู"
                  trailing={<Chip tone="success" icon={CircleCheck}>ไม่มีงานค้าง</Chip>}
                />
                <ListRow
                  href="#cards"
                  selected
                  leading={<IconTile icon={UserCheck} tone="teal" size="sm" />}
                  title="ยืนยันตัวตน"
                  subtitle="รอตั้งแต่ 16 ต.ค."
                  trailing={<Chip tone="warning" dot>1 รายการ</Chip>}
                />
                <ListRow
                  href="#cards"
                  leading={<IconTile icon={AlertTriangle} tone="amber" size="sm" />}
                  title="รายการผิดปกติ"
                  subtitle="รอตั้งแต่ 4 มี.ค."
                  trailing={<Chip tone="warning" dot>2 รายการ</Chip>}
                />
                <ListRow
                  href="#cards"
                  leading={<IconTile icon={ShieldAlert} tone="red" size="sm" />}
                  title="ความเสี่ยงและทุจริต"
                  subtitle="รอตั้งแต่ 4 มี.ค."
                  trailing={<Chip tone="danger" dot>2 รายการ</Chip>}
                />
                <ListRow
                  href="#cards"
                  leading={<IconTile icon={FilePenLine} tone="blue" size="sm" />}
                  title="ปรับปรุงยอด"
                  subtitle="รอตั้งแต่ 18 พ.ค."
                  trailing={<Chip tone="warning" dot>2 รายการ</Chip>}
                />
              </ListGroup>
              <Surface>
                <CardHeader
                  as="h3"
                  title="Passport Sim Tutor"
                  description="ครู · สมัครเมื่อ 16 ต.ค. 2569"
                  icon={<UserAvatar name="Passport Sim Tutor" seed={PEOPLE[1].id} />}
                  action={<AdminStatusChip domain="verification" status="PENDING" size="md" />}
                />
                <DescriptionList
                  items={[
                    { label: "อีเมล (60 ตัวอักษร)", value: LONG_EMAIL },
                    { label: "รหัสผู้ใช้", value: <IdCell id={PEOPLE[1].id} /> },
                    { label: "คลาสที่สอน", value: CLASS_NAME },
                    { label: "ยอดสะสมเดือนนี้", value: <Money satang={1_234_500} /> },
                  ]}
                />
              </Surface>
              <div className="flex flex-wrap items-center gap-3">
                <UserAvatar name="Local Admin 020" size="xs" />
                <UserAvatar name="Local Admin 020" size="sm" />
                <UserAvatar name="Passport Sim Tutor" size="md" />
                <UserAvatar name="Local Student 008" size="lg" />
                <UserAvatar name={LONG_THAI_NAME} size="md" />
                <UserAvatar name="T.นกเอี้ยง" size="md" />
                <UserAvatar name="Local Admin 020" size="md" self />
              </div>
              <div className="flex flex-wrap gap-2">
                {TILE_TONES.map((tone) => (
                  <IconTile key={tone} icon={BookOpen} tone={tone} size="sm" />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[0.8125rem] text-fg-muted">
                  <span>ตรวจเอกสารแล้ว 5 จาก 14</span>
                  <span className="tabular">36%</span>
                </div>
                <ProgressBar value={36} label="ตรวจเอกสารแล้ว 36%" />
                <ProgressBar value={80} tone="warning" size="sm" label="80%" />
              </div>
              <div className="flex items-center gap-4">
                <Spinner />
                <Spinner label="กำลังโหลด…" />
              </div>
              <UiCard>
                <UiCardHeader>
                  <CardTitle>ui/card (API เดิม)</CardTitle>
                  <CardDescription>การ์ดแบบ shadcn ที่ใช้โทเคนใหม่</CardDescription>
                </UiCardHeader>
                <CardContent className="text-sm">{CLASS_NAME}</CardContent>
              </UiCard>
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="table" title="ตารางข้อมูล" only={only}>
        <ThemePair stack>
          {(theme) => (
            <div className="flex flex-col gap-5">
              <UsersTableDemo theme={theme} />
              <AuditTableDemo />
              <RowMenuTableDemo theme={theme} />
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="forms" title="ฟอร์มและตัวควบคุม" only={only}>
        <ThemePair>
          {() => (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="อีเมล" defaultValue={LONG_EMAIL} hint="อีเมลยาว 60 ตัวอักษร" />
                <TextField label="จำนวนเงิน" required startAddon="฿" numeric inputMode="decimal" error="กรุณาระบุจำนวนเงิน" />
                <SelectField
                  label="สถานะ"
                  placeholder="เลือกสถานะ"
                  options={[
                    { value: "PENDING", label: "รออนุมัติ" },
                    { value: "APPROVED", label: "อนุมัติแล้ว" },
                  ]}
                />
                <TextField label="ชื่อนักเรียน" defaultValue={LONG_THAI_NAME} optional />
                <TextAreaField label="เหตุผล" containerClassName="md:col-span-2" defaultValue="ตรวจเอกสารของ Passport Sim Tutor แล้ว รอหลักฐานที่อยู่เพิ่มเติม" />
                <TextField label="อ่านอย่างเดียว" defaultValue="Local Student 008" readOnly className="bg-surface-muted" />
                <TextField label="ปิดใช้งาน" defaultValue="Local Admin 020" disabled />
              </div>
              <SearchStateDemo />
              <div className="flex flex-wrap items-center gap-4">
                <SegmentedControl
                  aria-label="ช่วงเวลา"
                  value={segment}
                  onValueChange={setSegment}
                  items={[
                    { value: "month", label: "เดือนนี้" },
                    { value: "last", label: "เดือนก่อน" },
                    { value: "custom", label: "กำหนดเอง" },
                  ]}
                />
                <ThemeSegmented />
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2.5 text-sm">
                  <Checkbox checked={checked} onCheckedChange={(value) => setChecked(Boolean(value))} /> ส่งอีเมลแจ้งครู
                </label>
                <label className="flex items-center gap-2.5 text-sm">
                  <Checkbox checked={false} /> ยังไม่เลือก
                </label>
                <label className="flex items-center gap-2.5 text-sm">
                  <Checkbox indeterminate /> เลือกบางส่วน
                </label>
                <label className="flex items-center gap-2.5 text-sm text-fg-muted">
                  <Checkbox disabled checked /> ปิดใช้งาน
                </label>
              </div>
              <TabNav
                aria-label="แท็บคลาส"
                items={[
                  { href: "/dev/ui-kit", label: "ภาพรวม" },
                  { href: "/dev/ui-kit#forms", label: "นักเรียน", count: 29 },
                  { href: "/dev/ui-kit#table", label: "การเข้าเรียน" },
                ]}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ui-input-demo">ui/input + ui/label</Label>
                  <Input id="ui-input-demo" placeholder="Local Student 008" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ui-select-demo">ui/select (native)</Label>
                  <Select defaultValue="A0">
                    <SelectTrigger id="ui-select-demo" className="w-full">
                      <SelectValue placeholder="เลือกระดับ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A0">Primary Origins 2 (A0)</SelectItem>
                      <SelectItem value="A1">Primary Origins 3 (A1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="feedback" title="การแจ้งเตือนและสถานะว่าง" only={only}>
        <ThemePair>
          {() => (
            <div className="flex flex-col gap-3">
              <Notice tone="info" title="ยังไม่ถึงวันคำนวณรอบจ่ายเงิน">ระบบจะคำนวณอัตโนมัติวันที่ 1 ของทุกเดือน</Notice>
              <Notice tone="warning" title="เอกสารอยู่ระหว่างตรวจสอบ" href="#feedback">
                Passport Sim Tutor ส่งเอกสาร 1 รายการ
              </Notice>
              <Notice tone="success" title="อนุมัติรอบจ่ายแล้ว" />
              <Notice tone="danger" action={<Button size="sm" variant="outline">ดูรายการ</Button>}>
                โอนเงินไม่สำเร็จ 2 รายการ
              </Notice>
              <Notice tone="brand">ครูใหม่ 1 คนรอการตั้งค่าคลาส {CLASS_NAME}</Notice>
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>ui/alert (API เดิม)</AlertTitle>
                <AlertDescription>หน้าตาเดียวกับ Notice</AlertDescription>
              </Alert>
              <EmptyState as="h3" icon={Inbox} tone="neutral" title="ยังไม่มีคูปอง" description="สร้างคูปองชั่วโมงสอนเพื่อมอบให้ครู" action={<Button>สร้างคูปอง</Button>} />
              <ErrorState onRetry={() => new Promise((resolve) => setTimeout(resolve, 600))} digest="dev-1234" />
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="loading" title="สถานะกำลังโหลด" only={only}>
        <ThemePair stack>
          {() => (
            <div className="flex flex-col gap-3">
              <StatGridSkeleton />
              <TableSkeleton rows={3} columns={5} />
              <ListSkeleton rows={2} />
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="overlays" title="หน้าต่าง เมนู และ Toast" only={only}>
        <Surface>
          <p className="mb-3 text-sm text-fg-muted">ตัวจริง (เปิดในธีมของหน้า):</p>
          <OverlaysLive />
        </Surface>
        <ThemePair>
          {() => (
            <div className="flex flex-col gap-4">
              <StaticSheet
                title="ระงับบัญชีผู้ใช้?"
                description="Local Student 008 จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดบัญชีอีกครั้ง"
                footer={
                  <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                    <Button variant="outline" size="lg" className="md:h-9 md:px-3.5">ยกเลิก</Button>
                    <Button variant="danger" size="lg" className="md:h-9 md:px-3.5">ระงับบัญชี</Button>
                  </div>
                }
              >
                <TextAreaField label="เหตุผล" required rows={2} placeholder="ระบุเหตุผลเพื่อบันทึกในประวัติกิจกรรม" />
              </StaticSheet>
              <StaticSheet
                side
                width={560}
                title="Passport Sim Tutor"
                description="Sheet ด้านขวา 560 สำหรับรายละเอียดจากตาราง"
                footer={
                  <div className="flex justify-end gap-2">
                    <Button variant="outline">ปฏิเสธเอกสาร</Button>
                    <Button>อนุมัติเอกสาร</Button>
                  </div>
                }
              >
                <DescriptionList
                  items={[
                    { label: "อีเมล", value: "passport-sim-tutor@local.test" },
                    { label: "รหัสผู้ใช้", value: <IdCell id={PEOPLE[1].id} /> },
                  ]}
                />
              </StaticSheet>
              <div className="w-72 overflow-hidden rounded-(--radius-ctl) border border-clay-rim bg-surface-elevated shadow-popover">
                <p className="border-b border-hairline px-4 py-3 text-sm font-semibold">งานที่รอดำเนินการ</p>
                <ul className="flex flex-col p-1.5">
                  {[
                    { label: "ปรับปรุงยอด", count: 2, icon: FilePenLine },
                    { label: "ความเสี่ยงและทุจริต", count: 2, icon: ShieldAlert },
                    { label: "ผู้ใช้งาน", count: 1, icon: History },
                  ].map((item) => (
                    <li key={item.label}>
                      <Link href="#overlays" className="flex min-h-10 items-center gap-3 rounded-(--radius-ctl-sm) px-2.5 text-sm hover:bg-press pointer-coarse:min-h-11">
                        <item.icon aria-hidden="true" className="size-4 text-fg-subtle" />
                        <span className="flex-1">{item.label}</span>
                        <CountBadge count={item.count} aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex max-w-[420px] flex-col gap-2">
                <ToastCard tone="success" message="คัดลอกแล้ว" onDismiss={() => undefined} />
                <ToastCard tone="error" message="บันทึกไม่สำเร็จ" description="เซิร์ฟเวอร์ไม่ตอบสนอง" onDismiss={() => undefined} />
                <ToastCard tone="info" message="ระบบกำลังคำนวณรอบจ่าย" />
                <ToastCard tone="warning" message="มีรายการปรับปรุงยอดรออนุมัติ" />
              </div>
            </div>
          )}
        </ThemePair>
      </Block>

      <Block id="sweep" title="รายการตรวจการย้ายสี" only={only}>
        <SweepDemo inventory={inventory} />
      </Block>
    </Page>
  );
}

function SearchStateDemo() {
  const [value, setValue] = useState("Local Student");
  return <SearchField value={value} onValueChange={setValue} label="ค้นหาผู้ใช้" placeholder="ค้นหาชื่อ อีเมล หรือรหัสผู้ใช้" containerClassName="max-w-md" />;
}
