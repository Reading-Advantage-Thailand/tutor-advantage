# Components

Specs for every shared component in the three apps. File paths are relative to each app's `src/`. **S** = student-liff, **T** = tutor-pwa, **A** = admin-console. Token names are in tokens.md. The reference CSS that the mocks use is `tools/css/student.css` and `tools/css/desk.css` (README §9).

## 0. Rules every component follows

| Rule | Spec |
|---|---|
| Touch target | ≥ 44×44 on touch for every interactive element (expand the hit area with padding or `::after` when the visual is smaller). ≥ 8px between adjacent targets. A desktop controls are 36px under `(pointer: fine)` and 44px under `(pointer: coarse)` |
| Focus | `:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px }` on every interactive element (≥ 4.67:1 on every light surface, ≥ 5.97:1 dark). Inside the tutor ink hero use `--focus-ring-ink`. Never `outline: none` without a replacement. Inputs use the outline **plus** the border turning `--brand-fg` |
| Hover | Pointer devices only (`@media (hover: hover)`). Hover never carries information |
| Pressed | Ledged elements: `translateY(ledge − 1px)` and the ledge shrinks to 1px (the ledge is a box-shadow, so there is no layout shift). Flat elements: background → `--press-tint` (rows) or the `-pressed` token (fills). `--duration-press` 120ms, `--ease-out` |
| Disabled | `disabled` or `aria-disabled="true"`, opacity .45, ledge removed, `cursor: not-allowed`, no tap action. Read-only is different: `--surface-muted` fill, full-opacity text |
| Loading | The label stays, a spinner replaces the leading icon, `aria-busy="true"`, the control is disabled but keeps its focus |
| Colour | Only semantic tokens. On a brand fill, text is `text-on-brand` (never `text-white`). On sunshine, `text-on-accent` |
| Status | Colour + dot or icon + a word. Never colour alone |
| Dark | Every component is checked in `/dev/ui-kit` in both themes with real fixtures. Dark elevation is lighter surfaces + the rim, not bigger shadows |
| Motion | `transform`/`opacity` only; durations from `--duration-*`; nothing moves under `prefers-reduced-motion` except colour changes |
| Icons | Lucide, outline, round caps. S 24 (stroke 2.1), 20 in links and small buttons, 16 in chips (stroke 2.4), 28 in quick tiles. T/A 20 (stroke 2), 16 in chips and buttons, 18 in A tiles. Decorative icons `aria-hidden="true"`; icon-only buttons get a Thai `aria-label`. Filled glyphs only for rewards (`star`, `crown`, `trophy` with `fill: currentColor`) |

## 1. Type roles

Kodchasan = `--font-display` (S and T only). Reading face = `--font-body` (Noto Sans Thai Looped in S, Noto Sans Thai in T/A).

**Student (phone; desktop is the same centred column)**

| Role / class | Face | Weight | Size / line-height | Used for |
|---|---|---|---|---|
| `t-display-xl` | Kodchasan | 700 | 32 / 1.3 (≥ 640px: 40 / 1.25) | Landing headline |
| `t-display` | Kodchasan | 700 | 28 / 1.3 | Home name, result title |
| `t-section` | Kodchasan | 700 | 20 / 1.35 | Section headers ("คลาสของฉัน") |
| `t-title-l` | Kodchasan | 600 | 22 / 1.35 | Card hero titles, course names |
| `t-title` | Kodchasan | 600 | 18 / 1.4 | Phase name, sheet title; app bar title 17 / 1.35 |
| `t-title-s` | Kodchasan | 600 | 16 / 1.45 | Card titles that are not list rows; Reedy's bubble 15 / 1.45 |
| `t-row` | reading | 600 | 16 / 1.5 | **List-row titles, leaderboard names** (never Kodchasan) |
| button | Kodchasan | 600 | 17 / 1.3 (lg 18, sm 15) | All buttons |
| `t-label` | Kodchasan | 600 | 14 / 1.4 | Chips, links |
| `t-body-l` | reading | 400 | 17 / 1.7 | Reading passages |
| `t-body` | reading | 400 | 16 / 1.65 | Default text |
| `t-body-s` | reading | 400 | 14 / 1.6 | Secondary lines |
| `t-caption` | reading | 500 | 12 / 1.5 | "ขั้นที่ 7/18", timestamps |
| tab label | reading | 600 | 12 / 1.4 | Bottom tabs |
| numbers that change (score, count, rank, money in lists) | reading | 600 | as the context | `tabular-nums` |
| static hero numbers, answer letters, podium | Kodchasan | 700 | 28–64 / 1–1.2 | Landing stats, A–D, podium |

**Tutor** (phone / desktop ≥ 1024): page title Kodchasan 600 19 in the app bar, 28/1.3 on desktop; greeting Kodchasan 600 21/1.4 (desktop: the greeting is the h1 at 28); section Noto 600 18/1.45; card title Noto 600 16/1.5; body Noto 400 16/1.6 phone, 15/1.6 desktop; body small 14/1.55; label 500 14/1.45; button 600 16 phone / 15 desktop; caption 12/1.5; wallet amount Kodchasan 600 36/1.2; next-class time Kodchasan 600 32/1.2; stat strip numbers Noto 600 22 tabular. Presenter: question Kodchasan 600 44/1.3 (min 36), option text Noto 600 30/1.4 (min 26), letters Kodchasan 600 40, nothing on stage under 24px at 1080p.

**Admin** (desktop / phone): h1 Noto 600 24/1.35 (phone 20/1.4); section 600 16/1.5; body 400 14/1.6 (phone 16); body small 13/1.55; table header 600 13/1.4; table cell 400 14/1.5 tabular (names 500); badge 500 12.5; nav 500 14 (active 600); KPI value 600 24/1.3 tabular; caption 12/1.5.

## 2. Buttons

### 2.1 Student `components/ui/button.tsx` (cva) and the `.btn*` classes in `globals.css`

The original shadcn variants and sizes stay untouched (the games use them). The mobile variants change as follows:

| Variant (existing name) | Fill / text | Edge | Use |
|---|---|---|---|
| `brand` → **primary** | `--brand-solid` / `--on-brand` | `0 var(--ledge) 0 var(--brand-solid-edge)` + `inset 0 2px 0 rgb(255 255 255/.16)` | The one primary per screen ("ทำบทเรียนต่อ", "ชำระเงิน") |
| `brandSoft` → **tonal** | `--brand-soft` / `--brand-soft-fg` | `0 var(--ledge-sm) 0 var(--brand-soft-border)` | Secondary actions on cards ("ดูรายละเอียด") |
| **`reward`** (new) | `--accent-solid` / `--on-accent` | `0 var(--ledge) 0 var(--accent-edge)` + `inset 0 2px 0 rgb(255 255 255/.35)` | The next step after a reward ("ฝึกพูดกับรีดี้"). Never payments. Counts as the view's reward group |
| **`outline`** (new mobile variant) | `--surface-card` / `--text-primary`, 2px `--field-border` | `0 var(--ledge-sm) 0 var(--clay-ledge)` | Neutral alternative ("ดูคลาสเรียนทั้งหมด") |
| `ghost` / link | transparent / `--brand-fg` | none | "ดูทั้งหมด", inline actions (44px hit area) |
| `warning` | `--warning-solid` / `--on-warning` | `0 var(--ledge-sm) 0 var(--accent-edge)` | Pending payment CTA only |
| `danger` | `--danger-solid` / `--on-danger` | `0 var(--ledge) 0 var(--answer-a-edge)` light, none dark | Destructive confirmations inside sheets only |
| `line` | see 2.2 | none | LINE login only |

Remove the hard-coded hex hovers (`hover:bg-[#e8930a]`, `#c81f1f`, `#05b34c`…) and use the tokens.

| Size (existing name) | Height | Radius | Text | Padding / icon |
|---|---|---|---|---|
| `touch` → **sm** | 44 | `--radius-ctl-sm` 14 | Kodchasan 600 15 | 0 16, icon 20 |
| `cta` → **md** | 52 | `--radius-ctl` 18 | 600 17 | 0 24, icon 24, gap 10 |
| **lg** (new) | 56 | 20 | 600 18 | Hero CTAs and bottom action bars |
| `icon-touch` | 44 round | 999 | — | icon 22 |

Full width (`w-full`) for the primary in cards and bottom bars. States per §0: pressed `translateY(3px)` + ledge 1px; hover (pointer) `--brand-solid-pressed`; disabled .45 + no ledge; loading spinner + `aria-busy`.

### 2.2 LINE login button (S landing, login, consent)

Fill `--line-green` `#06C755`; LINE's **official** white logo from LINE's brand resources (44px logo cell; replace the `LineIcon` mono path with the kit asset if they differ); a 1px `rgb(0 0 0/.08)` divider between logo and label; label "เข้าสู่ระบบด้วย LINE", white, Kodchasan 600 18, centred in the remaining width. Height 56, radius 20, **no ledge**, full width. Hover `--line-green-hover` (+10% black), pressed `--line-green-pressed` (+30% black). At least 16px clear space; Reedy and other targets never overlap it. Contrast 2.26:1 is accepted as a brand exception (decided by delegation, README §6 item 2). Never recoloured, relabelled or given an ink label.

### 2.3 Tutor and admin `components/ui/button.tsx` + `Atoms.tsx` usage

| Variant | Fill / text | Edge | Use |
|---|---|---|---|
| default / **primary** | `--brand-solid` / `--on-brand` | T: `0 2px 0 var(--brand-solid-edge)`; A: none | One per screen ("เริ่มสอนสด", "บันทึก") |
| **secondary** (shadcn `outline`) | `--surface-card` / `--text-primary`, 1px `--field-border` | none | "สร้างคลาสใหม่" when another primary exists, "ส่งออก CSV", "ดูคลาส" |
| **tonal** (shadcn `secondary`) | `--brand-soft` / `--brand-soft-fg` | none | Row actions ("เริ่มสอน" on a today row) |
| ghost / link | transparent / `--brand-fg` | none | "ดูทั้งหมด" |
| destructive | `--danger-solid` / `--on-danger` | none | Inside confirm dialogs only, set apart from cancel |
| on-ink (T, new) | `rgb(255 255 255/.12)` / `--ink-fg`, 1px `rgb(255 255 255/.28)` | none | Secondary action inside the wallet hero |

Sizes: T 44 phone (48 for the page's primary), 40–44 desktop, radius `--radius-ctl` 12, Noto 600 15–16, icon 16–20, gap 8. A `--ctl-h` 36 desktop (44 under `pointer: coarse`), radius 8, Noto 600 14, padding 0 14. Icon buttons T 44, A 36 (44 coarse), radius 12 / 8, glyph 20 / 18, Thai `aria-label`. Pressed T `translateY(1px)`, A background → `--brand-solid-pressed`.

### 2.4 `IconButton` (S `components/mobile/IconButton.tsx`)

44 round, glyph 22, stroke 2.2. Variants: `ghost` (transparent, `--text-primary`; pressed `--press-tint`), `tonal` (`--surface-card` + 1.5px `--clay-rim` + `0 3px 0 var(--clay-ledge)`), `onBrand` (on the hero: `--hero-chip` fill, `--hero-fg` glyph, 1.5px `--hero-ring`). Badge: a number → 20px pill `--danger-solid`/`--on-danger`, reading 600 12 tabular (today's 18px pill with 11px text goes: 12px is the floor); a dot → 10px `--danger-solid` with a 2px `--surface-card` ring.

## 3. Surfaces and lists

### 3.1 `Surface` / `Card` (S `components/mobile/Surface.tsx`, T/A `components/app/Surface.tsx`, `ui/card.tsx`)

| | Student | Tutor | Admin |
|---|---|---|---|
| Fill | `--surface-card` | `--surface-card` | `--surface-card` |
| Rim (mandatory) | 1.5px `--clay-rim` | 1px `--clay-rim` | 1px `--clay-rim` |
| Radius | `--radius-card` 24 | 16 | 12 |
| Shadow (container) | `--shadow-card` | `--shadow-card` | `--shadow-card` |
| Shadow (tappable card) | `--shadow-tap` (4px ledge) + press `translateY(2px)` | `--shadow-tap` (2px) | flat; hover `--row-hover` |
| Padding | 18–20 | 16–20 | 14–16 |

Tones (T/A `SurfaceTone`): `muted` → `--surface-muted`, no shadow; `brand` → `--brand-soft` + `--brand-soft-border` rim; `hero` → `--hero-bg-base`; `success`, `warning`, `danger`, `info` → `*-bg` + `*-border`. **Well** (grouped info inside a card): `--surface-muted`, radius 16 S / 12 T / 8 A, no rim. A whole-card link has one accessible name and a chevron or explicit button; nested interactive elements are not allowed inside a whole-card link.

### 3.2 `ListGroup` / `ListRow` (S `List.tsx`; T/A `Surface.tsx`) and `ListRowSkeleton`

Flat rows inside one card (no ledges on rows). Min height S 64, T 64, A 56; padding 10–12 × 16–18; leading tile/avatar 40–48 (A 32); title `t-row` (S) / Noto 600 16 (T) / 600 14 (A); subtitle body-small `--text-secondary`; trailing chevron 16–20 `--text-tertiary`, a value, or one chip. Dividers: 1.5px (S) / 1px (T/A) `--hairline`, inset to the text start when there is a leading element (keep `--row-divider-inset`: S 68, T/A 64). Pressed `--press-tint`; hover (pointer) `--row-hover`; selected `--brand-soft` with a 3px inset `--brand-solid` bar on the leading edge. `DescriptionList` (T/A): label 13 `--text-secondary` above value 15/14 `--text-primary`, two columns ≥ 768px, money and IDs tabular.

### 3.3 Student hero (home, class detail, progress)

Flat `--hero-bg-base`, radius `0 0 32 32`, padding 18 16 0. Two decorative circles via `::before/::after`: `--hero-blob-a` 210px top-right at .8, `--hero-blob-b` 132px bottom-left at .7 (never sunshine). Text `--hero-fg` / `--hero-fg-muted`; chips on the hero use the `paper` chip; avatar 52 with a 3px `--surface-card` ring. The following card overlaps the hero by 30px and sits above Reedy (z-index). The old `.appbar[data-variant="brand"]` becomes the same flat hero colour. Dark: `#143a2f` with dark blobs.

### 3.4 Tutor wallet hero (new composition, T dashboard and earnings)

The **one ink surface per screen**. `--ink-bg`, radius `--radius-hero` 20, padding 18 (desktop 22 24), `--shadow-raised`, inset 1px `--ink-rim` (visible in dark). Top row: label "รายได้ประมาณการเดือนนี้" Noto 500 14 `--ink-fg-muted` + rate chip ("เรท 35%", `--ink-chip` / `--ink-fg`). Amount Kodchasan 600 36 `--ink-fg` (static number). Sub-line 14 `--ink-fg-muted`. Goal block (below on phone, right half with a 1px `rgb(255 255 255/.14)` divider on desktop): "ยอดสะสมเดือนนี้" vs "เป้าหมายเรทถัดไป" labels, both values Noto 600 17 tabular; progress 10px `--ink-track` with `--accent-solid` fill; "ขาดอีก **฿1,550** เพื่อขึ้นเรทถัดไป" with the amount in `--ink-accent-fg`. `role="progressbar"` with values. Focus inside uses `--focus-ring-ink`. Data: `dashboard/page.tsx` and the `dashboardHome` / `dashboardEarnings` locale keys already provide it.

### 3.5 Stat strip and stat tiles: `StatTile` (S `Feedback.tsx`), `StatCard` (T/A)

- **Stat strip** (T phone and desktop, S progress): one card, 3 (T) or 4 cells, 1px `--hairline` dividers between cells, cell padding 14 16; label Noto 500 13 `--text-secondary`; value Noto 600 22 tabular (these numbers are not hero numbers). Replaces separate 2×2 stat cards on phones.
- **Admin KPI strip**: one card, 4 cells, dividers; label 500 13 + 32px tone tile top-right; value 600 24 tabular; hint 12 `--text-tertiary`; optional 4px micro-bar (track `--track`, fill a chart colour) with an `aria-label` giving the split ("PromptPay 100% บัตร 0%"). Risk cell: numeral in `--danger-fg`, a 3px inset `--danger-solid` left edge and a danger bar. A cell that is a link shows a "→" text action in `--brand-fg`.
- **StatTile** (S landing/progress): numbers Kodchasan 700 28 (static), label 13 `--text-secondary`. On the landing the three stats sit in **one** card with dividers (no ledges, they are not tappable).

## 4. Chips, badges, counts

| Component | Spec |
|---|---|
| S `Chip` (`components/mobile/Chip.tsx`) | `md`: 32px, padding 0 12, pill, Kodchasan 600 14, icon 16. `sm`: 24px, padding 0 10, **reading** 600 12 (Kodchasan never under 14), icon 14. Tones: `brand` (`--brand-soft`/`--brand-soft-fg`), `success`, `warning`, `danger`, `info` (`*-bg`/`*-fg`), `neutral` (`--tile-neutral`/`--icon-neutral`), `onBrand` → **paper** (`--hero-chip`, `--hero-fg`, 1.5px `--hero-ring`), **sun** (new: `--accent-solid`/`--on-accent` + 1.5px inset `--accent-edge`; streak and points only). Optional 6px dot. Non-interactive |
| S `FilterChip` | Interactive: 36px visual, 44px hit area, pill, 1.5px `--field-border` rest; selected `--brand-soft` fill, `--brand-soft-fg`, check icon 16, `aria-pressed` |
| S `HScroll` | Horizontal chip rails only (filters). Not for main content cards (vertical lists instead) |
| S `LevelChip` | Fixed tone per CEFR band, text = band: A0 teal, A1 plum (`tile-purple`), A2 sky (`tile-blue`), B1 orange, B2 berry (`tile-pink`). Same mapping in the class-card band and the tutor week grid |
| T/A `Chip`, `StatusChip` (`Atoms.tsx`), A `AdminStatusChip` | T: 28px, padding 0 10, pill, Noto 500 13. A: 24px, padding 0 8, **radius 6** (`--radius-chip`), 500 12.5. Always a 6px `currentColor` dot (or a 14px icon) **plus** the word. Tones: success / warning / danger / info / neutral / brand. "Not applicable" values ("ไม่ต้องยืนยัน") are plain `--text-tertiary` text, not a chip. Class status: open is success in both apps (T "รับสมัครอยู่", A "เปิดรับสมัคร"), full is warning ("เต็มแล้ว") |
| Count badge (S section count, T `NotificationBell` `CountBadge`, A `CountBadge`) | Neutral count: S 28px pill `--tile-neutral`/`--icon-neutral`, reading 600 14 tabular; T/A 22px `--neutral-bg`/`--neutral-fg` 600 12. Alert count in nav: 22px pill `--danger-solid`/`--on-danger` 600 12 tabular, right-aligned. Bell dot: 8px `--danger-solid` with a 2px ring in the bar colour |
| A `EnvBadge` | Full-width `warning` chip under the brand block ("โหมดพัฒนา"), 26px, centred, always visible outside production |
| `ui/badge.tsx` (all apps) | Map variants onto the chips above; no raw palette classes |

## 5. Atoms

| Component | Spec |
|---|---|
| `IconTile` (S `IconTile.tsx`, T/A `Atoms.tsx`) | Tones `brand, amber, blue, purple, pink, red, teal, orange, neutral` → `--tile-*` / `--icon-*` (every pair ≥ 4.6:1, so tiles may carry text). S sizes: sm 40 (r 12, icon 22), md 48 (r 16, icon 24), lg 56 (r 18, icon 28); quick-menu 60 (r 20, icon 28, 1.5px `--clay-rim` + `0 3px 0 var(--clay-ledge)` because they are tappable). T 40 (r 12, icon 20). A 32 (r 8, icon 18). One tone per meaning: chat blue, schedule purple, history teal, payment orange, risk red, settings neutral, classes by CEFR band |
| `UserAvatar` (S, T), A `Avatar.tsx` | Circle 32 / 36 / 40 / 52 (S home 52 with a 3px `--surface-card` ring). Initials: **one** leading character for Thai names (two Thai initials read badly), two letters for Latin names; S Kodchasan 700 / T, A Noto 600; colours from the tile pairs by a stable hash of the user id. Photo: `object-fit: cover` + 1px `--hairline` ring. "You": 2px `--brand-fg` ring |
| `ProgressBar` (S, T/A `Atoms.tsx`) | Track `--track`, fill `--brand-vivid` (≥ 3.38:1 on the track), pill. Height S 12 (sm 8), T 10, A 6. S fill has a 3px inner top highlight. Animate with `transform: scaleX()` from 0 (600ms `--ease-out`), never width; reduced motion renders the final value. Always paired with text ("เรียนแล้ว 5 จาก 14 บท", "36%") and `role="progressbar"` with values. Tones: `brand`, `onBrand` (`--hero-progress-track`), `warning`, `ink` (T wallet: `--ink-track` + `--accent-solid`) |
| `Spinner` | 16 / 20 / 24, 2px stroke `currentColor` at 25% + 100% arc, 800ms linear; under reduced motion it pulses opacity instead. Never Reedy |
| Skeletons (`Skeletons.tsx`, `ui/skeleton.tsx`, `.skeleton-block`) | `--skeleton-base` + `--skeleton-shine` sweep 1.4s (compositor only, static under reduced motion); shapes match the final layout (CLS 0); `LoadingAnnouncement` keeps its polite live region |
| S `Switch` / `SwitchRow`, `ui/checkbox.tsx` | Switch track 52×32, off `--fill-muted` + 1.5px `--field-border`, on `--brand-vivid`; thumb 26 `--surface-card` with a shadow; 44px hit area; `role="switch"`. Checkbox 20 (24 S), radius 6, 2px `--field-border`, checked `--brand-solid` + `--on-brand` check |

## 6. Live lesson (student phone + tutor presenter): one shared definition

### 6.1 Answer tiles A–D (S `components/lesson/AnswerTiles.tsx` `ANSWER_OPTIONS`, T presenter `OPTION_STYLES`)

| Option | Fill | Letter | Ledge | Shape (top-left) | Light boundary | Dark boundary |
|---|---|---|---|---|---|---|
| A | `--answer-a` `#c81e5a` berry red | `--on-answer-a` white (5.54:1) | `--answer-a-edge` | triangle | fill vs page 5.34:1 | 2px `--answer-rim` |
| B | `--answer-b` `#0f6fc6` ocean blue | white (5.11:1) | `--answer-b-edge` | diamond | 4.92:1 | 2px rim |
| C | `--answer-c` `#ffc72c` sunshine | `--on-answer-c` `#3d2900` (8.88:1) | `--answer-c-edge` | circle | 2px inset `--answer-c-edge` (3.18:1) | edge 3.59:1 |
| D | `--answer-d` `#4b2ca0` deep violet | white (9.69:1) | `--answer-d-edge` | square | 9.33:1 | 2px rim |

- **Student phone**: 2×2 grid filling the space between the question card and the rank strip, gap 16×12, tile min-height 120, radius `--radius-answer` 24, letter Kodchasan 700 64, shape 26px at 92% opacity. Box-shadow `0 6px 0 var(--answer-x-edge), inset 0 0 0 2px var(--answer-rim), inset 0 3px 0 rgb(255 255 255/.18)`. `<button aria-label="คำตอบ A">`; keys 1–4 and A–D on tablets with keyboards. The phone shows **letters only** (no option text, no answer counts, no timer: the class looks at the teacher's screen).
- Pressed: `translateY(5px)`, ledge 1px. **Submitted**: the chosen tile keeps its colour and gets a 28px `--surface-card` check badge top-right plus a 4px inner white ring; the others go to opacity .45 and lose their ledge; all four `aria-disabled`. **Missed / read-only**: all .45 with the warning `StatusCard`.
- **Feedback is never tile colour.** After the reveal the phone shows the result banner (6.3): `circle-check` + "ถูกต้อง" or `circle-x` + "ยังไม่ถูก", and the answer echo repeats the chosen letter tile with a success or neutral chip carrying the word. Not wired yet: the play screen does not render `ResultBanner` (only `/dev/ui-kit` does) and passes no result chip to the answer echo, so today the phone shows no right/wrong at all and points the child to the teacher's screen ("โปรดดูเฉลยที่หน้าจอคุณครู").
- **Presenter** (T): wide tiles, radius 16, min-height 96 at 1080p; a 56px letter badge (`rgb(0 0 0/.18)` on A/B/D, `rgb(0 0 0/.10)` on C) holding the shape + letter (Kodchasan 600 40); option text Noto 600 30/1.4 in the tile's text colour; speak button 44 (`rgb(0 0 0/.15)`). Reveal: the correct option gets a 6px `--success-solid` outer ring and a "ถูกต้อง" success chip with `check`; the others fade to .45. Results bars (`ChoiceQuestionStage.tsx`) use `--answer-*` for every option and `var(--success-solid)` for the correct one, which is also labelled by text and the check icon.
- Shipping: one PR changes `ANSWER_OPTIONS` (student `components/lesson/AnswerTiles.tsx`), `OPTION_STYLES`/`FALLBACK_OPTION_STYLE` (fallback `--surface-muted`/`--text-primary`) and the bar colours from the same `--answer-*` tokens. The six games must not import `OPTION_STYLES`.

### 6.2 Lesson top bar and phase blocks (S `components/lesson/PhaseBlocks.tsx`)

| Component | Spec |
|---|---|
| Lesson top bar | 60px + safe-top, `--surface-card`, bottom rim 1.5px `--clay-rim`. Close `X` icon button 44 (`aria-label="ออกจากห้องเรียน"`); centred title "ห้องเรียนสด" Kodchasan 600 17 + article title 13 `lang="en"`; score pill right: 36px pill `--accent-solid` / `--on-accent`, reading 600 16 **tabular**, filled `star` 18, 1.5px inset `--accent-edge`, `aria-label="คะแนนของคุณ 120 คะแนน"`. It is the screen's one reward element; it scales 1 → 1.12 → 1 (`--ease-spring`, 380ms) when points land |
| `PhaseColumn` / phase row | Tone tile 48 + "ขั้นที่ 7/18" (`t-caption` muted) + phase name (`t-title`); 18-segment journey (8px, gap 3): done `--brand-vivid`, current `--brand-solid` with a 2px page-colour gap + 1.5px `--brand-solid` ring, upcoming `--track`; `aria-hidden` (the caption is the text equivalent). The current step is jade, not sunshine (sunshine belongs to the score) |
| `PhaseIntroCard`, `PhaseCard` | Card (rim, no ledge), padding 16–18, chip + title + body. Question card: chip "คำถาม 2/3" (brand), question Kodchasan 700 23/1.4 `lang="en"` with `text-wrap: balance`, hint row with `presentation` 20 + "ดูตัวเลือกบนจอคุณครู แล้วแตะคำตอบที่ถูกต้อง" 14 `--text-secondary` |
| `LookAtScreenRow` | Replaces the floating emoji: tone tile 64 + tip text 16/1.65 + Reedy calm 88 (one Reedy). No looping motion while children answer |
| `StatusCard` | Tone card (`*-bg` + `*-border`, radius 24): eyebrow 13 `*-fg`, Lucide icon 24, title `t-title`, description `t-body-s`. Tones warning (missed), info (waiting, reconnecting), success, danger |
| `AnswerEcho` | Card: "คำตอบของคุณ" caption + the chosen **letter** (big: a 44px mini tile in the answer colour with its shape, or the 56px letter) + status chip after the reveal. Never the option text for MCQ |
| `AiPendingCard`, `AiScore`, `AiFeedbackText` | Info-tone pending card with `Spinner` + skeleton lines (`role="status"`); score as a 3-step meter with words (ดีมาก / พอใช้ / ลองอีกครั้ง) + number, never colour only; feedback text 16/1.65 |
| `WaitingNextLine` | Centred row: `presentation` 20 + "รอคุณครูไปขั้นถัดไป" 14 `--text-secondary`; `role="status"` |
| Rank strip (under the tiles) | Card (no ledge): Reedy happy 48 (decorative), "อันดับตอนนี้ · คุณอันดับ 2" (`t-row`), "120 คะแนน" 14 tabular, rank medal 36 at the right. No answered counts on the phone |

### 6.3 Result banner (new, bold graft restyled; `components/lesson/ResultBanner.tsx`, not yet used on the play screen)

After the reveal: a success card (`--success-bg`, 1.5px `--success-border`, radius 24, padding 16 8 16 18) with `role="status" aria-live="polite"`. Title Kodchasan 700 24/1.3 in `--success-fg` with `circle-check` 28: "ถูกต้อง! ทำได้ดีมาก" written as two no-wrap phrases so it breaks between them. Points chip: `sun` chip "+120 คะแนน" (filled star, tabular). Line 15/1.6: "ตอบเร็วเป็นอันดับ 2 ของห้อง". Reedy cheer 96 at the right (decorative). Enters with `pop-in` (scale .92 → 1.04 → 1, 380ms spring); reduced motion: no scale. Wrong answer: a neutral card (`--surface-card`), `circle-x` in `--text-secondary` + "ยังไม่ถูก ไม่เป็นไรนะ" + the correct letter as a mini tile, Reedy calm. Never red for a child's wrong answer.

### 6.4 `MobileLeaderboard` and `RankBadge` (S), leaderboard rules

Card with header "อันดับตอนนี้" (`t-title-s`) + brand chip "คุณอันดับ 5". Rows 56: rank cell 36 (ranks 1–3 as medal discs `--medal-gold/silver/bronze` with `--on-medal` numerals, reading 600 16 tabular, inner bottom shade; others plain numerals in `--text-secondary`; "–" before a first score), avatar 36, name `t-row` ("คุณ" for the viewer), optional rank move (`arrow-up` 16 + n in `--success-fg`, screen-reader text "ขึ้นมา 2 อันดับ" / "ลดลง 2 อันดับ"; `arrow-down` in `--text-secondary` for drops, never red), score right-aligned reading 600 16 tabular + "คะแนน" 12. **Your row**: `--brand-soft` fill, 3px inset `--brand-solid` bar, `aria-current="true"`. **Show the top 3 plus your row**, with a "…" row (32px, `aria-hidden`) between when you are below 4th. Ties share a rank (existing model). Reorders animate `translateY` 320ms; reduced motion: none.

### 6.5 Wrap-up podium (S results, T `FinalLeaderboardStage`)

Podium blocks 88 / 64 / 48 tall in gold / silver / bronze with the Kodchasan 700 numeral, avatar, name and "N คะแนน" above each; Reedy cheer 96 beside the headline "เก่งมาก! คุณอันดับ 2" (from data); the reward button "ฝึกพูดกับรีดี้" below. Confetti (`components/celebrate/Confetti.tsx`): 6 flat rounded shapes in the four answer colours, fall 40px + fade once (1.1s); not rendered under reduced motion. T presenter version: same layout at 1080p, names 28, medals 64.

## 7. Tutor presenter primitives (`app/(dashboard)/lesson/[id]/interactive/presenter/`)

| Component | Spec |
|---|---|
| `LessonShell`, `LessonBarActions`, `LessonDock`, `LessonContent` (`components/app/LessonShell.tsx`) | The stage follows the app theme (the device's light/dark setting until the tutor picks one). Use the **light paper theme** (`--surface-bg`) on projectors and in lit classrooms, dark on TVs; the tutor switches with the sun/moon button in the lesson bar before going fullscreen. Lesson bar 52 (44 on screens 800px tall or less), hidden in fullscreen. Dock: sticky bottom, `--surface-nav` + top hairline, controls 44 (56 on touch screens), never covering the stage; flow buttons in order: "จบคาบเรียน" (outline, shown from 768px up), outline "ย้อนกลับ", then "จบคำถาม" while a question is open and someone has not answered ("จบเกมเลย (n/total)" while a game is playing), then the primary "ถัดไป". Only one is filled: "จบคำถาม" while the question can still be closed and the primary waits; "จบเกมเลย" whenever it is shown, since the primary stays disabled while a game is playing; on the final leaderboard "จบคาบเรียน" (shown at every width there, while the primary reads "เริ่มรอบใหม่ต่อเนื่อง" and turns outline); otherwise the primary |
| `StagePanel` | Card: `--surface-card`, 1px `--clay-rim`, radius 16, `--shadow-card` (replace `rounded-xl border-hairline`) |
| `StageEyebrow` | Noto 500 16 at 1080p (never under 14 on a laptop) `--text-secondary` + optional icon 16 `--brand-fg` |
| Option tiles | §6.1, from `--answer-*` |
| `AnswerProgress` | "ส่งแล้ว **8 / 12** คน" (label 16 `--text-secondary`, numbers Noto 600 20 tabular; complete → `--success-fg`), bar 10px `--track` / `--brand-vivid` (complete `--success-solid`), `role="status" aria-live="polite"` |
| `PreparationStatus`, `StageEmpty` | Info-tone line with icon; empty stage = Reedy calm 120 + one line + one action |
| `ResultStat` | Tone well (`success`/`danger` `*-bg`), value Noto 600 40 tabular in `*-fg`, label 14 + unit. Wrong count uses the **neutral** tone, not danger (children see the projector) |
| `ResultsBarChart` / `LazyResultsBarChart` | Bars in `--answer-*`, the correct bar `--success-solid` + a check icon and "ถูกต้อง" label; axis 16, gridlines `--hairline`; a text summary in the `aria-label` |
| `PhaseProgress` | 18 segments as on the phone (§6.2), 12px tall on stage, current step labelled by name (Kodchasan 600 24) + "ขั้นที่ 7/18" |
| `StudentRosterPanel` | 320px right panel: avatars 36 + name 16 + answered `check` (success) or "รอ" (neutral word); sorted answered-last; never colour only |
| `PresenterDock`, `PresenterConfirm` | Dock as above; confirm uses `ConfirmDialog` (§9) |
| `WrapUpStages` (`PairConversationStage`, `FinalLeaderboardStage`) | Paper stage; podium per §6.5; Reedy cheer on results, calm on intros (one per stage) |
| `GamePhaseStage` | Hands the stage to the game; only the lesson bar and dock remain. Its `text-white`-on-brand classes are already swept (README §5 item 4); keep brand fills on `text-on-brand` |

## 8. Fields and controls

| Component | Spec |
|---|---|
| S `TextField`, `TextArea`, `SearchField` (`Fields.tsx`); `ui/input.tsx` | Height 52, radius 16, `--surface-card`, **2px** `--field-border` (≥ 3.48:1), text 16 (the unlayered `max(16px, 1rem)` rule stays). Label above, always visible (Kodchasan 600 15); helper below 14 `--text-secondary`; required "*" in `--danger-fg` + `aria-required`. Focus: border `--brand-fg` + the 3px focus ring. Error: border `--danger-solid`, message below with `circle-alert` 16 + text in `--danger-fg`, `aria-describedby`, validate on blur, error summary after a failed submit. Read-only `--surface-muted`; disabled .45. Search: leading `search` 20, clear button with a 44px hit area |
| T `Field`, `TextField`, `TextAreaField`, `SelectField`, `SearchField` | 48 phone / 44 desktop, radius 12, 1px `--field-border`, Noto 400 16 (15 desktop), label Noto 500 14 above. Same states |
| A `Fields.tsx`, `FilterBar.tsx`, `ui/input`, `ui/select`, `ui/textarea`, `ui/label` | `--ctl-h` 36 desktop / 44 coarse, radius 8, 1px `--field-border`, 14px (16 on touch); label 500 13 above; money inputs right-aligned tabular with a "฿" prefix. FilterBar: search (flex 1, min 200) + up to 2 selects (160) + the `ColumnToggle` button; extra filters go in a "ตัวกรอง" sheet |
| S `SegmentedControl`, T/A `SegmentedControl` + `TabNav` (`Segmented.tsx`) | Track `--surface-muted` + 1.5px (S) / 1px (T/A) `--clay-rim`, padding 3–4; S pill height 44, T 44 / 40 desktop, A 32 desktop (44 coarse), radius S pill / T 12 / A 10. Selected: `--surface-card`, `--text-primary`, 600 (S Kodchasan 15, T/A Noto 14), S 2px `--clay-ledge` ledge, T/A `0 1px 2px` shadow + 1px rim. Optional count after the label (tabular, `--text-tertiary`; selected `--brand-fg`). `role="tablist"` + arrow keys; selected marked by weight and fill, not colour only. T md segments with wrapping labels: side padding 12, 10 below 360px, so "บัตรประชาชนไทย" stays on one line at 320. `TabNav` (class detail tabs): underline variant, 44 tall, 3px `--brand-solid` bar under the active tab |
| `ThemeSegmented`, `ThemeToggle` | Segmented with `sun` / `moon` / `monitor` icons + words; the icon toggle in the A top bar is a 36 icon button whose `aria-label` names the next theme |
| `Dropdown` (T/A), `ui/dropdown-menu`, `ui/popover` | `--surface-elevated`, 1px `--clay-rim`, radius 12 (A 8), `--shadow-popover`; items 40 (44 coarse) with icon 16 + label 14; destructive items `--danger-fg` at the bottom after a hairline |
| A `ColumnToggle` | Secondary button "คอลัมน์" (`columns-3` 16) opening a dropdown of checkboxes; the identity column cannot be hidden |
| A `Pagination` | Footer 52 inside the table card, top hairline: "1–10 จาก 41 รายการ" 13 tabular left; "แถวต่อหน้า" + a 72px select; page buttons 32 (44 coarse), radius 8, current `--brand-soft`/`--brand-soft-fg` 600 + `aria-current="page"`; prev/next icon buttons with `aria-label` |

## 9. Navigation and shells

| Component | Spec |
|---|---|
| S `Screen` | `--surface-bg` (`#fffaf3`), opacity-only enter (keep `screen-in`, `backwards` fill) |
| S `AppBar` (`solid` / `brand` / `transparent`) | 56 + safe-top, `--surface-card`, title Kodchasan 600 17 (centred on pushed screens), back/close 44 icon buttons; hairline when scrolled (`[data-scrolled]`). `brand` variant = flat `--hero-bg-base` (no gradient, `#14532d` dark hard-code removed) |
| S `PageHeader`, `SectionHeader` | Tab-root title Kodchasan 700 28 on paper; section header row 44 min: Kodchasan 700 20 + optional count badge + "ดูทั้งหมด" link (Kodchasan 600 15 `--brand-fg` + chevron, 44 hit) |
| S `TabBar` (`components/layout/TabBar.tsx`) + `navigation.ts` | 76 + safe-bottom, `--surface-nav`, 1.5px top `--clay-rim`, top corners 24, `--shadow-float` (flat: no ledge). 4 tabs (หน้าหลัก `house`, คลาสเรียน `book-open`, ความก้าวหน้า `sprout`, โปรไฟล์ `circle-user-round`), each ≥ 56 tall; icon 24 in a 60×32 pill; active `--brand-soft` pill + `--brand-fg` icon (stroke 2.4) and label (reading 600 12); inactive `--text-secondary`; `aria-current="page"`. Hidden while a text field is focused (keep the existing rule). The in-flow spacer uses `--tabbar-h` |
| S `BottomActionBar` | Sticky, `--surface-nav`, top 1.5px `--clay-rim`, padding 12 16 + safe-bottom, one full-width primary (lg 56) and at most one outline/ghost |
| S `OfflineBanner` | Warning tone strip under the app bar: `wifi-off` + "ออฟไลน์อยู่ ข้อมูลอาจไม่อัปเดต", `role="status"` |
| T `AppShell`, `SideNav` (`BrandMark`), `MobileNav` (`AppBar`, `TabBar`), `NotificationBell` | Phone app bar 60 (`--appbar-h`): TA logo 32 + page name Kodchasan 600 19 + "+" (`aria-label="สร้างคลาสใหม่"`) + bell (44, red dot when unread). Tab bar 68: 5 tabs (ภาพรวม, คลาสเรียน, ตารางสอน, ข้อความ, เพิ่มเติม), 56×30 pill, flat + hairline. Side nav ≥ 1024 (rail 88 at 768–1279 per the existing breakpoints): `--surface-sidebar`, right hairline; brand block (logo 36 + "Tutor Advantage" Noto 600 15 nowrap + "ครูผู้สอน" 12); group labels Noto 600 12 `--text-tertiary` (no uppercase); items 42 tall, radius 12, icon 20 `--text-tertiary`, label 500 15 `--text-secondary`; active `--brand-soft` + `--brand-soft-fg` 600 + `--brand-fg` icon; counts right-aligned (danger pill). Footer: collapse to rail (icons + tooltips + `aria-label`), user avatar + name + role |
| T `Page`, `PageHeader`, `Section`, `SectionHeader`, `Toolbar`, `Grid`, `SplitLayout`, `StickyActions` | Content max 1280; padding 16 phone / 24 28 tablet / 28 40 desktop. PageHeader: optional date caption 14, h1 (desktop Kodchasan 600 28), subtitle 14, actions right (desktop) or in the app bar (phone). Section gap 20–24. `StickyActions`: phone full-bleed bar above the tab bar; desktop floating bar (radius 16, `--shadow-popover`, bottom 16) |
| A `AdminShell`, `SideNav`, `MobileNav`, `NavDrawerImpl` | Desktop: side nav 248 (rail 72): brand block (logo 32 + name + "คอนโซลผู้ดูแลระบบ" + rail toggle 36), `EnvBadge`, groups (การเงิน / งานปฏิบัติการ / ผู้ใช้และความเสี่ยง / ตั้งค่า / นักพัฒนา in dev), items 36, radius 8, 500 14, active `--brand-soft` + a 3px `--brand-solid` bar on the left edge; counts as danger pills. **Top bar** 56 (new): breadcrumb ("การเงิน › ภาพรวม", 14) left; theme toggle and bell (36) right; sticky, `--surface-bg` + bottom hairline. Global Ctrl-K search is deferred until an endpoint exists. Phones/tablets: app bar 56 with a menu button opening the nav drawer (320 max, slides from the left) |

## 10. Overlays and feedback

| Component | Spec |
|---|---|
| S `BottomSheet`, `ConfirmSheet` (`BottomSheet.tsx`, `BottomSheetImpl.tsx`) | `--surface-elevated`, top radius 32, 1.5px top rim, handle 40×5 `--clay-rim`, title Kodchasan 600 20, body padding 20, footer with full-width actions (primary, then outline cancel); scrim `--scrim`. Swipe down **and** a visible close button (44). Slide 320ms `--ease-sheet`, exit 220ms. Confirm: one sentence of consequence, focus starts on the safe option, destructive = `danger` set apart |
| T/A `Sheet`, `BottomSheet` (`Sheet.tsx`, `SheetImpl.tsx`), `ui/sheet.tsx` | Phone: bottom sheet (top radius 20 / 16, handle 36×4). ≥ 768: T centred dialog (max 520, radius 16) or right side sheet 480; A record detail as a right side sheet 560 over the table (keeps list context), radius 12 on the leading corners, header with title + close 36 |
| T/A `ConfirmDialog`, `ui/dialog`, `ui/confirm-dialog`, A `ConfirmDialogImpl` | Max 400, radius `--radius-dialog` (T 16, A 12), title Noto 600 18, consequence text, actions right (cancel secondary, confirm primary or destructive); anything that moves money requires typing or a reason when `ConfirmReasonOptions` asks for it |
| S `components/ui/sonner.tsx`, T `Toast.tsx`, A `Toast.tsx` + `toastStore.ts` | `--surface-elevated`, rim, radius 18 (T 14, A 10), `--shadow-popover`; leading 32 tone tile (success `circle-check`, danger `circle-alert`, info `info`, warning `triangle-alert`); text 15/16 + optional action link; `aria-live="polite"`, never steals focus; auto-dismiss 4 s, errors 6 s, and nothing stays by default (a single call may set its own time, or stay until dismissed when it needs an answer: S `duration: Infinity`, T/A `duration: 0`). S pauses while touched or hovered and can be swiped away; T/A always show a close button. Position: S top-centre under the app bar; T/A bottom-centre above the tab bar on phones, bottom-right on desktop |
| S `EmptyState`, `ErrorState`, `StatusScreen` (`Feedback.tsx`); T/A `EmptyState` (`Feedback.tsx`), `ErrorState.tsx` | A normal card (no dashed borders): S Reedy calm/sleepy (empty) or oops (error) 88; T Reedy calm 72 (empty only) or a 56 tone tile (errors); A a 40 tone tile. Title (S `t-title`, T/A section), one help line, one primary or tonal action. Errors name the cause and the recovery ("เช็กอินเทอร์เน็ตแล้วลองอีกครั้งนะ" + "ลองอีกครั้ง"). `StatusScreen` (full-screen states such as payment success): Reedy mood 120 + title Kodchasan 700 24 + body + one primary |
| `Notice` (S, T, A) | Tone banner: `*-bg` + 1px `*-border`, radius = card radius, padding 12 14, icon 20 `*-fg`, title 600 15 + description 14 in `*-fg`, optional chevron when the whole notice links (e.g. "เอกสารอยู่ระหว่างตรวจสอบ") |
| `ui/alert.tsx` (A) | Same as `Notice` |

## 11. Tables (T earnings/students on desktop, A everywhere): `DataTable`, `IdCell`/`CopyButton`, `Money`

Inside a card with `overflow: hidden`. Header 40: `--surface-muted`, Noto 600 13 `--text-secondary`, sticky; sortable headers show `chevrons-up-down` 14 (unsorted) or `arrow-up`/`arrow-down` in `--text-primary` with `aria-sort`. Rows: `--row-h` 52 (two-line identity cells, the default), `--row-h-compact` 40 (`data-density="compact"`, single-line tables), `--row-h-touch` 56 under `pointer: coarse`; cell padding 6 14; 1px `--hairline` between rows; hover `--row-hover`; the record open in the side sheet `--row-selected` (`data-selected`). Numbers right-aligned and tabular; dates "2 พ.ย. 2569"; `Money` with "฿" and two decimals in finance tables (whole baht elsewhere). First column: avatar 32 + name (500 14) + secondary line (13 `--text-secondary`, long emails truncated with an ellipsis and the full value in `title` and in the detail sheet). Status columns use status chips (radius 6, dot + word). `IdCell`: monospace stack 13, copy button 28 visual / 36 hit (44 coarse) with `aria-label="คัดลอกรหัส"` and a toast. Trailing chevron column 44 when rows open a detail. Sticky first column keeps its hairline. Phones (< 768): rows become list rows (identity, one status chip, chevron); no horizontal page scroll; wide finance tables may scroll inside their card with an edge shadow.

## 12. Brand marks

| Component | Spec |
|---|---|
| TA mark: S `components/icons/BrandMark.tsx`, T/A `BrandMark` in `SideNav.tsx` | One outlined SVG asset: rounded square (radius 30% of the size) in `--logo-bg` `#007352`, "TA" in `--logo-fg` white (Kodchasan 700 outlined, so no font is needed). Same in both themes; dark adds a 1px `rgb(255 255 255/.14)` ring. Sizes S 36/40/48/72/88, T 32/36, A 32. Remove the gradient tone and the green glow shadow. `aria-hidden` next to the visible name |
| `ReedyMini` (S `components/mascot/ReedyMini.tsx`) | Unchanged art and moods (`happy`, `cheer`, `calm`, `sleepy`, `oops`). Sizes in use: 48 (rank strip), 88 (empty/error), 96 (result banner, podium), 120–124 (home hero, landing). `float` only on the home hero (3.2s bob, off under reduced motion). `decorative` when the adjacent text says the same, otherwise the Thai mood label |
| `LineIcon` (S `components/icons/LineIcon.tsx`) | `mono` inside the LINE button only; must match LINE's official asset (swap the path for the kit file if it differs) |
