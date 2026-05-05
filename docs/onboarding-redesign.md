# Alan Cafe OS — Onboarding Redesign
**Design Document v1.0 · May 2026**

---

## 1. Executive Summary

Our current onboarding is a generic 5-step wizard that gets users into the system
without making them feel anything. It asks questions nobody cares about yet (slug,
timezone), puts all weight on the user to figure out what matters, and ends without
a sense of arrival.

The result: high drop-off, low activation, and a dashboard that feels empty and
broken on first visit.

This document proposes a complete redesign grounded in research from Square, Shopify,
Loyverse, Toast, Notion, and Linear — the six best onboarding experiences in
B2B SaaS and POS. The new flow has a single design principle:

> **Make the user feel successful before they close the browser.**

The proposed design achieves this through:
- Personalization-first (Notion model)
- Pre-loaded sample menu data (avoids empty state entirely)
- Hardware introduced at the right moment, not buried
- A genuine celebration at the end (Peak-End rule)
- A post-onboarding dashboard checklist to drive 30-day activation (Zeigarnik effect)

Target: lift onboarding completion from an estimated ~30% to 60%+.

---

## 2. Research Findings

### 2.1 Square POS

**Steps:** Account creation → bank details → menu → hardware → go live
**Onboarding philosophy:** "You can be live in hours." Self-service, minimal handholding.

**What's great:**
- Dashboard is immediately functional (no empty state; guided CTAs everywhere)
- Menu building tools are front and center — the first useful thing you do
- DIY-friendly; no waiting for sales calls
- "Just a few minutes to get started" messaging manages expectations

**Empty states:** Avoided through guided CTAs ("Add your first item", "Connect hardware").
**Hardware:** Not surfaced in the first screen — shown after menu is built.
**Tone:** Confident, practical. "You've got this."
**Skip:** No forced order; users can jump to any section.
**Aha moment:** Seeing your first menu item live in the POS interface.

**What to steal:** The "menu first, hardware second" sequence is exactly right.
Users need to feel the product works *before* they're asked to do technical setup.

---

### 2.2 Shopify POS

**Steps:** Account → app install → products sync → hardware → test order
**Onboarding philosophy:** Progressive disclosure. Don't show what you don't need yet.

**What's great:**
- **Personalized setup guide** adapts to what you've done vs. not done
- **Behavioral triggers** — onboarding tasks appear based on actual app usage, not
  calendar dates. First login unlocks step 1. First product triggers step 2 prompt.
- **Progress tracker** makes the to-do list visible and motivating
- Trial countdown creates gentle urgency without pressure
- Hardware setup (card reader pairing) is a 4-step visual guide: press button →
  see LED flash → app shows device → tap Connect. That's it.
- Steps auto-mark as complete when detected (you don't manually check them off)

**Empty states:** Zero empty states — setup guide cards fill the space until content exists.
**Sample data:** Trial products pre-populated to demonstrate catalog management.
**Tone:** Practical with subtle charm. The trial countdown is clever, not pushy.
**Skip:** Cancel icon on each card (Polaris design system). Always escapable.
**Aha moment:** Processing the first test order and seeing it in the orders list.

**What to steal:** Auto-detecting completed steps. The user should never have to
manually mark "shop name ✓" — we should detect it and check it.

---

### 2.3 Loyverse POS

**Steps:** App install → printer pairing → menu → staff → open
**Onboarding philosophy:** Hardware first. Everything else is secondary.

**What's great:**
- Printer setup is step ONE, not step seven. For a cafe POS, this is correct.
  If you can't print receipts, the system isn't working.
- Printer pairing flow: Name printer → Select model → Select interface type →
  Auto-search → Print test → Save. Clean, linear, no dead ends.
- **"Print test" button within setup** — user gets feedback before leaving the screen.
  This is a small Aha moment: you hear the printer click, paper comes out, it works.
- Multiple interface types supported with clear labels (Bluetooth / USB / Ethernet / WiFi)
- Mobile-first throughout — the whole product is designed for a tablet on a counter

**Empty states:** Menu screen has "Add your first item" with icon; not threatening.
**Hardware:** Central to identity. The product *is* the printer connection.
**Tone:** Technical but calm. Never condescending.
**Skip:** Hardware can be skipped, but tone clearly signals "you'll want this soon."
**Aha moment:** First test print. Tactile, physical, undeniable.

**What to steal:** The **test print button within the setup flow** itself. Don't make
users leave the wizard and open the POS to test. Do it right there.

---

### 2.4 Toast POS

**Steps (owner):** Account → restaurant type → menu builder → staff roles → floor plan → go live
**Steps (employee):** App → profile → W-2/I-9 → role assignment → clock in
**Onboarding philosophy:** Role-based from the first question. Owner and cashier have
completely different first experiences.

**What's great:**
- **Separate onboarding flows by role** — what a manager needs to see on day one
  is completely different from what a cashier needs. Toast segments immediately.
- Menu builder is rich: categories → items → modifiers → prices. Not just a list.
- Floor plan setup uses drag-and-drop templates — spatial thinking matches how
  restaurant owners think about their space
- Employee onboarding happens from the employee's own phone — owner doesn't do it for them
- Paperless W-2/I-9 from phone = modern, reduces friction for both owner and staff

**Empty states:** Floor plan uses a blank canvas with a toolbar — visual metaphor
of physical space makes empty feel natural, not broken.
**Sample data:** Menu and floor plan templates available as starting points.
**Tone:** Operational and authoritative. "Let's get your restaurant ready."
**Skip:** Most steps skippable, but role-based flow means fewer irrelevant skips needed.
**Aha moment:** Seeing your restaurant floor plan on screen for the first time.

**What to steal:** **Role segmentation on the first screen.** Not everyone opening
the dashboard is the owner. A cashier visiting Alan Cafe OS should get a different
first experience than the owner.

---

### 2.5 Notion

**Steps:** Use case question → template gallery (5 curated, not 500) → workspace details
→ invite team → Getting Started checklist
**Onboarding philosophy:** Personalize from question one, then teach through doing.

**What's great:**
- **The opening question** ("How do you want to use Notion?") does three things: it
  personalizes the template gallery, reduces choice from 500 to 5, and signals that
  Notion is listening. One question = 3x impact.
- **55% onboarding completion** (vs 20-30% industry average). That gap is almost
  entirely explained by the progress bar + pre-checked items = Zeigarnik + endowed
  progress working in concert.
- Templates are filled with *real, usable content* — not fake "Lorem ipsum" demos.
  Users leave onboarding with a working wiki, not an empty database.
- The Getting Started checklist in the sidebar never disappears until you've completed it.
  It sits there gently reminding you.

**Empty states:** Notion never shows you an empty state because templates fill the space.
**Sample data:** Pre-filled templates. The sample IS the product.
**Tone:** Empowering. "You can do anything here." Not overwhelming because of curation.
**Skip:** Template selection skippable, but 95% of users choose a template because
  the options are curated, not overwhelming.
**Aha moment:** Executing your first `/` slash command. The menu appears instantly
  and it's fast. You feel power.

**What to steal:** Pre-checking a few items on the onboarding checklist ("endowed
progress effect"). If users start at 2/7 complete instead of 0/7, they're 50%
more likely to finish.

---

### 2.6 Linear

**Steps:** Account → team selection (with avatars) → learn Cmd+K → create issue →
resolve issue (ACTIVATION EVENT)
**Onboarding philosophy:** Your first aha moment must happen *within* the onboarding
session itself, not after it.

**What's great:**
- Teaching the command menu (Cmd+K) is the FIRST thing, not the last. Most products
  hide keyboard shortcuts in a "tips" section for power users. Linear makes it the
  entry point. This signals: "We built this for people who like to move fast."
- The activation event (issue resolved) happens inside onboarding. By the time you
  finish setup, you've already done the core loop once.
- Colleague avatars are visible when choosing which team to join. Social proof
  before you've done anything.
- No fake data — you create real content during onboarding, so the product feels
  real from minute one.

**Empty states:** None — the product is populated by actions you take during onboarding.
**Sample data:** None — you create real data as you learn.
**Tone:** Technical, fast, keyboard-centric. "We expect you to be good at this."
**Skip:** Task checklist skippable, but each step takes 15 seconds. No reason to skip.
**Aha moment:** The first time Cmd+K opens instantly. Speed feels like power.

**What to steal:** **Activation within the onboarding session.** Alan Cafe OS should
not finish onboarding until the user has experienced one thing that feels like real work.
For us, that means adding at least one real menu item (not just clicking through screens).

---

### 2.7 Key Statistics from Research

| Metric | Industry Average | Best-in-class |
|--------|-----------------|---------------|
| Onboarding completion rate | 10–30% | 55% (Notion) |
| Users abandoning with 4+ choices shown simultaneously | 60% drop | — |
| Users who abandon in first week | 75% | — |
| Lift from personalized flow vs generic | +30–50% | — |
| Lift from microlearning modules | +45% | — |
| Drop-off from non-skippable onboarding | High | — |
| Task completion time reduction with progressive disclosure | 20–40% | — |

---

## 3. User Personas

### Persona 1: Pim
**"ร้านฉันต้องขายได้วันนี้"**

- Solo cafe owner in Vientiane, 35 years old
- Opens at 6:00 AM, handles everything herself — coffee, orders, accounting
- Not tech-savvy. Her phone is Android; she uses Facebook, LINE, and not much else.
- Has Xprinter XP-58 printer, USB connected to a Windows laptop on the counter
- Speaks Thai. Reads English slowly.
- **Motivation:** Get the POS working before her first customer today.
- **Fear:** "What if I set it up wrong and can't take an order?"
- **Attention span during setup:** 5–7 minutes maximum.
- **Success looks like:** Printer prints a receipt and she can ring up her first order.

**Design implications for Pim:**
- Thai-first copy, no jargon
- Printer setup must be self-contained with visual steps
- Sample menu data so she doesn't have to type 20 items under pressure
- One action per screen — she's doing this while making coffee
- Big touch targets, mobile-friendly

---

### Persona 2: Khamla
**"ฉันต้องการระบบที่ scale ได้"**

- Tech-savvy cafe chain owner, 28 years old, 3 locations
- Used Square and Shopify before. Has opinions about software.
- Bilingual (Lao + English). Reads documentation.
- **Motivation:** Replace a clunky spreadsheet system with something that gives
  him real-time data across all 3 shops.
- **Fear:** "Will this have the reporting and staff management I actually need?"
- **Attention span during setup:** 20–30 minutes (will read every option).
- **Success looks like:** Dashboard shows today's sales, staff clocked in,
  low-stock alerts visible.

**Design implications for Khamla:**
- Skip onboarding quickly — he wants to explore on his own
- Don't hide advanced features too deep
- Show him the dashboard is data-rich before he's finished setup
- Role-based access control must be in the flow (he manages staff)

---

### Persona 3: Bounthavy
**"ฉันยังไม่รู้ว่าต้องทำอะไร"**

- Young entrepreneur opening first cafe, 24 years old
- Business degree, energetic, eager. No previous POS experience.
- Active on Instagram, TikTok. Expects beautiful, modern software.
- Doesn't have a printer yet. Doesn't have a menu yet. Doesn't have staff yet.
- **Motivation:** "I want to look professional when I open."
- **Fear:** "Am I doing this in the right order? Am I missing something?"
- **Attention span during setup:** 15 minutes (curious, but needs guidance).
- **Success looks like:** Finishing setup feeling confident, not confused.

**Design implications for Bounthavy:**
- Explicit "what happens next" at each step
- Handle the "no printer yet" path gracefully — don't make her feel behind
- Sample data is essential — she can't type a menu she hasn't finalized yet
- Celebration matters most for this persona — make her feel like she did something real

---

## 4. User Journey Maps

### 4.1 Current Journey (What exists today)

```
[/signup] → Enter email + password
     ↓
[/onboarding] Step 1/5: Shop name + slug + phone + city
     ↓                  (4 fields simultaneously, cognitive overload)
Step 2/5: Confirm details
     ↓                  (just a review screen, adds no value)
Step 3/5: First menu item
     ↓                  (optional, generic "name" + "price" fields, no context)
Step 4/5: Printer choice Y/N
     ↓                  (binary choice with no explanation of what happens next)
Step 5/5: "ยินดีต้อนรับ" list of features
     ↓                  (text-only, no action, no celebration)
[/cafe] Dashboard — EMPTY STATE
     ↓
User leaves. Or opens menu tab and starts typing.
```

**Pain points:**
- Step 1 asks for 4 unrelated fields simultaneously
- Step 2 (confirmation) is pure friction with no value
- No sample data — dashboard is empty on arrival
- No emotional arc — flat from start to finish
- "Aha moment" never happens
- Printer step gives binary choice but no guidance on what to do next
- Completion of onboarding doesn't feel like an accomplishment

**Estimated completion rate: ~30%** (generic wizard, no motivation mechanisms)

---

### 4.2 Proposed Journey (What we're building)

```
[/signup] → Email + password (2 fields)
     ↓ auto-redirect
[/onboarding]
     ↓
SCREEN 0: Welcome splash (3 seconds, auto-advances)
  "ยินดีต้อนรับสู่ Alan CafeOS" + logo animation + café sounds (optional)
     ↓
SCREEN 1: "คุณเป็นใคร?" (personalization, single choice)
  [เจ้าของร้าน] [คุมทีม / หลายสาขา] [เพิ่งเปิดร้านใหม่]
  → Tailors step 3, help text, and dashboard defaults
     ↓
SCREEN 2: ข้อมูลร้าน (2 fields + live preview)
  Shop name → live receipt header preview updates as you type
  City (dropdown, not freeform)
  "ชื่อนี้จะปรากฏบนใบเสร็จของลูกค้า"
     ↓
SCREEN 3: เมนูตัวอย่าง (sample data approach)
  3 pre-selected items shown: กาแฟดำ ฿8,000 · ลาเต้ ฿12,000 · ชาเขียว ฿10,000
  "ใช้เมนูตัวอย่างนี้ก่อน แก้ไขได้ทุกเมื่อ"
  Or: "+ เพิ่มของฉันเอง"
  [ใช้เมนูตัวอย่าง →] (primary) [ข้าม เพิ่มเองทีหลัง]
     ↓
SCREEN 4: เครื่องพิมพ์ (hardware, 3-choice simplified)
  [มีอยู่แล้ว — ตั้งค่าเลย]   [ยังไม่มี — ตั้งทีหลัง]   [ไม่ใช้เครื่องพิมพ์]
  If "มีอยู่แล้ว" → inline mini-wizard (connection type → auto-detect → test print)
  If "ยังไม่มี" → "ไม่มีก็ไม่เป็นไร — ส่งใบเสร็จทาง LINE ได้"
     ↓
SCREEN 5: 🎉 พร้อมแล้ว! (CELEBRATION — Peak-End rule)
  Confetti animation + big gold checkmark
  "ร้าน [ชื่อร้าน] พร้อมขายแล้ว!"
  3 action cards:
    [☕ เปิด POS ขายเลย]   [📋 เพิ่มเมนูเพิ่มเติม]   [📊 ดูรายงาน]
     ↓
[/cafe] Dashboard
  Getting Started checklist (pre-checked 2 items, 5 remain)
  Collapses automatically when 100% complete
```

**Activation event:** First time the user adds a menu item to a real POS order.

---

## 5. Information Architecture

### 5.1 Screen Sequence Logic

```
Signup ──────────────────────────────────────► /onboarding
                                                    │
                              ┌─────────────────────┤
                              │     Screen 0        │ Welcome (auto)
                              ├─────────────────────┤
                              │     Screen 1        │ Who are you?
                              ├─────────────────────┤
                              │     Screen 2        │ Shop identity
                              ├─────────────────────┤
                              │     Screen 3        │ Sample menu
                              ├─────────────────────┤
                              │     Screen 4A       │ Printer (has one)
                              │     Screen 4B       │ Printer (no / skip)
                              ├─────────────────────┤
                              │     Screen 5        │ Celebration
                              └─────────────────────┘
                                                    │
                                             /cafe (dashboard)
                                            with Getting Started checklist
```

### 5.2 Getting Started Checklist (post-onboarding, in dashboard)

Items listed, with pre-checks applied based on onboarding completion:

```
[✓] ตั้งค่าร้านค้า                (auto-checked: done in onboarding)
[✓] เพิ่มเมนูแรก                 (auto-checked if sample data accepted)
[ ] เพิ่มเมนูให้ครบ 10 รายการ    (action → /cafe tab: menu)
[ ] เพิ่มพนักงาน                 (action → /cafe tab: staff)
[ ] ตั้งค่าเครื่องพิมพ์           (action → settings or printer wizard)
[ ] ขายออเดอร์แรก ⭐             (action → /pos — THE activation event)
[ ] ดูรายงานสิ้นวัน              (action → /cafe tab: dashboard)
```

2 of 7 pre-checked = endowed progress effect.
Progress bar: visible. Bar turns gold at 100%.
Checklist auto-collapses after 7/7 complete (with small celebration animation).

---

## 6. Wireframes (Screen-by-Screen)

### Screen 0: Welcome Splash
**Duration:** 3 seconds, auto-advances (or tap to skip)
**Purpose:** Emotional opening. Sets brand tone. No decisions required.

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│          ☕                              │
│       (logo animates in)                │
│                                         │
│    ALAN                                 │
│    ─────── CafeOS                       │
│                                         │
│    ยินดีต้อนรับ                          │
│    (fades in 0.5s after logo)           │
│                                         │
│                                         │
│    ─────────────────────                │
│    กำลังเตรียมระบบสำหรับคุณ…             │
│    (progress bar, fills in 2.5s)        │
│                                         │
└─────────────────────────────────────────┘
```

**Copy (Thai):** ยินดีต้อนรับสู่ Alan CafeOS · กำลังเตรียมระบบสำหรับคุณ…
**Copy (EN):** Welcome to Alan CafeOS · Getting things ready for you…
**Animation:** Logo scales from 0.8 → 1.0 with soft bounce. Text fades up.
Progress bar fills from left to right in 2.5s. Then auto-advances.

---

### Screen 1: Personalization ("คุณเป็นใคร?")
**Purpose:** Single question that shapes the entire rest of the experience.
**Principle:** Hick's Law — 3 choices maximum.

```
┌─────────────────────────────────────────┐
│  [1 of 4] ━━━━━━━━━─────────────────    │  ← progress, step 1 of 4
│                                         │
│  คุณเป็นใคร?                            │
│  เพื่อให้เราเตรียมระบบได้เหมาะกับคุณ     │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  🧑‍💼  เจ้าของร้านกาแฟ            │  │ ← card 1 (default selected)
│  │     ดูแลร้านและจัดการทุกอย่าง    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  🏪  คุมทีม / หลายสาขา           │  │ ← card 2
│  │     บริหารพนักงานและหลายสถานที่  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ✨  เพิ่งเปิดร้านใหม่            │  │ ← card 3
│  │     ยังไม่มีเมนู ไม่มีพนักงาน    │  │
│  └───────────────────────────────────┘  │
│                                         │
│         [ถัดไป →]  (primary button)     │
│                                         │
└─────────────────────────────────────────┘
```

**Selection behavior:** Tap card = gold border + gold check icon appears top-right.
Only one selectable. [ถัดไป] enabled immediately on first tap.

**What this changes downstream:**
- Card 1 (เจ้าของร้าน): Full onboarding flow, default help text
- Card 2 (คุมทีม): Skip sample menu, show staff setup first, mention multi-location
- Card 3 (เพิ่งเปิดใหม่): More encouraging copy, sample menu emphasized,
  printer step has "ยังไม่ต้องมีก็ได้" framing

---

### Screen 2: Shop Identity
**Purpose:** Shop name + city. Nothing else.
**Principle:** Don Norman's Feedback — receipt preview updates live.

```
┌─────────────────────────────────────────┐
│  [2 of 4] ━━━━━━━━━━━━━────────────     │
│                                         │
│  ร้านของคุณชื่ออะไร?                     │
│                                         │
│  ชื่อร้าน *                             │
│  ┌───────────────────────────────────┐  │
│  │  Alan Coffee & Travel          │  │ ← pre-filled
│  └───────────────────────────────────┘  │
│  ชื่อนี้จะปรากฏบนใบเสร็จของลูกค้า       │
│                                         │
│  เมือง                                  │
│  ┌───────────────────────────────────┐  │
│  │  Attapeu                   ▼  │  │ ← dropdown
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─── ตัวอย่างใบเสร็จ ────────────────┐ │
│  │ ================================  │ │
│  │  Alan Coffee & Travel          │ │ ← LIVE PREVIEW updates as you type
│  │  Attapeu, Laos                 │ │
│  │ ================================  │ │
│  │  กาแฟดำ              8,000 LAK │ │
│  │  TOTAL               8,000 LAK │ │
│  │  ขอบคุณที่ใช้บริการ ☕          │ │
│  └───────────────────────────────────┘ │
│                                         │
│      [← ย้อนกลับ]    [ถัดไป →]         │
│                                         │
└─────────────────────────────────────────┘
```

**Behavior:**
- Shop name pre-filled with "Alan Coffee & Travel" (from DB or default)
- City is dropdown (Vientiane, Attapeu, Champasak, Luang Prabang, Other)
- Receipt preview panel updates in real-time as user types shop name
- This is the feedback moment — user sees their shop name on a receipt
  for the first time. This is small but emotionally meaningful.
- If user deletes name: placeholder shows "ชื่อร้านของคุณ" in gray

---

### Screen 3: Sample Menu
**Purpose:** Avoid empty state on first dashboard visit. Load sample data.
**Principle:** Notion's template approach. Pre-fill, don't overwhelm.

```
┌─────────────────────────────────────────┐
│  [3 of 4] ━━━━━━━━━━━━━━━━━━━────────   │
│                                         │
│  เริ่มจากเมนูตัวอย่างไหม?               │
│  แก้ไข ลบ หรือเพิ่มเองได้ทุกเมื่อ       │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ [✓] กาแฟดำ            8,000 LAK  │  │ ← checkbox, pre-checked
│  │ [✓] ลาเต้             12,000 LAK │  │
│  │ [✓] ชาเขียว           10,000 LAK │  │
│  │ [ ] อเมริกาโน่         9,000 LAK │  │ ← unchecked (user can add)
│  │ [ ] คาปูชิโน่          13,000 LAK │  │
│  │                                   │  │
│  │  + เพิ่มรายการของฉันเอง           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [ใช้เมนูที่เลือก (3 รายการ) →]        │ ← primary, shows count
│                                         │
│  [ข้าม — เพิ่มเมนูเองทีหลัง]           │ ← skip, smaller, always visible
│                                         │
└─────────────────────────────────────────┘
```

**Behavior:**
- 5 items shown, 3 pre-checked. User can check/uncheck all.
- Primary button label updates dynamically: "ใช้เมนูที่เลือก (3 รายการ)"
- "+ เพิ่มรายการของฉันเอง" → adds an inline text field for name + price
- If user taps skip → these items are NOT loaded (clean slate, their choice)
- Sample data is real LAK prices for a Lao cafe context

**Why 3 pre-checked, not 5:** Endowed progress effect. They already have 3 items.
Adding more feels like improving, not starting.

---

### Screen 4A: Printer Setup (มีเครื่องพิมพ์)
**Purpose:** For users who select "มีอยู่แล้ว" — inline mini-wizard.

```
┌─────────────────────────────────────────┐
│  [4 of 4] ━━━━━━━━━━━━━━━━━━━━━━━────  │
│                                         │
│  ตั้งค่าเครื่องพิมพ์                    │
│                                         │
│  ประเภทการเชื่อมต่อ                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  🔵      │ │  📡      │ │  🔌      │ │
│  │Bluetooth │ │ Network  │ │   USB    │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                         │
│  ชื่อเครื่องพิมพ์ (ตั้งเอง)             │
│  ┌───────────────────────────────────┐  │
│  │  Xprinter Counter               │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌── ผลการเชื่อมต่อ ─────────────────┐  │
│  │  ○ กำลังค้นหา...                 │  │ ← status indicator
│  │  ● XPrinter-58 พบแล้ว ✓          │  │ (after search)
│  └───────────────────────────────────┘  │
│                                         │
│  [🖨️ ทดสอบพิมพ์]                        │ ← triggers test print
│                                         │
│      [← ย้อนกลับ]    [ถัดไป →]         │
│                                         │
└─────────────────────────────────────────┘
```

**Behavior:**
- Connection type: 3 large tap-targets (Bluetooth / Network / USB)
- After selecting type → "ค้นหาเครื่องพิมพ์" button activates
- Status shows searching state → found state
- [ทดสอบพิมพ์] triggers the print-server endpoint immediately
- Success: "พิมพ์สำเร็จ ✓" in green → [ถัดไป] activates
- Fail: "ไม่พบเครื่องพิมพ์ — ตรวจสอบการเชื่อมต่อ" with troubleshoot link

---

### Screen 4B: Printer Skip
**Purpose:** For users who select "ยังไม่มี" or "ไม่ใช้".

```
┌─────────────────────────────────────────┐
│  [4 of 4] ━━━━━━━━━━━━━━━━━━━━━━━────  │
│                                         │
│  เครื่องพิมพ์                           │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ✓  ไม่มีเครื่องพิมพ์ตอนนี้      │  │
│  │     ไม่เป็นไรเลย                  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  คุณยังใช้ Alan CafeOS ได้เต็มระบบ      │
│  ส่งใบเสร็จผ่าน LINE หรือ QR code ได้  │
│                                         │
│  เมื่อพร้อม เชื่อมเครื่องพิมพ์ได้จาก   │
│  Settings → เครื่องพิมพ์ ได้เลย         │
│                                         │
│              [ถัดไป →]                  │
│                                         │
└─────────────────────────────────────────┘
```

**Copy principle:** Never make the user feel behind. "ไม่เป็นไรเลย" is warm and
reassuring. Pim might not have set up her printer yet and needs to know that's okay.

---

### Screen 5: Celebration
**Purpose:** Peak-End rule. The last thing they experience must feel good.
**This is the most important screen in the entire onboarding.**

```
┌─────────────────────────────────────────┐
│                                         │
│        🎉 (confetti animation)          │
│                                         │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│    [✓][✓][✓][✓] ━━━━━━━━━━━━━━━━━     │ ← progress bar animates to 100%
│                                         │
│    ร้าน Alan Coffee & Travel            │
│    พร้อมขายแล้ว! ☕                     │
│                                         │
│    คุณได้ตั้งค่าสำเร็จแล้ว:            │
│    ✓  ข้อมูลร้านค้า                    │
│    ✓  เมนู 3 รายการ                    │
│    ✓  ระบบพร้อมทำงาน                   │
│                                         │
│    ┌───────────┐ ┌───────────────────┐  │
│    │  ☕        │ │  📋               │  │
│    │ เปิด POS  │ │ เพิ่มเมนู         │  │
│    │ ขายเลย   │ │ เพิ่มเติม         │  │
│    └───────────┘ └───────────────────┘  │
│                                         │
│         [→ ไปที่แดชบอร์ด]              │ ← primary
│                                         │
│    Alan จะช่วยเสมอถ้าคุณต้องการ 💛     │
│                                         │
└─────────────────────────────────────────┘
```

**Animation sequence:**
1. Confetti burst from top (canvas animation, 1.5s)
2. Progress bar sweeps to 100% (0.8s, gold fill)
3. Checkmarks appear one by one (staggered, 0.2s each)
4. Shop name fades in bold (0.3s delay)
5. Action cards slide up (0.4s delay, subtle spring)

**Copy rationale:** "Alan จะช่วยเสมอถ้าคุณต้องการ 💛" — personifies the brand.
Alan isn't a faceless system. Alan Coffee & Travel is a real place with a real person.

---

## 7. Copywriting (Thai + English)

### Progress Bar Labels
| Step | Thai | English |
|------|------|---------|
| 1/4 | คุณเป็นใคร? | Who are you? |
| 2/4 | ข้อมูลร้าน | Shop details |
| 3/4 | เมนู | Menu |
| 4/4 | เครื่องพิมพ์ | Printer |

### Error States
| Situation | Thai | English |
|-----------|------|---------|
| Name empty | กรุณาใส่ชื่อร้าน | Shop name is required |
| Printer not found | ไม่พบเครื่องพิมพ์ — ตรวจสอบว่าเปิดเครื่องแล้ว | Printer not found — check it's powered on |
| Network error | เกิดข้อผิดพลาด ลองใหม่อีกครั้ง | Something went wrong, please try again |

### Button Copy Principles
- Primary action: **verb + noun** (เปิด POS, เพิ่มเมนู, ตั้งค่า)
- Skip: always **"ข้าม — [action later]"** to explain what's being deferred
- Back: **← ย้อนกลับ** (never "Cancel" — that feels like quitting)
- Next: **ถัดไป →** with arrow to signal forward movement

### Tone Vocabulary
**Use:** ยินดีต้อนรับ, พร้อมแล้ว, ไม่เป็นไร, แก้ไขได้, ทุกเมื่อ, Alan จะช่วย
**Avoid:** Error, Failed, Invalid, ผิดพลาด (unless truly necessary), Please (feels corporate)

---

## 8. Visual Design Direction

### Color Usage in Onboarding

| Element | Color | Usage |
|---------|-------|-------|
| Progress bar fill | `#c9a84c` (gold) | Completion and progress |
| Card selected state | `rgba(201,168,76,0.12)` border + bg | Selected persona card |
| Primary button | `#c9a84c` bg, `#000` text | The single action per screen |
| Skip link | `rgba(255,255,255,0.25)` | Always present, never dominant |
| Receipt preview | `rgba(255,255,255,0.04)` bg, monospace font | Realistic receipt feel |
| Success green | `#4cba7f` | Printer connected ✓, test print ✓ |
| Error red | `rgba(255,77,77,0.8)` | Only for blocking errors |

### Typography in Onboarding

| Role | Font | Size | Weight |
|------|------|------|--------|
| Screen title | var(--font-heading) | 26px | 800 |
| Body / labels | var(--font-body) | 15px | 400 |
| Thai-primary labels | var(--font-thai) | 15px | 600 |
| Button text | var(--font-body) | 15px | 700 |
| Caption / helper | var(--font-body) | 12px | 400 |

### Card Anatomy (Persona cards, option cards)

```
┌─────────────────────────────────────────┐
│  [icon 28px]   [title, 17px, bold]      │
│                [subtitle, 13px, muted]  │
│                               [✓ gold]  │ ← appears on selection
└─────────────────────────────────────────┘
border: 1px solid rgba(255,255,255,0.08)
hover: border → rgba(201,168,76,0.3)
selected: border → rgba(201,168,76,0.6), bg → rgba(201,168,76,0.08)
transition: all 0.15s ease
```

### Progress Bar

```
Total width: 100% of card
Height: 4px
Border-radius: 99px
Track color: rgba(255,255,255,0.08)
Fill color: #c9a84c
Animation: width transition 0.4s ease-out on step change
```

---

## 9. Animation & Motion Specifications

### Principles
- **Purpose over decoration:** Every animation serves a UX function (feedback, direction, celebration)
- **Duration budget:** Transitions ≤ 300ms, celebrations ≤ 1500ms
- **Respect prefers-reduced-motion:** All non-essential animations disabled

### Screen Transitions
```css
/* Between steps: slide left (forward), slide right (back) */
transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
entering: translateX(40px) → translateX(0)
leaving: translateX(0) → translateX(-40px)
```

### Progress Bar Fill
```css
transition: width 0.4s ease-out;
/* Triggers on step change, width = (step/total * 100)% */
```

### Card Selection
```css
transition: border-color 0.15s, background-color 0.15s;
/* Checkmark icon: scale(0) → scale(1), 0.2s, spring */
```

### Screen 0 Splash
```
Logo: opacity 0, scale 0.85 → opacity 1, scale 1.0 (0.5s, ease-out)
Text: opacity 0, translateY 8px → opacity 1, translateY 0 (0.4s, delay 0.3s)
Progress bar: width 0 → 100% (2.5s, linear — intentional, builds anticipation)
```

### Screen 5 Celebration
```
Confetti: canvas particle system, 60 particles, burst from top center
  colors: [#c9a84c, #ffffff, #f0d060, #e8c84a]
  duration: 1.5s total, particles gravity-fall off screen
Progress bar: final sweep 0 → 100% in 0.8s (ease-out, triggers after confetti starts)
Checkmarks: stagger-in, 0.2s each, scale(0)→scale(1) with spring bounce
Shop name: fade up, 0.3s, delay 0.6s after checklist appears
Action cards: slide up from +20px, stagger 0.1s, delay 0.9s
```

### Receipt Preview (Screen 2)
```
On shop name keystroke: preview text updates instantly (debounced 150ms for typing)
No transition — instant = feels responsive
```

---

## 10. Empty State Library

### 10.1 Menu Tab (no menu items)
**Avoid this state** by accepting sample data in onboarding.
If user skipped sample data:

```
┌─────────────────────────────────────────┐
│                                         │
│         [illustration: coffee cup]      │
│                                         │
│    ยังไม่มีเมนู                         │
│                                         │
│    เพิ่มเมนูแรกเพื่อเริ่มขาย            │
│    ลูกค้าจะได้เลือกสั่งจากนี้           │
│                                         │
│         [+ เพิ่มเมนูแรก]               │
│                                         │
│    หรือ  โหลดเมนูตัวอย่าง →            │ ← second option
│                                         │
└─────────────────────────────────────────┘
```

### 10.2 Orders Tab (no orders today)
```
┌─────────────────────────────────────────┐
│    ยังไม่มีออเดอร์วันนี้                │
│    เปิด POS เพื่อรับออเดอร์แรก         │
│    [→ ไปที่ POS]                        │
└─────────────────────────────────────────┘
```

### 10.3 Staff Tab (no staff)
```
┌─────────────────────────────────────────┐
│    ยังไม่มีพนักงาน                      │
│    เพิ่มพนักงานเพื่อเริ่มบันทึกเวลา     │
│    [+ เพิ่มพนักงาน]                     │
└─────────────────────────────────────────┘
```

### 10.4 Reports (no data yet)
```
┌─────────────────────────────────────────┐
│    รายงานจะปรากฏหลังจากมีออเดอร์       │
│                                         │
│    ยอดขายวันนี้        0 LAK            │ ← show zeros, not blank
│    จำนวนออเดอร์         0               │
│    กำไร               0 LAK            │
│                                         │
│    [→ เปิด POS เพื่อเริ่มขาย]          │
└─────────────────────────────────────────┘
```

**Principle:** Reports show zeros, not blanks. Zeros tell the user the system is
working and waiting. Blanks suggest something is broken.

### 10.5 Dashboard Getting Started Checklist (persists until complete)

```
┌─── เริ่มต้นใช้งาน ── 2/7 ────────────┐
│ ████████░░░░░░░░░░░░░░░░░  29%        │ ← gold progress bar
│                                        │
│ [✓] ตั้งค่าร้านค้า                    │
│ [✓] เพิ่มเมนูแรก                      │
│ [ ] เพิ่มเมนูให้ครบ 10 รายการ  →     │
│ [ ] เพิ่มพนักงาน               →     │
│ [ ] ตั้งค่าเครื่องพิมพ์         →     │
│ [ ] ขายออเดอร์แรก ⭐           →     │
│ [ ] ดูรายงานสิ้นวัน            →     │
│                                        │
│ [ซ่อน]                                │ ← always escapable
└────────────────────────────────────────┘
```

---

## 11. Implementation Plan

### Phase 1: Core Onboarding Redesign (Implement Now)
**Estimated effort: 1–2 days**

Files to create/modify:
- `app/onboarding/page.tsx` — Complete rewrite (5 screens, animation, state machine)
- `components/onboarding/WelcomeSplash.tsx`
- `components/onboarding/PersonaSelect.tsx`
- `components/onboarding/ShopIdentity.tsx` (with receipt preview)
- `components/onboarding/SampleMenu.tsx`
- `components/onboarding/PrinterSetup.tsx` (with connection wizard)
- `components/onboarding/Celebration.tsx` (with confetti)
- `lib/confetti.ts` — lightweight canvas confetti (no external library)

Key behaviors to implement:
- Screen-to-screen transition (slide left/right)
- Live receipt preview on shop name input
- Sample data load on "ใช้เมนูตัวอย่าง" click
- Printer test print via print-server API
- Celebration confetti animation
- All state persisted in component (no localStorage needed)

---

### Phase 2: Dashboard Getting Started Checklist
**Estimated effort: half day**

Files to create/modify:
- `components/GettingStarted.tsx` — the checklist widget
- `app/cafe/CafeClient.tsx` — add checklist as collapsible section on dashboard tab
- Auto-detection: if `recipes.count > 0` → check "เพิ่มเมนูแรก"
- Auto-detection: if `orders.count_today > 0` → check "ขายออเดอร์แรก"

---

### Phase 3: Role-Based Personalization (Future)
**Estimated effort: 1 day**

- Store persona choice in `shop_users.role` or user metadata
- Show different dashboard tabs first based on role
- Cashier persona → goes directly to /pos after onboarding
- Owner persona → goes to /cafe after onboarding

---

### Phase 4: Behavioral Triggers (Future)
**Estimated effort: 2 days**

- Track activation events in analytics or `user_events` table
- First order placed → send congratulations banner in dashboard
- 3 days without orders → show "คุณต้องการความช่วยเหลือไหม?" prompt
- Week 1 completion rate → decide which follow-up email to send

---

## Approval Checklist

Before implementation, confirm:

- [ ] 5-screen sequence approved (Welcome → Persona → Shop → Menu → Printer → Celebrate)
- [ ] Sample menu items are correct (LAK prices, item names)
- [ ] Thai copy is natural (review with native speaker if possible)
- [ ] Celebration screen design approved (confetti, copy, action cards)
- [ ] Getting Started checklist items and order approved
- [ ] Printer connection types to support confirmed (USB only? Bluetooth? Network?)
- [ ] What happens if user has no shop in DB yet (first-ever signup)

---

*Document authored by Claude Sonnet 4.6 based on research into Square, Shopify,
Loyverse, Toast, Notion, and Linear onboarding flows, combined with Nielsen Norman
Group UX guidelines and cognitive psychology principles.*
