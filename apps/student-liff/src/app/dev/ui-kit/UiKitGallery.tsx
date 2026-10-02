"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Flame,
  Gift,
  Heart,
  Inbox,
  LogOut,
  MessageCircle,
  Moon,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Wallet,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { CelebrationDemo } from "./CelebrationDemo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LineIcon } from "@/components/icons/LineIcon";
import { TabBarNav } from "@/components/layout/TabBar";
import {
  AppBar,
  BottomActionBar,
  BottomSheet,
  CardSkeleton,
  Chip,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  FilterChip,
  HScroll,
  IconButton,
  IconTile,
  LevelChip,
  ListGroup,
  ListRow,
  ListRowSkeleton,
  Notice,
  OfflineBanner,
  PageHeader,
  ProgressBar,
  Screen,
  SearchField,
  SectionHeader,
  SegmentedControl,
  SkeletonText,
  Spinner,
  StatTile,
  StatusScreen,
  Surface,
  Switch,
  SwitchRow,
  TextArea,
  TextField,
  UserAvatar,
  type ChipTone,
  type IconTileTone,
  type NoticeTone,
  type TabRoot,
} from "@/components/mobile";
import { CEFR_FILTER_LEVELS, getLevelTone, levelToneClass } from "@/lib/cefr";
import { cn } from "@/lib/utils";

const ICON_TONES: IconTileTone[] = ["brand", "teal", "amber", "orange", "blue", "purple", "pink", "red", "neutral"];
const CHIP_TONES: ChipTone[] = ["brand", "success", "warning", "danger", "info", "neutral"];
const NOTICE_TONES: NoticeTone[] = ["info", "success", "warning", "danger", "brand"];
const CEFR = ["ทั้งหมด", "A1", "A2", "B1", "B2", "C1"];

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <SectionHeader title={title} as="h2" />
      {children}
    </section>
  );
}

function Frame({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-xs font-semibold text-fg-subtle">{label}</p>
      <div className={cn("overflow-hidden rounded-2xl border border-dashed border-hairline bg-app", className)}>
        {children}
      </div>
    </div>
  );
}

export function UiKitGallery() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [filter, setFilter] = useState("ทั้งหมด");
  const [segment, setSegment] = useState<"chat" | "class" | "teacher">("chat");
  const [search, setSearch] = useState("");
  const [notify, setNotify] = useState(true);
  const [sound, setSound] = useState(false);
  const [loadingButton, setLoadingButton] = useState(false);
  const [previewTab, setPreviewTab] = useState<TabRoot>("/dashboard");

  return (
    <Screen>
      <AppBar
        title="UI kit — ระบบดีไซน์มือถือ"
        subtitle={`ธีม: ${resolvedTheme === "dark" ? "มืด" : "สว่าง"} · หน้าทดสอบสำหรับนักพัฒนา`}
        back
        fallbackHref="/dashboard"
        actions={
          <>
            <IconButton icon={Moon} label="สลับธีม" onClick={toggleTheme} />
            <IconButton icon={Bell} label="การแจ้งเตือน 3 รายการ" badge={3} />
          </>
        }
      />

      <div className="space-y-8 px-4 pt-4 pb-8">
        <Notice
          tone="brand"
          title="หน้านี้ใช้ตรวจหน้าตา (visual QA)"
          description="สลับธีมมืด/สว่างด้วยปุ่มพระจันทร์ เลื่อนลงเพื่อดูเส้นใต้ AppBar ที่จะขึ้นเมื่อเลื่อนหน้า"
        />

        <Section title="App bars">
          <Frame label='variant="solid" + back + bottom slot'>
            <AppBar
              title="ชื่อหน้าที่ยาวมากๆ เพื่อทดสอบการตัดคำด้วยจุดสามจุดในแถบด้านบน"
              subtitle="คำอธิบายย่อย"
              back
              onBack={() => toast("กดปุ่มย้อนกลับแล้ว")}
              actions={<IconButton icon={Share2} label="แชร์" />}
              bottom={<SearchField value={search} onChange={setSearch} placeholder="ค้นหาคลาสเรียน" />}
            />
          </Frame>
          <Frame label='variant="brand"'>
            <AppBar
              title="ชำระเงิน"
              variant="brand"
              onBack={() => toast("ย้อนกลับ")}
              actions={<IconButton icon={Share2} label="แชร์" variant="onBrand" />}
            />
            <div className="bg-gradient-brand h-16" />
          </Frame>
          <Frame label='variant="transparent" (becomes solid once scrolled)'>
            <AppBar title="รายละเอียดคลาส" variant="transparent" onBack={() => toast("ย้อนกลับ")} />
          </Frame>
          <Frame label="PageHeader (tab roots)">
            <PageHeader
              title="คลาสเรียน"
              subtitle="เลือกคลาสที่อยากเรียนได้เลย"
              actions={<IconButton icon={Search} label="ค้นหา" variant="tonal" />}
              className="pt-5"
            >
              <HScroll aria-label="ตัวกรองระดับ">
                {CEFR.map((level) => (
                  <FilterChip key={level} selected={filter === level} onClick={() => setFilter(level)}>
                    {level}
                  </FilterChip>
                ))}
              </HScroll>
            </PageHeader>
          </Frame>
          <Frame label="TabBar (static preview — the real one shows only on /dashboard, /classes, /progress, /profile)">
            <TabBarNav
              preview
              activeHref={previewTab}
              onSelect={(href, event) => {
                event.preventDefault();
                setPreviewTab(href);
              }}
            />
          </Frame>
        </Section>

        <Section title="Buttons">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="brand" size="touch">หลัก (brand)</Button>
            <Button variant="brandSoft" size="touch">รอง (brandSoft)</Button>
            <Button variant="warning" size="touch">เตือน (warning)</Button>
            <Button variant="danger" size="touch">อันตราย (danger)</Button>
            <Button variant="outline" size="touch">outline</Button>
            <Button variant="ghost" size="touch">ghost</Button>
          </div>
          <Button variant="brand" size="cta" className="w-full">
            <Sparkles /> สมัครเรียนเลย (cta)
          </Button>
          <Button variant="line" size="cta" className="w-full">
            <LineIcon size={22} /> เข้าสู่ระบบด้วย LINE
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="brand"
              size="touch"
              loading={loadingButton}
              onClick={() => {
                setLoadingButton(true);
                window.setTimeout(() => setLoadingButton(false), 1800);
              }}
            >
              {loadingButton ? "กำลังบันทึก..." : "กดเพื่อโหลด"}
            </Button>
            <Button variant="brand" size="touch" disabled>
              ปิดใช้งาน
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="brandSoft" size="icon-touch" aria-label="ถูกใจ">
              <Heart />
            </Button>
            <Link href="/dashboard" className={buttonVariants({ variant: "brandSoft", size: "touch" })}>
              Link ที่หน้าตาเป็นปุ่ม <ChevronRight />
            </Link>
            <Button variant="default" size="sm">shadcn sm</Button>
          </div>
        </Section>

        <Section title="Icon buttons">
          <div className="flex items-center gap-2">
            <IconButton icon={Settings} label="ตั้งค่า" />
            <IconButton icon={Settings} label="ตั้งค่า" variant="tonal" />
            <IconButton icon={MessageCircle} label="แชท มีข้อความใหม่" variant="tonal" badge />
            <IconButton icon={Bell} label="การแจ้งเตือน 120 รายการ" variant="tonal" badge={120} />
            <div className="bg-gradient-brand rounded-full p-1">
              <IconButton icon={Bell} label="แจ้งเตือน" variant="onBrand" />
            </div>
            <IconButton icon={Settings} label="ปิดใช้งาน" disabled />
          </div>
        </Section>

        <Section title="Chips">
          <div className="flex flex-wrap gap-2">
            {CHIP_TONES.map((tone) => (
              <Chip key={tone} tone={tone} dot>
                {tone}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip tone="success" size="md" icon={ShieldCheck}>ชำระเงินแล้ว</Chip>
            <Chip tone="warning" size="md" icon={Timer}>รอตรวจสอบ</Chip>
            <Chip tone="danger" size="md">เต็มแล้ว</Chip>
            <Chip tone="info" size="md">A2</Chip>
          </div>
          <div className="bg-gradient-brand flex flex-wrap gap-2 rounded-2xl p-3">
            <Chip tone="onBrand" icon={Flame}>เรียนต่อเนื่อง 5 วัน</Chip>
            <Chip tone="onBrand">ระดับ A1</Chip>
          </div>
          <HScroll snap aria-label="ตัวกรอง">
            {CEFR.map((level, index) => (
              <FilterChip key={level} selected={filter === level} onClick={() => setFilter(level)} count={index * 3}>
                {level}
              </FilterChip>
            ))}
          </HScroll>
        </Section>

        <Section title="Level colours (CEFR)">
          <div className="flex flex-wrap gap-2">
            {CEFR_FILTER_LEVELS.map((level) => (
              <LevelChip key={level} cefr={level} />
            ))}
            <LevelChip cefr={null}>Primary</LevelChip>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CEFR_FILTER_LEVELS.map((level) => (
              <div
                key={level}
                className="relative overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface p-3 pt-4 shadow-[var(--shadow-card)]"
              >
                <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${levelToneClass[getLevelTone(level)].solid}`} />
                <p className="text-sm font-bold text-fg">Reading {level}</p>
                <LevelChip cefr={level} className="mt-2">{`${level} · Lv.1`}</LevelChip>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Icon tiles">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-2">
              {ICON_TONES.map((tone) => (
                <IconTile key={tone} icon={BookOpen} tone={tone} size={size} />
              ))}
            </div>
          ))}
          <div className="flex gap-2">
            {ICON_TONES.map((tone) => (
              <IconTile key={tone} icon={Star} tone={tone} shape="circle" />
            ))}
          </div>
        </Section>

        <Section title="Lists">
          <ListGroup header="การตั้งค่า" footer="ข้อความเล็กๆ ใต้กลุ่ม">
            <ListRow
              href="/dashboard"
              leading={<IconTile icon={CalendarDays} tone="blue" />}
              title="ตารางเรียน"
              subtitle="ดูวันและเวลาเรียนทั้งหมด"
            />
            <ListRow
              onClick={() => toast.success("กดแถวแล้ว")}
              leading={<IconTile icon={Wallet} tone="amber" />}
              title="ประวัติการชำระเงิน"
              trailing={<Chip tone="success">ล่าสุด</Chip>}
              chevron
            />
            <SwitchRow
              leading={<IconTile icon={Bell} tone="purple" />}
              title="แจ้งเตือนเมื่อมีข้อความใหม่"
              checked={notify}
              onCheckedChange={setNotify}
            />
            <ListRow leading={<IconTile icon={Trophy} tone="pink" />} title="แถวแบบอ่านอย่างเดียว" trailing="12 คะแนน" />
            <ListRow href="/dashboard" leading={<IconTile icon={Gift} tone="neutral" />} title="แถวที่ปิดใช้งาน" disabled />
            <ListRow onClick={() => setConfirmOpen(true)} leading={<IconTile icon={LogOut} tone="red" />} title="ออกจากระบบ" destructive />
          </ListGroup>

          <ListGroup header="ไม่มีไอคอนนำหน้า">
            <ListRow title="เสียงในแอป" trailing={<Switch checked={sound} onCheckedChange={setSound} aria-label="เสียงในแอป" />} />
            <ListRow href="/dashboard" title="ชื่อยาวมากๆ เพื่อทดสอบการตัดบรรทัดของภาษาไทยที่มีสระบนและวรรณยุกต์ซ้อนกันหลายชั้น" subtitle="คำอธิบายที่ยาวเช่นกัน ผู้ใช้จะเห็นสองบรรทัดแล้วตัดด้วยจุดสามจุด" />
          </ListGroup>

          <ListGroup header="Full-bleed (inset={false})" inset={false}>
            <ListRow href="/dashboard" leading={<UserAvatar name="ครูแพรว" />} title="ครูแพรว" subtitle="ส่งรูปภาพ · 10:24" trailing={<Chip tone="brand">2</Chip>} />
            <ListRow href="/dashboard" leading={<UserAvatar name="John Smith" />} title="John Smith" subtitle="See you tomorrow!" />
          </ListGroup>

          <ListGroup header="ListRowSkeleton">
            <ListRowSkeleton count={3} />
          </ListGroup>
        </Section>

        <Section title="Section header">
          <SectionHeader title="คลาสของฉัน" count={4} action={{ label: "ดูทั้งหมด", href: "/classes" }} />
          <SectionHeader title="บทเรียนล่าสุด" action={{ label: "ล้าง", onClick: () => toast("ล้างแล้ว") }} />
        </Section>

        <Section title="Stat tiles">
          <div className="grid grid-cols-3 gap-2">
            <StatTile icon={Flame} tone="amber" value="5" label="วันต่อเนื่อง" />
            <StatTile icon={Timer} tone="blue" value="2.5 ชม." label="เวลาเรียนสัปดาห์นี้" />
            <StatTile icon={BookOpen} tone="brand" value="12" label="บทที่เรียนจบ" />
          </div>
        </Section>

        <Section title="Surfaces">
          <Surface>
            <p className="font-semibold text-fg">การ์ดธรรมดา (กดแล้วไม่ยุบ)</p>
            <p className="text-sm text-fg-muted">ขอบบางมาก เงาอ่อนๆ มุมโค้ง 20px</p>
          </Surface>
          <Surface href="/dashboard" tone="brand">
            <p className="font-semibold text-brand-fg">การ์ดที่กดได้ (href)</p>
            <p className="text-sm text-fg-muted">กดแล้วยุบลงเล็กน้อยแบบแอป</p>
          </Surface>
          <Surface onClick={() => toast("กดการ์ด")} tone="warning">
            <p className="font-semibold text-warning-fg">การ์ดเตือน (onClick)</p>
          </Surface>
        </Section>

        <Section title="Notices">
          {NOTICE_TONES.map((tone) => (
            <Notice
              key={tone}
              tone={tone}
              title={`หัวข้อแบบ ${tone}`}
              description="รายละเอียดสั้นๆ ที่อ่านง่าย เข้าใจได้ทันที"
              action={tone === "warning" ? <Button variant="warning" size="touch">ชำระเงิน</Button> : undefined}
            />
          ))}
          <OfflineBanner />
        </Section>

        <Section title="Fields">
          <TextField label="ชื่อเล่น" placeholder="เช่น น้องมายด์" hint="ครูจะเรียกชื่อนี้ในห้องเรียน" />
          <TextField label="เบอร์โทรผู้ปกครอง" inputMode="tel" defaultValue="08" error="กรอกเบอร์ให้ครบ 10 หลักนะ" required />
          <SearchField value={search} onChange={setSearch} />
          <TextArea label="ข้อความถึงครู" placeholder="พิมพ์ข้อความ..." hint="ไม่เกิน 500 ตัวอักษร" />
        </Section>

        <Section title="Segmented control">
          <SegmentedControl
            aria-label="ประเภทแชท"
            items={[
              { value: "chat", label: "แชท", badge: 3 },
              { value: "class", label: "คลาสเรียน" },
              { value: "teacher", label: "ครูผู้สอน" },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </Section>

        <Section title="Progress">
          <ProgressBar value={64} />
          <ProgressBar value={30} tone="warning" size="lg" />
          <div className="bg-gradient-brand rounded-2xl p-4">
            <ProgressBar value={80} tone="onBrand" size="sm" />
          </div>
          <Progress value={45} className="h-1.5" />
          <p className="text-xs text-fg-subtle">↑ ui/progress (legacy API) now uses the brand colour and className reaches the track</p>
        </Section>

        <Section title="Celebration (confetti)">
          <CelebrationDemo />
        </Section>

        <Section title="Avatars">
          <div className="flex flex-wrap items-end gap-3">
            <UserAvatar name="เอก" size="xs" />
            <UserAvatar name="ไอซ์ ใจดี" size="sm" />
            <UserAvatar name="สมชาย" size="md" />
            <UserAvatar name="Mai Tanaka" size="lg" />
            <UserAvatar name="น้ำ" size="xl" ring="surface" />
            <UserAvatar name="รูปเสีย" src="/does-not-exist.png" size="lg" />
          </div>
        </Section>

        <Section title="Loading">
          <div className="flex items-center gap-3 text-fg-muted">
            <Spinner size="sm" /> <Spinner size="md" /> <Spinner size="lg" label="กำลังโหลด" />
          </div>
          <CardSkeleton />
          <SkeletonText lines={4} />
        </Section>

        <Section title="Empty / error / status">
          <Surface padding="none">
            <EmptyState
              icon={Inbox}
              title="ยังไม่มีข้อความ"
              description="เมื่อครูส่งข้อความมา จะขึ้นที่นี่"
              action={<Button variant="brand" size="touch">ค้นหาคลาสเรียน</Button>}
            />
          </Surface>
          <Surface padding="none">
            <ErrorState onRetry={() => toast("ลองใหม่")} />
          </Surface>
          <Surface padding="none">
            <ErrorState kind="offline" onRetry={() => toast("ลองใหม่")} secondaryAction={<Button variant="ghost" size="touch">กลับหน้าหลัก</Button>} />
          </Surface>
          <Frame label="StatusScreen (fills the screen in real use)">
            <StatusScreen
              icon={Wallet}
              tone="amber"
              title="ต้องชำระเงินก่อนเข้าเรียน"
              description="ชำระค่าเรียนเล่มนี้ก่อน แล้วกลับมาเข้าห้องเรียนได้เลย"
              primaryAction={<Button variant="brand" size="cta">ไปชำระเงิน</Button>}
              secondaryAction={<Button variant="ghost" size="touch">ไว้ทีหลัง</Button>}
              className="min-h-0 py-10"
            />
          </Frame>
        </Section>

        <Section title="Sheets & toasts">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="brandSoft" size="touch" onClick={() => setSheetOpen(true)}>
              เปิด BottomSheet
            </Button>
            <Button variant="danger" size="touch" onClick={() => setConfirmOpen(true)}>
              เปิด ConfirmSheet
            </Button>
            <Button variant="outline" size="touch" onClick={() => toast.success("บันทึกเรียบร้อย")}>
              Toast สำเร็จ
            </Button>
            <Button variant="outline" size="touch" onClick={() => toast.error("ต่ออินเทอร์เน็ตไม่ได้")}>
              Toast ผิดพลาด
            </Button>
          </div>
        </Section>
      </div>

      <BottomActionBar>
        <div className="min-w-0">
          <p className="text-xs text-fg-muted">ราคา</p>
          <p className="text-lg font-extrabold text-fg">฿1,290</p>
        </div>
        <Button variant="brand" size="cta" className="flex-1">
          สมัครเรียน
        </Button>
      </BottomActionBar>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="เลือกคลาสที่จะเชิญเพื่อน"
        description="ลากลงเพื่อปิด หรือกดพื้นหลัง"
        footer={
          <Button variant="brand" size="cta" className="w-full" onClick={() => setSheetOpen(false)}>
            ยืนยัน
          </Button>
        }
      >
        <ListGroup inset={false} className="-mx-5">
          {Array.from({ length: 12 }, (_, index) => (
            <ListRow
              key={index}
              onClick={() => toast(`เลือกคลาสที่ ${index + 1}`)}
              leading={<IconTile icon={BookOpen} tone={ICON_TONES[index % ICON_TONES.length]} />}
              title={`Reading ${index + 1}.${index % 3}`}
              subtitle="ทุกวันเสาร์ 10:00 – 11:30"
            />
          ))}
        </ListGroup>
        <TextField label="ฟิลด์ในชีต (ทดสอบคีย์บอร์ด)" placeholder="พิมพ์ได้" className="mt-4" />
      </BottomSheet>

      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="ออกจากระบบใช่ไหม?"
        description="ต้องเข้าสู่ระบบด้วย LINE ใหม่อีกครั้งเมื่อกลับมา"
        confirmLabel="ออกจากระบบ"
        tone="danger"
        loading={confirmLoading}
        onConfirm={() => {
          setConfirmLoading(true);
          window.setTimeout(() => {
            setConfirmLoading(false);
            setConfirmOpen(false);
            toast("ออกจากระบบแล้ว (ตัวอย่าง)");
          }, 1500);
        }}
      />
    </Screen>
  );
}
