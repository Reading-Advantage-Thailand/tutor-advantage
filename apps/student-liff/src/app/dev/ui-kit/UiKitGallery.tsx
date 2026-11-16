"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  AppBar,
  BottomSheet,
  ConfirmSheet,
  IconButton,
  IconTile,
  ListGroup,
  ListRow,
  Notice,
  Screen,
  SegmentedControl,
  TextField,
  type IconTileTone,
} from "@/components/mobile";
import { cn } from "@/lib/utils";
import { GalleryContent, galleryPaneClass } from "./GalleryContent";
import { Section } from "./GalleryParts";
import { SweepInventory } from "./SweepInventoryPanel";
import { REAL_BOOKS } from "./fixtures";

type PaneView = "both" | "light" | "dark";

const SHEET_TONES: IconTileTone[] = ["brand", "teal", "orange", "blue", "purple", "pink"];
const PANES = [
  { theme: "light" as const, title: "ธีมสว่าง", icon: Sun },
  { theme: "dark" as const, title: "ธีมมืด", icon: Moon },
];

/**
 * Dev-only visual QA gallery for the student design system (redesign 2026-11).
 * Every shared component renders twice, in a forced-light pane and a
 * forced-dark pane (side by side from 720px, stacked on phones), with real
 * fixtures and stress strings. The sweep inventory below is the acceptance
 * checklist for the colour migration. `?panes=light|dark|both` picks the panes.
 */
export function UiKitGallery() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [view, setView] = useState<PaneView>("both");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Read once on mount (no useSearchParams: keeps the dev page free of a Suspense boundary).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("panes");
    if (requested === "light" || requested === "dark" || requested === "both") setView(requested);
  }, []);

  const panes = PANES.filter((pane) => view === "both" || pane.theme === view);

  return (
    <Screen>
      <AppBar
        title="UI kit · ระบบดีไซน์นักเรียน"
        subtitle={`ธีมแอป: ${resolvedTheme === "dark" ? "มืด" : "สว่าง"} · หน้าทดสอบสำหรับนักพัฒนา`}
        back
        fallbackHref="/dashboard"
        actions={<IconButton icon={resolvedTheme === "dark" ? Sun : Moon} label="สลับธีมของแอป" onClick={toggleTheme} />}
      />

      <div className="space-y-4 px-3 pt-4 pb-10">
        <Notice
          tone="brand"
          title="หน้านี้ใช้ตรวจหน้าตา (visual QA) ของการออกแบบใหม่ พ.ย. 2569"
          description="ทุกคอมโพเนนต์แสดงทั้งธีมสว่างและธีมมืดพร้อมกัน ด้วยข้อมูลจริงและข้อความยาวสำหรับทดสอบ ชีตและ toast ตามธีมของแอป (ปุ่มพระจันทร์)"
        />
        <SegmentedControl
          aria-label="แสดงธีม"
          items={[
            { value: "both", label: "ทั้งสองธีม" },
            { value: "light", label: "สว่าง" },
            { value: "dark", label: "มืด" },
          ]}
          value={view}
          onChange={setView}
        />

        <div className={cn("grid gap-3", panes.length === 2 && "min-[720px]:grid-cols-2")}>
          {panes.map(({ theme, title, icon: Icon }) => (
            <section key={theme} aria-label={title} data-theme-pane={theme} className={galleryPaneClass(theme)}>
              <h2 className="mb-5 flex items-center gap-2 font-heading text-xl leading-[1.35] font-bold">
                <Icon aria-hidden="true" className="size-5 text-brand-fg" strokeWidth={2.4} />
                {title}
              </h2>
              <GalleryContent onOpenSheet={() => setSheetOpen(true)} onOpenConfirm={() => setConfirmOpen(true)} />
            </section>
          ))}
        </div>

        <section aria-labelledby="sweep-title" className="rounded-[28px] border-[1.5px] border-clay-rim bg-surface-muted px-3.5 pt-4 pb-6">
          <h2 id="sweep-title" className="mb-1 font-heading text-xl leading-[1.35] font-bold text-fg">Sweep inventory</h2>
          <p className="mb-4 text-sm leading-[1.6] text-fg-muted">
            สีดิบที่ยังเหลือต่อเส้นทาง (นอกเกม) เส้นทางไหนเป็นศูนย์ครบทุกช่อง = ย้ายไปใช้ token ครบแล้ว
          </p>
          <Section title="Raw colours per route">
            <SweepInventory />
          </Section>
        </section>
      </div>

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
          {Array.from({ length: 8 }, (_, index) => (
            <ListRow
              key={index}
              onClick={() => toast(`เลือกคลาสที่ ${index + 1}`)}
              leading={<IconTile icon={BookOpen} tone={SHEET_TONES[index % SHEET_TONES.length]} size="sm" />}
              title={REAL_BOOKS[index % REAL_BOOKS.length]}
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
