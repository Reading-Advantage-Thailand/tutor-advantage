"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  BookOpen,
  BookOpenText,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Flame,
  Heart,
  History,
  Inbox,
  LogOut,
  Mail,
  MessageCircle,
  Play,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Timer,
  Trophy,
  Wallet,
} from "lucide-react";
import { BrandMark } from "@/components/icons/BrandMark";
import { LineIcon } from "@/components/icons/LineIcon";
import { TabBarNav } from "@/components/layout/TabBar";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import {
  AppBar,
  BottomActionBar,
  CardSkeleton,
  Chip,
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
  PageHeader,
  ProgressBar,
  SearchField,
  SectionHeader,
  SegmentedControl,
  SkeletonText,
  Spinner,
  StatStrip,
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CEFR_FILTER_LEVELS, getLevelTone, levelToneClass } from "@/lib/cefr";
import { cn } from "@/lib/utils";
import { CelebrationDemo } from "./CelebrationDemo";
import { REAL_BOOKS, REAL_CLASS, SEED, STRESS } from "./fixtures";
import { Frame, Section, Swatch } from "./GalleryParts";
import { LeaderboardDemo } from "./LeaderboardDemo";
import { LessonSamples } from "./LessonSamples";

const ICON_TONES: IconTileTone[] = ["brand", "teal", "amber", "orange", "blue", "purple", "pink", "red", "neutral"];
const CHIP_TONES: ChipTone[] = ["brand", "success", "warning", "danger", "info", "neutral"];
const NOTICE_TONES: NoticeTone[] = ["info", "success", "warning", "danger", "brand"];
const CEFR = ["ทั้งหมด", "A0", "A1", "A2", "B1", "B2"];
const SWATCHES: { fill: string; on?: string }[] = [
  { fill: "--surface-bg" },
  { fill: "--surface-card" },
  { fill: "--surface-muted" },
  { fill: "--clay-rim" },
  { fill: "--brand-solid", on: "--on-brand" },
  { fill: "--brand-soft", on: "--brand-soft-fg" },
  { fill: "--accent-solid", on: "--on-accent" },
  { fill: "--accent-soft", on: "--accent-soft-fg" },
  { fill: "--hero-bg-base", on: "--hero-fg" },
  { fill: "--danger-solid", on: "--on-danger" },
  { fill: "--success-bg", on: "--success-fg" },
  { fill: "--info-bg", on: "--info-fg" },
];

export interface GalleryContentProps {
  onOpenSheet: () => void;
  onOpenConfirm: () => void;
}

/**
 * Every shared student component, with real fixtures and stress strings
 * (README §5 item 13). Rendered once per theme pane by <UiKitGallery>.
 */
export function GalleryContent({ onOpenSheet, onOpenConfirm }: GalleryContentProps) {
  const [filter, setFilter] = useState("ทั้งหมด");
  const [segment, setSegment] = useState<"chat" | "class" | "teacher">("chat");
  const [search, setSearch] = useState("");
  const [notify, setNotify] = useState(true);
  const [sound, setSound] = useState(false);
  const [agree, setAgree] = useState(true);
  const [loadingButton, setLoadingButton] = useState(false);
  const [previewTab, setPreviewTab] = useState<TabRoot>("/dashboard");
  const progress = Math.round((REAL_CLASS.lessonsDone / REAL_CLASS.lessonsTotal) * 100);

  return (
    <div className="space-y-9">
      <Section title="Type & colour" note="Kodchasan (display) ≥ 14px only; Noto Sans Thai Looped (reading) for body, rows and numbers that change.">
        <div className="space-y-1.5 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-4">
          <p className="t-display text-balance text-fg">{STRESS.thaiName}</p>
          <p className="t-section text-fg">คลาสของฉัน · t-section</p>
          <p className="t-title-l text-fg">{REAL_CLASS.title} · t-title-l</p>
          <p className="t-title text-fg">ตอบคำถามจับใจความ · t-title</p>
          <p className="t-title-s text-fg">การ์ดหัวข้อ · t-title-s</p>
          <p className="t-row text-fg">{SEED.localStudent} · t-row (reading)</p>
          <p className="t-label text-brand-fg">ดูทั้งหมด · t-label</p>
          <p className="t-body text-fg">หลักสูตรภาษาอังกฤษพร้อมบทอ่านและแบบฝึกหัด สมัครง่าย จ่ายสะดวก ผ่าน LINE โดยตรง (t-body 16/1.65)</p>
          <p className="t-body-s text-fg-muted">เรียนแล้ว {REAL_CLASS.lessonsDone} จาก {REAL_CLASS.lessonsTotal} บท · t-body-s</p>
          <p className="t-caption text-fg-muted">ขั้นที่ 7/18 · t-caption · 12px floor</p>
          <p className="text-[22px] leading-[1.3] font-semibold text-fg tabular-nums">1,111 · 0,000 · ฿3,000 <span className="text-sm font-normal text-fg-muted">(tabular)</span></p>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          {SWATCHES.map((swatch) => (
            <Swatch key={swatch.fill} fill={swatch.fill} on={swatch.on} />
          ))}
        </div>
      </Section>

      <Section title="Brand marks & LINE" note="TA mark: one outlined SVG, jade in both themes. LINE button: LINE's green, white label and logo, 56px, no ledge.">
        <div className="flex flex-wrap items-end gap-3">
          <BrandMark size="sm" />
          <BrandMark size="smd" />
          <BrandMark size="md" />
          <BrandMark size="lg" />
          <BrandMark size="xl" />
        </div>
        <Button variant="line" size="cta" className="w-full">
          <LineIcon variant="mono" size={34} />
          เข้าสู่ระบบด้วย LINE
        </Button>
        <div className="flex items-center gap-3 text-[13px] text-fg-muted">
          <LineIcon size={32} /> LineIcon (color) · 2.26:1 white-on-green is LINE&apos;s own rule (owner-signed exception)
        </div>
      </Section>

      <Section title="App bars, page header, tab bar">
        <Frame label='AppBar solid + back + long title + search (title centred on pushed screens)'>
          <AppBar
            title={STRESS.longClass}
            subtitle={`ครู ${REAL_CLASS.tutor}`}
            back
            onBack={() => toast("ย้อนกลับ")}
            actions={<IconButton icon={Share2} label="แชร์" />}
            bottom={<SearchField value={search} onChange={setSearch} placeholder="ค้นหาคลาสเรียน" />}
          />
        </Frame>
        <Frame label='AppBar variant="brand" (flat hero colour)'>
          <AppBar title="ชำระเงิน" variant="brand" onBack={() => toast("ย้อนกลับ")} actions={<IconButton icon={Share2} label="แชร์" variant="onBrand" />} />
          <div className="h-10 bg-hero-bg-base" />
        </Frame>
        <Frame label="PageHeader (tab roots: Kodchasan 700 28)">
          <PageHeader title="คลาสเรียน" subtitle="เลือกคลาสที่อยากเรียนได้เลย" actions={<IconButton icon={Search} label="ค้นหา" variant="tonal" />} className="pt-5">
            <HScroll aria-label="ตัวกรองระดับ">
              {CEFR.map((level) => (
                <FilterChip key={level} selected={filter === level} onClick={() => setFilter(level)}>
                  {level}
                </FilterChip>
              ))}
            </HScroll>
          </PageHeader>
        </Frame>
        <Frame label="TabBar (76px, rim, 24px top corners, float shadow; real bar shows on the 4 tab roots)">
          <div className="pt-3">
            <TabBarNav
              preview
              activeHref={previewTab}
              onSelect={(href, event) => {
                event.preventDefault();
                setPreviewTab(href);
              }}
            />
          </div>
        </Frame>
      </Section>

      <Section title="Hero sample" note="Flat hero-bg-base + two blobs (never sunshine); paper chip, one sun chip, avatar with a 3px card ring, Reedy's bubble from data.">
        <div className="hero-surface px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[15px] leading-[1.5] font-medium text-hero-fg-muted">
                <Sun aria-hidden="true" className="size-4" strokeWidth={2.4} />
                สวัสดีตอนบ่าย
              </p>
              <p className="t-display text-balance">{STRESS.thaiName}</p>
            </div>
            <UserAvatar name={STRESS.thaiName} size="hero" ring="surface" />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Chip tone="paper" size="md">{REAL_CLASS.book}</Chip>
            <Chip tone="sun" size="md" icon={Flame}>3 สัปดาห์ต่อเนื่อง</Chip>
          </div>
          <div className="mt-1.5 flex items-start justify-between gap-2">
            <p className="bubble mt-4 max-w-[232px] text-balance">
              วันนี้ไปต่อ<span className="whitespace-nowrap">บทที่ {REAL_CLASS.lessonNumber}</span> กันนะ
            </p>
            <ReedyMini mood="happy" size="hero" float decorative className="-mr-2" />
          </div>
        </div>
      </Section>

      <Section title="Buttons" note="Ledge only on tappables. One primary per screen; reward = sunshine (never payments).">
        <Button variant="brand" size="cta-lg" className="w-full">
          <Play aria-hidden="true" /> ทำบทเรียนต่อ (primary lg)
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="brand" size="touch">หลัก (brand)</Button>
          <Button variant="brandSoft" size="touch">ดูรายละเอียด</Button>
          <Button variant="reward" size="touch">
            <Star aria-hidden="true" className="fill-current" /> ฝึกพูดกับรีดี้
          </Button>
          <Button variant="outline" size="touch">outline</Button>
          <Button variant="warning" size="touch">ชำระเงิน</Button>
          <Button variant="danger" size="touch">ออกจากระบบ</Button>
          <Button variant="ghost" size="touch">ดูทั้งหมด</Button>
          <Button variant="brand" size="touch" disabled>ปิดใช้งาน</Button>
        </div>
        <Button variant="outline" size="cta" className="w-full">
          ดูคลาสเรียนทั้งหมด <ChevronRight aria-hidden="true" />
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="brand"
            size="cta"
            loading={loadingButton}
            onClick={() => {
              setLoadingButton(true);
              window.setTimeout(() => setLoadingButton(false), 1800);
            }}
          >
            {loadingButton ? "กำลังบันทึก" : "กดเพื่อโหลด"}
          </Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "brandSoft", size: "cta" })}>
            ลิงก์ปุ่ม <ChevronRight aria-hidden="true" />
          </Link>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="brandSoft" size="icon-touch" aria-label="ถูกใจ">
            <Heart />
          </Button>
          <Button variant="default" size="sm">shadcn sm (games)</Button>
          <Button variant="outline" size="default">shadcn outline</Button>
        </div>
      </Section>

      <Section title="Icon buttons">
        <div className="flex flex-wrap items-center gap-2.5">
          <IconButton icon={Settings} label="ตั้งค่า" />
          <IconButton icon={Settings} label="ตั้งค่า" variant="tonal" />
          <IconButton icon={MessageCircle} label="แชท มีข้อความใหม่" variant="tonal" badge />
          <IconButton icon={Bell} label="การแจ้งเตือน 120 รายการ" variant="tonal" badge={120} />
          <span className="rounded-full bg-hero-bg-base p-1.5">
            <IconButton icon={Bell} label="แจ้งเตือน" variant="onBrand" badge={3} />
          </span>
          <IconButton icon={Settings} label="ปิดใช้งาน" disabled />
        </div>
      </Section>

      <Section title="Chips & badges" note="Status = colour + dot/icon + a word. sm = reading 600 12, md = Kodchasan 600 14.">
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
          <Chip tone="danger" size="md" dot>เต็มแล้ว</Chip>
          <Chip tone="sun" size="md" icon={Star} iconFilled>+120 คะแนน</Chip>
        </div>
        <div className="flex flex-wrap gap-2 rounded-[20px] bg-hero-bg-base p-3">
          <Chip tone="paper" size="md">{REAL_CLASS.book}</Chip>
          <Chip tone="sun" size="md" icon={Flame}>3 สัปดาห์ต่อเนื่อง</Chip>
        </div>
        <HScroll snap aria-label="ตัวกรอง">
          {CEFR.map((level, index) => (
            <FilterChip key={level} selected={filter === level} onClick={() => setFilter(level)} count={index * 3}>
              {level}
            </FilterChip>
          ))}
        </HScroll>
        <div className="flex flex-wrap gap-2">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="success">success</Badge>
          <Badge variant="warning">warning</Badge>
          <Badge variant="destructive">destructive</Badge>
          <Badge variant="info">info</Badge>
          <Badge variant="outline">outline</Badge>
        </div>
      </Section>

      <Section title="CEFR band colours" note="A0 teal · A1 plum · A2 sky · B1 orange · B2 berry (same in the class band and the tutor week grid).">
        <div className="flex flex-wrap gap-2">
          {CEFR_FILTER_LEVELS.map((level) => (
            <LevelChip key={level} cefr={level} />
          ))}
          <LevelChip cefr={null}>Primary</LevelChip>
          <LevelChip cefr="A0" size="md">{REAL_CLASS.book}</LevelChip>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CEFR_FILTER_LEVELS.slice(0, 4).map((level, index) => (
            <Surface key={level} href="/classes" padding="none" className="relative overflow-hidden p-3.5 pl-[18px]">
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${levelToneClass[getLevelTone(level)].solid}`} />
              <p className="truncate text-base leading-[1.45] font-semibold text-fg">{index === 0 ? REAL_CLASS.title : REAL_BOOKS[index % REAL_BOOKS.length]}</p>
              <LevelChip cefr={level} className="mt-1.5">{`${level} · Lv.1`}</LevelChip>
            </Surface>
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
        <nav aria-label="เมนูด่วน (ตัวอย่าง)" className="grid grid-cols-4 gap-2">
          {[
            { icon: MessageCircle, tone: "blue" as const, lines: ["แชท", "ติวเตอร์"] },
            { icon: CalendarDays, tone: "purple" as const, lines: ["ตาราง", "เรียน"] },
            { icon: History, tone: "teal" as const, lines: ["ประวัติ", "การเรียน"] },
            { icon: CreditCard, tone: "orange" as const, lines: ["ประวัติ", "การชำระ"] },
          ].map((item) => (
            <Link key={item.lines.join("")} href="/dashboard" className="clay-press flex min-h-11 flex-col items-center gap-2 py-1 text-center font-heading text-sm leading-[1.35] font-semibold text-fg">
              <IconTile icon={item.icon} tone={item.tone} size="quick" />
              <span>
                {item.lines[0]}
                <br />
                {item.lines[1]}
              </span>
            </Link>
          ))}
        </nav>
      </Section>

      <Section title="Surfaces & stats" note="Every card has a 1.5px rim; only tappable cards get the 4px clay ledge.">
        <Surface padding="lg">
          <div className="flex items-center gap-3.5">
            <IconTile icon={BookOpenText} tone="brand" size="lg" />
            <div className="min-w-0">
              <p className="t-body-s text-fg-muted">คาบถัดไป · ตามนัดหมาย</p>
              <p className="t-title-l text-fg">{REAL_CLASS.title}</p>
              <p className="t-body-s text-fg-muted">ครู {REAL_CLASS.tutor}</p>
            </div>
          </div>
          <div className="well mt-3.5 flex items-center gap-3 px-3 py-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-surface font-heading text-lg font-bold text-brand-fg shadow-[inset_0_0_0_1.5px_var(--brand-soft-border)]">{REAL_CLASS.lessonNumber}</span>
            <div className="min-w-0">
              <p className="t-caption text-fg-muted">บทถัดไป</p>
              <p lang="en" className="t-row text-fg">{REAL_CLASS.lessonTitle}</p>
            </div>
          </div>
          <div className="mt-3.5 mb-2 flex items-baseline justify-between">
            <span className="t-body-s text-fg-muted">เรียนแล้ว {REAL_CLASS.lessonsDone} จาก {REAL_CLASS.lessonsTotal} บท</span>
            <span className="t-label text-brand-fg">{progress}%</span>
          </div>
          <ProgressBar value={progress} label={`ความคืบหน้า ${REAL_CLASS.title} ${progress}%`} />
          <Button variant="brand" size="cta-lg" className="mt-[18px] w-full">
            <Play aria-hidden="true" /> ทำบทเรียนต่อ
          </Button>
        </Surface>
        <Surface href="/classes" tone="default">
          <p className="font-semibold text-fg">การ์ดที่กดได้ (href): ledge 4px, กดแล้วลงไปบนขอบ</p>
          <p className="text-sm text-fg-muted">{STRESS.longClass}</p>
        </Surface>
        <div className="grid grid-cols-2 gap-2.5">
          <Surface tone="brand"><p className="text-sm font-semibold text-brand-soft-fg">tone brand</p></Surface>
          <Surface tone="warning"><p className="text-sm font-semibold text-warning-fg">tone warning</p></Surface>
          <Surface tone="muted"><p className="text-sm font-semibold text-fg">tone muted (well)</p></Surface>
          <Surface tone="hero"><p className="text-sm font-semibold">tone hero</p></Surface>
        </div>
        <StatStrip
          aria-label="สถิติ"
          items={[
            { value: "1", label: "คลาสเปิดขาย" },
            { value: "1", label: "หนังสือในคลาส" },
            { value: String(REAL_CLASS.lessonsTotal), label: "บทอ่านในหลักสูตร" },
          ]}
        />
        <StatStrip
          numbers="tabular"
          items={[
            { value: "12", label: "บทที่จบ" },
            { value: "2,480", label: "คะแนนรวม" },
            { value: "3", label: "อันดับดีที่สุด" },
          ]}
        />
        {/* Progress (S9): the streak cell is the view's one sunshine reward. */}
        <StatStrip
          numbers="tabular"
          items={[
            { value: "3", label: "สัปดาห์ต่อเนื่อง", tone: "sun", icon: Flame },
            { value: "5", label: "บทที่เรียนจบ" },
            { value: "48", label: "นาทีที่เรียน" },
          ]}
        />
        <div className="grid grid-cols-3 gap-2">
          <StatTile icon={Flame} tone="amber" value="5" label="วันต่อเนื่อง" />
          <StatTile icon={Timer} tone="blue" value="2.5" label="ชม. สัปดาห์นี้" />
          <StatTile icon={Trophy} tone="pink" value="12" label="บทที่เรียนจบ" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>ui/card (games use it too)</CardTitle>
            <CardDescription>Rim, 24px radius, container shadow.</CardDescription>
          </CardHeader>
          <CardContent className="truncate text-fg-muted" title={STRESS.email}>{STRESS.email}</CardContent>
        </Card>
      </Section>

      <Section title="Lists">
        <SectionHeader title="คลาสของฉัน" count={2} action={{ label: "ดูทั้งหมด", href: "/classes" }} />
        <ListGroup header="การตั้งค่า" footer="ข้อความเล็กๆ ใต้กลุ่ม">
          <ListRow href="/schedule" leading={<IconTile icon={CalendarDays} tone="purple" size="sm" />} title="ตารางเรียน" subtitle="ดูวันและเวลาเรียนทั้งหมด" />
          <ListRow
            onClick={() => toast.success("กดแถวแล้ว")}
            leading={<IconTile icon={Wallet} tone="orange" size="sm" />}
            title="ประวัติการชำระเงิน"
            trailing={<Chip tone="success" dot>ชำระแล้ว</Chip>}
            chevron
          />
          <SwitchRow leading={<IconTile icon={Bell} tone="pink" size="sm" />} title="แจ้งเตือนเมื่อมีข้อความใหม่" checked={notify} onCheckedChange={setNotify} />
          <ListRow leading={<IconTile icon={Trophy} tone="amber" size="sm" />} title="แถวแบบอ่านอย่างเดียว" trailing={<span className="tabular-nums">120 คะแนน</span>} />
          <ListRow href="/dashboard" leading={<IconTile icon={Sparkles} tone="neutral" size="sm" />} title="แถวที่ปิดใช้งาน" disabled />
          <ListRow onClick={onOpenConfirm} leading={<IconTile icon={LogOut} tone="red" size="sm" />} title="ออกจากระบบ" destructive />
        </ListGroup>
        <ListGroup header="Real names & stress strings">
          <ListRow href="/profile" leading={<UserAvatar name={STRESS.thaiFullName} decorative />} title={STRESS.thaiFullName} subtitle={STRESS.email} lines={1} />
          <ListRow href="/profile" leading={<UserAvatar name={SEED.localStudent} decorative />} title={SEED.localStudent} subtitle={SEED.studentEmail} current />
          <ListRow href="/chat" leading={<UserAvatar name={SEED.passportTutor} decorative />} title={SEED.passportTutor} subtitle={STRESS.longClass} />
          <ListRow title="เสียงในแอป" trailing={<Switch checked={sound} onCheckedChange={setSound} aria-label="เสียงในแอป" />} />
        </ListGroup>
        <ListGroup header="ListRowSkeleton">
          <ListRowSkeleton count={2} />
        </ListGroup>
      </Section>

      <Section title="Fields & controls" note="52px, radius 16, 2px field border; focus = jade border + the 3px blue ring.">
        <TextField label="ชื่อเล่น" placeholder="เช่น น้องมายด์" hint="ครูจะเรียกชื่อนี้ในห้องเรียน" />
        <TextField label="อีเมลผู้ปกครอง" type="email" defaultValue={STRESS.email} />
        <TextField label="เบอร์โทรผู้ปกครอง" inputMode="tel" defaultValue="08" error="กรอกเบอร์ให้ครบ 10 หลักนะ" required />
        <TextField label="รหัสนักเรียน (อ่านอย่างเดียว)" defaultValue={SEED.studentEmail} readOnly />
        <SearchField value={search} onChange={setSearch} />
        <TextArea label="ข้อความถึงครู" placeholder="พิมพ์ข้อความ..." hint="ไม่เกิน 500 ตัวอักษร" />
        <Input placeholder="ui/input (games)" aria-label="ui/input ตัวอย่าง" />
        <label className="flex min-h-11 items-center gap-3 text-base text-fg">
          <Checkbox checked={agree} onCheckedChange={(value) => setAgree(Boolean(value))} />
          ยอมรับเงื่อนไขการใช้งาน
        </label>
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
        <ProgressBar value={progress} label="ความคืบหน้า" />
        <ProgressBar value={30} tone="warning" size="sm" label="ตัวอย่าง warning" />
        <div className="rounded-[20px] bg-hero-bg-base p-4">
          <ProgressBar value={80} tone="onBrand" size="sm" label="ตัวอย่างบน hero" />
        </div>
        <Progress value={45} aria-label="ui/progress" />
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
      </Section>

      <Section title="Avatars" note="Initials from the name, tile colour by a stable hash; 'you' = 2px jade ring.">
        <div className="flex flex-wrap items-end gap-3">
          <UserAvatar name={SEED.student} size="xs" />
          <UserAvatar name={SEED.localStudent} size="sm" />
          <UserAvatar name="มะปราง" size="rank" />
          <UserAvatar name={SEED.passportTutor} size="md" />
          <UserAvatar name={STRESS.thaiName} size="hero" ring="surface" />
          <UserAvatar name="ใบเตย" size="lg" ring="you" />
          <UserAvatar name={REAL_CLASS.tutor} size="xl" />
          <UserAvatar name="รูปเสีย" src="/does-not-exist.png" size="lg" />
        </div>
      </Section>

      <Section title="Loading">
        <div className="flex items-center gap-3 text-fg-muted">
          <Spinner size="sm" /> <Spinner size="md" /> <Spinner size="lg" label="กำลังโหลด" />
        </div>
        <CardSkeleton />
        <SkeletonText lines={3} />
      </Section>

      <Section title="Empty / error / status">
        <EmptyState card icon={Inbox} title="ยังไม่มีข้อความ" description="เมื่อครูส่งข้อความมา จะขึ้นที่นี่" action={<Button variant="brand" size="touch">ค้นหาคลาสเรียน</Button>} />
        <ErrorState card onRetry={() => toast("ลองใหม่")} description="เช็กอินเทอร์เน็ตแล้วลองอีกครั้งนะ" />
        <Frame label="StatusScreen (fills the screen in real use)">
          <StatusScreen
            icon={Wallet}
            tone="amber"
            title="ต้องชำระเงินก่อนเข้าเรียน"
            description="ชำระค่าเรียนเล่มนี้ก่อน แล้วกลับมาเข้าห้องเรียนได้เลย"
            primaryAction={<Button variant="warning" size="cta">ไปชำระเงิน</Button>}
            secondaryAction={<Button variant="ghost" size="touch">ไว้ทีหลัง</Button>}
            className="min-h-0 py-8"
          />
        </Frame>
        <Frame label="BottomActionBar (sticky on pushed screens)">
          <div className="h-6" />
          <BottomActionBar>
            <div className="min-w-0">
              <p className="text-xs text-fg-muted">ราคา</p>
              <p className="font-heading text-lg font-bold text-fg">{REAL_CLASS.price}</p>
            </div>
            <Button variant="brand" size="cta" className="flex-1">สมัครเรียน</Button>
          </BottomActionBar>
        </Frame>
      </Section>

      <LessonSamples />

      <Section title="Wrap-up & leaderboard (existing phase)">
        <LeaderboardDemo />
      </Section>

      <Section title="Celebration (confetti)">
        <CelebrationDemo />
      </Section>

      <Section title="Sheets & toasts" note="Portaled to <body>: they follow the app theme (moon button), not the pane.">
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="brandSoft" size="touch" onClick={onOpenSheet}>เปิด BottomSheet</Button>
          <Button variant="danger" size="touch" onClick={onOpenConfirm}>เปิด ConfirmSheet</Button>
          <Button variant="outline" size="touch" onClick={() => toast.success("บันทึกเรียบร้อย")}>Toast สำเร็จ</Button>
          <Button variant="outline" size="touch" onClick={() => toast.error("ต่ออินเทอร์เน็ตไม่ได้")}>Toast ผิดพลาด</Button>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-fg-muted">
          <Mail aria-hidden="true" className="size-4" /> {STRESS.email}
        </p>
      </Section>
    </div>
  );
}

export const galleryPaneClass = (theme: "light" | "dark") =>
  cn(theme === "dark" ? "dark" : "theme-light", "min-w-0 rounded-[28px] border-[1.5px] border-clay-rim bg-app px-3.5 pt-4 pb-8 text-fg");
