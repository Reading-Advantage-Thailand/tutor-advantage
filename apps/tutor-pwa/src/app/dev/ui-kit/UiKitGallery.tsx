"use client";

import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Download,
  Gavel,
  LayoutGrid,
  List,
  MessageSquare,
  Plus,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  AppShell,
  CardHeader,
  CardSkeleton,
  Chip,
  ConfirmDialog,
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
  Notice,
  Page,
  PageHeader,
  ProgressBar,
  SearchField,
  Section,
  SegmentedControl,
  SelectField,
  Sheet,
  Spinner,
  SplitLayout,
  StatCard,
  StatGridSkeleton,
  StatusChip,
  StickyActions,
  Surface,
  TableSkeleton,
  TextAreaField,
  TextField,
  ThemeSegmented,
  Toolbar,
  UserAvatar,
  toast,
  type DataTableColumn,
} from "@/components/app";
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
import { formatTHB, formatThaiDate, formatThaiDateTime, formatTimeRange } from "@/lib/format";

const DEMO_USER = { tutorId: "dev-ui-kit", displayName: "ครูสมศรี ใจดี", email: "somsri@example.com", avatarUrl: null };

type Payout = { id: string; period: string; classes: number; gross: number; net: number; status: string; label: string };
const PAYOUTS: Payout[] = [
  { id: "p1", period: "2026-09-30T05:00:00Z", classes: 12, gross: 18500, net: 16650, status: "PAID", label: "โอนแล้ว" },
  { id: "p2", period: "2026-08-31T05:00:00Z", classes: 9, gross: 13200, net: 11880, status: "PENDING_TRANSFER", label: "รอโอน" },
  { id: "p3", period: "2026-07-31T05:00:00Z", classes: 4, gross: 5200, net: 4680, status: "TRANSFER_FAILED", label: "โอนไม่สำเร็จ" },
];
const PAYOUT_COLUMNS: DataTableColumn<Payout>[] = [
  { key: "period", header: "รอบบิล", cell: (p) => formatThaiDate(p.period, "long"), mobile: "primary" },
  { key: "classes", header: "จำนวนคลาส", align: "right", cell: (p) => `${p.classes} คลาส` },
  { key: "gross", header: "ยอดรวม", align: "right", cell: (p) => formatTHB(p.gross) },
  { key: "net", header: "ยอดสุทธิ", align: "right", cell: (p) => <span className="font-semibold">{formatTHB(p.net)}</span>, mobile: "trailing" },
  { key: "status", header: "สถานะ", cell: (p) => <StatusChip status={p.status} label={p.label} size="sm" /> },
];

const BRAND_SWATCHES: [string, string][] = [
  ["brand-50", "bg-brand-50"],
  ["brand-100", "bg-brand-100"],
  ["brand-200", "bg-brand-200"],
  ["brand-300", "bg-brand-300"],
  ["brand-400", "bg-brand-400"],
  ["brand-500", "bg-brand-500"],
  ["brand-600", "bg-brand-600"],
  ["brand-700", "bg-brand-700"],
  ["brand-800", "bg-brand-800"],
  ["brand-900", "bg-brand-900"],
];

const SECTIONS = [
  "tokens",
  "type",
  "buttons",
  "chips",
  "stats",
  "cards",
  "lists",
  "table",
  "forms",
  "controls",
  "feedback",
  "loading",
  "overlays",
  "legacy",
] as const;

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`size-9 shrink-0 rounded-lg border border-hairline ${className}`} />
      <code className="truncate text-xs text-fg-muted">{name}</code>
    </div>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-fg-subtle">{title}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function UiKitGallery({ only }: { only?: string }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const show = (id: (typeof SECTIONS)[number]) => !only || only === id;

  return (
    <AppShell user={DEMO_USER} initialNotifications={{ unreadChat: 3, availableAuctions: 1 }}>
      <Page>
        <PageHeader
          title="UI kit"
          description="ชุดคอมโพเนนต์และโทเค็นของแอปครู (เฉพาะโหมดพัฒนา) — สลับธีมเพื่อดูโหมดมืด"
          meta={
            <>
              <Chip tone="brand">components/app</Chip>
              <Chip tone="neutral">components/ui</Chip>
            </>
          }
          actions={
            <>
              <ThemeSegmented />
              <Button>
                <Plus /> สร้างคลาสใหม่
              </Button>
            </>
          }
        />

        {show("tokens") && (
          <Section id="tokens" title="Tokens" description="ใช้คลาสจากโทเค็นเท่านั้น (bg-surface, text-fg-muted, bg-brand-solid …)">
            <Surface>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {BRAND_SWATCHES.map(([name, className]) => (
                  <Swatch key={name} name={name} className={className} />
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-hairline pt-5 sm:grid-cols-3 lg:grid-cols-5">
                <Swatch name="bg-app" className="bg-app" />
                <Swatch name="bg-surface" className="bg-surface" />
                <Swatch name="bg-surface-muted" className="bg-surface-muted" />
                <Swatch name="bg-brand-solid" className="bg-brand-solid" />
                <Swatch name="bg-brand-soft" className="bg-brand-soft" />
                <Swatch name="success-bg" className="bg-success-bg" />
                <Swatch name="warning-bg" className="bg-warning-bg" />
                <Swatch name="danger-bg" className="bg-danger-bg" />
                <Swatch name="info-bg" className="bg-info-bg" />
                <Swatch name="bg-hero" className="bg-hero" />
                <Swatch name="tile-teal" className="bg-tile-teal" />
                <Swatch name="tile-orange" className="bg-tile-orange" />
                <Swatch name="tile-blue" className="bg-tile-blue" />
                <Swatch name="tile-amber" className="bg-tile-amber" />
                <Swatch name="tile-purple" className="bg-tile-purple" />
              </div>
            </Surface>
          </Section>
        )}

        {show("type") && (
          <Section id="type" title="Typography" description="สเกลเดียวทั้งแอป ไม่ใช้ตัวพิมพ์ใหญ่หรือระยะห่างตัวอักษรกว้างกับภาษาไทย">
            <Surface className="flex flex-col gap-3">
              <p className="text-3xl font-bold">text-3xl bold — ตัวเลขใหญ่ ฿18,500</p>
              <p className="text-2xl font-bold">text-2xl bold — หัวข้อหน้า ภาพรวมการสอน</p>
              <p className="text-xl font-semibold">text-xl semibold — ชื่อคลาส Reading Advantage</p>
              <p className="text-base font-semibold">text-base semibold — หัวข้อส่วน คลาสวันนี้</p>
              <p className="text-sm">text-sm — เนื้อหาทั่วไป นักเรียนเข้าร่วมแล้ว 12 คน จาก 15 คน</p>
              <p className="text-[0.8125rem] text-fg-muted">13px muted — คำอธิบายรอง อัปเดตล่าสุด {formatThaiDateTime(new Date())}</p>
              <p className="text-xs text-fg-subtle">text-xs subtle — หมายเหตุ</p>
            </Surface>
          </Section>
        )}

        {show("buttons") && (
          <Section id="buttons" title="Buttons">
            <Surface className="flex flex-col gap-5">
              <Demo title="Variants">
                <Button>บันทึก</Button>
                <Button variant="soft">ดูรายละเอียด</Button>
                <Button variant="outline">ส่งออก CSV</Button>
                <Button variant="secondary">ยกเลิก</Button>
                <Button variant="ghost">ข้าม</Button>
                <Button variant="danger">ลบคลาส</Button>
                <Button variant="destructive">ลบ (tonal)</Button>
                <Button variant="link">ลิงก์</Button>
              </Demo>
              <Demo title="Sizes">
                <Button size="xs">xs</Button>
                <Button size="sm">sm</Button>
                <Button>default</Button>
                <Button size="lg">lg</Button>
                <Button size="xl">xl เริ่มสอน</Button>
              </Demo>
              <Demo title="States & icons">
                <Button loading>กำลังบันทึก</Button>
                <Button disabled>ปิดใช้งาน</Button>
                <Button variant="outline">
                  <Download /> ดาวน์โหลด
                </Button>
                <Button size="icon" variant="outline" aria-label="ลบ">
                  <Trash2 />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="ถัดไป">
                  <ChevronRight />
                </Button>
              </Demo>
            </Surface>
          </Section>
        )}

        {show("chips") && (
          <Section id="chips" title="Chips & badges">
            <Surface className="flex flex-col gap-4">
              <Demo title="Chip tones">
                <Chip tone="brand">เปิดรับสมัคร</Chip>
                <Chip tone="success" dot>กำลังสอน</Chip>
                <Chip tone="warning">รอตรวจสอบ</Chip>
                <Chip tone="danger">ยกเลิก</Chip>
                <Chip tone="info" icon={CalendarDays}>พรุ่งนี้ 18:00</Chip>
                <Chip tone="neutral" icon={Users}>12 คน</Chip>
                <Chip tone="neutral" size="sm">sm</Chip>
              </Demo>
              <Demo title="StatusChip (status → tone)">
                {["PAID", "PENDING", "FAILED", "RUNNING", "CLOSED"].map((status) => (
                  <StatusChip key={status} status={status} />
                ))}
              </Demo>
              <Demo title="ui/Badge (legacy API)">
                <Badge>default</Badge>
                <Badge variant="secondary">secondary</Badge>
                <Badge variant="success">success</Badge>
                <Badge variant="warning">warning</Badge>
                <Badge variant="destructive">destructive</Badge>
                <Badge variant="outline">outline</Badge>
              </Demo>
            </Surface>
          </Section>
        )}

        {show("stats") && (
          <Section id="stats" title="Stat cards" description="การ์ดตัวเลขสีกลาง ใช้ไอคอนสีเดียวต่อความหมาย">
            <Grid cols={4} className="grid-cols-2 sm:grid-cols-2">
              <StatCard label="รายได้เดือนนี้" value={formatTHB(18500)} icon={Wallet} tone="brand" delta={{ value: "+12%", direction: "up" }} hint="เทียบเดือนก่อน" />
              <StatCard label="นักเรียนทั้งหมด" value="48" icon={Users} tone="teal" hint="ใน 4 คลาส" />
              <StatCard label="คลาสสัปดาห์นี้" value="6" icon={CalendarDays} tone="blue" href="#stats" />
              <StatCard label="อัตราการเข้าเรียน" value="92%" icon={BookOpen} tone="orange" delta={{ value: "-3%", direction: "down" }} />
            </Grid>
          </Section>
        )}

        {show("cards") && (
          <Section id="cards" title="Cards / surfaces">
            <SplitLayout
              main={
                <>
                  <Surface padding="lg">
                    <CardHeader
                      icon={<IconTile icon={BookOpen} tone="brand" />}
                      title="คลาส Reading Advantage 1"
                      description={`ทุกวันจันทร์ ${formatTimeRange("2026-10-05T11:00:00Z", "2026-10-05T12:30:00Z")}`}
                      action={<Chip tone="success" dot>เปิดรับสมัคร</Chip>}
                    />
                    <DescriptionList
                      items={[
                        { label: "ระดับ", value: "A2 – B1" },
                        { label: "นักเรียน", value: "12 / 15 คน" },
                        { label: "เริ่มเรียน", value: formatThaiDate("2026-10-05T11:00:00Z", "full") },
                        { label: "ค่าเรียน", value: formatTHB(2490) },
                      ]}
                    />
                  </Surface>
                  <Surface tone="hero" padding="lg">
                    <p className="text-sm text-hero-fg-muted">คลาสถัดไป · วันนี้ 18:00 น.</p>
                    <p className="mt-1 text-xl font-bold">Reading Advantage 1 — บทที่ 4</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button>เริ่มสอน</Button>
                      <Button variant="outline">เตรียมบทเรียน</Button>
                    </div>
                  </Surface>
                </>
              }
              side={
                <>
                  <Surface tone="brand">
                    <p className="text-sm font-semibold text-brand-fg">เป้าหมายเรทถัดไป</p>
                    <p className="mt-1 text-2xl font-bold tabular">43%</p>
                    <ProgressBar value={50} className="mt-3" label="ความคืบหน้า" />
                    <p className="mt-2 text-xs text-fg-muted">ขาดอีก {formatTHB(5000)}</p>
                  </Surface>
                  <Surface tone="muted">
                    <p className="text-sm text-fg-muted">tone=&quot;muted&quot; สำหรับกล่องรอง</p>
                  </Surface>
                  <Surface href="#cards">
                    <p className="text-sm font-medium">การ์ดที่กดได้ (href)</p>
                  </Surface>
                </>
              }
            />
          </Section>
        )}

        {show("lists") && (
          <Section id="lists" title="Lists">
            <Grid cols={2}>
              <ListGroup header="คลาสวันนี้" headerAction={<Button variant="link" size="sm">ดูทั้งหมด</Button>}>
                <ListRow
                  href="#lists"
                  leading={<IconTile icon={BookOpen} tone="brand" />}
                  title="Reading Advantage 1"
                  subtitle="18:00–19:30 น. · 12 คน"
                  trailing={<Chip tone="success" size="sm" dot>ใกล้เริ่ม</Chip>}
                />
                <ListRow
                  href="#lists"
                  leading={<IconTile icon={BookOpen} tone="teal" />}
                  title="Speaking Club B1"
                  subtitle="20:00–21:00 น. · 8 คน"
                  meta={<><Chip size="sm">บทที่ 6</Chip><Chip size="sm" tone="info">ออนไลน์</Chip></>}
                />
                <ListRow leading={<UserAvatar name="ด.ญ. มะลิ สวยงาม" />} title="ด.ญ. มะลิ สวยงาม" subtitle="เข้าร่วมล่าสุด เมื่อวาน" trailing={formatTHB(2490)} />
              </ListGroup>
              <ListGroup header="การตั้งค่า" footer="การแจ้งเตือนจะเล่นเสียงเมื่อมีข้อความใหม่">
                <ListRow
                  leading={<IconTile icon={MessageSquare} tone="blue" size="sm" />}
                  title="เสียงแจ้งเตือนข้อความ"
                  trailing={<Switch checked={notify} onCheckedChange={setNotify} aria-label="เสียงแจ้งเตือน" />}
                />
                <ListRow leading={<IconTile icon={Gavel} tone="amber" size="sm" />} title="คลาสรอรับ" trailing="2" onClick={() => toast("กดแถวแล้ว")} chevron />
                <ListRow leading={<IconTile icon={Trash2} tone="red" size="sm" />} title="ลบบัญชี" destructive onClick={() => setConfirmOpen(true)} />
              </ListGroup>
            </Grid>
          </Section>
        )}

        {show("table") && (
          <Section id="table" title="Data table" description="ตารางบนจอใหญ่ กลายเป็นการ์ดบนมือถือ">
            <Toolbar>
              <SearchField value={query} onValueChange={setQuery} label="ค้นหารอบบิล" />
              <SegmentedControl
                aria-label="ช่วงเวลา"
                value={period}
                onValueChange={setPeriod}
                items={[
                  { value: "week", label: "สัปดาห์" },
                  { value: "month", label: "เดือน" },
                  { value: "year", label: "ปี" },
                ]}
              />
            </Toolbar>
            <DataTable
              caption="ประวัติการจ่ายเงิน"
              rows={PAYOUTS}
              getRowKey={(row) => row.id}
              columns={PAYOUT_COLUMNS}
              rowHref={() => "#table"}
              footer={<p className="text-xs text-fg-muted">แสดง 3 จาก 3 รายการ</p>}
            />
            <DataTable
              caption="ว่าง"
              rows={[] as Payout[]}
              getRowKey={(row) => row.id}
              columns={PAYOUT_COLUMNS}
              empty={<EmptyState icon={Wallet} title="ยังไม่มีประวัติการจ่ายเงิน" description="เมื่อมีรอบบิลแรก รายการจะแสดงที่นี่" />}
            />
          </Section>
        )}

        {show("forms") && (
          <Section id="forms" title="Forms">
            <Surface padding="lg">
              <form className="flex flex-col gap-5" onSubmit={(event) => event.preventDefault()}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TextField label="ชื่อคลาส" placeholder="เช่น Reading Advantage 1" required hint="นักเรียนจะเห็นชื่อนี้" />
                  <TextField label="ค่าเรียน" startAddon="฿" inputMode="numeric" defaultValue="2490" endAddon="บาท" />
                  <SelectField
                    label="ระดับ"
                    placeholder="เลือกระดับ"
                    options={[
                      { value: "a1", label: "A1" },
                      { value: "a2", label: "A2" },
                      { value: "b1", label: "B1" },
                    ]}
                  />
                  <TextField label="ลิงก์ห้องเรียน" type="url" error="ลิงก์ไม่ถูกต้อง" defaultValue="meet.google" />
                </div>
                <TextAreaField label="รายละเอียด" optional placeholder="บอกนักเรียนเกี่ยวกับคลาสนี้" />
                <Field label="ตัวเลือก">
                  <div className="flex flex-wrap items-center gap-5">
                    <div className="flex items-center gap-2">
                      <Checkbox id="kit-cb" defaultChecked />
                      <Label htmlFor="kit-cb">เปิดให้สมัครทันที</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="kit-sw" defaultChecked />
                      <Label htmlFor="kit-sw">แจ้งเตือนนักเรียน</Label>
                    </div>
                  </div>
                </Field>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="kit-input">ui/Input (legacy)</Label>
                  <Input id="kit-input" placeholder="Input จาก components/ui" />
                </div>
                <StickyActions>
                  <Button variant="ghost">ยกเลิก</Button>
                  <Button onClick={() => toast.success("บันทึกแล้ว")}>บันทึกคลาส</Button>
                </StickyActions>
              </form>
            </Surface>
          </Section>
        )}

        {show("controls") && (
          <Section id="controls" title="Tabs & segmented">
            <Surface className="flex flex-col gap-5">
              <Demo title="SegmentedControl">
                <SegmentedControl
                  aria-label="มุมมอง"
                  value={view}
                  onValueChange={setView}
                  items={[
                    { value: "list", label: "รายการ", icon: List },
                    { value: "grid", label: "การ์ด", icon: LayoutGrid },
                  ]}
                />
                <ThemeSegmented />
              </Demo>
              <Tabs defaultValue="overview">
                <TabsList variant="line">
                  <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
                  <TabsTrigger value="lessons">บทเรียน</TabsTrigger>
                  <TabsTrigger value="students">นักเรียน</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="pt-3 text-fg-muted">เนื้อหาแท็บภาพรวม (ui/Tabs variant=&quot;line&quot;)</TabsContent>
                <TabsContent value="lessons" className="pt-3 text-fg-muted">บทเรียน</TabsContent>
                <TabsContent value="students" className="pt-3 text-fg-muted">นักเรียน</TabsContent>
              </Tabs>
              <Tabs defaultValue="a">
                <TabsList>
                  <TabsTrigger value="a">ทั้งหมด</TabsTrigger>
                  <TabsTrigger value="b">เปิดอยู่</TabsTrigger>
                  <TabsTrigger value="c">ปิดแล้ว</TabsTrigger>
                </TabsList>
              </Tabs>
            </Surface>
          </Section>
        )}

        {show("feedback") && (
          <Section id="feedback" title="Feedback">
            <div className="flex flex-col gap-3">
              <Notice tone="warning" title="กรุณายืนยันตัวตนเพื่อรับเงิน" href="#feedback">
                ยังขาด: บัตรประชาชน, สมุดบัญชีธนาคาร
              </Notice>
              <Notice tone="info" title="กำลังตรวจสอบเอกสาร">ทีมงานจะแจ้งผลภายใน 1–2 วันทำการ</Notice>
              <Notice tone="success">บันทึกการตั้งค่าแล้ว</Notice>
              <Notice tone="danger" title="โอนเงินไม่สำเร็จ" action={<Button size="sm" variant="outline">ลองใหม่</Button>}>
                เลขบัญชีไม่ตรงกับชื่อผู้รับ
              </Notice>
            </div>
            <Grid cols={2}>
              <EmptyState
                icon={MessageSquare}
                tone="blue"
                title="ยังไม่มีข้อความ"
                description="เมื่อผู้ปกครองหรือนักเรียนส่งข้อความ จะแสดงที่นี่"
                action={<Button variant="outline">ดูคลาสของฉัน</Button>}
              />
              <ErrorState onRetry={() => new Promise((resolve) => setTimeout(resolve, 800))} digest="abc123" />
            </Grid>
            <Surface className="flex flex-wrap items-center gap-4">
              <Button variant="outline" onClick={() => toast.success("บันทึกแล้ว")}>Toast success</Button>
              <Button variant="outline" onClick={() => toast.error("บันทึกไม่สำเร็จ", { description: "ลองใหม่อีกครั้ง" })}>Toast error</Button>
              <Spinner label="กำลังโหลด…" />
              <ProgressBar value={64} className="max-w-48" label="ความคืบหน้า" />
            </Surface>
          </Section>
        )}

        {show("loading") && (
          <Section id="loading" title="Skeletons">
            <StatGridSkeleton />
            <Grid cols={2}>
              <ListSkeleton rows={3} />
              <CardSkeleton />
            </Grid>
            <TableSkeleton rows={3} />
          </Section>
        )}

        {show("overlays") && (
          <Section id="overlays" title="Overlays" description="Sheet = bottom sheet บนมือถือ / dialog บนจอใหญ่">
            <Surface className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setSheetOpen(true)}>เปิด Sheet</Button>
              <Button variant="outline" onClick={() => setConfirmOpen(true)}>ConfirmDialog</Button>
              <Dialog>
                <DialogTrigger render={<Button variant="outline" />}>ui/Dialog</DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>เลื่อนคลาส</DialogTitle>
                    <DialogDescription>เลือกวันและเวลาใหม่สำหรับคลาสนี้</DialogDescription>
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
          <Section id="legacy" title="Legacy components/ui (restyled)">
            <Grid cols={2}>
              <UiCard>
                <UiCardHeader>
                  <CardTitle>ui/Card</CardTitle>
                  <CardDescription>CardHeader / CardContent ยังใช้ได้เหมือนเดิม</CardDescription>
                </UiCardHeader>
                <CardContent>
                  <Progress value={40} />
                </CardContent>
              </UiCard>
              <Surface>
                <p className="text-sm text-fg-muted">
                  หน้าเดิมที่ยังไม่ย้าย ใช้ bg-card / text-muted-foreground / bg-primary ได้ — โทเค็นถูก map ไปยังพาเลตใหม่แล้ว
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">bg-primary</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">bg-muted</span>
                  <span className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground">bg-accent</span>
                </div>
              </Surface>
            </Grid>
          </Section>
        )}
      </Page>

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="เลือกบทเรียน"
        description="บทเรียนถัดไปของคลาส Reading Advantage 1"
        footer={
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" onClick={() => setSheetOpen(false)}>ยกเลิก</Button>
            <Button onClick={() => setSheetOpen(false)}>ยืนยัน</Button>
          </div>
        }
      >
        <ListGroup>
          {["บทที่ 4: The Lost Kite", "บทที่ 5: A Day at the Market", "บทที่ 6: My Best Friend"].map((title) => (
            <ListRow key={title} title={title} subtitle="A2 · 12 นาที" onClick={() => setSheetOpen(false)} chevron />
          ))}
        </ListGroup>
      </Sheet>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="ลบคลาสนี้?"
        description="นักเรียน 12 คนจะไม่เห็นคลาสนี้อีก การลบไม่สามารถย้อนกลับได้"
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
