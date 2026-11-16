"use client";

import {
  BookOpen,
  CalendarDays,
  CircleCheck,
  Clock,
  Download,
  Gavel,
  LayoutGrid,
  List,
  ListChecks,
  MessageSquare,
  Plus,
  Presentation,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import {
  AppShell,
  BrandMark,
  CardHeader,
  CardSkeleton,
  Chip,
  ConfirmDialog,
  Count,
  CountBadge,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  Field,
  Grid,
  IconTile,
  ListGroup,
  ListRow,
  ListSkeleton,
  NextClassCard,
  Notice,
  Page,
  PageHeader,
  ProgressBar,
  SearchField,
  Section,
  SegmentedControl,
  SelectField,
  SessionList,
  SessionRow,
  Sheet,
  Spinner,
  StatCard,
  StatGridSkeleton,
  StatStrip,
  StatusChip,
  StickyActions,
  Surface,
  TabNav,
  TableSkeleton,
  TextAreaField,
  TextField,
  ThemeSegmented,
  Toolbar,
  UserAvatar,
  WalletHero,
  levelTone,
  tileToneClass,
  toast,
  type DataTableColumn,
} from "@/components/app";
import { BrandLockup } from "@/components/auth/BrandLockup";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as UiCard, CardContent, CardDescription, CardHeader as UiCardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LazyResultsBarChart } from "@/app/(dashboard)/lesson/[id]/interactive/presenter/LazyResultsBarChart";
import {
  AnswerProgress,
  OPTION_STYLES,
  OptionTile,
  ResultStat,
  StageEmpty,
  StageEyebrow,
  StagePanel,
  StageQuestion,
} from "@/app/(dashboard)/lesson/[id]/interactive/presenter/primitives";
import { formatTHB, formatThaiDate, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import inventory from "./sweep-inventory.json";

/* ─── Fixtures: real local seed names + stress strings (README §5 item 13) ── */

const EMAIL_60 = "punnchanida.srisuwanwong.guardian@tutoradvantage-stress.test";
const LONG_THAI_NAME = "ปุณณ์ชนิดา ศรีสุวรรณวงศ์";
const CLASS_NAME = "English";
const CLASS_BOOK = "Primary Origins 2 (A0)";
const LONG_CLASS_NAME = "English · Primary Origins 2 (A0) — คลาสเสริมการอ่านและการฟังสำหรับนักเรียนประถมปลาย รอบเสาร์เช้า";
const STUDENTS = ["Dev Student", "Local Student 008", LONG_THAI_NAME, "ภูมิพัฒน์ ใจดี", "มินตรา", "ต้นกล้า"];

const DEMO_USER = { tutorId: "passport-sim-tutor", displayName: "Passport Sim Tutor", email: EMAIL_60, avatarUrl: null };

type Payout = { id: string; period: string; classes: number; gross: number; net: number; status: string; label: string };
const PAYOUTS: Payout[] = [
  { id: "p1", period: "2026-10-31T05:00:00Z", classes: 12, gross: 8450, net: 2958, status: "PAID", label: "โอนแล้ว" },
  { id: "p2", period: "2026-09-30T05:00:00Z", classes: 9, gross: 3000, net: 1050, status: "PENDING_TRANSFER", label: "รอโอน" },
  { id: "p3", period: "2026-08-31T05:00:00Z", classes: 4, gross: 1200, net: 420, status: "TRANSFER_FAILED", label: "โอนไม่สำเร็จ" },
];
const PAYOUT_COLUMNS: DataTableColumn<Payout>[] = [
  { key: "period", header: "รอบบิล", cell: (p) => formatThaiDate(p.period, "long"), mobile: "primary" },
  { key: "classes", header: "จำนวนคลาส", align: "right", cell: (p) => `${p.classes} คลาส` },
  { key: "gross", header: "ยอดสะสม", align: "right", cell: (p) => formatTHB(p.gross) },
  { key: "net", header: "ยอดสุทธิ", align: "right", cell: (p) => <span className="font-semibold">{formatTHB(p.net)}</span>, mobile: "trailing" },
  { key: "status", header: "สถานะ", cell: (p) => <StatusChip status={p.status} label={p.label} size="sm" /> },
];

type InventoryRoute = (typeof inventory.routes)[number];
const INVENTORY_COLUMNS: DataTableColumn<InventoryRoute>[] = [
  { key: "route", header: "เส้นทาง / โฟลเดอร์", cell: (r) => <span className="font-mono text-[0.8125rem] break-all">{r.route}</span>, mobile: "primary" },
  { key: "files", header: "ไฟล์", align: "right", cell: (r) => r.files },
  { key: "palette", header: "คลาสสีดิบ", align: "right", cell: (r) => r.palette },
  { key: "hex", header: "hex", align: "right", cell: (r) => r.hex },
  { key: "white", header: "ตัวอักษรขาว", align: "right", cell: (r) => r.textWhite },
  {
    key: "status",
    header: "สถานะ",
    cell: (r) => {
      const left = r.palette + r.hex + r.textWhite;
      return left === 0 ? (
        <Chip tone="success" size="sm" dot>
          ย้ายแล้ว
        </Chip>
      ) : (
        <Chip tone="warning" size="sm" dot>
          เหลือ {left}
        </Chip>
      );
    },
    mobile: "trailing",
  },
];

const SECTIONS = [
  "inventory",
  "tokens",
  "type",
  "brand",
  "buttons",
  "chips",
  "dashboard",
  "cards",
  "lists",
  "table",
  "forms",
  "controls",
  "feedback",
  "loading",
  "presenter",
  "overlays",
  "legacy",
] as const;

/* ─── Gallery helpers ─────────────────────────────────────────────────── */

/**
 * Renders the same children twice: a light panel (.theme-light) and a dark
 * panel (.dark). Side by side from 1024px (`layout="pair"`) or one above the
 * other (`layout="stack"`, for wide compositions). Portals (sheets, toasts,
 * dropdowns) follow the page theme instead.
 */
function ThemePair({ children, layout = "pair", className }: { children: ReactNode; layout?: "pair" | "stack"; className?: string }) {
  return (
    <div className={cn("grid min-w-0 gap-3", layout === "pair" && "lg:grid-cols-2", className)}>
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          data-theme-panel={theme}
          className={cn(
            theme === "dark" ? "dark" : "theme-light",
            "min-w-0 rounded-(--radius-card) border border-hairline-strong p-4 sm:p-5",
          )}
        >
          <p className="mb-3 type-caption font-semibold text-fg-subtle">{theme === "dark" ? "มืด · dark" : "สว่าง · light"}</p>
          {children}
        </div>
      ))}
    </div>
  );
}

function Demo({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="type-caption font-semibold text-fg-subtle">{title}</p>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
    </div>
  );
}

function Swatch({ name, color, fg }: { name: string; color: string; fg?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-(--radius-ctl-sm) border border-hairline text-xs font-semibold"
        style={{ background: `var(${color})`, color: fg ? `var(${fg})` : undefined }}
      >
        {fg ? "ก" : null}
      </span>
      <code className="min-w-0 truncate text-xs text-fg-muted">{name}</code>
    </div>
  );
}

const SWATCH_GROUPS: { title: string; items: [string, string, string?][] }[] = [
  {
    title: "Surfaces & lines",
    items: [
      ["surface-bg", "--surface-bg"],
      ["surface-card", "--surface-card"],
      ["surface-muted", "--surface-muted"],
      ["surface-elevated", "--surface-elevated"],
      ["clay-rim", "--clay-rim"],
      ["clay-ledge", "--clay-ledge"],
      ["hairline", "--hairline"],
      ["field-border", "--field-border"],
      ["track", "--track"],
      ["focus-ring", "--focus-ring"],
    ],
  },
  {
    title: "Brand (jade) · accent (sunshine rewards, tangerine text)",
    items: [
      ["brand-solid / on-brand", "--brand-solid", "--on-brand"],
      ["brand-solid-edge", "--brand-solid-edge"],
      ["brand-soft / -fg", "--brand-soft", "--brand-soft-fg"],
      ["brand-fg", "--brand-fg"],
      ["brand-vivid", "--brand-vivid"],
      ["accent-solid / on-accent", "--accent-solid", "--on-accent"],
      ["accent-soft / -fg", "--accent-soft", "--accent-soft-fg"],
      ["hero-bg-base / hero-fg", "--hero-bg-base", "--hero-fg"],
      ["ink-bg / ink-fg", "--ink-bg", "--ink-fg"],
      ["logo-bg / logo-fg", "--logo-bg", "--logo-fg"],
    ],
  },
  {
    title: "Status (fg on bg ≥ 4.5:1)",
    items: [
      ["success", "--success-bg", "--success-fg"],
      ["warning", "--warning-bg", "--warning-fg"],
      ["danger", "--danger-bg", "--danger-fg"],
      ["info", "--info-bg", "--info-fg"],
      ["neutral", "--neutral-bg", "--neutral-fg"],
      ["success-solid", "--success-solid", "--on-success"],
      ["danger-solid", "--danger-solid", "--on-danger"],
      ["info-solid", "--info-solid"],
    ],
  },
  {
    title: "Tiles / icons (CEFR: A0 teal · A1 purple · A2 blue · B1 orange · B2 pink)",
    items: (["brand", "teal", "purple", "blue", "orange", "pink", "amber", "red", "neutral"] as const).map(
      (tone) => [`tile-${tone}`, `--tile-${tone}`, `--icon-${tone}`] as [string, string, string],
    ),
  },
  {
    title: "Answer tiles A–D (presenter + student phones; never games)",
    items: [
      ["answer-a", "--answer-a", "--on-answer-a"],
      ["answer-b", "--answer-b", "--on-answer-b"],
      ["answer-c", "--answer-c", "--on-answer-c"],
      ["answer-d", "--answer-d", "--on-answer-d"],
      ["medal-gold", "--medal-gold", "--on-medal"],
      ["medal-silver", "--medal-silver", "--on-medal"],
      ["medal-bronze", "--medal-bronze", "--on-medal"],
    ],
  },
];

const LEVELS = ["A0", "A1", "A2", "B1", "B2"] as const;

/* ─── Shared demo blocks (rendered once per theme panel) ─────────────── */

function DashboardDemo() {
  return (
    <div className="flex flex-col gap-4">
      <WalletHero
        label="รายได้ประมาณการเดือนนี้"
        chip="เรท 35%"
        amount="฿2,958"
        subline="คอมมิชชัน 35% จากยอดสะสม ฿8,450"
        goal={{
          currentLabel: "ยอดสะสมเดือนนี้",
          currentValue: "฿8,450",
          targetLabel: "เป้าหมายเรทถัดไป",
          targetValue: "฿10,000",
          progress: 84.5,
          progressLabel: "ยอดสะสม 85% ของเป้าหมาย",
          note: (
            <>
              ขาดอีก <b>฿1,550</b> เพื่อขึ้นเรทถัดไป
            </>
          ),
        }}
      />
      <NextClassCard
        label="คลาสถัดไป"
        chip={
          <Chip tone="brand" dot>
            วันนี้
          </Chip>
        }
        time="17:00"
        timeNote="ถึง 18:00 · อีก 35 นาที"
        title={CLASS_NAME}
        lines={[
          CLASS_BOOK,
          <>
            บทที่ 6 · <span lang="en">The Friendly Dolphin</span>
          </>,
        ]}
        studentNames={STUDENTS}
        studentsLabel="6 นักเรียน"
        primaryAction={
          <Button size="lg" className="w-full">
            <Presentation aria-hidden="true" />
            เริ่มสอนสด
          </Button>
        }
        secondaryAction={
          <Button size="lg" variant="outline">
            ดูคลาส
          </Button>
        }
      />
      <StatStrip
        aria-label="สรุปตัวเลข"
        items={[
          { label: "คลาสที่เปิด", value: "3", hint: "รับได้อีก 5 ที่" },
          { label: "นักเรียนทั้งหมด", value: "14", hint: "ใหม่ 4 คนเดือนนี้" },
          { label: "คลาสสัปดาห์นี้", value: "7", hint: "วันนี้ 2 คาบ", href: "#dashboard" },
        ]}
      />
      <Section title="คาบสอนวันนี้" action={<Button variant="ghost-brand">ตารางสอน</Button>}>
        <SessionList aria-label="คาบสอนวันนี้">
          <SessionRow
            time="17:00"
            duration="60 นาที"
            title={CLASS_NAME}
            level="A0"
            meta="6 คน · A0 · บทที่ 6"
            href="#dashboard"
            trailing={<Chip tone="brand">ถัดไป</Chip>}
          />
          <SessionRow
            time="18:00"
            duration="45 นาที"
            title="Reading Club"
            level="A2"
            meta="4 คน · A2 · บทที่ 2"
            href="#dashboard"
            trailing={
              <Button variant="tonal" size="sm">
                <Presentation aria-hidden="true" />
                เริ่มสอน
              </Button>
            }
          />
          <SessionRow time="19:00" duration="60 นาที" title="English Conversation" level="A1" meta="4 คน · A1 · บทที่ 9" href="#dashboard" />
          <SessionRow time="20:30" duration="90 นาที" title={LONG_CLASS_NAME} level="B1" meta={`12 คน · B1 · บทที่ 14 · ${LONG_THAI_NAME}`} href="#dashboard" />
        </SessionList>
      </Section>
    </div>
  );
}

/** Checkbox / switch rows with ids unique per theme panel. */
function ChoiceDemo() {
  const id = useId();
  return (
    <>
      <Field label="ตัวเลือก">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2.5">
            <Checkbox id={`${id}-cb`} defaultChecked />
            <Label htmlFor={`${id}-cb`}>เปิดให้สมัครทันที</Label>
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox id={`${id}-cb2`} />
            <Label htmlFor={`${id}-cb2`}>ส่งอีเมล</Label>
          </div>
          <div className="flex items-center gap-2.5">
            <Switch id={`${id}-sw`} defaultChecked />
            <Label htmlFor={`${id}-sw`}>แจ้งเตือนนักเรียน</Label>
          </div>
          <div className="flex items-center gap-2.5">
            <Switch id={`${id}-sw2`} />
            <Label htmlFor={`${id}-sw2`}>ปิด</Label>
          </div>
        </div>
      </Field>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-input`}>ui/Input (legacy)</Label>
        <Input id={`${id}-input`} placeholder="Input จาก components/ui" />
      </div>
    </>
  );
}

/* ─── Gallery ─────────────────────────────────────────────────────────── */

export function UiKitGallery({ only }: { only?: string }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [period, setPeriod] = useState<"all" | "open" | "closed">("all");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const show = (id: (typeof SECTIONS)[number]) => !only || only === id;
  const migrated = inventory.routes.filter((r) => r.palette + r.hex + r.textWhite === 0).length;

  return (
    <AppShell user={DEMO_USER} initialNotifications={{ unreadChat: 2, availableAuctions: 1 }}>
      <Page>
        <PageHeader
          eyebrow="วันจันทร์ 9 พฤศจิกายน 2569"
          title="UI kit"
          description="ระบบดีไซน์ใหม่ของแอปครู (พฤศจิกายน 2569) ทุกคอมโพเนนต์แสดงทั้งโหมดสว่างและโหมดมืดด้วยข้อมูลจริงและข้อความยาวทดสอบ (เฉพาะโหมดพัฒนา)"
          mobileTitle="inline"
          appBarAction={{ href: "/dashboard/classes/new", label: "สร้างคลาสใหม่" }}
          meta={
            <>
              <Chip tone="brand" dot>
                components/app
              </Chip>
              <Chip tone="neutral">components/ui</Chip>
              <Chip tone="info">docs/design/redesign-2026-11</Chip>
            </>
          }
          actions={
            <>
              <ThemeSegmented />
              <Button variant="outline">
                <Plus aria-hidden="true" /> สร้างคลาสใหม่
              </Button>
            </>
          }
        />

        <nav aria-label="หัวข้อในแกลเลอรี" className="flex flex-wrap gap-1.5">
          {SECTIONS.map((id) => (
            <a
              key={id}
              href={only ? `?section=${id}` : `#${id}`}
              className="inline-flex h-8 items-center rounded-full bg-surface-muted px-3 text-[0.8125rem] font-medium text-fg-muted hover:text-fg pointer-coarse:h-11"
            >
              {id}
            </a>
          ))}
        </nav>

        {show("inventory") && (
          <Section
            id="inventory"
            title="Sweep inventory (README §8 step 2)"
            description={`สร้างโดย scripts/sweep-inventory.mjs · ${formatThaiDate(inventory.generatedAt, "long")} · ย้ายแล้ว ${migrated}/${inventory.routes.length} เส้นทาง`}
          >
            <StatStrip
              aria-label="ยอดรวมที่เหลือ"
              items={[
                { label: "ไฟล์ที่ตรวจ", value: inventory.totals.files, hint: "ไม่รวมโฟลเดอร์เกม" },
                { label: "คลาสสีดิบ (palette)", value: inventory.totals.palette, hint: "สีจากพาเลต Tailwind โดยตรง" },
                { label: "ค่า hex", value: inventory.totals.hex, hint: "#rrggbb ใน TSX" },
                { label: "ตัวอักษรขาว (white)", value: inventory.totals.textWhite, hint: "ทั้งหมด (เกม/ศิลป์รวมอยู่)" },
              ]}
            />
            <ListGroup header="ตัวอักษรขาวบนพื้นสีแบรนด์ → text-on-brand (README §5 ข้อ 4)">
              {inventory.textWhiteOnBrand.map((item) => (
                <ListRow
                  key={item.file}
                  title={<span className="font-mono text-[0.8125rem] font-medium break-all">{item.file}</span>}
                  trailing={
                    item.remaining === 0 ? (
                      <Chip tone="success" size="sm" icon={CircleCheck}>
                        text-on-brand แล้ว
                      </Chip>
                    ) : (
                      <Chip tone="warning" size="sm" dot>
                        เหลือ {item.remaining}
                      </Chip>
                    )
                  }
                />
              ))}
            </ListGroup>
            <DataTable
              caption="จำนวนสีดิบที่เหลือต่อเส้นทาง"
              rows={inventory.routes}
              getRowKey={(row) => row.route}
              columns={INVENTORY_COLUMNS}
              dense
            />
            <Notice tone="neutral" title="ข้อยกเว้นที่ตั้งใจ (ไม่ใช่สีของ UI)">
              ศิลป์ของ Reedy (components/mascot, ไม่นับ hex) · เอกสาร PDF ทวิ 50 (react-pdf ใช้ตัวแปร CSS ไม่ได้) · โลโก้ Google บนหน้าเข้าสู่ระบบ ·
              theme-color ใน layout · สีคอนเฟตตีบนแคนวาส · เกมสอนใน components/lesson และ lib/games-runtime (ศิลป์ของเกม) · DevToolbar (โหมดพัฒนา)
            </Notice>
          </Section>
        )}

        {show("tokens") && (
          <Section id="tokens" title="Tokens" description="tokens.md §9.2 · ใช้คลาสจากโทเค็นเท่านั้น (bg-surface, text-fg-muted, bg-brand-solid + text-on-brand …)">
            <ThemePair>
              <div className="flex flex-col gap-5">
                {SWATCH_GROUPS.map((group) => (
                  <div key={group.title} className="flex flex-col gap-2.5">
                    <p className="type-label font-semibold text-fg">{group.title}</p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {group.items.map(([name, color, fg]) => (
                        <Swatch key={name} name={name} color={color} fg={fg} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ThemePair>
          </Section>
        )}

        {show("type") && (
          <Section id="type" title="Type roles" description="Kodchasan 600 เฉพาะชื่อหน้า คำทักทาย และตัวเลขฮีโร่ · ที่เหลือ Noto Sans Thai (ตัวเลขตาราง tabular)">
            <ThemePair>
              <div className="flex flex-col gap-3">
                <p className="type-page text-fg">type-page 28 · ภาพรวม</p>
                <p className="type-greet text-fg text-balance-th">
                  type-greet 21 · <span className="whitespace-nowrap">สวัสดีตอนบ่าย</span> <span className="whitespace-nowrap">ครูปุณณ์ชนิดา</span>
                </p>
                <p className="type-hero-amount text-fg">฿2,958</p>
                <p className="type-hero-time text-fg">17:00</p>
                <p className="type-section text-fg">type-section 18 · คาบสอนวันนี้</p>
                <p className="type-card text-fg">type-card 16 · {CLASS_NAME} · {CLASS_BOOK}</p>
                <p className="type-body text-fg">type-body 16/15 · นักเรียนเข้าร่วมแล้ว 12 คน จาก 15 คน ข้อความยาวภาษาไทยควรตัดคำได้สวยงาม</p>
                <p className="type-body-s text-fg-muted">type-body-s 14 · {LONG_CLASS_NAME}</p>
                <p className="type-label text-fg-muted">type-label 14 · วันจันทร์ 9 พฤศจิกายน 2569</p>
                <p className="type-caption text-fg-subtle">type-caption 12 · อัปเดตล่าสุด 12:22 น. · {EMAIL_60}</p>
                <p className="type-stat text-fg">type-stat 22 · 1,111 / 0,000</p>
              </div>
            </ThemePair>
          </Section>
        )}

        {show("brand") && (
          <Section id="brand" title="Brand marks & Reedy" description="TA mark: SVG เส้นโครง สีคงที่ทั้งสองธีม (โหมดมืดมีขอบขาว 14%) · Reedy เฉพาะสถานะว่างและจอพรีเซนเตอร์ ครั้งละหนึ่งตัว">
            <ThemePair>
              <div className="flex flex-col gap-4">
                <Demo title="BrandMark 32 · 36 · 44 · 72" className="gap-4">
                  <BrandMark size={32} />
                  <BrandMark size={36} />
                  <BrandMark size={44} />
                  <BrandMark size={72} />
                </Demo>
                <Demo title="BrandLockup (หน้าเข้าสู่ระบบ)">
                  <BrandLockup />
                </Demo>
                <Demo title="ReedyMini calm 72 (empty) · cheer 96 (podium)" className="gap-6">
                  <ReedyMini mood="calm" size={72} />
                  <ReedyMini mood="cheer" size={96} />
                </Demo>
              </div>
            </ThemePair>
          </Section>
        )}

        {show("buttons") && (
          <Section id="buttons" title="Buttons" description="primary มีขอบล่าง 2px หนึ่งปุ่มต่อหน้า · สัมผัส ≥ 44px · โฟกัสสีน้ำเงิน 3px">
            <ThemePair>
              <div className="flex flex-col gap-5">
                <Demo title="Variants">
                  <Button>เริ่มสอนสด</Button>
                  <Button variant="outline">ส่งออก CSV</Button>
                  <Button variant="tonal">เริ่มสอน</Button>
                  <Button variant="ghost">ยกเลิก</Button>
                  <Button variant="ghost-brand">ดูทั้งหมด</Button>
                  <Button variant="link">ลิงก์</Button>
                  <Button variant="danger">ลบคลาส</Button>
                  <Button variant="destructive">ปิดห้อง (tonal)</Button>
                </Demo>
                <Demo title="Sizes: xs 28 · sm 32 · default 40 · lg 44 · xl 48">
                  <Button size="xs">xs</Button>
                  <Button size="sm">sm</Button>
                  <Button>default</Button>
                  <Button size="lg">lg</Button>
                  <Button size="xl">
                    <Presentation aria-hidden="true" />
                    xl เริ่มสอนสด
                  </Button>
                </Demo>
                <Demo title="States & icons">
                  <Button loading>กำลังบันทึก</Button>
                  <Button disabled>ปิดใช้งาน</Button>
                  <Button variant="outline">
                    <Download aria-hidden="true" /> ดาวน์โหลด
                  </Button>
                  <Button size="icon" variant="outline" aria-label="ลบ">
                    <Trash2 />
                  </Button>
                  <Button size="icon-lg" variant="ghost" aria-label="สร้างคลาสใหม่">
                    <Plus />
                  </Button>
                </Demo>
                <Demo title="on-ink (ในการ์ดกระเป๋าเงิน)">
                  <div className="ds-wallet w-full">
                    <div className="flex flex-wrap gap-2 p-4">
                      <Button variant="on-ink">
                        <Wallet aria-hidden="true" /> ดูรายได้
                      </Button>
                      <Button variant="on-ink" disabled>
                        ปิดใช้งาน
                      </Button>
                    </div>
                  </div>
                </Demo>
                <Demo title="Full width (การ์ดบนมือถือ)" className="w-full">
                  <Button size="xl" className="w-full">
                    บันทึกคลาส
                  </Button>
                </Demo>
              </div>
            </ThemePair>
          </Section>
        )}

        {show("chips") && (
          <Section id="chips" title="Chips, status & counts" description="สถานะ = สี + จุดหรือไอคอน + คำ ไม่ใช้สีอย่างเดียว">
            <ThemePair>
              <div className="flex flex-col gap-4">
                <Demo title="Chip tones (28px) + dot">
                  <Chip tone="brand" dot>
                    วันนี้
                  </Chip>
                  <Chip tone="success" dot>
                    เปิดรับ
                  </Chip>
                  <Chip tone="warning" dot>
                    รอชำระ
                  </Chip>
                  <Chip tone="danger" dot>
                    โอนไม่สำเร็จ
                  </Chip>
                  <Chip tone="info" icon={CalendarDays}>
                    พรุ่งนี้ 18:00
                  </Chip>
                  <Chip tone="neutral" icon={Users}>
                    12 คน
                  </Chip>
                  <Chip tone="neutral" size="sm">
                    sm 24px
                  </Chip>
                </Demo>
                <Demo title="StatusChip (API status → tone)">
                  {[
                    ["PAID", "โอนแล้ว"],
                    ["PENDING", "รอตรวจ"],
                    ["FAILED", "ไม่ผ่าน"],
                    ["LIVE", "กำลังสอน"],
                    ["CLOSED", "ปิดแล้ว"],
                  ].map(([status, label]) => (
                    <StatusChip key={status} status={status} label={label} />
                  ))}
                </Demo>
                <Demo title="Level (CEFR band tones)">
                  {LEVELS.map((level) => (
                    <span
                      key={level}
                      className={cn("inline-flex h-7 items-center rounded-full px-2.5 text-[0.8125rem] font-semibold", tileToneClass[levelTone(level)])}
                    >
                      {level}
                    </span>
                  ))}
                </Demo>
                <Demo title="Counts: neutral 22 · alert 22 · ui/Badge">
                  <Count value={41} />
                  <CountBadge count={2} />
                  <CountBadge count={128} />
                  <Badge>default</Badge>
                  <Badge variant="success">success</Badge>
                  <Badge variant="warning">warning</Badge>
                  <Badge variant="destructive">destructive</Badge>
                  <Badge variant="solid">solid</Badge>
                  <Badge variant="outline">outline</Badge>
                </Demo>
              </div>
            </ThemePair>
          </Section>
        )}

        {show("dashboard") && (
          <Section
            id="dashboard"
            title="Dashboard compositions (patterns.md T1)"
            description="WalletHero (พื้นหมึกหนึ่งเดียวต่อหน้า) · StatStrip · NextClassCard · SessionList/SessionRow — กว้าง ≥ 600px กระเป๋าเงินแบ่งซ้ายขวา"
          >
            <ThemePair layout="stack">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-4">
                  <WalletHero
                    label="รายได้ประมาณการเดือนนี้"
                    chip="เรท 35%"
                    amount="฿2,958"
                    subline="คอมมิชชัน 35% จากยอดสะสม ฿8,450"
                    goal={{
                      currentLabel: "ยอดสะสมเดือนนี้",
                      currentValue: "฿8,450",
                      targetLabel: "เป้าหมายเรทถัดไป",
                      targetValue: "฿10,000",
                      progress: 84.5,
                      progressLabel: "ยอดสะสม 85% ของเป้าหมาย",
                      note: (
                        <>
                          ขาดอีก <b>฿1,550</b> เพื่อขึ้นเรทถัดไป
                        </>
                      ),
                    }}
                  />
                  <StatStrip
                    aria-label="สรุปตัวเลข"
                    items={[
                      { label: "คลาสที่เปิด", value: "3", hint: "รับได้อีก 5 ที่" },
                      { label: "นักเรียนทั้งหมด", value: "14", hint: "ใหม่ 4 คนเดือนนี้" },
                      { label: "คลาสสัปดาห์นี้", value: "7", hint: "วันนี้ 2 คาบ" },
                    ]}
                  />
                </div>
                <NextClassCard
                  label="คลาสถัดไป"
                  chip={
                    <Chip tone="brand" dot>
                      วันนี้
                    </Chip>
                  }
                  time="17:00"
                  timeNote="ถึง 18:00 · อีก 35 นาที"
                  title={CLASS_NAME}
                  lines={[
                    CLASS_BOOK,
                    <>
                      บทที่ 6 · <span lang="en">The Friendly Dolphin</span>
                    </>,
                  ]}
                  studentNames={STUDENTS}
                  studentsLabel="6 นักเรียน"
                  primaryAction={
                    <Button size="lg" className="w-full">
                      <Presentation aria-hidden="true" />
                      เริ่มสอนสด
                    </Button>
                  }
                  secondaryAction={
                    <Button size="lg" variant="outline">
                      ดูคลาส
                    </Button>
                  }
                />
              </div>
            </ThemePair>
            <p className="type-label font-semibold text-fg">ตัวอย่างลำดับบนมือถือ 390px (เทียบกับ mock tutor-home)</p>
            <ThemePair>
              <div className="mx-auto w-full max-w-[358px]">
                <p className="type-greet text-fg text-balance-th">
                  <span className="whitespace-nowrap">สวัสดีตอนบ่าย</span> <span className="whitespace-nowrap">ครูนกเอี้ยง</span>
                </p>
                <p className="mb-4 type-body-s text-fg-muted">สรุปคลาสและรายได้ของคุณในเดือนนี้</p>
                <Notice tone="info" icon={Clock} title="เอกสารอยู่ระหว่างตรวจสอบ" href="#dashboard" className="mb-4">
                  เจ้าหน้าที่กำลังตรวจสอบเอกสารของคุณ
                </Notice>
                <DashboardDemo />
              </div>
            </ThemePair>
            <ThemePair>
              <div className="flex flex-col gap-4">
                <StatStrip
                  aria-label="สี่ช่อง"
                  items={[
                    { label: "เดือนนี้", value: formatTHB(2958), hint: "ประมาณการ" },
                    { label: "เดือนก่อน", value: formatTHB(1050) },
                    { label: "รอโอน", value: formatTHB(420) },
                    { label: "นักเรียน", value: "14", href: "#dashboard" },
                  ]}
                />
                <Surface padding="none">
                  <EmptyState
                    compact
                    mascot
                    title="ยังไม่มีคาบถัดไป"
                    description="สร้างตารางสอนเพื่อให้นักเรียนเห็นเวลาเรียน"
                    action={<Button variant="tonal">สร้างตารางสอน</Button>}
                  />
                </Surface>
              </div>
            </ThemePair>
          </Section>
        )}

        {show("cards") && (
          <Section id="cards" title="Cards / surfaces" description="ทุกการ์ดมีขอบ clay 1px · ขอบล่าง (ledge) เฉพาะการ์ดที่กดได้">
            <ThemePair>
              <div className="flex flex-col gap-3">
                <Surface padding="lg">
                  <CardHeader
                    icon={<IconTile icon={BookOpen} tone={levelTone("A0")} />}
                    title={`${CLASS_NAME} · ${CLASS_BOOK}`}
                    description={`ทุกวันจันทร์ ${formatTimeRange("2026-11-09T10:00:00Z", "2026-11-09T11:00:00Z")}`}
                    action={
                      <Chip tone="success" dot>
                        เปิดรับ
                      </Chip>
                    }
                  />
                  <DescriptionList
                    items={[
                      { label: "ระดับ", value: "A0" },
                      { label: "นักเรียน", value: <span className="tabular">6 / 8 คน</span> },
                      { label: "เริ่มเรียน", value: formatThaiDate("2026-11-09T10:00:00Z", "full") },
                      { label: "ค่าเรียน", value: <span className="tabular">{formatTHB(3000)}</span> },
                      { label: "อีเมลผู้ปกครอง", value: EMAIL_60, wide: true },
                    ]}
                  />
                </Surface>
                <Surface href="#cards">
                  <p className="type-card text-fg">การ์ดที่กดได้ (href): ขอบล่าง 2px และกดลง 1px</p>
                  <p className="type-body-s text-fg-muted">{LONG_CLASS_NAME}</p>
                </Surface>
                <div className="grid grid-cols-2 gap-3">
                  <Surface tone="muted">
                    <p className="text-sm text-fg-muted">tone muted (well)</p>
                  </Surface>
                  <Surface tone="brand">
                    <p className="text-sm text-brand-soft-fg">tone brand</p>
                  </Surface>
                  <Surface tone="hero">
                    <p className="text-sm">tone hero</p>
                  </Surface>
                  <Surface tone="warning">
                    <p className="text-sm text-warning-fg">tone warning</p>
                  </Surface>
                </div>
                <Grid cols={2} className="grid-cols-2">
                  <StatCard label="รายได้เดือนนี้" value={formatTHB(2958, { fractionDigits: 0 })} icon={Wallet} tone="brand" hint="เรท 35%" />
                  <StatCard label="นักเรียนทั้งหมด" value="14" icon={Users} tone="teal" href="#cards" delta={{ value: "+4", direction: "up" }} />
                </Grid>
              </div>
            </ThemePair>
          </Section>
        )}

        {show("lists") && (
          <Section id="lists" title="Lists" description="แถวแบน 64px ในการ์ดเดียว · เลือกอยู่ = brand-soft + แถบ 3px">
            <ThemePair>
              <div className="flex flex-col gap-4">
                <ListGroup header="คลาสเรียนล่าสุด" headerAction={<Button variant="ghost-brand" size="sm">ดูทั้งหมด</Button>}>
                  <ListRow
                    href="#lists"
                    leading={<IconTile icon={BookOpen} tone={levelTone("A0")} />}
                    title={CLASS_NAME}
                    subtitle="6/8 คน · เรียนแล้ว 5/14 บท"
                    trailing={
                      <Chip tone="success" size="sm" dot>
                        เปิดรับ
                      </Chip>
                    }
                  />
                  <ListRow
                    href="#lists"
                    selected
                    leading={<IconTile icon={BookOpen} tone={levelTone("A1")} />}
                    title="English Conversation"
                    subtitle="4/8 คน · เรียนแล้ว 8/14 บท"
                  />
                  <ListRow
                    href="#lists"
                    leading={<IconTile icon={BookOpen} tone={levelTone("B1")} />}
                    title={LONG_CLASS_NAME}
                    subtitle={`4 คน · รอเริ่มคาบแรก · ${EMAIL_60}`}
                    trailing={
                      <Chip tone="warning" size="sm" dot>
                        รอชำระ
                      </Chip>
                    }
                  />
                  <ListRow leading={<UserAvatar name={LONG_THAI_NAME} />} title={LONG_THAI_NAME} subtitle="ผู้ปกครอง: Dev Student" trailing={formatTHB(3000)} />
                  <ListRow leading={<UserAvatar name="Local Student 008" self />} title="Local Student 008 (คุณ)" subtitle="เข้าร่วมล่าสุด เมื่อวาน" />
                </ListGroup>
                <ListGroup header="การตั้งค่า" footer="การแจ้งเตือนจะเล่นเสียงเมื่อมีข้อความใหม่">
                  <ListRow
                    leading={<IconTile icon={MessageSquare} tone="blue" size="sm" />}
                    title="เสียงแจ้งเตือนข้อความ"
                    trailing={<Switch checked={notify} onCheckedChange={setNotify} aria-label="เสียงแจ้งเตือน" />}
                  />
                  <ListRow leading={<IconTile icon={Gavel} tone="amber" size="sm" />} title="คลาสรอรับ" trailing={<Count value={2} />} onClick={() => toast("กดแถวแล้ว")} chevron />
                  <ListRow leading={<IconTile icon={Trash2} tone="red" size="sm" />} title="ลบบัญชี" destructive onClick={() => setConfirmOpen(true)} />
                </ListGroup>
              </div>
            </ThemePair>
          </Section>
        )}

        {show("table") && (
          <Section id="table" title="Data table" description="ตารางบนจอใหญ่ กลายเป็นการ์ดบนมือถือ · ตัวเลขชิดขวาแบบ tabular">
            <ThemePair layout="stack">
              <div className="flex flex-col gap-3">
                <Toolbar>
                  <SearchField value={query} onValueChange={setQuery} label="ค้นหารอบบิล" />
                  <SegmentedControl
                    aria-label="สถานะ"
                    value={period}
                    onValueChange={setPeriod}
                    items={[
                      { value: "all", label: "ทั้งหมด", count: 3 },
                      { value: "open", label: "รอโอน", count: 1 },
                      { value: "closed", label: "โอนแล้ว", count: 1 },
                    ]}
                  />
                </Toolbar>
                <DataTable
                  caption="ประวัติการจ่ายเงิน"
                  rows={PAYOUTS}
                  getRowKey={(row) => row.id}
                  columns={PAYOUT_COLUMNS}
                  rowHref={() => "#table"}
                  footer={<p className="text-[0.8125rem] text-fg-muted tabular">แสดง 1–3 จาก 3 รายการ</p>}
                />
              </div>
            </ThemePair>
          </Section>
        )}

        {show("forms") && (
          <Section id="forms" title="Forms" description="44 เดสก์ท็อป / 48 สัมผัส · โฟกัส = ขอบ brand-fg + วงสีน้ำเงิน · ผิด = ขอบแดง + ไอคอน + ข้อความ">
            <ThemePair>
              <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
                <TextField label="ชื่อคลาส" placeholder="เช่น English" required hint="นักเรียนจะเห็นชื่อนี้" defaultValue={CLASS_NAME} />
                <TextField label="ค่าเรียน" startAddon="฿" inputMode="numeric" defaultValue="3000" endAddon="บาท" className="text-right tabular" />
                <SelectField
                  label="ระดับ"
                  placeholder="เลือกระดับ"
                  defaultValue="a0"
                  options={LEVELS.map((level) => ({ value: level.toLowerCase(), label: level }))}
                />
                <TextField label="ลิงก์ห้องเรียน" type="url" error="ลิงก์ไม่ถูกต้อง ใส่ลิงก์ที่ขึ้นต้นด้วย https://" defaultValue="meet.google" />
                <TextField label="อีเมลผู้ปกครอง (อ่านอย่างเดียว)" readOnly defaultValue={EMAIL_60} />
                <TextField label="ปิดใช้งาน" disabled defaultValue="Passport Sim Tutor" />
                <TextAreaField label="รายละเอียด" optional placeholder="บอกนักเรียนเกี่ยวกับคลาสนี้" />
                <ChoiceDemo />
              </form>
            </ThemePair>
            <Surface padding="lg">
              <p className="type-body-s text-fg-muted">StickyActions (แถบล่างของฟอร์ม: เต็มกว้างบนมือถือ ลอยบนเดสก์ท็อป)</p>
              <StickyActions className="static mt-3">
                <Button variant="outline">ยกเลิก</Button>
                <Button onClick={() => toast.success("บันทึกแล้ว")}>บันทึกคลาส</Button>
              </StickyActions>
            </Surface>
          </Section>
        )}

        {show("controls") && (
          <Section id="controls" title="Segmented & tabs" description="เลือกอยู่ = พื้นการ์ด + ตัวหนา + ขอบ (ไม่ใช่สีอย่างเดียว) · แท็บเส้น 44px แถบ 3px">
            <ThemePair>
              <div className="flex flex-col gap-5">
                <Demo title="SegmentedControl + counts">
                  <SegmentedControl
                    aria-label="มุมมอง"
                    value={view}
                    onValueChange={setView}
                    items={[
                      { value: "list", label: "รายการ", icon: List, count: 14 },
                      { value: "grid", label: "การ์ด", icon: LayoutGrid },
                    ]}
                  />
                </Demo>
                <Demo title="ThemeSegmented">
                  <ThemeSegmented />
                </Demo>
                <Demo title="TabNav (route tabs)" className="block">
                  <TabNav
                    aria-label="แท็บคลาส"
                    items={[
                      { href: "/dev/ui-kit", label: "ภาพรวม" },
                      { href: "/dev/ui-kit/students", label: "นักเรียน", count: 6 },
                      { href: "/dev/ui-kit/schedule", label: "ตารางสอน" },
                      { href: "/dev/ui-kit/lessons", label: "บทเรียน" },
                    ]}
                  />
                </Demo>
                <Tabs defaultValue="overview">
                  <TabsList variant="line">
                    <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
                    <TabsTrigger value="lessons">บทเรียน</TabsTrigger>
                    <TabsTrigger value="students">นักเรียน</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="pt-2 text-fg-muted">
                    ui/Tabs variant=&quot;line&quot;
                  </TabsContent>
                  <TabsContent value="lessons" className="pt-2 text-fg-muted">
                    บทเรียน
                  </TabsContent>
                  <TabsContent value="students" className="pt-2 text-fg-muted">
                    นักเรียน
                  </TabsContent>
                </Tabs>
                <Tabs defaultValue="a">
                  <TabsList variant="segmented">
                    <TabsTrigger value="a">ทั้งหมด</TabsTrigger>
                    <TabsTrigger value="b">เปิดอยู่</TabsTrigger>
                    <TabsTrigger value="c">ปิดแล้ว</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </ThemePair>
          </Section>
        )}

        {show("feedback") && (
          <Section id="feedback" title="Feedback" description="Notice · EmptyState (Reedy 72 หรือไทล์) · ErrorState (ไทล์ 56) · Toast · Spinner · ProgressBar">
            <ThemePair>
              <div className="flex flex-col gap-3">
                <Notice tone="info" icon={Clock} title="เอกสารอยู่ระหว่างตรวจสอบ" href="#feedback">
                  เจ้าหน้าที่กำลังตรวจสอบเอกสารของคุณ
                </Notice>
                <Notice tone="warning" title="กรุณายืนยันตัวตนเพื่อรับเงิน">
                  ยังขาด: บัตรประชาชน, สมุดบัญชีธนาคาร
                </Notice>
                <Notice tone="success">บันทึกการตั้งค่าแล้ว</Notice>
                <Notice tone="danger" title="โอนเงินไม่สำเร็จ" action={<Button size="sm" variant="outline">ลองใหม่</Button>}>
                  เลขบัญชีไม่ตรงกับชื่อผู้รับ
                </Notice>
                <EmptyState
                  mascot
                  title="ยังไม่มีข้อความ"
                  description="เมื่อผู้ปกครองหรือนักเรียนส่งข้อความ จะแสดงที่นี่"
                  action={<Button variant="tonal">ดูคลาสของฉัน</Button>}
                />
                <EmptyState icon={Wallet} tone="brand" title="ยังไม่มีประวัติการจ่ายเงิน" description="เมื่อมีรอบบิลแรก รายการจะแสดงที่นี่" />
                <ErrorState
                  title="โหลดข้อมูลไม่สำเร็จ"
                  description="เช็กอินเทอร์เน็ตแล้วลองอีกครั้ง"
                  onRetry={() => new Promise((resolve) => setTimeout(resolve, 800))}
                  digest="abc123"
                />
                <Surface className="flex flex-wrap items-center gap-4">
                  <Spinner label="กำลังโหลด…" />
                  <Spinner size={24} />
                  <div className="flex w-full flex-col gap-2">
                    <ProgressBar value={36} label="เรียนแล้ว 5 จาก 14 บท" />
                    <ProgressBar value={100} tone="success" label="ครบแล้ว" />
                    <ProgressBar value={64} tone="warning" size="sm" label="ใกล้ครบกำหนด" />
                  </div>
                </Surface>
              </div>
            </ThemePair>
            <Surface className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => toast.success("บันทึกแล้ว")}>
                Toast success
              </Button>
              <Button variant="outline" onClick={() => toast.error("บันทึกไม่สำเร็จ", { description: "ลองใหม่อีกครั้ง" })}>
                Toast error
              </Button>
              <Button variant="outline" onClick={() => toast.warning("ใกล้หมดเวลาเรียน")}>
                Toast warning
              </Button>
              <Button variant="outline" onClick={() => toast.info("มีข้อความใหม่ 2 ข้อความ")}>
                Toast info
              </Button>
            </Surface>
          </Section>
        )}

        {show("loading") && (
          <Section id="loading" title="Skeletons" description="รูปทรงเหมือนหน้าจริง · ไม่ขยับเมื่อลดการเคลื่อนไหว">
            <ThemePair>
              <div className="flex flex-col gap-3">
                <StatGridSkeleton count={2} className="lg:grid-cols-2" />
                <ListSkeleton rows={2} />
                <CardSkeleton lines={2} />
                <TableSkeleton rows={2} columns={3} />
              </div>
            </ThemePair>
          </Section>
        )}

        {show("presenter") && (
          <Section
            id="presenter"
            title="Presenter primitives (components.md §6.1, §7)"
            description="สีตัวเลือก A–D จากโทเค็น --answer-* ชุดเดียวกับมือถือนักเรียน พร้อมรูปทรง · แท่งคำตอบที่ถูกใช้ --success-solid + ไอคอนเช็กและคำว่า “ถูก” · ชิ้นส่วนจริง (OptionTile, StageQuestion, ResultsBarChart)"
          >
            <ThemePair layout="stack">
              <div className="flex flex-col gap-4">
                <StagePanel className="px-6 py-5">
                  <StageEyebrow icon={ListChecks}>คำถามแบบเลือกตอบ · ข้อ 2/3</StageEyebrow>
                  <StageQuestion className="mt-1.5" lang="en">
                    Where does the friendly dolphin live?
                  </StageQuestion>
                </StagePanel>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {(["A", "B", "C", "D"] as const).map((key, index) => (
                    <OptionTile
                      key={key}
                      letter={key}
                      lang="en"
                      onSpeak={() => toast.info(`ฟังตัวเลือก ${key}`)}
                      speakLabel={`ฟังตัวเลือก ${key}`}
                      speakTitle="ฟังตัวเลือก"
                    >
                      {["In the sea", "In a river", "In a pool at the zoo", "In the sky"][index]}
                    </OptionTile>
                  ))}
                </div>
                <AnswerProgress answered={8} total={12} label="ส่งแล้ว" className="mx-auto" />
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                  <StagePanel className="flex flex-col gap-3 p-5">
                    <StageEyebrow icon={ListChecks}>สรุปคำตอบ (ResultsBarChart)</StageEyebrow>
                    <div className="h-52">
                      <LazyResultsBarChart
                        data={(["A", "B", "C", "D"] as const).map((key) => ({
                          name: key,
                          count: { A: 2, B: 1, C: 8, D: 1 }[key],
                          fill: key === "C" ? "var(--success-solid)" : OPTION_STYLES[key].bar,
                          correct: key === "C",
                        }))}
                      />
                    </div>
                  </StagePanel>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:content-start">
                    <ResultStat tone="success" label="ตอบถูก" value={8} unit="คน" />
                    <ResultStat tone="neutral" label="ยังไม่ถูก" value={4} unit="คน" />
                  </div>
                </div>
                <StageEmpty message="บทนี้ยังไม่มีคำถามสำหรับขั้นนี้" />
              </div>
            </ThemePair>
          </Section>
        )}

        {show("overlays") && (
          <Section id="overlays" title="Overlays" description="Sheet = bottom sheet บนมือถือ / dialog บนจอใหญ่ · ใช้ธีมของหน้า (portal)">
            <Surface className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setSheetOpen(true)}>
                เปิด Sheet
              </Button>
              <Button variant="outline" onClick={() => setConfirmOpen(true)}>
                ConfirmDialog
              </Button>
              <Dialog>
                <DialogTrigger render={<Button variant="outline" />}>ui/Dialog</DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>เลื่อนคลาส</DialogTitle>
                    <DialogDescription>เลือกวันและเวลาใหม่สำหรับคลาส {CLASS_NAME}</DialogDescription>
                  </DialogHeader>
                  <TextField label="วันที่ใหม่" type="date" />
                  <DialogFooter>
                    <Button>บันทึก</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Surface>
          </Section>
        )}

        {show("legacy") && (
          <Section id="legacy" title="Legacy components/ui (restyled)" description="หน้าเดิมที่ยังไม่ย้ายใช้ bg-card / text-muted-foreground / bg-primary ได้ — map ไปยังโทเค็นใหม่แล้ว">
            <ThemePair>
              <div className="flex flex-col gap-3">
                <UiCard>
                  <UiCardHeader>
                    <CardTitle>ui/Card</CardTitle>
                    <CardDescription>CardHeader / CardContent ยังใช้ได้เหมือนเดิม</CardDescription>
                  </UiCardHeader>
                  <CardContent>
                    <Progress value={40} />
                  </CardContent>
                </UiCard>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">bg-primary</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">bg-muted</span>
                  <span className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground">bg-accent</span>
                  <span className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground">bg-destructive</span>
                  <span className="bg-hero rounded-md px-2 py-1 text-xs text-hero-fg">bg-hero (flat)</span>
                  <span className="bg-gradient-brand rounded-md px-2 py-1 text-xs text-on-brand">bg-gradient-brand (flat)</span>
                </div>
              </div>
            </ThemePair>
          </Section>
        )}
      </Page>

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="เลือกบทเรียน"
        description={`บทเรียนถัดไปของคลาส ${CLASS_NAME} · ${CLASS_BOOK}`}
        footer={
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => setSheetOpen(false)}>ยืนยัน</Button>
          </div>
        }
      >
        <ListGroup>
          {["บทที่ 6 · The Friendly Dolphin", "บทที่ 7 · A Day at the Market", "บทที่ 8 · My Best Friend"].map((title) => (
            <ListRow key={title} title={title} subtitle="A0 · 12 นาที" onClick={() => setSheetOpen(false)} chevron />
          ))}
        </ListGroup>
      </Sheet>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="ลบคลาสนี้?"
        description="นักเรียน 6 คนจะไม่เห็นคลาสนี้อีก การลบไม่สามารถย้อนกลับได้"
        confirmLabel="ลบคลาส"
        tone="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          toast("ลบแล้ว (ตัวอย่าง)");
        }}
      />
    </AppShell>
  );
}
