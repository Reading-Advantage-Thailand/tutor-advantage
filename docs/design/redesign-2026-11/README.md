# Tutor Advantage redesign, November 2026: final spec

The owner has accepted that the look of all three apps changes ("ยอมเปลี่ยนหน้าตาแอป แก้/ทำใหม่ทั้งหมดเลย"). This folder is the single specification the engineers implement. It combines the three judged directions: **playful** is the base (tokens, type, Reedy, clay, answer tiles), with layouts and rules grafted from **calm** (tutor home, admin table and overview chrome, system rules) and **bold** (lesson reveal, tutor next-class card, admin KPI micro-bars, measurement discipline).

| File | What it holds |
|---|---|
| `README.md` (this file) | Rationale, principles, what changes and what stays, fonts and how to load them, the must-fix decisions, do/don't, rollout |
| [`tokens.md`](tokens.md) | Every token value per app, light and dark, mapped onto the existing names in each `globals.css`; new and retired tokens; shape, depth, spacing, motion; 522 computed contrast pairs; paste-ready CSS |
| [`components.md`](components.md) | Specs for every shared component in the three apps (variants, sizes, states, focus, dark) plus the student tab bar, lesson PhaseBlocks, answer tiles, leaderboard and the tutor presenter primitives |
| [`patterns.md`](patterns.md) | Page layouts per screen type per app: hierarchy, what comes first, phone vs desktop |
| `mocks/*.png` | Final renders that follow this spec exactly (Playwright, Edge, DPR 1, after `document.fonts.ready`) |

Mocks (390×844 phone, 1440×900 desktop): `student-home`, `student-lesson`, `student-landing`, `tutor-home` (phone), `tutor-home-desktop`, `tutor-home-dark`, `admin-overview`, `admin-table`, plus verification renders `x-student-reveal` (lesson reveal graft), `x-student-home-dark`, `x-student-lesson-dark`, `x-admin-overview-dark`, `x-admin-table-dark` and `x-student-home-320` (320px line-break check).

---

## 1. Rationale

The student app is the paying product: a LINE mini app used by 7 to 15-year-olds whose parents pay. Today's mint/LINE-green look is friendly but anonymous. Our primary button is almost the same green as the LINE login button, the system font gives the product no voice, and the mascot appears only on empty states.

The new family is built **from Reedy outward**. His hoodie gives the brand colour (jade `#007352`), his fur gives the accent (tangerine), a sunshine yellow is kept for rewards only, and his cream muzzle gives the paper the apps are printed on. Students get the full volume: a looped reading face, a rounded display face, soft "clay" ledges on things you can tap, Reedy on the home hero, and answer tiles with shapes and a podium. Tutors get the same family turned down. It is capable and warm: one dark "ink" wallet hero, flat cards and quiet paper. Admin gets the quietest version: no display face, no ledges, dense tables. It looks calm and precise. One company, three tones of voice.

Why this mix:

- **Playful** is the only direction that fits the primary audience, and its accessibility work held up under independent re-checking. It is also the cheapest to build, because its clay ledge evolves today's `btn-3d` and its tokens map onto today's names.
- **Calm** has the best tutor and admin page layouts (wallet hero, today's sessions, count-tab toolbar, pagination, joined KPI strip) and the best system rules (one reward colour per view, status = colour + dot + word, mandatory card rim). Those are layouts and rules, so they graft onto playful's tokens without breaking the family. Calm's fonts and evergreen palette are **not** taken.
- **Bold** has the best lesson reveal (result banner, rank-move arrows) and a strong tutor next-class card. Only those, plus the admin KPI micro-bars, are taken. Its ink-and-volt base, four font families, forced-dark lesson stage and answer text on phones are **not** taken.

## 2. Principles

1. **Reedy leads, the UI follows.** At most one Reedy per screen, never cropped, never over a tap target or the LINE button. He always says something factual from the data (the next lesson number, a result), never fixed praise. Admin never shows Reedy; tutors see him only on empty states and the projected presenter screens.
2. **Jade means "go", sunshine means "you earned it".** Jade is for primary actions, progress and selection. Sunshine is for rewards only (points, streak, medals). There is at most **one sunshine reward group per view**. On student home that is the streak chip; in the live lesson it is the score pill (plus the "+120" chip that feeds it on reveal). Decoration is never sunshine.
3. **Status is never colour alone.** Every status is colour + icon or dot + a word ("ใช้งานอยู่", "ถูกต้อง", "ยังไม่ถูก"). Answer tiles carry a shape and a letter, and they never signal right or wrong by their colour.
4. **Clay only on things you can tap.** Buttons, answer tiles, tappable cards and quick-menu tiles have a ledge. Containers, list rows, inputs, the tab bar and tables are flat. **Every card has a rim** (1.5px student, 1px tutor/admin), so white cards separate from paper on cheap screens.
5. **Thai first.** Real Thai faces from Google Fonts, Thai body line-height ≥ 1.6, nothing under 12px, 16px body on phones. Display headlines get authored line breaks. No letter-spacing, uppercase or italics on Thai.
6. **Quieter with age.** The same tokens at three volumes: student (24px cards, 4px ledge), tutor (16px, 2px ledge on primary only), admin (12px, no ledges).
7. **Accessible by construction.** Text 4.5:1 and UI 3:1 in both themes, computed (tokens.md §8). 44×44 targets on touch (admin 36px desktop controls grow to 44px under `pointer: coarse`), 8px between targets, a 3px blue focus ring, `prefers-reduced-motion` respected, Lucide icons only (no emoji as icons).
8. **Cheap on a low-end Android in LINE.** No `backdrop-filter`, no gradients on surfaces, no glows. CSS-only motion on `transform`/`opacity`. Fonts are at most 2 families and 3 weights per app (student 103 KB measured).

## 3. What changes and what stays

**Changes:** palette (LINE-ish mint → jade, tangerine, sunshine on warm paper; night-green dark theme), type (system stack → Kodchasan + Noto Sans Thai Looped / Noto Sans Thai), shape and depth (clay ledges only on tappables, rims on every card, new radius dial), the focus ring (green → blue `#1d66cf` / `#8cb8ff`), the student home hero, landing hero and live-lesson screens, answer tile colours (**A berry red, B ocean blue, C sunshine, D deep violet**, with shapes), the tutor dashboard layout (wallet hero, next class, today, week grid), the admin table and overview chrome (count tabs, pagination footer, joined KPI strip, top bar), and the dark themes of all three apps.

**Stays:**

- **Reedy** (the orange cat with headphones in a green hoodie): same art, same five `ReedyMini` moods. He is never recoloured; the hoodie greens are his own.
- **The TA logo**: keeps the "TA" monogram on a rounded square. The fill (`#14883b` → jade `#007352`), the letterform (outlined Kodchasan 700) and the corner radius (30% of the size) changed. It ships as one outlined SVG (`apps/tutor-pwa/public/icons/ta-mark.svg`), constant in both themes. The browser-tab icon (`src/app/favicon.ico`) of all three apps is the same jade tile. Decided by delegation (§6, items 1a and 1b).
- **The LINE login button**: LINE's own `#06C755`, white label, LINE's official logo asset, LINE's hover (+10% black) and pressed (+30% black) rules.
- **Thai copy**: no copy rewrites beyond the few labels named in patterns.md. All i18n keys stay, except tutor `tutorClass.lessons.satangUnit`, which became `priceUnit` ("บาท") when the price field moved to baht (§6 item 6).
- **The six lesson games** keep their own art and motion (`data-motion="full"`). They must not read `--answer-*` or the presenter option styles.
- Layout, z-index, safe-area and breakpoint tokens, the navigation structure (4 student tabs, 5 tutor tabs, admin side nav), routes and data.

## 4. Fonts

### 4.1 Choice

| App | Display (static text ≥ 14px) | Reading (everything else) | First-load font bytes (measured, thai + latin woff2) |
|---|---|---|---|
| student-liff | **Kodchasan** 600, 700 | **Noto Sans Thai Looped** 400, 500, 600 (one variable file per subset) | **103 KB**: Kodchasan 600 (12 + 14), 700 (11 + 13), Looped (28 + 25) |
| tutor-pwa | **Kodchasan** 600 | **Noto Sans Thai** 400, 500, 600 (variable) | **82 KB**: Kodchasan 600 (12 + 14), Noto (26 + 30) |
| admin-console | none (the logo is an SVG) | **Noto Sans Thai** 400, 500, 600 (variable) | **56 KB**: Noto (26 + 30) |

- **Kodchasan** (Cadson Demak) is a rounded, looped Thai/Latin face. It is friendly for children and calm enough for a parent paying. It has a normal zero (Mitr's slashed zero turns "฿3,000" into "฿3,ØØØ"), and each weight is only about 25 KB. It has **no tabular figures**, measured: "1111" is 60.5px and "0000" is 113.8px at 40px, with or without `tabular-nums`. So it is used for static numbers only.
- **Noto Sans Thai Looped** for students: looped (มีหัว) letterforms are what Thai primary pupils learn to read. Its Latin is Noto Sans, so English words look the same in all three apps. Tabular by default.
- **Noto Sans Thai** (the loopless sibling) for tutors and admin: compact, tabular, same Latin.
- The skill's own pairings (Baloo 2 + Comic Neue, Fira Sans/Code) were rejected because they have no Thai glyphs.

### 4.2 Rules

- Kodchasan **never below 14px**, never in tables, lists, list-row titles or anything that ticks (scores, timers, counts, money in lists). Those use the reading face with `font-variant-numeric: tabular-nums`. Kodchasan may set: page titles, greetings, hero names, section headers (student), buttons/chips/links (student, ≥ 14px), static hero numbers (the tutor wallet amount, landing stats, the next-class start time), answer letters, podium numerals.
- In tutor-pwa, Kodchasan is used only for the page title, the greeting, hero numbers, and the projected presenter (question, letters). Money in lists and tables uses Noto Sans Thai tabular.
- Line height: Thai body ≥ 1.6 (student body 1.65, reading passages 1.7); display ≥ 1.3 (Kodchasan's stacked marks clip below that).
- `font-synthesis: none` on `body`: never fake bold or italic Thai.
- English learning content (articles, options) is set in the reading face with `lang="en"`. English question prompts on the lesson screen may use Kodchasan 700 (the hero of that screen).

### 4.3 Loading with `next/font/google` (Next 15.5)

One `src/app/fonts.ts` per app, wired on `<html>`. `display: "swap"` everywhere; `subsets: ["thai", "latin"]` (the owner's rule). The CSS variable names deliberately differ from the semantic `--font-body`/`--font-display` tokens, so the next/font class and `:root` never write the same variable.

```ts
// apps/student-liff/src/app/fonts.ts
import { Kodchasan, Noto_Sans_Thai_Looped } from "next/font/google";

export const kodchasan = Kodchasan({
  weight: ["600", "700"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-kodchasan",
  fallback: ["Noto Sans Thai Looped", "Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});

export const notoLooped = Noto_Sans_Thai_Looped({
  weight: ["400", "500", "600"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-thai-looped",
  fallback: ["Noto Sans Thai", "Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});
```

```tsx
// apps/student-liff/src/app/layout.tsx: keep the existing attributes, add the two variables
<html lang="th" className={`font-sans ${kodchasan.variable} ${notoLooped.variable}`} suppressHydrationWarning data-scroll-behavior="smooth">
```

```ts
// apps/tutor-pwa/src/app/fonts.ts
import { Kodchasan, Noto_Sans_Thai } from "next/font/google";

export const kodchasan = Kodchasan({
  weight: ["600"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-kodchasan",
  fallback: ["Noto Sans Thai", "Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});

export const notoThai = Noto_Sans_Thai({
  weight: ["400", "500", "600"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-thai",
  fallback: ["Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});
// layout.tsx: <html lang="th" className={`${kodchasan.variable} ${notoThai.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
```

```ts
// apps/admin-console/src/app/fonts.ts
import { Noto_Sans_Thai } from "next/font/google";

export const notoThai = Noto_Sans_Thai({
  weight: ["400", "500", "600"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-thai",
  fallback: ["Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});
// layout.tsx: <html lang="th" className={notoThai.variable} suppressHydrationWarning>
```

Then in each `globals.css` (values in tokens.md §9):

```css
:root {
  --font-body: var(--font-noto-thai-looped), "Noto Sans Thai", "Sukhumvit Set", Thonburi, "Leelawadee UI", Tahoma, var(--font-system); /* tutor/admin: var(--font-noto-thai) … */
  --font-display: var(--font-kodchasan), var(--font-body);                                                                             /* admin: var(--font-body) */
}
@theme inline {
  --font-sans: var(--font-body);        /* font-sans: reading face, the default */
  --font-heading: var(--font-display);  /* font-heading: Kodchasan (admin: reading face) */
}
@layer base { body { font-family: var(--font-body); font-synthesis: none; } }
```

Remove `--font-system` from `body { font-family }`; it stays only as the last fallback. Update the header comment that says "No web fonts are loaded".

**Preload and budget.** In Next 15.5, `subsets` decides which files are *preloaded*. All subsets are still self-hosted and served through `unicode-range` (checked in `next/dist/compiled/@next/font/dist/google/find-font-files-in-css.js`). With the owner's `["thai", "latin"]`, the student app preloads all six files, 103 KB in total. That is inside the **110 KB first-load budget**. The judge asked to preload only the Thai files of Kodchasan 700 and Looped. next/font cannot preload per weight inside one family call, so the budget is met by measurement instead. **Lever, if the LINE WebView test on a low-end Android shows fonts delaying first paint:** switch both student loaders to `subsets: ["thai"]`. The Latin files stay self-hosted and load on demand, and preload drops to 51 KB. Measure in the LINE in-app browser (DevTools → Network → Font) on a low-end Android before release. Each family must download **one file per subset** (the Noto faces are variable).

## 5. Must-fix decisions (all resolved in this spec)

| # | Issue | Decision | Where |
|---|---|---|---|
| 1 | `--answer-a` equalled `--danger-solid`; D was the presenter's "correct" green | One shared `--answer-*` set with its own values: A `#c81e5a` berry red (ΔE2000 17.8 from danger), B `#0f6fc6`, C `#ffc72c`, D `#4b2ca0` deep violet. D is darker than B, so they stay apart for deuteranopes (ΔE 13.2; playful's plum was 1.4). Shapes on every tile. Phone feedback is a check or x icon **plus** "ถูกต้อง" / "ยังไม่ถูก", never tile colour (the result banner is built but not yet on the play screen; today the phone shows no right/wrong). Ship `ANSWER_OPTIONS` in `apps/student-liff/src/components/lesson/AnswerTiles.tsx` (read as `mcqOptions` in `apps/student-liff/src/app/interactive/play/_components/PlayLesson.tsx`) and `OPTION_STYLES` in `apps/tutor-pwa/src/app/(dashboard)/lesson/[id]/interactive/presenter/primitives.tsx` in **one PR** from the same token definition; the correct bar in `ChoiceQuestionStage.tsx` (same folder) stays `var(--success-solid)`. The six games must not read these styles | tokens.md §8.2, components.md §6 |
| 2 | LINE button contrast | White on `#06C755`, LINE's official logo asset from LINE's brand kit (not redrawn; replace the `LineIcon` path if it differs), 56px tall, 16px clear space, divider `rgb(0 0 0 / .08)`. 2.26:1 is accepted as a **brand exception** (decided by delegation, §6 item 2). No ink-label variant without LINE's written approval | components.md §2.2, §6 below |
| 3 | The real `weekStreak` chip was dropped | Kept: sunshine chip with Lucide `flame` ("3 สัปดาห์ต่อเนื่อง"), shown only when `weekStreak > 0`. It is home's one reward element | patterns.md S1, mock `student-home` |
| 4 | Dark mode blocker: dark `--brand-solid #3ccf98` + hard-coded `text-white` = 1.99:1 | Sweep `text-white` on brand fills to `text-on-brand` **in the same PR as the tokens**. Done: none of these files carries `text-white` now. Files that had it before the sweep: `components/ui/button.tsx`, `components/mobile/Chip.tsx`, `SegmentedControl.tsx`, `IconButton.tsx`, `components/icons/BrandMark.tsx`, `app/progress/_components/ProgressHero.tsx`, `LessonList.tsx`, `app/dashboard/_components/QuickActions.tsx`, the chat components (`ChatRoom`, `Composer`, `MessageBubble`, `ConversationRow`), payment (`PromptPayStep`, `SelectMethodStep`), `support/_components/OptionPicker.tsx`, `TicketThread.tsx`, `schedule/_components/MonthCalendar.tsx`, `guardian/_components/GuardianFormParts.tsx`, `lesson/[classId]/page.tsx`, `lesson/history/[sessionId]/page.tsx`, `courses/CatalogRetry.tsx`, `providers/ConsentGate.tsx`; tutor `components/ui/button.tsx`, `checkbox.tsx`, `components/app/SideNav.tsx`, `NotificationBell.tsx`, presenter `primitives.tsx`, `GamePhaseStage.tsx`, `ArticleDisplay.tsx`; admin `components/ui/button.tsx`, `checkbox.tsx`, `components/app/SideNav.tsx`, `CountBadge.tsx`. Exclude every `/games/` folder. Then the raw palette classes and raw hex values per route, outside the games (current counts: each app's `/dev/ui-kit` sweep inventory, §8 step 2) | §7 below, tokens.md "How to apply" |
| 5 | Font budget | 103 KB student (≤ 110 KB), with the measured lever above. Kodchasan ≥ 14px, never in tables, lists or ticking numbers | §4 |
| 6 | Paper `#fff4e6` rendered peach | Student page is `#fffaf3` on **every** screen. `#fff4e6` is retired as a page colour. Every card keeps its rim | tokens.md §1 |
| 7 | Clay everywhere | Ledges only on buttons, answer tiles, tappable cards and quick-menu tiles. `--shadow-card` (no ledge) vs `--shadow-tap` (ledge). Rows, inputs, the tab bar and tables are flat | components.md §3 |
| 8 | Admin was today's layout re-skinned | Calm's count-tab toolbar, pagination footer, joined KPI strip, 6px dot badges, 52/40 rows and top bar; bold's KPI micro-bars, risk edge, column toggle and activity legend. Desktop controls 36px with a 44px hit area under `pointer: coarse`. Ctrl-K search and the daily-payments chart are deferred until endpoints exist | patterns.md A1/A2, mocks |
| 9 | Tutor Kodchasan overuse; projector risk | Kodchasan only for the page title, greeting and hero numbers (+ presenter). **Before release, test the light-paper presenter and the violet D / berry A on a real classroom projector and a TV** (lit room, back row, 1080p and 720p). Set the theme in the lesson bar first: the stage follows the app theme. The check is done by hand (§6, "Still to do by hand before release") | §4.2, patterns.md T10 |
| 10 | Thai line breaks | Authored breaks (`<br>` or one `white-space: nowrap` span per phrase) for static headlines; `text-wrap: balance` plus tests with the longest real class and student names for dynamic headings; quick-menu labels are authored two-line (แชท/ติวเตอร์, ตาราง/เรียน, ประวัติ/การเรียน, ประวัติ/การชำระ) and checked at 320px (`x-student-home-320`) | patterns.md "Thai text" |
| 11 | Reedy's bubble | Built from the home summary: `ไปเรียน {class} ต่อกันนะ` (the summary carries no lesson number, so the class name stands in; the mocks `student-home` and `x-student-home-320` still show the earlier line with "บทที่ 6"). While the class is being taught: `ครูกำลังสอนอยู่`. When there is no next session: `ยังไม่มีคาบถัดไป ลองฝึกพูดกับรีดี้ไหม`. One Reedy per screen, never over the LINE button or a tap target | patterns.md S1 |
| 12 | Logo colour | Decided: jade `#007352` and the flat TA tile (approved by delegation, §6 items 1a and 1b). Ships: the TA mark as one outlined SVG (`apps/tutor-pwa/public/icons/ta-mark.svg`; constant in both themes; 1px white 14% ring in dark), `apps/tutor-pwa/public/icons/icon-192.png` and `icon-512.png`, the tutor manifest `theme_color` `#007352` and `background_color` `#f8f5ef`, the `<meta name="theme-color">` in each layout, and the three `src/app/favicon.ico` files (one file in all three apps; frames 32, 16, 48; flat jade tile). Open follow-ups: the student manifest lists no icons, and no app has an apple-touch icon | §6 |
| 13 | Illustrative mock data | `/dev/ui-kit` galleries use **real fixtures** (local seed users such as Dev Student, Passport Sim Tutor, Local Student 008, the real class "English · Primary Origins 2 (A0)") plus stress strings (the longest real class name, a long Thai name with stacked marks such as "ปุณณ์ชนิดา", a 60-character email). Every component is checked there in light **and** dark before any page migrates | §8 |

## 6. Owner decisions (delegated and decided on 2026-11-10)

The owner delegated these decisions on 2026-11-10 ("decide yourself"). Each one was investigated and challenged before it was decided, and the code follows the decision. Paths are relative to each app's folder; the one `infra/…` path starts at the repository root. Settlement stays manual: nothing here schedules or promises a payout.

| # | Item | Decision | Where it lives |
|---|---|---|---|
| 1a | Logo colour | Jade `#007352` (white on jade 5.88:1; on the old `#14883b` 4.55:1) | `--logo-bg` in each `src/app/globals.css`; `BrandMark.tsx` in each app; §3, §5 item 12, components.md §12 |
| 1b | Logo artwork | The flat jade "TA" tile in all three apps. The old illustrated circle-and-book favicon is replaced, so the tab icon matches the in-app mark | `src/app/favicon.ico` in each app (same file), tutor `public/icons/ta-mark.svg`, `icon-192.png`, `icon-512.png`; §3, §5 item 12 |
| 2 | LINE button | LINE's own green `#06C755` and wording are kept. The 2.26:1 contrast is accepted as a brand exception (decided by delegation, not signed by the owner in person). No ink-label variant without LINE's written approval | student `--line-green*` in `src/app/globals.css`, `src/components/icons/LineIcon.tsx`; components.md §2.2, tokens.md §8 |
| 3 | Presenter on a projector or TV | No dock or colour change. The stage follows the app theme; the tutor picks light for projectors with the sun/moon button in the lesson bar before going fullscreen | tutor `src/components/app/LessonShell.tsx`, `ThemeToggle.tsx`; components.md §7, patterns.md T10 |
| 4 | Admin settlement note | Copy unchanged (standing rule). The note says last month's round is calculated automatically on the 1st; no scheduler job runs it (the only definition, `infra/cloud-scheduler/settlement-cron.yaml`, is a template that was never applied), so the round is calculated by hand from the console | admin `src/locales/th/settlements.ts` (`cronNote`) |
| 5 | Tutor wallet sub-line | Chosen from the finance summary: no network volume → "คอมมิชชัน {rate} จากยอดสะสม {amount}"; group volume above personal volume → "คอมมิชชัน {rate} จากยอดส่วนตัว {personal} + โบนัสเครือข่าย {bonus}"; split unknown or no finance summary → no sub-line | tutor `src/app/dashboard/_home/home-data.ts`, `HomeWallet.tsx`, `src/locales/th/dashboardHome.ts`; patterns.md T1 |
| 6 | Tutor class price field | The tutor types baht (text field, Thai digits accepted, more than 0 and at most 10,000). The request still sends integer satang; no backend change | tutor `src/lib/bookPrice.ts`, `src/app/dashboard/classes/[classId]/components/OpenBookSheet.tsx`, `ArticleSelector.tsx`, `src/locales/th/tutorClass.ts`; patterns.md copy table |
| 7 | Tutor app name | "Tutor Advantage ครูผู้สอน" in page titles and legal text; home-screen label "TA ครูผู้สอน" | tutor `public/manifest.json` (`short_name`), `src/app/layout.tsx` (`appleWebApp.title`), `src/locales/th/app.ts`, `legal.ts`; patterns.md copy table |
| 8 | Word "settlement" on tutor screens | Thai terms, as in admin: "รอบจ่ายเงิน", "หัก ณ ที่จ่าย 3%", "สร้างคำสั่งโอนแล้ว". Term swap only: no promise changed; the hold notice and legal text are untouched | tutor `src/locales/th/dashboardEarnings.ts`, `src/lib/thaiText.tsx`; patterns.md copy table |
| 9 | Class status "open" colour | Admin OPEN "เปิดรับสมัคร" is success green, as in tutor ("รับสมัครอยู่"); full is warning in both | admin `src/lib/status.ts` (`classStatus`); tutor `src/app/dashboard/classes/components/class-status.ts`; components.md §4 |
| 10 | Resolved ticket chip (tutor) | Stays green (success): all three apps agree, closing means solved | tutor `src/app/dashboard/support/lib/support.ts`; student `src/app/support/_lib/tickets.ts`; admin `src/lib/status.ts` |
| 11 | Toast duration | 4 s, errors 6 s, in all three apps; a call's own duration wins; nothing stays by default | student `src/components/ui/sonner.tsx`; tutor `src/components/app/Toast.tsx`; admin `src/components/app/toastStore.ts`; components.md §10 |
| 12 | Dates and times (student) | Shown in Thai time (Asia/Bangkok), like tutor and admin; a device-local calendar day goes through `localDayToBangkokNoon()` | student `src/lib/format.ts` and its call sites; patterns.md §0 |
| 13 | ID-type option at 320px (tutor) | Wrapping md segments use 10px side padding below 360px, so "บัตรประชาชนไทย" stays on one line at 320; no change from 360px up | tutor `src/components/app/Segmented.tsx`; components.md §8 |
| 14 | "{days} วัน" period label (admin, phones) | Below 640px the short label "{days} วัน" shows; the full "{days} วันล่าสุด" is the accessible name at every width | admin `src/app/reconciliation/page.tsx`, `src/locales/th/reconciliation.ts`; patterns.md copy table |

**Still to do by hand before release**

- **Projector and TV check**: run the presenter (light paper stage, violet D, berry A) on a real classroom projector and a TV. Set the theme first with the sun/moon button in the lesson bar: the stage follows the app theme, so a laptop in dark mode projects the dark stage. Check light on the projector, and light and dark on the TV.
- **Tutor home-screen label**: install the tutor app on one Android phone and one iPhone and read the label ("TA ครูผู้สอน"). If either phone cuts it, use "TA ครู" in `public/manifest.json` (`short_name`) and `src/app/layout.tsx` (`appleWebApp.title`).
- **Logo assets outside the repository** (LINE OA profile, LIFF channel icon, rich menu, Google consent screen, Omise) still show the old art. Replace them by hand.
- **Admin settlement note**: unchanged by standing rule. The owner may still reword it.

## 7. Do and don't

| Do | Don't |
|---|---|
| Use semantic tokens (`bg-brand-solid text-on-brand`, `bg-surface`, `text-fg-muted`) | Hard-code hex, Tailwind palette classes (`bg-emerald-600`) or `text-white` on brand fills |
| Put a rim on every card; a ledge only on things you can tap | Put ledges on containers, rows, inputs, the tab bar or tables |
| One primary button per screen; one sunshine reward group per view | Use sunshine for decoration, or tangerine and sunshine together as rewards |
| Status = colour + dot or icon + word | Signal right/wrong, success/danger or "D = correct" by colour alone |
| Kodchasan ≥ 14px for titles, buttons, static hero numbers | Kodchasan in tables, list rows, scores, timers, money in lists, or under 14px |
| Reading face with `tabular-nums` for every number that changes or aligns | Proportional digits in tables and scoreboards |
| Authored Thai line breaks in headlines; `text-wrap: balance` on dynamic headings | Letter-spacing, uppercase or italics on Thai; line-height under 1.6 on Thai body |
| One Reedy per screen, saying something factual from the data | Reedy as a spinner, cropped, recoloured, in admin, or over a tap target |
| LINE button exactly as LINE specifies | Restyle, recolour or relabel the LINE button |
| 44×44 targets and 8px gaps on touch; 3px blue focus ring with 2px offset | Remove focus outlines or rely on hover |
| CSS motion on `transform`/`opacity`, honour reduced motion | Animate width/height/top/left, loop motion while children answer, or use `backdrop-filter` |
| Keep the games' own art and `data-motion="full"` | Let games read `--answer-*` or `OPTION_STYLES` |

## 8. Rollout (per app, in order)

1. **Fonts** (§4) and **tokens** (tokens.md §9), with the shadcn aliases, the `@theme inline` additions and the `text-white` → `text-on-brand` sweep in the same PR. Dark mode is broken without the sweep.
2. **Component classes** in `globals.css` (`@layer components`) and the shared components (components.md), each checked in `/dev/ui-kit` in light and dark with real fixtures. Each app's `/dev/ui-kit` also carries the sweep inventory as its acceptance checklist: the `text-white`-on-brand files (§5 item 4) and the raw palette classes and hex values per route outside the games (student `sweepInventoryData.ts` and tutor `sweep-inventory.json`, each generated by the app's `scripts/sweep-inventory.mjs`; admin `sweepInventory.ts`, counted when the page renders). The inventory holds the current numbers; the spec does not repeat them. A route is migrated when its count is zero.
3. **Answer tiles PR** (student `ANSWER_OPTIONS` + tutor `OPTION_STYLES` + `ChoiceQuestionStage` bars), shipped together.
4. **Pages** (patterns.md): student home, landing, live lesson and reveal; tutor dashboard; admin overview and tables; then lists, details and forms route by route, sweeping raw palette classes as each route migrates.
5. **Verify each page**: the contrast script after any token edit; an audit pass at 320, 375 and 390 wide and at 1440 (no horizontal scroll, no text under 12px, touch targets ≥ 44px, fonts loaded, Thai body line-height ≥ 1.6), modelled on `render.js`; reduced motion; a LINE in-app browser test on a low-end Android (font bytes, jank); the presenter on a projector.

## 9. Files and tools

The mock sources and tools are not part of the repo. They live in the session scratchpad:
`C:\Users\fukus\AppData\Local\Temp\claude\7f35c20da6b868ae\8141eb7a-5752-48c4-b2bc-5215363c6f90\scratchpad\redesign\final\`

- `tools/tokens.js`: the single token source; `tools/contrast.js` + `tools/color.js`: WCAG contrast, CIEDE2000 and colour-vision simulation (`node contrast.js` → 522 pairs, 0 failing).
- `tools/gen-tokens-md.js`: regenerates tokens.md from the token source and the live `globals.css`.
- `tokens/student.css`, `tokens/tutor.css`, `tokens/admin.css`: the paste-ready `:root` / `.dark` blocks (identical to tokens.md §9).
- `tools/css/student.css`, `tools/css/desk.css`: the reference implementation of the component classes used by the mocks.
- `tools/build.js` + `tools/src/*.html`: mock sources; `tools/render.js`: Playwright render + audit; `tools/tnum.js`: tabular-figure measurement.

The skill's checks used here: `ui-ux-pro-max` `--design-system` searches per app (kids education → claymorphism; tutor dashboard → minimal; admin dense → data-dense dashboard; their Latin-only fonts rejected), and its quick-reference and pro-rules checklists as hard requirements.
