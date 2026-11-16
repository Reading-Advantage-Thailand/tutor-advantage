import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button-variants";
import { buttonVariants as buttonVariantsFromButton } from "@/components/ui/button";
import { LevelChip, UserAvatar } from "./Atoms";
import { NextClassCard, SessionList, SessionRow, StatStrip, WalletHero } from "./Compositions";
import { DataTable, type DataTableColumn } from "./DataTable";
import { EmptyState, Notice } from "./Feedback";
import { Field, TextAreaField } from "./Fields";
import { SegmentedControl, TabNav } from "./Segmented";
import { PageHeader } from "./Page";
import { CardHeader, ListRow, Surface } from "./Surface";

/* Options added to the shared tutor components after the 2026-11 screen rebuild. */

type Row = { id: string; name: string; note: string | null; amount: number };
const rows: Row[] = [
  { id: "a", name: "English", note: null, amount: 1200 },
  { id: "b", name: "Primary Origins 2 (A0)", note: "คืนเงิน", amount: 0 },
];
const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "คลาส", cell: (row) => row.name, mobile: "primary", width: "40%" },
  { key: "note", header: "หมายเหตุ", cell: (row) => (row.note ? row.note : <span className="text-fg-subtle">–</span>) },
  { key: "amount", header: "ยอด", align: "right", cell: (row) => <b>{row.amount}</b>, isEmpty: (row) => row.amount === 0 },
];

describe("Thai line-height and balance", () => {
  it("Notice title and description use 1.6; the title is balanced", () => {
    const html = renderToStaticMarkup(<Notice title="หัวข้อ">รายละเอียด</Notice>);
    expect(html).toContain("leading-[1.6] font-semibold text-balance-th");
    expect(html).toContain("text-sm leading-[1.6]");
  });

  it("EmptyState description is 1.6 and balanced; headingAs sets the level", () => {
    const html = renderToStaticMarkup(<EmptyState title="ไม่พบหน้านี้" description="ลองกลับไปที่รายการคลาส" headingAs="h1" iconSize="xl" />);
    expect(html).toMatch(/<h1 [^>]*>ไม่พบหน้านี้<\/h1>/);
    expect(html).toContain("text-sm leading-[1.6] text-balance-th text-fg-muted");
    expect(html).toContain("size-14");
    expect(renderToStaticMarkup(<EmptyState title="ว่าง" />)).toMatch(/<h3 /);
  });
});

describe("Compositions", () => {
  it("StatStrip align=center puts the cells on a shared subgrid", () => {
    const items = [{ label: "คลาสที่เปิด", value: "7", hint: "รับได้อีก 147 ที่", href: "/dashboard/classes" }, { label: "นักเรียน", value: "33" }];
    const html = renderToStaticMarkup(<StatStrip items={items} align="center" />);
    expect(html).toContain("grid-rows-[1fr_auto_auto_auto_1fr]");
    expect(html.match(/row-span-5 grid grid-rows-subgrid/g)).toHaveLength(2);
    expect(html).toContain("ds-strip-hint block row-start-4");
    expect(renderToStaticMarkup(<StatStrip items={items} />)).not.toContain("subgrid");
  });

  it("NextClassCard is a flex column whose action row keeps to the bottom", () => {
    const html = renderToStaticMarkup(<NextClassCard label="คลาสถัดไป" time="17:00" title="English" primaryAction={<a href="/x">เริ่มสอนสด</a>} />);
    expect(html).toContain("ds-card flex flex-col");
    expect(html).toContain("mt-auto grid");
  });

  it("WalletHero compactAction sits on the amount line", () => {
    const html = renderToStaticMarkup(<WalletHero label="รายได้" amount="฿0" compactAction={<a href="/dashboard/earnings">ดูรายละเอียด</a>} />);
    expect(html).toMatch(/ds-wallet-amount">฿0<\/p><div class="flex shrink-0 items-center gap-2"><a href="\/dashboard\/earnings"/);
  });

  it("SessionList and SessionRow take a wide time column", () => {
    const html = renderToStaticMarkup(
      <SessionList timeColumn="wide">
        <SessionRow time="ตามนัดหมาย" title="English" />
      </SessionList>,
    );
    expect(html).toContain('data-time-column="wide"');
    expect(renderToStaticMarkup(<SessionList>{null}</SessionList>)).not.toContain("data-time-column");
  });

  it("SessionRow trailing: a plain chip lets the tap through to the row link; only real controls take it", () => {
    const html = renderToStaticMarkup(<SessionRow time="17:00" title="English" href="/dashboard/classes/1" trailing={<span>สาธิต</span>} />);
    // The title is the stretched link over the whole row.
    expect(html).toContain('<a class="outline-none after:absolute after:inset-0');
    // The wrapper above that link takes no pointer events itself, and gives them back to controls inside it.
    const wrapper = html.match(/<span class="([^"]*)"><span>สาธิต<\/span><\/span>/)?.[1] ?? "";
    expect(wrapper.split(" ")).toContain("pointer-events-none");
    expect(wrapper).toContain("relative z-[1]");
    const controls = wrapper.match(/\[&amp;_:is\(([^)]*)\)\]:pointer-events-auto/)?.[1] ?? "";
    for (const selector of ["a", "button", "input", "select", "textarea", "label", "[role=button]", "[role=switch]", "[tabindex]"]) {
      expect(controls.split(",")).toContain(selector);
    }
  });
});

describe("Surface, CardHeader and ListRow", () => {
  it("Surface renders as an aside with its labelling props", () => {
    const html = renderToStaticMarkup(
      <Surface as="aside" id="roster" aria-labelledby="roster-title">
        x
      </Surface>,
    );
    expect(html).toMatch(/^<aside class="[^"]*" id="roster" aria-labelledby="roster-title">/);
  });

  it("CardHeader takes a heading level, an id and the section size", () => {
    const html = renderToStaticMarkup(<CardHeader as="h2" id="t" size="section" align="center" title="ตารางสอน" />);
    expect(html).toContain('<h2 id="t" class="type-section text-fg">ตารางสอน</h2>');
    expect(html).toContain("min-w-0 flex-1 self-center");
  });

  it("CardHeader balances the title only when asked", () => {
    expect(renderToStaticMarkup(<CardHeader title="English · Primary Origins 2" balance />)).toContain('<h3 class="type-card text-balance-th text-fg">');
    expect(renderToStaticMarkup(<CardHeader title="ตารางสอน" />)).not.toContain("text-balance-th");
  });

  it("ListRow actions: the title is a stretched link and the actions sit above it (nothing nested)", () => {
    const html = renderToStaticMarkup(
      <ListRow as="li" titleAs="h3" href="/dashboard/classes/1" title="English" actions={<button type="button">ตั้งค่า</button>} lines="none" align="start" />,
    );
    expect(html).toMatch(/^<li class="list-row[^"]*items-start/);
    expect(html).toContain('<h3 class="text-base leading-[1.6] font-semibold text-fg break-words text-balance-th"><a data-row-link=""');
    expect(html).toContain("after:absolute after:inset-0");
    expect(html).toMatch(/<\/a><\/h3><span class="pointer-events-none relative z-10[^"]*"><button/);
    // The row itself is not a link, so the button is not nested in one.
    expect(html.indexOf("<a ")).toBeLessThan(html.indexOf("</a>"));
    expect(html.slice(html.indexOf("<a "), html.indexOf("</a>"))).not.toContain("<button");
  });

  it("ListRow onClick with actions or as li: the title is a stretched button, nothing nested", () => {
    const withActions = renderToStaticMarkup(
      <ListRow onClick={() => {}} title="English" lines={1} actions={<button type="button">ลบ</button>} />,
    );
    expect(withActions).toMatch(/^<div class="list-row[^"]*has-\[\[data-row-link\]:hover\]:bg-row-hover/);
    expect(withActions).toContain('<button type="button" data-row-link="" class="');
    expect(withActions).toContain('<span class="block truncate">English</span></button>');
    // The row button closes before the actions open.
    expect(withActions.indexOf("</button>")).toBeLessThan(withActions.indexOf(">ลบ<"));
    const li = renderToStaticMarkup(<ListRow as="li" onClick={() => {}} title="A" />);
    expect(li).toMatch(/^<li class="list-row/);
    expect(li).toContain("after:absolute after:inset-0");
    const disabled = renderToStaticMarkup(<ListRow as="li" onClick={() => {}} disabled title="A" />);
    expect(disabled).toMatch(/^<li /);
    expect(disabled).toContain("disabled=\"\"");
    expect(disabled).not.toContain("has-[[data-row-link]:hover]");
  });

  it("ListRow onClick without actions keeps the whole row a button", () => {
    expect(renderToStaticMarkup(<ListRow onClick={() => {}} title="A" />)).toMatch(/^<button type="button" class="list-row/);
  });

  it("ListRow without actions keeps the whole row a link", () => {
    const html = renderToStaticMarkup(<ListRow href="/x" title="A" subtitle="B" />);
    expect(html).toMatch(/^<a class="list-row/);
    expect(html).toContain("text-sm leading-[1.6] text-fg-muted");
  });
});

describe("DataTable", () => {
  it("leaves empty fields out of the phone cards", () => {
    const html = renderToStaticMarkup(<DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />);
    const cards = html.slice(html.indexOf("<ul"));
    // Row a: note is "–" (left out), amount 1200 shown. Row b: note shown, amount 0 left out by isEmpty.
    expect(cards.match(/<dt/g)).toHaveLength(2);
    expect(cards).toContain("<dd class=\"mt-0.5 text-sm leading-[1.6] break-words text-fg\"><b>1200</b></dd>");
    expect(cards).toContain(">คืนเงิน</dd>");
    // The desktop table still shows every cell.
    expect(html.slice(0, html.indexOf("<ul"))).toContain("–");
  });

  it("cards=none renders only the table; layout=fixed adds a colgroup", () => {
    const html = renderToStaticMarkup(
      <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} breakpoint="lg" cards="none" layout="fixed" rowHref={(row) => `/r/${row.id}`} />,
    );
    expect(html).not.toContain("<ul");
    expect(html).toContain("hidden lg:block");
    expect(html).toContain("table-fixed");
    expect(html).toContain('<colgroup><col style="width:40%"/><col/><col/><col class="w-8"/></colgroup>');
  });

  it("breakpoint=container switches on the table's own width, grid cards two per row", () => {
    const html = renderToStaticMarkup(
      <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} breakpoint="container" containerBreakpoint="64rem" cards="grid" />,
    );
    expect(html).toMatch(/^<div class="min-w-0 @container">/);
    expect(html).toContain("hidden @min-[64rem]:block");
    expect(html).toContain("@min-[64rem]:hidden grid grid-cols-1 gap-2 @min-[48rem]:grid-cols-2");
    expect(html).toContain('class="ds-table-edge" data-edge="end"');
    // No data-overflow until the client measures an overflow, so no edge shadow on first paint.
    expect(html).toContain('<div class="ds-table-frame"><div class="ds-table-scroll overflow-x-auto">');
  });

  it("containerBreakpoint 73rem for the 8-column payout table", () => {
    const html = renderToStaticMarkup(
      <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} breakpoint="container" containerBreakpoint="73rem" cards="grid" />,
    );
    expect(html).toContain("hidden @min-[73rem]:block");
    expect(html).toContain("@min-[73rem]:hidden grid");
  });
});

describe("Controls", () => {
  it("SegmentedControl: responsive full width, lg height and wrapping labels", () => {
    const items = [
      { value: "th", label: "ในประเทศไทย (Thailand)" },
      { value: "abroad", label: "ต่างประเทศ (Abroad)" },
    ];
    const html = renderToStaticMarkup(
      <SegmentedControl aria-label="สถานที่สอน" items={items} value="th" onValueChange={() => {}} fullWidth="mobile" size="lg" wrapLabels />,
    );
    expect(html).toContain("flex w-full md:inline-flex md:w-auto md:shrink-0");
    expect(html).toContain("flex-1 md:flex-none");
    expect(html).toContain("min-h-9");
    expect(html).not.toContain("truncate");
    expect(html).not.toContain("whitespace-nowrap");
    // Wrapped Thai labels keep 1.6.
    expect(html).toContain('<span class="text-center leading-[1.6]">ในประเทศไทย (Thailand)</span>');
    // Below 360px a wrapping md segment gives 4px back to its label ("บัตรประชาชนไทย" on one line at 320).
    const md = renderToStaticMarkup(
      <SegmentedControl aria-label="ประเภทเอกสาร" items={items} value="th" onValueChange={() => {}} wrapLabels />,
    );
    expect(md).toContain("max-[360px]:px-2.5");
  });

  it("TabNav in-page mode renders tabs with tab semantics", () => {
    const html = renderToStaticMarkup(
      <TabNav
        aria-label="ส่วนของคลาส"
        value="students"
        onValueChange={() => {}}
        idPrefix="class-tab"
        items={[
          { value: "lessons", label: "บทเรียน", count: 14, controls: "panel-lessons" },
          { value: "students", label: "นักเรียน", count: 6, controls: "panel-students" },
        ]}
      />,
    );
    expect(html).toContain('role="tablist" aria-label="ส่วนของคลาส"');
    expect(html).toContain('role="tab" id="class-tab-students" aria-selected="true" aria-controls="panel-students" tabindex="0"');
    expect(html).toContain('id="class-tab-lessons" aria-selected="false" aria-controls="panel-lessons" tabindex="-1"');
    const radios = renderToStaticMarkup(
      <TabNav aria-label="ตัวกรอง" value="a" onValueChange={() => {}} semantics="radiogroup" items={[{ value: "a", label: "A" }]} />,
    );
    expect(radios).toContain('role="radiogroup"');
    expect(radios).toContain('role="radio"');
    expect(radios).toContain('aria-checked="true"');
  });

  it("Field and TextAreaField can hide the label visually (still the accessible name)", () => {
    const html = renderToStaticMarkup(<TextAreaField id="reply" label="ตอบกลับ" hint="อย่าใส่ข้อมูลส่วนตัว" hideLabel />);
    expect(html).toMatch(/<label for="reply" class="[^"]*sr-only[^"]*">ตอบกลับ<\/label>/);
    expect(html).toContain('<p id="reply-hint" class="text-sm leading-[1.6] text-fg-muted">');
    expect(renderToStaticMarkup(<Field id="x" label="ชื่อ">{() => null}</Field>)).not.toContain("sr-only");
  });
});

describe("Atoms and buttons", () => {
  it("LevelChip carries the band in its tile tone with a screen-reader prefix", () => {
    const html = renderToStaticMarkup(<LevelChip level="A1" />);
    expect(html).toContain("bg-tile-purple text-icon-purple");
    expect(html).toContain('<span class="sr-only">ระดับ </span>A1');
  });

  it("UserAvatar has a stage size for the presenter", () => {
    expect(renderToStaticMarkup(<UserAvatar name="ปุณณ์ชนิดา" size="stage" />)).toContain("size-16 text-xl xl:size-20 xl:text-2xl");
  });

  it("buttonVariants comes from a server-safe module and is re-exported by ui/button", () => {
    expect(buttonVariantsFromButton).toBe(buttonVariants);
    expect(buttonVariants({ variant: "outline", size: "xl" })).toContain("border-field-border");
    // Merged: the variant's border colour and the size's gap replace the base ones when used on a bare <Link>.
    expect(buttonVariants({ variant: "outline" })).not.toContain("border-transparent");
    expect(buttonVariants({ size: "sm" }).split(" ")).not.toContain("gap-2");
  });
});

/*
 * Page-level controls that stand in for the app bar switch at the shell's own px
 * widths (768px app bar / rail, 1280px full sidebar), not at md:/xl: (rem), so a
 * larger or smaller browser default font never leaves a width with neither.
 */
describe("Page controls follow the shell's px breakpoints", () => {
  const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

  it("the shell switches at 768px and 1280px", () => {
    const css = source("../../app/globals.css");
    expect(css).toMatch(/@media \(min-width: 768px\) \{\s*\.app-appbar \{ display: none; \}/);
    expect(css).toContain("@media (min-width: 1280px)");
  });

  it("PageHeader: back link, h1 and wrapper use the 768px pair", () => {
    const html = renderToStaticMarkup(<PageHeader title="คลาสเรียน" backHref="/dashboard" />);
    expect(html).toMatch(/<a [^>]*class="[^"]*hidden[^"]*min-\[768px\]:inline-flex/);
    expect(html).toMatch(/<h1 [^>]*class="[^"]*max-\[768px\]:sr-only/);
    expect(html).toContain("max-[768px]:contents");
    expect(html).not.toMatch(/\bmd:(?:inline-flex|sr-only|contents)\b/);
  });

  it("the other page-level switches use the same px values", () => {
    expect(source("../../app/dashboard/page.tsx")).toContain("max-[768px]:[&>div:last-child]:hidden");
    expect(source("../../app/dashboard/classes/page.tsx")).toContain('createLink("max-[768px]:hidden")');
    expect(source("../../app/dashboard/classes/[classId]/components/ClassHeader.tsx")).toContain("min-[768px]:inline-flex");
    expect(source("../../app/dashboard/classes/[classId]/components/DetailTabs.tsx")).toContain("min-[768px]:top-0");
    expect(source("../../app/dashboard/chat/[conversationId]/chat-room-client.tsx")).toContain("max-[768px]:sr-only");
    expect(source("./SideNav.tsx")).toContain("min-[1280px]:flex");
  });
});
