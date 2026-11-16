# Page patterns

How each kind of screen is laid out in each app: what goes first, what is emphasised, and how the desktop differs from the phone. Components are specified in components.md, tokens in tokens.md. Mock references are files in `mocks/`.

## 0. Rules for every page

- **Hierarchy**: one h1 per page; one primary action per screen; one sunshine reward group per view; one Reedy per screen (student and the tutor presenter only); at most one ink surface per screen (tutor wallet).
- **Order**: what the person came to do comes first (the next lesson, the next class, the work queue), then status, then browsing.
- **Breakpoints**: 320 (smallest supported), 375, 390 (design width), 640, 768, 1024 (side nav replaces the tab bar in T/A), 1280, 1440. No horizontal page scroll at any width.
- **Student desktop**: the same phone column, centred, max `--max-mobile` 768 (tablet grids at ≥ 640 as today); outside the column the page shows `--surface-muted`.
- **Tutor desktop**: side nav 256 (rail 88), content max 1280, padding 28 40. **Admin desktop**: side nav 248 (rail 72), top bar 56, content max 1440, padding 0 32 40.
- **Safe areas**: app bars, tab bars, bottom action bars, sheets and the lesson bar keep `--safe-top` / `--safe-bottom`. `scroll-padding` keeps focused fields clear of sticky bars (existing rules stay).
- **Loading**: skeletons shaped like the final layout for anything over 300ms; spinners only inside buttons. **Empty**: a normal card with Reedy (S) or a tone tile (T/A), one line of help and one action. **Error**: name the cause and the recovery, keep the user's input.
- **Dates and times**: all three apps show Thai time (Asia/Bangkok). Format through the app's `lib/format.ts`; a formatter built anywhere else must set `timeZone: "Asia/Bangkok"`. In student-liff a device-local calendar day (the schedule grid) goes through `localDayToBangkokNoon()` first; the schedule's own today/month logic stays device-local for now.

### Thai text

- **Static headlines** get authored breaks: `<br>` or one `white-space: nowrap` span per phrase (landing: "เรียนภาษาอังกฤษ / กับติวเตอร์ / ที่คุณไว้วางใจ"; reveal: "ถูกต้อง! / ทำได้ดีมาก"). Browser segmentation otherwise splits "ไว้วางใจ" into "ไว้ / วางใจ" and "ทำได้ดีมาก" into "ทำได้ดี / มาก".
- **Dynamic headings** (class names, student names, tutor names) use `text-wrap: balance` and are tested in `/dev/ui-kit` with the longest real class name, a long Thai name with stacked marks ("ปุณณ์ชนิดา") and a 60-character email. Truncate only in table cells and single-line rows, with an ellipsis and the full value in `title` and on the detail screen.
- **Templated copy** keeps its fixed phrases whole and lets the variable wrap: in `ไปเรียน {class} ต่อกันนะ` the phrases "ไปเรียน" and "ต่อกันนะ" never break, the class name may (the mock `x-student-home-320` still shows the earlier line with "บทที่ 6").
- **Two-line labels** in tight grids are authored: แชท/ติวเตอร์, ตาราง/เรียน, ประวัติ/การเรียน, ประวัติ/การชำระ (student quick menu), checked at 320px.

---

## Student (student-liff)

### S1. Home (`app/dashboard`) — mock `student-home`, dark `x-student-home-dark`, 320px `x-student-home-320`

1. **Hero** (flat `--hero-bg-base`, rounded bottom 32, two decorative blobs): greeting "สวัสดีตอนบ่าย" with `sun` 16 (`--hero-fg-muted`), the name `t-display`, avatar 52 top-right. Chips row: level (`paper` chip, no icon so both chips fit on one line at 390) and the **streak chip** (`sun` tone, `flame`, "3 สัปดาห์ต่อเนื่อง", only when `weekStreak > 0`). Then **Reedy happy 124** at the right, his body tucked behind the next card and his face fully visible, with a speech bubble at the left built from the home summary (`ไปเรียน {class} ต่อกันนะ`; while the class is being taught: `ครูกำลังสอนอยู่`; with no next session: `ยังไม่มีคาบถัดไป ลองฝึกพูดกับรีดี้ไหม`). The mock still shows the earlier line with "บทที่ 6".
2. **Next-lesson card** (overlaps the hero by 30px; a container, so rim + soft shadow, no ledge): book tile 56 + "คาบถัดไป · {next session time}" (with no session booked: "ยังไม่มีคาบที่นัดไว้") + class title `t-title-l` + "ครู T.นกเอี้ยง"; progress row "เรียนไปแล้ว" + "36%"; progress 12px (the summary carries no lesson number or lesson counts, so the app has no next-lesson block; the mock still shows one with "บทถัดไป" and "เรียนแล้ว 5 จาก 14 บท"); primary lg "ทำบทเรียนต่อ" (`play`). When the tutor is live, a danger chip with a dot "ครูกำลังสอนอยู่" takes the place of the "คาบถัดไป" line and the primary becomes "เข้าห้องเรียนเลย" (`video`). A pending payment adds a warning `Notice` with a `warning` button "ชำระเงิน" (below the live card, above the upcoming card; on its own when the student has no active class); when the live class itself is unpaid, its primary becomes the `warning` button "ชำระเงิน".
3. **Quick menu**: 4 tappable tiles (60px, ledge) with authored two-line labels.
4. **"คลาสของฉัน"** section header + count + "ดูทั้งหมด", then the classes as a **vertical** list of tappable cards (CEFR colour band on the leading edge, tile, title, "ครู … · A0", chevron). No horizontal swipe in main content.
5. Invite card ("ชวนเพื่อนมาเรียน", tonal button), today's history. Tab bar.

Emphasis: the next lesson and its primary button. The streak is the only sunshine. Desktop/tablet: same column; at ≥ 640 the quick menu and classes use the existing tablet grids.

### S2. Landing (`app/page.tsx`, public) — mock `student-landing`

1. Brand row 64: TA mark 40 + "Tutor Advantage" (Kodchasan 700 18).
2. Hero on paper with two blobs: brand chip "Reading Advantage · Primary Advantage" (`sparkles`); headline `t-display-xl` in **three authored lines** with the one sunshine marker under "ติวเตอร์"; Reedy cheer 120 beside lines 2–3 and the lead (never overlapping the LINE button or its 16px clear space); lead 16/1.7 `--text-secondary` with authored breaks.
3. **LINE button** (56, LINE's rules), then outline "ดูคลาสเรียนทั้งหมด", then the trust line (`shield-check` + "ชำระเงินผ่าน PromptPay หรือบัตร โดย Omise").
4. Facts: **one** card with three divided stats (1 คลาสเปิดขาย · 1 หนังสือในคลาส · 14 บทอ่านในหลักสูตร), Kodchasan 700 28 numbers, no ledges.
5. "คลาสที่เปิดขาย" + course cards (tappable: CEFR band, level chip, title, "Primary Origins 2 (A0) · 14 บทอ่าน", price Kodchasan 700 26 `--brand-fg` + "ต่อผู้เรียน").
6. "เริ่มเรียนง่ายๆ 3 ขั้นตอน" as numbered tone tiles; product details; footer (privacy, terms).

Desktop: the same column centred (max 768; hero headline 40 at ≥ 640).

### S3. Course catalog and course detail (`app/courses`)

- **Catalog**: app bar "คลาสเรียนที่เปิดขาย"; optional level filter chips (`FilterChip`, horizontal rail allowed for filters); vertical course cards as in S2.5; empty state Reedy calm "ยังไม่มีคลาสที่เปิดขาย".
- **Course detail**: hero in the course's CEFR tone band (title `t-title-l`, chips level/book/tutor); sections as cards: what you learn, schedule, price (`Money`), tutor; sticky `BottomActionBar` with the primary "สมัครเรียน" (or the LINE button when signed out).

### S4. Lists: classes, lesson history, payments history, tickets (`app/classes`, `app/lesson/history`, `app/payment` history, `app/support`)

App bar (or tab-root `PageHeader`) → optional segmented filter (ทั้งหมด / กำลังเรียน / จบแล้ว) → `ListGroup` cards of flat rows (tile or avatar, title `t-row`, meta 14, one chip, chevron) → "โหลดเพิ่ม" ghost. Empty: Reedy calm + one action. Lists do not use ledges; the card is the container.

### S5. Class detail and class lessons (`app/classes/[id]`, `app/lesson/[classId]`)

1. Hero in the class's CEFR tone (flat): status chip, level chip, title `t-title-l`, tutor line.
2. Next-session card (date/time, "เพิ่มลงปฏิทิน" tonal).
3. Progress card (bar + "เรียนแล้ว 5 จาก 14 บท").
4. Lessons as a numbered list: done (success tile + `check`), current (brand tile + chevron, row tinted `--brand-soft`), locked (`lock` + "เรียนบทก่อนหน้าให้จบก่อน" in `--text-tertiary`).
5. Sticky bottom bar: primary "เข้าห้องเรียน".

### S6. Live lesson phase screens (`app/interactive/play`) — mocks `student-lesson`, `x-student-lesson-dark`

Fixed full-height column, no tab bar:

1. **Lesson bar** (60): close, "ห้องเรียนสด" + article title, **score pill** (the one reward element).
2. **Phase row**: tone tile + "ขั้นที่ 7/18" + phase name; 18-segment journey (current step jade).
3. **Phase content**, by phase type:
   - *Multiple choice*: question card (chip "คำถาม 2/3", question Kodchasan 700 23, hint "ดูตัวเลือกบนจอคุณครู แล้วแตะคำตอบที่ถูกต้อง") → **A–D tiles** filling the remaining height (letters and shapes only) → rank strip (Reedy 48, "อันดับตอนนี้ · คุณอันดับ 2", "120 คะแนน", medal). After submitting: chosen tile with a check badge, others .45, `WaitingNextLine`.
   - *Look at the screen*: `LookAtScreenRow` (tone tile 64 + tip + Reedy calm 88). No looping motion while children answer.
   - *Reading / vocabulary*: passage card `t-body-l` 17/1.7 `lang="en"`, highlights `--highlight-bg`/`--highlight-text`; vocabulary flashcards keep their component.
   - *Written / spoken answers*: field card + `AiPendingCard` → `AiScore` + `AiFeedbackText`.
   - *Games*: the game owns the content area with its own art (`data-motion="full"`); only the lesson bar remains.
   - *Status strips* (reconnecting, tutor away, read-only, missed): `StatusCard` under the phase row in info or warning tones.
4. Desktop/tablet: same column; tiles keep a 2×2 grid capped at 560 wide; keys 1–4 and A–D work.

### S7. Reveal and leaderboard — mock `x-student-reveal`

1. Lesson bar (the score already includes the new points) and the phase row.
2. **Result banner** (`role="status"`): success card "ถูกต้อง! ทำได้ดีมาก", the `sun` chip "+120 คะแนน", "ตอบเร็วเป็นอันดับ 2 ของห้อง", Reedy cheer 96. Wrong answer: the neutral card "ยังไม่ถูก ไม่เป็นไรนะ" with `circle-x` and the correct letter, Reedy calm. Never red for a child's wrong answer. Not on the play screen yet: `ResultBanner` is built but shown only in `/dev/ui-kit`, and these strings are not in the locale file. Today, after answering, the phone shows "ส่งคำตอบแล้ว!", then "ตอบครบทุกคนแล้ว!" with "โปรดดูเฉลยที่หน้าจอคุณครู", the answer echo without a result chip, and the leaderboard.
3. **Answer echo**: "คำตอบของคุณ" + the chosen letter tile + "ตัวเลือก B" + a "ถูกต้อง" or "ยังไม่ถูก" chip (icon + word; the play screen does not pass the chip yet, see item 2).
4. **Leaderboard**: "อันดับตอนนี้" + "คุณอันดับ 5"; the top 3 with medals, a "…" row, then your row (`--brand-soft`, inset bar, rank move "↑ 2" with the screen-reader text "ขึ้นมา 2 อันดับ").
5. `WaitingNextLine` "รอคุณครูไปขั้นถัดไป".

### S8. Wrap-up results (phase 18)

Lesson bar → phase row ("ขั้นที่ 18/18 · สรุปผลคะแนน") → podium card (Reedy cheer 96 + "เก่งมาก! คุณอันดับ 2" from data + podium 1/2/3) → rows 4+ (top 3 + your row rule) → reward button "ฝึกพูดกับรีดี้" (the screen's one reward action). Confetti once, none under reduced motion.

### S9. Progress (`app/progress`)

Tab-root header → stat strip card (สัปดาห์ต่อเนื่อง / บทที่เรียนจบ / นาทีที่เรียน; the streak cell may use the sunshine tone because it is the view's reward) → per-class progress cards (bar + "บทที่ 6 จาก 14") → lesson list (S4 rows). No Reedy if the hero has none; empty state Reedy sleepy.

### S10. Profile, settings, guardian (`app/profile`, `app/guardian`)

Tab-root header with avatar 72 + name + level chip → grouped `ListGroup` rows (บัญชี, ผู้ปกครอง, การแจ้งเตือน with `SwitchRow`, ธีม with `ThemeSegmented`, ช่วยเหลือ) → destructive "ออกจากระบบ" ghost in `--danger-fg`, separated by space. Guardian forms follow S12's form rules.

### S11. Schedule (`app/schedule`)

App bar "ตารางเรียน" → `MonthCalendar` card (selected day `--brand-solid` + `--on-brand`, today ring `--brand-fg`, dots for sessions in the CEFR tone) → the day's sessions as rows (time column 52 tabular + class + tutor + chip). Empty day: one line, no Reedy.

### S12. Payment steps (`app/payment`: AgeCheck → SelectMethod → PromptPay or CardForm → Result)

- Paper `#fffaf3`; app bar with back; a step caption ("ขั้นที่ 2 จาก 3", `t-caption`) under the app bar.
- **Order summary first** (`OrderSummaryCard`: class, package, `AmountCard` total in reading 600 tabular, `DiscountCodeCard` field + apply).
- **Method choice** (`SelectMethodStep`): two selectable cards (PromptPay, บัตรเครดิต/เดบิต) with logo, description and a radio; selected = 2px `--brand-fg` border + check badge + `--brand-soft` tint; `role="radiogroup"`.
- **PromptPay**: QR in a white card with a 16px quiet zone **even in dark mode**, amount, `QrCountdown` (reading tabular, `role="timer"`, warning tone under 1 minute), "บันทึกรูป QR" secondary, status line `aria-live`.
- **Card form**: grouped fields (number, expiry, CVC, name) with labels above, `autocomplete` attributes, inline errors, an error summary on submit.
- Sticky bottom bar: the primary ("ชำระเงิน ฿3,000"); never the reward button and never sunshine.
- **Result**: `StatusScreen` with Reedy cheer (success) or oops (failure) + cause + recovery ("ลองชำระอีกครั้ง").

### S13. Support ticket (`app/support`, `support/new`, `support/[ticketId]`)

- **List**: S4 pattern; each row shows the subject, the last update and a status chip (word + dot).
- **New** (`OptionPicker` + form): step 1 category tiles (tappable tone tiles with ledges, 2-column), step 2 subject + description + optional attachment row; sticky primary "ส่งคำร้อง". Errors inline.
- **Thread** (`TicketThread`): header card (subject, status chip, ticket ID with copy); messages as bubbles (staff left `--surface-card` + rim, student right `--brand-soft` + `--brand-soft-fg`; never `text-white` on a brand fill); composer pinned at the bottom (field 52 + send icon button 44 `aria-label="ส่ง"`). Closed tickets show a neutral notice instead of the composer.

### S14. Chat (`app/chat`, `chat/[conversationId]`)

- **Conversation list**: rows with avatar 48 (tutor), name `t-row`, last message 14 one line, time 12 tabular, unread count pill (`--danger-solid`/`--on-danger`).
- **Room**: app bar with the tutor's avatar + name; date separators (12, centred chip); bubbles max 80% width, radius 18 with the tail corner 6, own messages `--brand-soft` / `--brand-soft-fg`, theirs `--surface-card` + rim; timestamps 12 `--text-tertiary`; the composer follows S13. The tab bar hides while typing (existing rule).

### S15. Voice practice with Reedy (`app/voice-practice`)

The full Reedy (voice-practice art) is the screen's hero and its one Reedy: status line (`aria-live`) under him; one large round mic button (72, `--brand-solid`, `mic` 32, `aria-pressed` while recording, pulsing ring off under reduced motion); transcript cards below; "จบการฝึก" ghost. Results use the S7 banner pattern.

---

## Tutor (tutor-pwa)

### T1. Dashboard (`app/dashboard/_home`) — mocks `tutor-home`, `tutor-home-desktop`, `tutor-home-dark`

**Phone** (app bar: logo, "ภาพรวม", "+" for สร้างคลาสใหม่, bell):

1. Greeting "สวัสดีตอนบ่าย ครูนกเอี้ยง" (Kodchasan 600 21) + "สรุปคลาสและรายได้ของคุณในเดือนนี้".
2. Status `Notice` when relevant (KYC "เอกสารอยู่ระหว่างตรวจสอบ", info tone, links to settings).
3. **Wallet hero** (ink): "รายได้ประมาณการเดือนนี้" + "เรท 35%" chip, **฿2,958**, then a sub-line chosen from the finance summary: a tutor without network volume sees "คอมมิชชัน 35% จากยอดสะสม ฿8,450"; when the group volume is above the personal volume the line is "คอมมิชชัน {rate} จากยอดส่วนตัว {personal} + โบนัสเครือข่าย {bonus}" (bonus in whole baht); when the split is unknown or the finance summary did not load there is no sub-line; goal: ยอดสะสมเดือนนี้ ฿8,450 vs เป้าหมายเรทถัดไป ฿10,000, sunshine bar, "ขาดอีก ฿1,550 เพื่อขึ้นเรทถัดไป". It replaces the separate "เป้าหมายเรทถัดไป" card.
4. **Next-class card**: "คลาสถัดไป" + "วันนี้" chip; **17:00** (Kodchasan 600 32) + "ถึง 18:00 · อีก 35 นาที"; class "English"; "Primary Origins 2 (A0)" / "บทที่ 6 · The Friendly Dolphin"; avatar stack + "6 นักเรียน"; **primary "เริ่มสอนสด"** (`presentation`) + secondary "ดูคลาส". This is the page's one primary. With no upcoming class: an empty card "ยังไม่มีคาบถัดไป" + tonal "สร้างตารางสอน".
5. **Stat strip** (one card, 3 cells): คลาสที่เปิด 3 · นักเรียนทั้งหมด 14 · คลาสสัปดาห์นี้ 7 (Noto 600 22 tabular).
6. **"คาบสอนวันนี้"** + "ตารางสอน" link: rows with a time column (17:00 / 60 นาที), a level dot + class name, "6 คน · A0 · บทที่ 6". The session already shown in the next-class card gets a "ถัดไป" chip instead of a button, so the start action is never duplicated. Any other session that can start now (from 15 minutes before) gets the tonal "เริ่มสอน" (`presentation`); the rest get a chevron. The schedule page uses the same row.
7. "คลาสเรียนล่าสุด" rows (tile, name, "6/8 คน · เรียนแล้ว 5/14 บท", status chip). Tab bar.

**Desktop ≥ 1024**: side nav; page header (date caption "วันจันทร์ 9 พฤศจิกายน 2569", the greeting as the h1 Kodchasan 600 28, subtitle; right: bell + **secondary** "สร้างคลาสใหม่"); notice; **row 1** (2fr : 1fr): left column = wallet hero (amount left, goal right, divided) above the stat strip (stretched to the next card's height); right = next-class card. **Row 2** (2fr : 1fr): left = "คาบสอนวันนี้" then **"ตารางสอนสัปดาห์นี้"** (mini week grid: 7 day rows × 09–20 hours, class blocks in their CEFR tile tones with a 3px leading edge, today's day label in a `--brand-soft` pill); right = "คลาสเรียนล่าสุด". Dark: identical layout; the ink hero becomes `#13342a` with a rim; the primary becomes bright jade with dark text.

### T2. Lists: classes, students, earnings history, tickets (`dashboard/classes`, `earnings`, `support`)

Page header (title + primary "สร้างคลาสใหม่" when it is the page's main action) → toolbar (search + segmented status filter with counts) → phone: cards of rows (S4 style, T sizes); desktop: `DataTable` (components.md §11) with money right-aligned tabular and payout status chips. Empty: Reedy calm 72 + one action.

### T3. Class detail (`dashboard/classes/[id]`)

Header card (title, CEFR chip, status chip, schedule line, seats "6/8"); actions: secondary "แก้ไข" + primary "เริ่มสอนสด" (desktop header) or the sticky bar (phone). `TabNav`: ภาพรวม / นักเรียน / ตารางสอน / บทเรียน. Overview: next session + progress + recent activity cards. Students: roster rows (avatar, name, guardian status chip, attendance %). Lessons: numbered list with done/current/locked states (S5.4 at T sizes).

### T4. Class setup and schedule forms (`dashboard/classes/new`, `[id]/edit`, schedule)

Single column, max 720 (desktop centred); fieldsets as cards with a section title (Noto 600 18) and helper lines; fields per components.md §8 (T); schedule rows (day select + time range + remove icon button 44) with "เพิ่มเวลาเรียน" tonal; inline validation on blur, an error summary on submit; `StickyActions` with secondary "ยกเลิก" + primary "บันทึกคลาส". A leave guard on unsaved changes.

### T5. Attendance (`classes/[id]/attendance` in T; also A `classes/[id]/attendance`)

Header with session date/time; a table (desktop) or rows (phone): avatar + name, a segmented present/late/absent control per row (44 tall on touch, words + icons, not colours alone), note field; sticky save bar; totals strip (มา 5 · สาย 1 · ขาด 0, tabular).

### T6. Earnings (`dashboard/earnings`)

Wallet hero (T1.3) at the top (the earnings page is its home) → stat strip (this month / last month / pending payout) → rate tiers card (current tier highlighted `--brand-soft`, the next tier with "ขาดอีก ฿X") → transactions table/rows with `Money` (two decimals), status chips, filters by month.

### T7. Referral network, performance (`dashboard/network`, `performance`)

Network: summary strip (team size, bonus) → tree as indented rows (avatar, name, tier chip in a tile tone, joined date); share card with a copy-link button. Performance: stat strip → simple bar or line charts (chart tokens, legends, text summary in `aria-label`, gridlines `--hairline`) → feedback rows. No Reedy.

### T8. Settings and KYC (`dashboard/settings`)

Grouped cards: profile, payout account (Omise), documents (KYC), notifications, theme (`ThemeSegmented`), help. **KYC upload rows**: tone tile + document name + status chip (ยังไม่ส่ง / รอตรวจ / ผ่าน / ไม่ผ่าน + reason) + a "อัปโหลด" or "เปลี่ยนไฟล์" secondary button (44); a privacy note `Notice` (info) explaining that files go to the private verification bucket. Destructive actions in a separate card at the bottom.

### T9. Support and chat (`dashboard/support`, `dashboard/chat`)

As S13/S14 at tutor sizes; desktop chat is two panes (conversation list 320 + room).

### T10. Presenter stage (`(dashboard)/lesson/[id]/interactive/presenter`) — projector/TV

- 16:9 stage scaled by `FitToViewport`, **light paper theme** for projectors and lit classrooms, dark for TVs (the stage follows the app theme; switch it with the sun/moon button in the lesson bar before going fullscreen). Minimum stage text 24px at 1080p; nothing relies on hover.
- Top phase bar 64: phase tile, phase name (Kodchasan 600 24), "ขั้นที่ 7/18", the 18-segment progress.
- Centre: question panel (`StagePanel`, radius 16, Kodchasan 600 44, speak button) → option tiles 2×2 (`--answer-*` + shapes + letters + text, max width 1400) → `AnswerProgress` "ส่งแล้ว 8 / 12 คน".
- Right: `StudentRosterPanel` 320 (answered checks).
- Bottom: `LessonDock` (44+ controls; "จบคาบเรียน" (outline, from 768px up), outline "ย้อนกลับ", then "จบคำถาม", then "ถัดไป"; "จบคำถาม" (or "จบเกมเลย" during a game) is filled while it can be pressed and "ถัดไป" waits, "จบคาบเรียน" is filled on the final leaderboard, otherwise "ถัดไป" is).
- Reveal: correct tile ring + "ถูกต้อง" chip, others .45; results chart with the correct bar in `--success-solid` + a label; the wrong count in the neutral tone.
- Reedy calm on waiting/intro stages, cheer on the final leaderboard (one per stage).
- **Before release: test the light stage and the violet D / berry A on a real classroom projector and a TV** (by hand, README §6). Set the theme in the lesson bar first; check light on the projector, and light and dark on the TV.

---

## Admin (admin-console)

### A1. Overview (`app/page.tsx`) — mocks `admin-overview`, `x-admin-overview-dark`

1. **Top bar** 56: breadcrumb "การเงิน › ภาพรวม"; theme toggle and bell at the right. (Ctrl-K global search: deferred until a search endpoint exists.)
2. **Page header**: h1 "ภาพรวม" + "งานที่รอคุณ และตัวเลขสำคัญของระบบ อัปเดตทุก 1 นาที"; right: "อัปเดต 12:22 น." (tabular) + refresh **icon** button 36 (`aria-label="รีเฟรชข้อมูล"`).
3. **KPI strip** (one card, 4 divided cells): ยอดโอนรออนุมัติ ฿0 · ยอดชำระสำเร็จ 30 วัน ฿3,000 (hint "1 รายการ · PromptPay 1 · บัตร 0" + a split micro-bar) · **ความเสี่ยงสูง/วิกฤต 1** (numeral `--danger-fg`, danger left edge, bar "จากเคสเปิดทั้งหมด 2 เคส") · รอบจ่ายที่สร้าง 30 วัน 0.
4. Two columns (1.25fr : 1fr): **"งานที่รอดำเนินการ"** (queue rows: tone tile, queue name, "รอตั้งแต่ 16 ต.ค.", count chip with a dot and a word, or the success chip "ไม่มีงานค้าง"; chevron) + **ทางลัด** secondary buttons below; **"กิจกรรมล่าสุด"** (8px category dot + event + "context · actor" + date) with a **category legend** at the bottom of the card.
5. The daily-payments chart is deferred until its endpoint exists (keep space below the queue).

Phone: app bar with the drawer; KPI strip becomes a 2×2 grid (dividers on both axes); queue, activity and shortcuts stack.

### A2. Data table page (users, classes, coupons, discount codes, settlements, reconciliation, audit, tickets, voice operations) — mocks `admin-table`, `x-admin-table-dark`

1. Top bar (breadcrumb "ผู้ใช้และความเสี่ยง › ผู้ใช้งาน").
2. Page header: h1 + one-line description; right: secondary "ส่งออก CSV" (`download`) or the page's primary ("สร้างคูปอง").
3. **Toolbar**: segmented **count tabs** (ทั้งหมด 41 · ติวเตอร์ 12 · นักเรียน 29 · รอตรวจเอกสาร 1). They replace the four KPI tiles and the role select. Then search (flex, "ค้นหาชื่อ อีเมล หรือรหัสผู้ใช้"), at most two selects (สถานะเอกสาร, สถานะบัญชี), then **"คอลัมน์"** (`ColumnToggle`). More filters go in a sheet; active filters show as removable chips under the toolbar.
4. **Table card**: sticky header; rows 52 (identity column: avatar 32 + name + email or "ไม่มีอีเมล (สมัครผ่าน LINE)"); role as icon + word; status chips radius 6 with dot + word; "ไม่ต้องยืนยัน" as plain tertiary text; numbers right-aligned; the sorted column ("สมัครเมื่อ" ↓) marked by an arrow and `aria-sort`; trailing chevron; the record open in the side sheet highlighted `--row-selected`.
5. **Pagination footer** inside the card: "1–10 จาก 41 รายการ", แถวต่อหน้า, numbered pages.

Single-line tables (audit log, reconciliation lines) use `data-density="compact"` (40). Bulk selection is not mocked because it does not exist yet; when it lands, a 40px checkbox column comes first and a bulk bar replaces the toolbar while rows are selected. Phone: rows become list rows (identity, one status chip, chevron), filters in a sheet, pagination as "โหลดเพิ่ม".

### A3. Detail page or side sheet (user, verification, settlement, ticket)

- **From a table**: a right side sheet 560 over the table (keeps the list context). **Deep records** (settlement, verification review): a full page with the breadcrumb "ผู้ใช้งาน / Passport Sim Tutor".
- Header: avatar/ID (`IdCell` with copy), status chips, the primary action for the record's state ("อนุมัติเอกสาร") + secondary actions in a `Dropdown`.
- Body: two columns ≥ 1280 (main facts as `DescriptionList` cards; right rail with the status timeline and the audit trail list); one column below.
- Money: `Money`, right-aligned, tabular, "฿" + two decimals.
- **Danger zone**: a separate card at the bottom (ระงับบัญชี, ปฏิเสธเอกสาร) with destructive buttons that open `ConfirmDialog` with a reason field.

### A4. Forms (coupon, discount code, adjustment, class create, roles)

Sheet 480 (desktop) / full-height sheet (phone), or a page for long forms. Two-column field grid ≥ 768 (labels above); money fields right-aligned with a "฿" prefix; code fields monospace; inline validation on blur + a summary on submit; sticky footer (secondary "ยกเลิก" + primary). Anything that moves money ends in a confirm dialog that restates the amount and the recipient. Discount codes for N seats are created as N single-use codes (never one shared N-use code).

### A5. Finance: settlements and reconciliation

Page header + period selector (segmented เดือนนี้ / เดือนก่อน / กำหนดเอง) → KPI strip (ยอดรวม, รอโอน, โอนแล้ว, ผิดปกติ with the danger edge if > 0) → table (A2) with `Money` columns and status chips → the detail page (A3) shows the settlement lines in a compact table and the approve action. Mismatches in reconciliation rows use a warning chip + "ต่างกัน ฿X" in `--warning-fg`, never colour only.

### A6. Support tickets, audit log, docs, roles

- **Tickets**: A2 with count tabs by status (ใหม่ / กำลังดำเนินการ / รอผู้ใช้ / ปิดแล้ว) and a priority chip; the detail is a side sheet with the thread (S13 bubbles at admin sizes) and an assignee select.
- **Audit log**: compact table (40), monospace IDs, actor, category dot + word (same category colours as the overview legend), timestamp tabular; filters by actor/category/date.
- **Docs** (`app/docs`): two columns: a sticky table of contents 240 + the article (max 720, body 15/1.7, code blocks `--surface-muted`).
- **Roles** (`app/settings`): a matrix table with checkboxes (44 hit area on touch) and a sticky save bar.

### A7. Phone (all admin pages)

App bar 56 (menu → nav drawer, page title, one action); content padding 16; KPI strips as 2×2; tables as row cards; sheets full-height; controls 44.

---

## Empty, error and loading (all apps)

| State | Student | Tutor | Admin |
|---|---|---|---|
| Empty | Card: Reedy calm/sleepy 88 + title + one line + one action ("ดูคลาสเรียนทั้งหมด") | Card: Reedy calm 72 + title + line + action | Card: tone tile 40 + title + line + action |
| Error (load) | Card: Reedy oops 88 + cause + "ลองอีกครั้ง" | Tone tile 56 + cause + retry | Tone tile + cause + retry + the error ID (copy) |
| Offline | `OfflineBanner` under the app bar (warning) | Notice (warning) | Notice (warning) |
| Not found | `StatusScreen`: Reedy oops 120 + "ไม่พบหน้านี้" + primary "กลับหน้าหลัก" | Same with a tone tile | Same with a tone tile |
| Loading | Skeleton of the final layout (hero, card, rows); `LoadingAnnouncement` | Skeletons (`PageSkeleton`, `StatGridSkeleton`, `ListSkeleton`) | `TableSkeleton` keeps the header and 10 row-height placeholders |
| Form error | Inline under each field + a focused summary after submit | Same | Same |

---

## New and changed Thai copy (add to the i18n files; keys are proposals)

Everything else keeps today's strings. Templates keep number phrases together with a no-wrap span (see "Thai text").

| App | Proposed key | Copy | Where |
|---|---|---|---|
| S | `dashboard.reedyContinuePrefix` / `reedyContinueSuffix` | ไปเรียน / ต่อกันนะ | Reedy's bubble on home: "ไปเรียน {class} ต่อกันนะ" (the class name stands in for the lesson number, which the summary does not carry); while the class is being taught the bubble shows `dashboard.liveNow` "ครูกำลังสอนอยู่" |
| S | `dashboard.reedyNoNextLesson` | ยังไม่มีคาบถัดไป ลองฝึกพูดกับรีดี้ไหม | Bubble when there is no next lesson |
| S | `dashboard.progressLabel` | เรียนไปแล้ว | Progress row on the home next-up card, followed by the percentage (the summary carries no lesson counts) |
| S | `app.trustLineLead` / `trustLineTail` | ชำระเงินผ่าน PromptPay / หรือบัตร โดย Omise | Under the landing CTAs, as two no-wrap phrases (the whole line is also kept as `app.trustLine`) |
| S | `interactivePlay.mcqHint` | ดูตัวเลือกบนจอคุณครู แล้วแตะคำตอบที่ถูกต้อง | Question card hint (replaces the generic "เลือกคำตอบที่ถูกต้อง" on MCQ) |
| S | `interactivePlay.youRankPrefix` | คุณอันดับ {n} | Leaderboard header chip, rank strip |
| S | `interactivePlay.rankUpPrefix` / `rankDownPrefix` + `rankMoveUnit` | ขึ้นมา {n} อันดับ / ลดลง {n} อันดับ | Screen-reader text of the rank-move indicator (`MobileLeaderboard`) |
| S | `interactivePlay.waitTeacherNext` | รอคุณครูไปขั้นถัดไป | `WaitingNextLine` (was "รอคุณครูไปยังหน้าถัดไป...") |
| T | `dashboardHome.nextClass` | คลาสถัดไป | Next-class card label |
| T | `dashboardHome.endsAt` + `startsInMinutes` | ถึง {end} · อีก {n} นาที | Next-class time line, joined with " · " (from an hour away `startsInHours` "อีก {n} ชม."; while teaching `inProgress` "กำลังสอนอยู่") |
| T | `dashboardHome.startLive` / `viewClass` | เริ่มสอนสด / ดูคลาส | Next-class actions |
| T | `dashboardHome.todaySessions` / `nextChip` | คาบสอนวันนี้ / ถัดไป | Today list |
| T | `dashboardHome.weekSchedule` | ตารางสอนสัปดาห์นี้ | Desktop week grid |
| T | `dashboardHome.rateChip` | เรท {rate} | Wallet hero chip ({rate} carries the "%") |
| T | `dashboardHome.commissionFrom` | คอมมิชชัน {rate} จากยอดสะสม {amount} | Wallet hero sub-line for a tutor without network volume (`estimatedNet`, `remainingPrefix`, `remainingSuffix`, `targetLabel` already exist) |
| T | `dashboardHome.commissionWithNetwork` | คอมมิชชัน {rate} จากยอดส่วนตัว {personal} + โบนัสเครือข่าย {bonus} | Wallet hero sub-line when the group volume is above the personal volume |
| T | `tutorClass.lessons.priceLabel` | ราคาแพ็กเกจ (บาท) | Open-book sheet price label (was "ราคาแพ็กเกจ (สตางค์)") |
| T | `tutorClass.lessons.priceUnit` | บาท | Price field end addon, `aria-hidden` (replaces `satangUnit`) |
| T | `tutorClass.lessons.priceHintPrefix` | เท่ากับ | Hint "เท่ากับ ฿3,000" while the price parses |
| T | `tutorClass.lessons.priceRangeHint` | มากกว่า 0 และไม่เกิน 10,000 บาท | Hint while the price does not parse and no error shows |
| T | `tutorClass.lessons.priceInvalid` | ระบุเป็นบาท มากกว่า 0 และไม่เกิน 10,000 | Price error after blur or a submit attempt, until the next edit |
| T | `dashboardEarnings.projectionWHTNote` | ยอดก่อนหักภาษี — หัก ณ ที่จ่าย 3% จะคำนวณจริงเมื่อปิดรอบจ่ายเงิน | Earnings wallet sub-line (resident) |
| T | `dashboardEarnings.projectionWHTNoteNonResident` | ยอดก่อนหักภาษี — หัก ณ ที่จ่าย 15% (ผู้ไม่มีถิ่นที่อยู่) จะคำนวณจริงเมื่อปิดรอบจ่ายเงิน · Before 15% non-resident withholding | Earnings wallet sub-line (non-resident) |
| T | `dashboardEarnings.historyDescription` | ยอดที่ปิดรอบจ่ายเงินแล้วในแต่ละงวด | Payout history description |
| T | `dashboardEarnings.emptyPayoutHistoryDescription` | เมื่อปิดรอบจ่ายเงินครั้งแรก รายการจ่ายเงินและเอกสารจะแสดงที่นี่ | Payout history empty state |
| T | `dashboardEarnings.transferStatuses.CREATED` | สร้างคำสั่งโอนแล้ว | Transfer status chip |
| T | `public/manifest.json` `short_name`; `layout.tsx` `appleWebApp.title` | TA ครูผู้สอน | Home-screen label (was "Tutor PWA"); "TA ครู" if a phone cuts it |
| T | `app.loginTitle` | เข้าสู่ระบบ - Tutor Advantage ครูผู้สอน | Tab title of the sign-in page |
| T | `app.privacyMetaTitle` | นโยบายความเป็นส่วนตัว (Privacy Policy) - Tutor Advantage ครูผู้สอน | Tab title of /privacy |
| T | `app.termsMetaTitle` | ข้อตกลงการให้บริการ (Terms of Service) - Tutor Advantage ครูผู้สอน | Tab title of /terms |
| T | `tutorLegalCopy.privacy` (section 2, first item) | สร้างและจัดการบัญชีของคุณบนระบบ Tutor Advantage | /privacy (`locales/th/legal.ts`) |
| T | `tutorLegalCopy.terms.intro` | ข้อตกลงการให้บริการนี้เป็นสัญญาระหว่างครูผู้สอนหรือผู้ใช้งานกับแพลตฟอร์ม Tutor Advantage เมื่อใช้งานแพลตฟอร์มของเรา ถือว่าคุณยอมรับข้อกำหนดเหล่านี้ | /terms intro (`locales/th/legal.ts`) |
| A | `users.tabPendingDocs` | รอตรวจเอกสาร | Count tab |
| A | `shell.columns` | คอลัมน์ | `ColumnToggle` button |
| A | `dashboard.refreshAria` | รีเฟรชข้อมูล | Refresh icon button `aria-label` |
| A | `reconciliation.daysShort` / `reconciliation.filters.daysOption` | {days} วัน / {days} วันล่าสุด | Reconciliation period selector: the short label is the visible text below 640px (`aria-hidden`); the full label is the accessible name at every width and the visible text from 640px |
