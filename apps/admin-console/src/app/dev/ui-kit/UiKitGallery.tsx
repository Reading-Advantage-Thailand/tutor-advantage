"use client";

import {
  AlertTriangle,
  Banknote,
  Download,
  FilePenLine,
  Inbox,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  AdminStatusChip,
  Chip,
  ColumnToggle,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  Grid,
  IconTile,
  IdCell,
  ListGroup,
  ListRow,
  Money,
  Notice,
  Page,
  PageHeader,
  Pagination,
  PageSkeleton,
  Section,
  SegmentedControl,
  SelectField,
  Sheet,
  SplitLayout,
  StatCard,
  Surface,
  CardHeader,
  TableSkeleton,
  TextAreaField,
  TextField,
  ThemeSegmented,
  toast,
  useColumnVisibility,
  type DataTableColumn,
} from "@/components/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTableState } from "@/hooks/useTableState";
import { formatPeriodMonth, formatThaiDate, formatThaiDateTime, previousBangkokMonth } from "@/lib/format";
import { ADMIN_STATUS, statusOptions, type StatusDomain } from "@/lib/status";

const SECTIONS = [
  { id: "tokens", title: "สีและโทน" },
  { id: "type", title: "ตัวอักษร" },
  { id: "buttons", title: "ปุ่ม" },
  { id: "status", title: "สถานะ (ไทย)" },
  { id: "stats", title: "สถิติ" },
  { id: "cards", title: "การ์ดและรายการ" },
  { id: "table", title: "ตารางข้อมูล" },
  { id: "forms", title: "ฟอร์ม" },
  { id: "feedback", title: "การแจ้งเตือนและสถานะว่าง" },
  { id: "loading", title: "สถานะกำลังโหลด" },
  { id: "overlays", title: "หน้าต่างยืนยัน" },
] as const;

function Block({ id, title, only, children }: { id: string; title: string; only?: string; children: ReactNode }) {
  if (only && only !== id) return null;
  return (
    <Section id={id} title={title}>
      {children}
    </Section>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`size-8 shrink-0 rounded-lg border border-hairline ${className}`} />
      <code className="truncate text-xs text-fg-muted">{label}</code>
    </div>
  );
}

interface DemoRun {
  id: string;
  period: string;
  status: string;
  lines: number;
  netSatang: number;
  createdAt: string;
}

const DEMO_RUNS: DemoRun[] = Array.from({ length: 47 }, (_, index) => {
  const statuses = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ADJUSTMENT_PENDING"];
  const month = ((index % 12) + 1).toString().padStart(2, "0");
  return {
    id: `5eed0000-0000-4000-8000-${(1000 + index).toString().padStart(12, "0")}`,
    period: `${2026 - Math.floor(index / 12)}-${month}`,
    status: statuses[index % statuses.length],
    lines: (index * 7) % 40,
    netSatang: ((index * 731_17) % 9_000_000) - (index % 9 === 0 ? 50_000 : 0),
    createdAt: new Date(Date.UTC(2026, 8, 30 - (index % 28), 3 + (index % 10))).toISOString(),
  };
});

function TableDemo() {
  const table = useTableState({
    prefix: "demo",
    defaultPageSize: 10,
    defaultSort: { key: "period", dir: "desc" },
    sortKeys: ["period", "lines", "net", "createdAt"],
    filterKeys: ["status"],
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const columns: DataTableColumn<DemoRun>[] = useMemo(
    () => [
      { key: "period", header: "รอบเดือน", sortable: true, sticky: true, alwaysVisible: true, cell: (r) => formatPeriodMonth(r.period), mobile: "primary" },
      { key: "status", header: "สถานะ", cell: (r) => <AdminStatusChip domain="settlementRun" status={r.status} />, mobile: "trailing" },
      { key: "lines", header: "จำนวนครู", align: "right", sortable: true, cell: (r) => r.lines.toLocaleString("th-TH") },
      { key: "net", header: "ยอดจ่ายสุทธิ", align: "right", sortable: true, cell: (r) => <Money satang={r.netSatang} />, mobile: "trailing" },
      { key: "createdAt", header: "สร้างเมื่อ", sortable: true, cell: (r) => formatThaiDateTime(r.createdAt), mobile: "secondary" },
      { key: "id", header: "รหัสอ้างอิง", label: "รหัสอ้างอิง", defaultHidden: true, cell: (r) => <IdCell id={r.id} /> },
    ],
    [],
  );
  const visibility = useColumnVisibility("ui-kit-demo", columns);

  // Simulates the server: filter → sort → page.
  const filtered = DEMO_RUNS.filter(
    (r) => (!table.filters.status || r.status === table.filters.status) && (!table.q || r.period.includes(table.q)),
  );
  const sorted = [...filtered].sort((a, b) => {
    if (!table.sort) return 0;
    const dir = table.sort.dir === "asc" ? 1 : -1;
    const value = (r: DemoRun) =>
      table.sort?.key === "lines" ? r.lines : table.sort?.key === "net" ? r.netSatang : table.sort?.key === "createdAt" ? r.createdAt : r.period;
    return value(a) > value(b) ? dir : value(a) < value(b) ? -dir : 0;
  });
  const rows = sorted.slice((table.page - 1) * table.pageSize, table.page * table.pageSize);

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: "ค้นหาเดือน เช่น 2026-08" }}
        isFiltered={table.isFiltered}
        onReset={table.reset}
        actions={
          <>
            <ColumnToggle columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />
            <Button variant="outline">
              <Download aria-hidden="true" /> ส่งออก CSV
            </Button>
          </>
        }
      >
        <SelectField
          aria-label="สถานะ"
          containerClassName="w-full sm:w-44"
          value={table.filters.status ?? ""}
          onChange={(event) => table.setFilter("status", event.target.value)}
          options={statusOptions("settlementRun", { all: "ทุกสถานะ" })}
        />
      </FilterBar>
      <DataTable
        caption="รอบจ่ายเงินตัวอย่าง"
        rows={rows}
        columns={columns}
        getRowKey={(r) => r.id}
        sort={table.sort}
        onSortChange={table.toggleSort}
        hiddenColumns={visibility.hidden}
        selection={{ selected, onChange: setSelected, isSelectable: (key) => !key.endsWith("1003") }}
        bulkActions={(count) => (
          <Button size="sm" variant="outline" onClick={() => toast.success(`ส่งออก ${count} รายการ`)}>
            ส่งออกที่เลือก
          </Button>
        )}
        empty={<EmptyState compact icon={Inbox} title="ไม่พบรอบจ่ายเงิน" description="ลองเปลี่ยนตัวกรองหรือคำค้นหา" />}
        footer={
          <Pagination
            page={table.page}
            pageSize={table.pageSize}
            total={filtered.length}
            onPageChange={table.setPage}
            onPageSizeChange={table.setPageSize}
          />
        }
      />
      <p className="text-xs text-fg-muted">
        สถานะตาราง (URL): <code>{table.queryKey}</code>
      </p>
    </div>
  );
}

function OverlaysDemo() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirm, setConfirm] = useState<"none" | "brand" | "danger" | "fail">("none");
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setSheetOpen(true)}>
        เปิด Sheet (ฟอร์ม)
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
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="สร้างคูปองชั่วโมงสอน"
        description="คูปองใช้ได้ครั้งเดียว"
        footer={
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" onClick={() => setSheetOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => setSheetOpen(false)}>สร้างคูปอง</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="จำนวนชั่วโมง" inputMode="numeric" required endAddon="ชม." />
          <TextAreaField label="หมายเหตุ" optional />
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
              { label: "รอบเดือน", value: formatPeriodMonth("2026-08") },
              { label: "ยอดรวม", value: <Money satang={4_512_000} /> },
            ]}
          />
        }
        requireText="2026-08"
        reason
        confirmLabel="ยืนยันการโอน"
        onConfirm={({ reason }) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              toast.success("สั่งโอนแล้ว", { description: `เหตุผล: ${reason}` });
              resolve();
            }, 800),
          )
        }
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

export function UiKitGallery({ only }: { only?: string }) {
  const [segment, setSegment] = useState<"all" | "pending">("all");
  const [checked, setChecked] = useState(true);
  const domains = Object.keys(ADMIN_STATUS) as StatusDomain[];
  return (
    <Page>
      <PageHeader
        title="ชุดคอมโพเนนต์ผู้ดูแลระบบ"
        description={`ตัวอย่างคอมโพเนนต์ใน src/components/app · รอบเดือนก่อนหน้า (เวลาไทย): ${formatPeriodMonth(previousBangkokMonth())}`}
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
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-hairline bg-surface px-3 py-1 text-sm text-fg-muted hover:text-fg">
              {s.title}
            </a>
          ))}
        </nav>
      ) : null}

      <Block id="tokens" title="สีและโทน" only={only}>
        <Surface>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Swatch className="bg-app" label="bg-app" />
            <Swatch className="bg-surface" label="bg-surface" />
            <Swatch className="bg-surface-muted" label="bg-surface-muted" />
            <Swatch className="bg-brand-solid" label="bg-brand-solid" />
            <Swatch className="bg-brand-soft" label="bg-brand-soft" />
            <Swatch className="bg-brand-vivid" label="bg-brand-vivid" />
            <Swatch className="bg-success-bg" label="success-bg" />
            <Swatch className="bg-warning-bg" label="warning-bg" />
            <Swatch className="bg-danger-bg" label="danger-bg" />
            <Swatch className="bg-info-bg" label="info-bg" />
            <Swatch className="bg-neutral-bg" label="neutral-bg" />
            <Swatch className="bg-danger-solid" label="danger-solid" />
          </div>
        </Surface>
      </Block>

      <Block id="type" title="ตัวอักษร" only={only}>
        <Surface className="flex flex-col gap-2">
          <p className="text-2xl font-bold">หัวข้อหน้า 24px · ฿1,234,567.89</p>
          <p className="text-base font-semibold">หัวข้อส่วน 16px</p>
          <p className="text-sm">เนื้อหา 14px: ผู้ตรวจสอบการเงินอนุมัติรอบจ่ายเงินเดือนสิงหาคม 2569 แล้ว</p>
          <p className="text-[0.8125rem] text-fg-muted">ข้อความรอง 13px · {formatThaiDateTime(new Date())}</p>
          <p className="text-xs text-fg-subtle">คำอธิบาย 12px · {formatThaiDate(new Date(), "long")}</p>
        </Surface>
      </Block>

      <Block id="buttons" title="ปุ่ม" only={only}>
        <Surface className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button>หลัก</Button>
            <Button variant="soft">รอง (โทนเขียว)</Button>
            <Button variant="outline">ขอบ</Button>
            <Button variant="secondary">พื้นเทา</Button>
            <Button variant="ghost">โปร่ง</Button>
            <Button variant="danger">อันตราย</Button>
            <Button variant="destructive">ลบ (โทน)</Button>
            <Button variant="link">ลิงก์</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs">xs</Button>
            <Button size="sm">sm</Button>
            <Button>default</Button>
            <Button size="lg">lg</Button>
            <Button loading>กำลังบันทึก</Button>
            <Button disabled>ปิดใช้งาน</Button>
            <Button size="icon" variant="outline" aria-label="รีเฟรช">
              <RefreshCw />
            </Button>
          </div>
        </Surface>
      </Block>

      <Block id="status" title="สถานะ (ไทย)" only={only}>
        <Surface className="flex flex-col gap-3">
          {domains.map((domain) => (
            <div key={domain} className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
              <code className="w-40 shrink-0 text-xs text-fg-muted">{domain}</code>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(ADMIN_STATUS[domain]).map((status) => (
                  <AdminStatusChip key={status} domain={domain} status={status} />
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="brand">brand</Chip>
            <Badge variant="warning">Badge warning</Badge>
            <Badge variant="outline">Badge outline</Badge>
          </div>
        </Surface>
      </Block>

      <Block id="stats" title="สถิติ" only={only}>
        <Grid cols={4} className="grid-cols-2">
          <StatCard label="รออนุมัติ" value="3" icon={ReceiptText} tone="amber" hint="รอบจ่ายเงิน" href="/settlements" />
          <StatCard label="ยอดจ่ายเดือนนี้" value={<Money satang={45_120_000} />} icon={Banknote} tone="brand" delta={{ value: "+12%", direction: "up" }} />
          <StatCard label="ผู้ใช้รอตรวจเอกสาร" value="2" icon={Users} tone="blue" />
          <StatCard label="ความเสี่ยงเปิดอยู่" value="4" icon={ShieldAlert} tone="red" delta={{ value: "-1", direction: "down", positive: true }} />
        </Grid>
      </Block>

      <Block id="cards" title="การ์ดและรายการ" only={only}>
        <SplitLayout
          main={
            <Surface>
              <CardHeader title="รายละเอียดรอบจ่ายเงิน" description="ข้อมูลสรุป" icon={<IconTile icon={ReceiptText} size="sm" />} action={<AdminStatusChip domain="settlementRun" status="SUBMITTED" size="md" />} />
              <DescriptionList
                items={[
                  { label: "รอบเดือน", value: formatPeriodMonth("2026-08") },
                  { label: "ยอดสุทธิ", value: <Money satang={1_234_500} /> },
                  { label: "รหัสอ้างอิง", value: <IdCell id="5eed0000-0000-4000-8000-000000000a01" /> },
                  { label: "สร้างเมื่อ", value: formatThaiDateTime("2026-09-01T03:00:00Z") },
                ]}
              />
            </Surface>
          }
          side={
            <ListGroup header="งานที่รอดำเนินการ">
              <ListRow href="/settlements" leading={<IconTile icon={ReceiptText} tone="amber" size="sm" />} title="รอบจ่ายเงินรออนุมัติ" trailing={<Chip tone="warning" size="sm">1</Chip>} />
              <ListRow href="/adjustments" leading={<IconTile icon={FilePenLine} tone="blue" size="sm" />} title="ปรับปรุงยอดรออนุมัติ" trailing={<Chip size="sm">2</Chip>} />
              <ListRow leading={<IconTile icon={AlertTriangle} tone="red" size="sm" />} title="รายการผิดปกติ" subtitle="4 รายการยังไม่แก้ไข" />
            </ListGroup>
          }
        />
      </Block>

      <Block id="table" title="ตารางข้อมูล" only={only}>
        <TableDemo />
      </Block>

      <Block id="forms" title="ฟอร์ม" only={only}>
        <Surface className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="รหัสครู" hint="ค้นหาด้วยชื่อหรืออีเมลก็ได้" placeholder="เช่น ครูสมใจ" />
          <TextField label="จำนวนเงิน" required startAddon="฿" inputMode="decimal" error="กรุณาระบุจำนวนเงิน" />
          <SelectField label="สถานะ" placeholder="เลือกสถานะ" options={statusOptions("adjustment")} />
          <TextField label="วันหมดอายุ" type="date" optional />
          <TextAreaField label="เหตุผล" containerClassName="md:col-span-2" />
          <div className="flex flex-wrap items-center gap-4 md:col-span-2">
            <SegmentedControl
              aria-label="มุมมอง"
              value={segment}
              onValueChange={setSegment}
              items={[
                { value: "all", label: "ทั้งหมด", count: 47 },
                { value: "pending", label: "รอดำเนินการ", count: 3 },
              ]}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(value) => setChecked(Boolean(value))} /> ส่งอีเมลแจ้งครู
            </label>
          </div>
        </Surface>
      </Block>

      <Block id="feedback" title="การแจ้งเตือนและสถานะว่าง" only={only}>
        <div className="flex flex-col gap-3">
          <Notice tone="info" title="ยังไม่ถึงวันคำนวณรอบจ่ายเงิน">ระบบจะคำนวณอัตโนมัติวันที่ 1 ของทุกเดือน</Notice>
          <Notice tone="warning" title="มีรายการปรับปรุงยอดรออนุมัติ" action={<Button size="sm" variant="outline">ดูรายการ</Button>}>
            ต้องอนุมัติหรือปฏิเสธให้ครบก่อนอนุมัติรอบนี้
          </Notice>
          <Notice tone="danger">โอนเงินไม่สำเร็จ 2 รายการ</Notice>
          <Grid cols={2}>
            <EmptyState icon={Inbox} title="ยังไม่มีคูปอง" description="สร้างคูปองชั่วโมงสอนเพื่อมอบให้ครู" action={<Button>สร้างคูปอง</Button>} />
            <ErrorState onRetry={() => new Promise((resolve) => setTimeout(resolve, 600))} digest="dev-1234" />
          </Grid>
        </div>
      </Block>

      <Block id="loading" title="สถานะกำลังโหลด" only={only}>
        <TableSkeleton rows={3} columns={5} />
        <PageSkeleton stats variant="list" />
      </Block>

      <Block id="overlays" title="หน้าต่างยืนยัน" only={only}>
        <Surface>
          <OverlaysDemo />
        </Surface>
      </Block>
    </Page>
  );
}
