# Alan Cafe OS — Account & User System Design
**Design Document v1.0 · May 2026**

---

## 1. Executive Summary

Every POS product we studied makes the same structural decision early and sticks to it forever: **separate "account" (the person) from "shop" (the business)**. Alan Cafe OS currently has neither concept built properly. We have a floating badge in the bottom-right corner and no settings pages anywhere.

This matters because:

1. **The barista problem.** Real cafes have 2–6 employees. Not all of them should log in with email and password. A barista clocks in with a PIN. This is not a minor detail — it's how every serious POS (Loyverse, Toast, Square) works, and it's the reason our current `staff` table exists but goes unused in auth.

2. **The owner vs manager problem.** The owner is not always present. A manager needs to do everything except billing and deleting the shop. A cashier should never see the financial reports. If everyone shares one login, we have no accountability.

3. **The trust problem.** A user who can't find "Change Password" does not trust the system with their business. These features signal product maturity more than any feature on the POS itself.

4. **The support problem.** Without account management, every "I forgot my password" case becomes a manual fix. With Supabase's built-in reset flow, it's zero support cost.

This document establishes the complete account and user system — what to build, in what order, and exactly why each decision was made.

---

## 2. Research Findings

### 2.1 Square — The Standard Everyone Copies

Square is the benchmark for POS account management. After studying it, the key decisions become obvious.

**Settings hierarchy:**
Square separates two distinct concerns cleanly:
- **Account** (squareup.com/account) — personal: your name, email, password, 2FA, notifications
- **Business** (squareup.com/dashboard/[location]) — shop-level: locations, team, hardware, receipts

The navigation places both under a single avatar dropdown in the top-right. Clicking the avatar reveals:
```
My Account     ← personal settings
Dashboard      ← back to the business dashboard
Settings       ← business/location settings
Help Center
Sign Out
```

**Avatar:** Square auto-generates an initial-based circle avatar (first letter of name, gold background). Photo upload is optional and rarely used by cafe owners.

**Password change:** Settings → Account & Security → "Change Password"
- Requires current password (security barrier)
- New password minimum 8 characters
- Password strength indicator (weak/good/strong)
- No requirement to relogin after change (session preserved)

**2FA:** SMS-based, also supports authenticator apps. Can be required for all team members by the owner — a critically missing feature from every low-quality POS.

**Logout:** Square sends you to `squareup.com` (the marketing homepage), not to the login page. This is intentional — you feel "done" not "rejected." The login page is only shown when you try to go somewhere protected.

**Account deletion:** "Deactivate Account" (not immediate deletion). Requires: $0 balance, no pending payouts, no active subscriptions. Warning screen, then 30-day grace period before permanent deletion. The business data is retained for 7 years for legal/tax purposes (US requirement — relevant to note for Laos compliance too).

**What to steal:** The two-level hierarchy (account vs business). The "logout → homepage" behavior. The auto-generated initial avatar.

---

### 2.2 Shopify — Multi-Shop Done Right

Shopify's model is the only one where one email truly "owns" multiple shops. The others simulate this. For Alan Cafe OS, multi-shop is a future concern, but the architecture decision made now determines whether it's possible later.

**The crucial architectural decision:**
In Shopify, one email address is attached to a Shopify account (identity), and that account can be collaborator/owner/staff on any number of stores. The **store switcher** lives in the top-left corner (not the avatar dropdown), with your shop name shown and a chevron that drops down a list of all stores.

```
[☕ Alan Coffee ▼]    ← click to switch stores
```

The avatar dropdown (top-right) contains only personal settings — it's completely separate from shop switching.

**Staff permissions — how Shopify does it:**
Rather than fixed roles, Shopify uses permission checkboxes per staff member. The UI groups these into sections:

```
General
  [ ] Home
  [ ] Orders — (None / View / Edit)
  [ ] Products — (None / View / Edit)
  [ ] Customers — (None / View / Edit)
  [ ] Reports — (None / View)
  [ ] Marketing — (None / View / Edit)
  [ ] Discounts — (None / View / Edit)
  [ ] Apps

Point of Sale
  [ ] POS access (on/off)

Settings
  [ ] View settings
  [ ] Edit settings

Store management
  [ ] Manage and install apps
```

Owner cannot be removed — ownership must be transferred. Staff members are invited by email and accept via the invitation link.

**What to steal:** The store switcher placement (top-left, not in avatar dropdown). The concept that invitation must be accepted. The Owner-as-a-role-you-can-transfer model.

**What NOT to steal:** The granular permission checkboxes. For a single-shop cafe POS, role-based (Owner/Manager/Cashier/Viewer) is simpler and good enough. Granular permissions add cognitive overhead without adding real value at our scale.

---

### 2.3 Loyverse — The Insight That Changes Everything

Loyverse is the most important reference for Alan Cafe OS because it solves the exact problem we have: **a shared tablet with multiple employees taking turns at the POS**.

**The critical discovery: Two completely different user concepts.**

Loyverse distinguishes:

1. **Account users** — have email + password, access the web dashboard at loyverse.com. These are managers and owners. The barista is NOT one of these.

2. **POS employees** — have a name and a 4-digit PIN code. They clock in on the shared tablet. No email required. No Supabase Auth account. They exist only in the database as records.

This is the system we need. Here's why it matters for a typical Alan Cafe session:
- Owner opens `/cafe` dashboard in the morning (email login, happens once)
- First barista clocks in by tapping their name → entering PIN (4 seconds, no browser login)
- Second barista clocks in the same way when they arrive
- Owner goes home. The tablet stays logged in as the shop.
- POS orders are attributed to whichever employee is active (based on PIN clock-in)

**Loyverse employee setup:**
- Name (required)
- Photo (optional, taken from camera or uploaded)
- PIN code (4 digits, required, unique per shop)
- Role: Owner / Manager / Cashier (determines what they can do on the POS tablet)
- Hourly rate (optional, for payroll reports)
- Email (optional, for sending reports)

**Loyverse permission groups (POS-level):**
- Open/close register
- Apply discounts
- Void items
- View reports
- Manage inventory
- Manage employees

Each group can be on/off per role. This is not the same as dashboard access.

**Time tracking:**
- Each PIN clock-in records `start_time` and `employee_id`
- Clock-out records `end_time`
- Shift reports show total hours per employee per day/week

**What to steal:** The entire two-tier model (dashboard users vs POS employees). This is the most important architectural decision in this document. Our existing `staff` table is almost the right shape for POS employees.

---

### 2.4 Notion — Account UI Patterns

Notion's account management is heavily referenced because the quality of their settings UI set the bar for B2B SaaS.

**Avatar position:** Unlike most apps, Notion places the user trigger at the **bottom-left** of the sidebar. The workspace name is at the top-left. For Alan Cafe OS (which has a sidebar in the dashboard), this bottom-left placement makes sense.

**What clicking the avatar shows:**
```
┌──────────────────────────────────┐
│  [Avatar] User Name              │
│           user@email.com         │
├──────────────────────────────────┤
│  ⚙️  Settings                    │
│  🔔  Notifications               │
│  🔑  Connections                 │
│  📦  Import                      │
├──────────────────────────────────┤
│  🚪  Log out                     │
└──────────────────────────────────┘
```

**Settings modal (not a page):**
Notion opens a full-screen overlay modal with a left sidebar. The sidebar has:
- **My Account** (personal section)
  - Profile — name, photo, email
  - Notifications
  - Language & region
- **Workspace** (business section)
  - Settings — workspace name, domain, icon, delete
  - Members
  - Plans & billing
  - Security

The two-section sidebar (personal vs workspace) maps perfectly to our account vs shop hierarchy.

**Profile editing:**
- Photo: drag & drop or click. Shows circle crop preview. Saves immediately on upload.
- Name: inline editing, saves on blur
- Email: requires re-verification if changed (Notion sends a confirmation to both old and new email)
- Password: "Change password" link → new screen (current password + new + confirm)

**What to steal:** The settings modal layout (left sidebar + right content). The personal/workspace section split. The immediate-save-on-blur UX for name editing.

**What NOT to steal:** The bottom-left avatar placement may not fit our sidebar's current design. Evaluate at implementation time.

---

### 2.5 Stripe — Account Settings Done Right

Stripe's settings are the most complete and professional of the five products studied. They set the standard for completeness.

**URL structure:** Stripe uses `/settings` (full page, not modal) with a left sidebar navigation. No modals.

**Settings sidebar order (important — this order is not accidental):**
1. Profile — first because it's the most personal, builds trust
2. Team — second because delegation is the first thing a growing business needs
3. Billing — third, requires trust already established
4. Notifications — fourth, personal but not urgent
5. Security — last (most users don't need it, power users will find it)
6. API Keys — very last (developer-only)

**Security tab (the gold standard):**
```
Change Password
─────────────────────────────────
Current password: [           ]
New password:     [           ]   (min 8 chars, strength indicator)
Confirm password: [           ]
                  [Update password]

Two-step authentication
─────────────────────────────────
Add an extra layer of security.
[Authenticator app] [SMS]  ← two options
Status: Not enabled
[Enable]

Active sessions
─────────────────────────────────
Your account is currently active in these locations:
● Chrome on Windows — Attapeu, LA — Active now          [This device]
○ Chrome on iPhone — Vientiane, LA — 2 days ago         [Revoke]
○ Firefox on Mac — Bangkok, TH — 5 days ago             [Revoke]

Security activity (last 10 events)
─────────────────────────────────
Password changed          2026-05-01 09:14  Chrome / Windows
Signed in                 2026-04-28 08:02  Chrome / iPhone
Team member invited       2026-04-25 14:33  Chrome / Windows
```

**Team tab:**
- Shows all team members with: name, email, role badge, "Last active" timestamp
- Roles: Administrator / Developer / Analyst / Support Specialist
- Invite by email: sends invitation email, shows "Pending" until accepted
- Revoking access: sets `active = false` in the backend (not hard delete)
- Pending invitations are listed separately with "Resend" and "Cancel" options

**Audit log:** Every account action is logged: who, what, when, IP, device. This is critical for accountability in a multi-person business.

**What to steal:** The full-page settings (not modal) structure. The ordered left sidebar. Active sessions list with revoke. Security activity log. The invitation state machine (Pending → Active / Cancelled / Revoked).

---

### 2.6 Cross-Product Analysis

**Where is logout?**
| Product | Logout placement | After logout → |
|---------|-----------------|----------------|
| Square | Avatar dropdown → "Sign Out" | squareup.com homepage |
| Shopify | Avatar dropdown → "Log out" | accounts.shopify.com |
| Loyverse | Top-right menu → "Sign out" | loyverse.com homepage |
| Notion | Avatar dropdown → "Log out" | notion.so homepage |
| Stripe | Avatar dropdown → "Sign out" | stripe.com homepage |

**Universal finding:** Logout is always in the avatar dropdown. After logout, every product sends you to the **marketing homepage**, not the login page. This is intentional — you feel "done" not "rejected."

**Settings: modal or page?**
| Product | Pattern |
|---------|---------|
| Square | Full page |
| Shopify | Full page |
| Loyverse | Full page |
| Notion | Full-screen modal with internal sidebar |
| Stripe | Full page |

Full page wins 4:1. Notion's modal approach works because Notion is the entire product. For a POS with separate operational views, full pages are right.

**Avatar dropdown contents (in order every product uses):**
1. User name + email (display only, not clickable)
2. Profile / Account settings
3. Shop/workspace settings  
4. Team management
5. Billing (if applicable)
6. Divider
7. Logout

**Default avatar:** All 5 products generate an initial-based circle avatar. Only Notion and Stripe make photo upload prominent. Square and Loyverse treat it as optional.

---

## 3. Information Architecture

### 3.1 Two-Level Hierarchy (The Core Decision)

Everything in the system belongs to one of two levels:

```
Level 1: ACCOUNT (personal — belongs to the person, not the shop)
  /account/profile          Name, avatar, email, phone, language, timezone
  /account/security         Password change, active sessions, 2FA (future)
  /account/notifications    Email preferences

Level 2: SHOP (business — belongs to the shop, visible to all staff with access)
  /shop/settings            Shop name, address, city, currency, timezone, logo
  /shop/team                Dashboard users (email-based, Supabase Auth)
  /shop/team/employees      POS employees (PIN-based, no Auth account)
  /shop/receipts            Receipt design, footer text, paper width
  /shop/billing             Plan, payment method (future)
```

These routes are all inside the authenticated zone (require Supabase session). They are accessed via the sidebar in the `/cafe` dashboard — not from the public Navbar.

### 3.2 Why Full Pages, Not a Modal

Notion's settings modal is impressive but wrong for our context:

1. The `/cafe` dashboard is already a full-page app with a sidebar. A modal on top of a complex POS dashboard creates depth confusion.
2. Full pages are bookmarkable and deep-linkable — `/account/security` can be linked from an email ("click here to update your password").
3. On a tablet (which the POS runs on), modals are harder to dismiss accidentally.
4. Full pages allow the browser's Back button to work naturally.

**Exception:** The avatar dropdown itself is a floating menu overlay (not a page). This is standard and expected by users.

### 3.3 Where Does "Account" Live in the App?

The entry point is the avatar in the **bottom section of the `/cafe` sidebar**.

The public Navbar (travel website) does NOT show any account UI — it has the "CafeOS" link and "Contact" button only. Account UI lives exclusively inside the dashboard.

```
Dashboard sidebar structure:
┌─────────────────────────────┐
│  ALAN · CafeOS              │  ← logo / shop switcher (future)
├─────────────────────────────┤
│  📊 แดชบอร์ด               │
│  ☕ เมนู                    │
│  📦 สต็อก                  │
│  📋 ออเดอร์                 │
│  👥 พนักงาน                 │
│  💰 การเงิน                 │
│  📈 รายงาน                  │
│  ⚙️  ตั้งค่า                │  ← goes to /shop/settings
├─────────────────────────────┤
│  → POS                      │
│  → จอ TV                   │
├─────────────────────────────┤
│  [Av] ชื่อผู้ใช้  ▲        │  ← avatar trigger (bottom)
│       email@...             │
└─────────────────────────────┘
```

The avatar trigger is at the BOTTOM-LEFT of the sidebar (Notion pattern). Clicking it opens the account dropdown menu upward.

---

## 4. User Flows

### 4.1 First-Time Login Flow

```
/login
  ↓ (valid credentials)
/cafe (dashboard)
  ↓ (if onboarding not complete)
/onboarding (screen 0–5)
  ↓ (completion)
/cafe (dashboard with Getting Started checklist)
```

If a user signs in and has `shop_users` record: goes directly to `/cafe`.
If no `shop_users` record found: goes to `/onboarding`.

The current `/login` page already handles this. Refinement needed: detect whether onboarding was completed via presence of `shop_users.accepted_at`.

### 4.2 Password Change Flow

```
Sidebar avatar → "ความปลอดภัย" → /account/security

Security page shows:
┌─────────────────────────────────────┐
│  เปลี่ยนรหัสผ่าน                    │
│                                     │
│  รหัสผ่านปัจจุบัน  [              ] │
│  รหัสผ่านใหม่      [              ] │
│  ยืนยันรหัสผ่าน   [              ] │
│                                     │
│  [บันทึก]                           │
└─────────────────────────────────────┘

On submit:
  1. Client: validate new === confirm, length ≥ 8
  2. Call: authClient.auth.updateUser({ password: newPassword })
     (Supabase handles current-password verification at the API level)
  3. On success: show "รหัสผ่านเปลี่ยนแล้ว ✓" (no redirect — stay on page)
  4. On error: show Thai error message inline
```

**Important:** Supabase's `updateUser()` does NOT require the current password to be passed — it uses the current session token. This means a logged-in user can change their password. The current-password field is for UX only (user expectation) — consider whether to validate it client-side or skip entirely.

**Recommendation:** Skip the current-password field entirely. The session itself is proof of identity. This matches how Notion handles it.

### 4.3 Forgot Password Flow

```
/login
  ↓ click "ลืมรหัสผ่าน?"
/forgot-password
  Enter email address
  [ส่งลิงก์รีเซ็ต]
  ↓
  Email sent: "ถ้ามีบัญชีด้วยอีเมลนี้ เราจะส่งลิงก์ให้"
  (always show success even if email not found — security)
  ↓
  User clicks link in email
  ↓
/account/reset-password?token=...
  New password: [          ]
  Confirm:      [          ]
  [ตั้งรหัสผ่านใหม่]
  ↓ on success
/login (with success message: "รหัสผ่านเปลี่ยนแล้ว กรุณาล็อกอินใหม่")
```

Supabase handles the token generation and validation. We only need to build:
1. `/forgot-password` page — calls `authClient.auth.resetPasswordForEmail(email, { redirectTo: baseUrl + '/account/reset-password' })`
2. `/account/reset-password` page — calls `authClient.auth.updateUser({ password: newPassword })`

Supabase will send a branded reset email automatically. We can customize the email template in the Supabase dashboard.

### 4.4 Staff Invitation Flow (Dashboard Users)

```
/shop/team
  ↓ click [+ เชิญสมาชิก]
  
  Drawer/form appears:
  อีเมล:  [                    ]
  บทบาท:  [Manager ▼]           (Owner / Manager / Cashier / Viewer)
  [ส่งคำเชิญ]
  
  On submit:
  1. INSERT shop_users (shop_id, email, role, invited_at) — user_id is NULL until accepted
  2. Send invitation email (via Supabase edge function or manual)
  3. Show "ส่งคำเชิญแล้ว" with pending badge
  
  Invitee receives email → clicks link → /signup?invite=token
  /signup?invite=token:
  - Shows "คุณได้รับเชิญให้เข้าร่วม Alan Coffee & Travel"
  - Email pre-filled (disabled), just set password
  - On submit: creates Supabase Auth account, updates shop_users.user_id + accepted_at
  
  /shop/team now shows:
  [✓] User Name    Manager    Last active: just now
  [⏳] pending@email.com  Cashier  Invited 2 days ago  [Resend] [Cancel]
```

**Note:** Supabase does not have a built-in "invitation" flow. We need to either:
- Use a signed URL token stored in `shop_users` (recommended)
- Use Supabase's `inviteUserByEmail()` which generates a signup link (simpler, but gives full auth.users access before they accept)

### 4.5 POS Employee Flow (PIN-Based, No Auth Account)

```
/shop/team/employees
  ↓ click [+ เพิ่มพนักงาน]

  Form:
  ชื่อ:           [              ]  (required)
  รหัส PIN:       [    ]           (4 digits, auto-validate uniqueness in shop)
  บทบาท POS:     [Cashier ▼]       (Manager / Cashier)
  อัตราค่าจ้าง:  [    ] กีบ/ชั่วโมง (optional)
  
  ← No email required. No Supabase Auth account.
  
  On save: INSERT employees (shop_id, name, pin_hash, role, hourly_rate)
  
At POS terminal (/pos):
  "เลือกพนักงาน" button → PIN pad modal:
  [1][2][3]
  [4][5][6]
  [7][8][9]
     [0]
  → validates PIN → sets active_employee_id in local state
  → every order is tagged with employee_id
```

### 4.6 Logout Flow

```
Avatar dropdown → [ออกจากระบบ]
  ↓
  authClient.auth.signOut()
  ↓
  router.replace('/') ← homepage (NOT /login)
```

Following the universal pattern: logout sends to the marketing homepage. The user feels "done." If they want to log back in, they find the "CafeOS" link in the Navbar.

### 4.7 Account Deletion Flow

```
/account/security → "ลบบัญชี" (at the very bottom, small and non-prominent)
  ↓
  Warning modal:
  "คุณแน่ใจหรือไม่? ข้อมูลทั้งหมดของร้านจะถูกลบถาวร
   รวมถึง: เมนู [X รายการ], ออเดอร์ [Y รายการ], พนักงาน [Z คน]
   
   พิมพ์ชื่อร้านเพื่อยืนยัน: [              ]"
  
  [ยกเลิก] [ลบบัญชีถาวร] (red, disabled until name matches)
  
  On confirm:
  - Mark shop as status='deleted' (soft delete, 30 day grace)
  - authClient.auth.admin.deleteUser(userId) — requires service role key (not anon key)
  
  Implementation note: Account deletion requires a server-side API route or
  Supabase edge function with service_role key. Do NOT implement client-side.
```

---

## 5. Wireframes

### 5.1 Avatar Dropdown (in dashboard sidebar)

```
┌──────────────────────────────────────────┐
│                                          │
│   ┌── Account ──────────────────────┐   │
│   │                                 │   │
│   │  ┌──┐  User Name               │   │
│   │  │ A│  user@email.com          │   │
│   │  └──┘  Alan Coffee & Travel    │   │
│   │                                 │   │
│   ├─────────────────────────────────┤   │
│   │  👤  โปรไฟล์ของฉัน             │   │
│   │  🔒  ความปลอดภัย               │   │
│   │  🔔  การแจ้งเตือน              │   │
│   ├─────────────────────────────────┤   │
│   │  ⚙️   ตั้งค่าร้าน              │   │
│   │  👥  จัดการทีม                 │   │
│   │  🏷️   พนักงาน POS              │   │
│   ├─────────────────────────────────┤   │
│   │  🚪  ออกจากระบบ               │   │
│   └─────────────────────────────────┘   │
│                                          │
│                           ↑ opens upward │
│  [Av] User Name  ▲                      │ ← trigger
└──────────────────────────────────────────┘
```

The dropdown opens UPWARD from the avatar trigger (since the trigger is at the bottom of the sidebar). The gold initial avatar auto-generates from the user's display name.

### 5.2 /account/profile

```
┌─────────────────────────────────────────┐
│  ← แดชบอร์ด                            │
│                                         │
│  โปรไฟล์                               │
│  ──────────────────────────────────     │
│                                         │
│  รูปโปรไฟล์                            │
│  ┌───┐                                  │
│  │ A │  [เปลี่ยนรูป]  [ลบรูป]          │
│  └───┘                                  │
│  รูปจะปรากฏในแดชบอร์ดและในใบเสร็จ      │
│                                         │
│  ชื่อที่แสดง                            │
│  ┌──────────────────────────────────┐   │
│  │  User Name                       │   │
│  └──────────────────────────────────┘   │
│                                         │
│  อีเมล                                  │
│  ┌──────────────────────────────────┐   │
│  │  user@email.com              🔒  │   │  ← lock icon: change needs verify
│  └──────────────────────────────────┘   │
│  การเปลี่ยนอีเมลต้องยืนยันทั้งสองที่    │
│                                         │
│  เบอร์โทรศัพท์                          │
│  ┌──────────────────────────────────┐   │
│  │  +856 20...                      │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ภาษา                                   │
│  [ภาษาไทย ▼]                           │
│                                         │
│  เขตเวลา                                │
│  [Asia/Vientiane (UTC+7) ▼]            │
│                                         │
│              [บันทึกการเปลี่ยนแปลง]     │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3 /account/security

```
┌─────────────────────────────────────────┐
│  ← แดชบอร์ด                            │
│                                         │
│  ความปลอดภัย                            │
│  ──────────────────────────────────     │
│                                         │
│  เปลี่ยนรหัสผ่าน                       │
│  ┌──────────────────────────────────┐   │
│  │  รหัสผ่านใหม่       [          ]│   │
│  │  ยืนยันรหัสผ่าน    [          ]│   │
│  │  ความแข็งแรง: ●●●○○ ดี          │   │
│  │                 [เปลี่ยนรหัสผ่าน]│   │
│  └──────────────────────────────────┘   │
│                                         │
│  การยืนยันตัวตนสองขั้นตอน (2FA)        │
│  ┌──────────────────────────────────┐   │
│  │  ● ยังไม่ได้เปิดใช้งาน          │   │
│  │  เพิ่มความปลอดภัยด้วย OTP       │   │
│  │              [เปิดใช้งาน] Soon  │   │  ← disabled, "Coming soon"
│  └──────────────────────────────────┘   │
│                                         │
│  เซสชันที่ใช้งานอยู่                    │
│  ┌──────────────────────────────────┐   │
│  │  ● Chrome / Windows             │   │
│  │    Attapeu, LA · ตอนนี้         │   │
│  │    อุปกรณ์นี้            [นี่คือฉัน] │
│  ├──────────────────────────────────┤   │
│  │  ○ Chrome / iPhone              │   │
│  │    Vientiane, LA · 2 วันที่แล้ว │   │
│  │                         [ยกเลิก]│   │
│  └──────────────────────────────────┘   │
│                                         │
│  ─────────────────── Danger Zone ──     │
│                                         │
│  ลบบัญชี                               │
│  การลบจะเป็นการลบข้อมูลทั้งหมดถาวร     │
│                      [ลบบัญชี...] ←red  │
│                                         │
└─────────────────────────────────────────┘
```

### 5.4 /account/notifications

```
┌─────────────────────────────────────────┐
│  ← แดชบอร์ด                            │
│                                         │
│  การแจ้งเตือน                           │
│  ──────────────────────────────────     │
│                                         │
│  อีเมลรายงาน                           │
│  ┌──────────────────────────────────┐   │
│  │  [✓] รายงานยอดขายรายวัน          │   │
│  │       ส่งทุกวันเวลา 20:00        │   │
│  │                                  │   │
│  │  [ ] รายงานรายสัปดาห์            │   │
│  │       ส่งทุกวันจันทร์            │   │
│  │                                  │   │
│  │  [ ] รายงานสต็อกต่ำ             │   │
│  │       เมื่อสต็อกต่ำกว่าขั้นต่ำ  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  การแจ้งเตือนระบบ (ปิดไม่ได้)          │
│  ┌──────────────────────────────────┐   │
│  │  [✓] อีเมลความปลอดภัย           │   │  ← always on, greyed out
│  │  [✓] อีเมลยืนยันการเปลี่ยนแปลง  │   │  ← always on, greyed out
│  └──────────────────────────────────┘   │
│                                         │
│              [บันทึก]                   │
│                                         │
└─────────────────────────────────────────┘
```

### 5.5 /shop/team (Dashboard Users)

```
┌─────────────────────────────────────────┐
│  ← ตั้งค่าร้าน                          │
│                                         │
│  สมาชิกทีม                              │  ← dashboard access users
│  ──────────────────────────────────     │
│                                    [+ เชิญ]
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ [Av] ชื่อผู้ใช้    Owner        │   │
│  │      user@email.com              │   │
│  │      เข้าสู่ระบบล่าสุด: ตอนนี้  │   │
│  │                         [จัดการ]│   │
│  ├──────────────────────────────────┤   │
│  │ [Av] พนักงาน 2      Manager     │   │
│  │      staff@email.com             │   │
│  │      เข้าสู่ระบบล่าสุด: เมื่อวาน│   │
│  │                         [จัดการ]│   │
│  ├──────────────────────────────────┤   │
│  │ ⏳    pending@email.com          │   │  ← pending invitation
│  │       Cashier · เชิญ 2 วันที่แล้ว│   │
│  │       [ส่งซ้ำ]  [ยกเลิก]        │   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 5.6 /shop/team/employees (POS PIN Employees)

```
┌─────────────────────────────────────────┐
│  ← จัดการทีม                           │
│                                         │
│  พนักงาน POS                            │  ← PIN-based, no Auth account
│  ──────────────────────────────────     │
│  ใช้ PIN เพื่อ clock in ที่หน้า POS    │
│                                  [+ เพิ่ม]
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  [🧑] นุ้ย          Cashier      │   │
│  │       PIN: ●●●●                  │   │
│  │       เข้างานล่าสุด: วันนี้ 8:00 │   │
│  │       รวมชั่วโมง เดือนนี้: 64 ชม │   │
│  │                [แก้ไข] [ลบ]      │   │
│  ├──────────────────────────────────┤   │
│  │  [🧑] ก้อง          Manager     │   │
│  │       PIN: ●●●●                  │   │
│  │       เข้างานล่าสุด: เมื่อวาน   │   │
│  │       รวมชั่วโมง เดือนนี้: 48 ชม │   │
│  │                [แก้ไข] [ลบ]      │   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 5.7 /shop/settings (General Shop Settings)

```
┌─────────────────────────────────────────┐
│  ← แดชบอร์ด                            │
│                                         │
│  ตั้งค่าร้าน                            │
│  ──────────────────────────────────     │
│                                         │
│  ข้อมูลร้าน                             │
│  ┌──────────────────────────────────┐   │
│  │  ชื่อร้าน      [               ]│   │
│  │  ที่อยู่        [               ]│   │
│  │  เมือง         [Attapeu ▼      ]│   │
│  │  เบอร์โทร      [               ]│   │
│  │  เว็บไซต์      [               ]│   │
│  └──────────────────────────────────┘   │
│                                         │
│  โลโก้ร้าน                              │
│  ┌──────────────────────────────────┐   │
│  │  [Drop image here or click]      │   │
│  │  แสดงบนใบเสร็จและในระบบ         │   │
│  └──────────────────────────────────┘   │
│                                         │
│  การเงิน                                │
│  ┌──────────────────────────────────┐   │
│  │  สกุลเงิน    [LAK (กีบ) ▼     ]│   │
│  │  เขตเวลา     [Asia/Vientiane ▼ ]│   │
│  └──────────────────────────────────┘   │
│                                         │
│  ใบเสร็จ                                │
│  ┌──────────────────────────────────┐   │
│  │  ข้อความท้ายใบเสร็จ [          ]│   │
│  │  ขนาดกระดาษ  ○ 58mm  ● 80mm   │   │
│  └──────────────────────────────────┘   │
│                                         │
│              [บันทึกการเปลี่ยนแปลง]     │
│                                         │
└─────────────────────────────────────────┘
```

---

## 6. Permission Matrix

### 6.1 Dashboard Users (email-based, Supabase Auth)

| Permission | Owner | Manager | Cashier | Viewer |
|------------|:-----:|:-------:|:-------:|:------:|
| **POS & Orders** | | | | |
| Access /pos | ✓ | ✓ | ✓ | — |
| Take orders | ✓ | ✓ | ✓ | — |
| Apply discounts | ✓ | ✓ | — | — |
| Override prices | ✓ | ✓ | — | — |
| Void orders | ✓ | ✓ | — | — |
| View order history | ✓ | ✓ | own only | ✓ |
| **Menu** | | | | |
| View menu | ✓ | ✓ | ✓ | ✓ |
| Add/edit menu items | ✓ | ✓ | — | — |
| Delete menu items | ✓ | ✓ | — | — |
| Set prices | ✓ | ✓ | — | — |
| **Inventory / Stock** | | | | |
| View inventory | ✓ | ✓ | ✓ | ✓ |
| Adjust stock | ✓ | ✓ | — | — |
| Set low-stock alerts | ✓ | ✓ | — | — |
| **Staff & Team** | | | | |
| View team members | ✓ | ✓ | — | ✓ |
| Invite dashboard users | ✓ | — | — | — |
| Change user roles | ✓ | — | — | — |
| Remove dashboard users | ✓ | — | — | — |
| Add/edit POS employees | ✓ | ✓ | — | — |
| View POS timesheets | ✓ | ✓ | own only | — |
| **Reports** | | | | |
| View sales reports | ✓ | ✓ | — | ✓ |
| View financial reports | ✓ | ✓ | — | — |
| View staff performance | ✓ | ✓ | own only | — |
| Export reports | ✓ | ✓ | — | — |
| **Settings** | | | | |
| View shop settings | ✓ | ✓ | — | — |
| Edit shop settings | ✓ | — | — | — |
| Change receipt design | ✓ | ✓ | — | — |
| View/change billing | ✓ | — | — | — |
| Delete shop | ✓ | — | — | — |

### 6.2 POS Employees (PIN-based, no dashboard access)

POS employees never access the web dashboard. Their permissions are only relevant at the POS terminal (`/pos`).

| Permission | Manager PIN | Cashier PIN |
|------------|:-----------:|:-----------:|
| Take orders | ✓ | ✓ |
| Apply discounts | ✓ | — |
| Void items/orders | ✓ | — |
| View own order history | ✓ | ✓ |
| Open cash drawer | ✓ | ✓ |
| View daily totals | ✓ | — |
| Access POS settings | ✓ | — |

### 6.3 Implementation Note

Role enforcement is dual-layered:
- **Client-side:** Hide UI elements based on role (UX)
- **Server-side (RLS):** Supabase policies enforce role at DB level (security)

Client-side enforcement alone is never sufficient. A Manager who knows the URL should not be able to reach the billing page and have their DB writes succeed. The RLS policies in `002_saas_tenants.sql` handle this for operational data. Account/settings pages need their own RLS or server-action checks.

---

## 7. Database Schema Additions

### 7.1 shop_users — Profile Fields

```sql
ALTER TABLE shop_users
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS language     TEXT DEFAULT 'th',
  ADD COLUMN IF NOT EXISTS timezone     TEXT DEFAULT 'Asia/Vientiane',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
```

`display_name` takes priority over `full_name` for display. `full_name` is set at signup from Supabase auth metadata.

### 7.2 employees — POS PIN Employees (New Table)

```sql
CREATE TABLE IF NOT EXISTS employees (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  photo_url    TEXT,
  pin_hash     TEXT        NOT NULL,   -- bcrypt hash of 4-digit PIN
  role         TEXT        NOT NULL DEFAULT 'cashier'
                           CHECK (role IN ('manager','cashier')),
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  hourly_rate  DECIMAL(10,2),          -- optional, for payroll tracking
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, pin_hash)            -- PINs must be unique per shop
);

CREATE INDEX IF NOT EXISTS employees_shop_id_idx ON employees(shop_id);
```

**Security note:** Never store raw PIN codes. Use bcrypt with cost factor 10. A 4-digit PIN has only 10,000 combinations — bcrypt slows brute force to practical infeasibility even with a stolen database.

### 7.3 employee_shifts — Clock In/Out Tracking

```sql
CREATE TABLE IF NOT EXISTS employee_shifts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  employee_id  UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  clocked_in   TIMESTAMPTZ NOT NULL DEFAULT now(),
  clocked_out  TIMESTAMPTZ,            -- NULL = currently clocked in
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shifts_employee_id_idx ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS shifts_shop_id_date_idx ON employee_shifts(shop_id, clocked_in);
```

### 7.4 notification_preferences (New Table)

```sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id         UUID    NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  daily_report    BOOLEAN NOT NULL DEFAULT true,
  weekly_report   BOOLEAN NOT NULL DEFAULT false,
  low_stock_alert BOOLEAN NOT NULL DEFAULT false,
  report_time     TEXT    NOT NULL DEFAULT '20:00',  -- HH:MM in shop timezone
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, shop_id)
);
```

### 7.5 account_events — Security Audit Log

```sql
CREATE TABLE IF NOT EXISTS account_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id     UUID        REFERENCES shops(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,   -- 'login', 'logout', 'password_change',
                                      -- 'profile_update', 'member_invited', etc.
  description TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_events_user_id_idx ON account_events(user_id);
CREATE INDEX IF NOT EXISTS account_events_created_at_idx ON account_events(created_at DESC);
```

---

## 8. Supabase Auth Integration

### 8.1 What Supabase Handles (Free)

| Feature | Supabase Method | Notes |
|---------|----------------|-------|
| Signup | `auth.signUp({ email, password })` | Sends confirmation email if enabled |
| Login | `auth.signInWithPassword({ email, password })` | Returns session + user |
| Logout | `auth.signOut()` | Revokes current session token |
| Password change | `auth.updateUser({ password })` | Requires active session |
| Password reset | `auth.resetPasswordForEmail(email, { redirectTo })` | Sends email with magic link |
| Session refresh | Auto via `autoRefreshToken: true` | Already configured |
| Get current user | `auth.getUser()` | Validates session server-side |
| Email change | `auth.updateUser({ email })` | Sends confirmation to both old and new email |

### 8.2 What We Need to Build

| Feature | Where |
|---------|-------|
| `/forgot-password` page | New page (simple form, calls resetPasswordForEmail) |
| `/account/reset-password` page | New page (reads token from URL, calls updateUser) |
| `/account/profile` page | New page |
| `/account/security` page | New page |
| `/account/notifications` page | New page |
| `/shop/settings` page | New page |
| `/shop/team` page | New page |
| `/shop/team/employees` page | New page |
| Staff invitation system | Edge function OR signed token in shop_users |
| PIN validation at POS | Client-side PIN check → bcrypt verify |
| Avatar upload | Supabase Storage bucket (public read, auth write) |
| Account events logging | DB insert on each event |

### 8.3 Email Verification

Supabase can require email confirmation before login. Currently it sends a confirmation email on signup. 

**Recommendation:** Enable email confirmation in Supabase dashboard (Authentication → Settings → "Confirm email"). Add a `/signup/verify` page that detects the verification state and shows appropriate messaging.

**The "confirm email" state:**
```
/signup → credentials entered → Supabase sends confirmation email
  ↓ (before clicking link)
/signup/verify?email=user@email.com
  "ตรวจสอบอีเมลของคุณ"
  "เราส่งลิงก์ยืนยันไปที่ [email]"
  [ส่งลิงก์ใหม่]  [เปลี่ยนอีเมล]
  ↓ (after clicking link in email)
/onboarding (redirect after email confirmed)
```

### 8.4 Supabase Auth Settings Required

In Supabase dashboard → Authentication → Settings:

```
Site URL: https://alan-coffee-travel.vercel.app
Redirect URLs:
  https://alan-coffee-travel.vercel.app/account/reset-password
  https://alan-coffee-travel.vercel.app/signup/verify
  http://localhost:3000/account/reset-password        (dev)
  http://localhost:3000/signup/verify                 (dev)

Email provider: Enabled (default)
Confirm email: Enabled (recommended)
Secure email change: Enabled (sends to both old and new email)
```

---

## 9. Security Best Practices

### 9.1 Password Requirements

```
Minimum length: 8 characters
Client-side feedback:
  < 8 chars:          ●○○○○  (very weak — show immediately)
  8 chars, simple:    ●●○○○  (weak)
  8+ chars, mixed:    ●●●○○  (good)  ← minimum we accept
  12+ chars, complex: ●●●●●  (strong)

Server-side: Supabase enforces minimum 6 chars (we raise this to 8 client-side).
No character class requirements (they make passwords LESS secure by being predictable).
```

### 9.2 Session Management

```
Session lifetime: 1 hour (Supabase JWT)
Refresh token: 7 days (rotates on each use)
autoRefreshToken: true (already configured in supabase-auth.ts)
persistSession: true (localStorage, already configured)

Active sessions:
  - Tracked via account_events table (each login = new event)
  - "Revoke session" = signOut on target session (requires Supabase admin API)
  - MVP: only revoke all sessions via password change
```

### 9.3 PIN Security (POS Employees)

```
PIN length: 4 digits (compromise between UX and security)
Hash: bcrypt(pin, saltRounds=10)
Uniqueness: UNIQUE constraint on (shop_id, pin_hash)
Rate limiting: After 5 wrong PINs, lock for 60 seconds (client-side state)
Failed attempts: Log to account_events
```

### 9.4 Rate Limiting

Supabase has built-in rate limiting on auth endpoints (configurable in dashboard):
- Sign ups: 30/hour by default
- Magic links: 3/hour per email
- Password resets: 3/hour per email

For the POS PIN system, implement client-side rate limiting (lockout after 5 failures) since it's not going through Supabase Auth.

### 9.5 Data Sensitivity

```
Never log or expose:
- Passwords (obviously)
- PIN codes (raw or hashed should not appear in logs)
- Full session tokens
- Full API keys

Safe to log:
- User ID (UUID)
- Email (for audit purposes)
- Event type and timestamp
- IP address (anonymized: first 3 octets only)
```

---

## 10. Implementation Phases

### Phase 1: Avatar Dropdown + Logout Fix (1 day)
**Priority: CRITICAL — this is the minimum viable account UI**

Files to modify:
- `app/cafe/CafeClient.tsx` — replace SessionBadge integration with proper sidebar avatar trigger
- `components/SessionBadge.tsx` — replace with `components/AccountMenu.tsx` (the dropdown)

What Phase 1 delivers:
- Avatar (gold initial circle) at bottom of sidebar
- Click → dropdown with links to /account/profile, /shop/settings, /shop/team
- Logout → redirects to `/` (homepage)
- Remove the bottom-right floating SessionBadge

### Phase 2: Forgot Password + Reset Password (half day)
**Priority: HIGH — zero-cost support improvement**

Files to create:
- `app/forgot-password/page.tsx`
- `app/account/reset-password/page.tsx`

What Phase 2 delivers:
- Users can self-serve their forgotten passwords
- Eliminates the #1 support request for any auth system

### Phase 3: /account/profile + /account/security (1 day)
**Priority: HIGH — trust signals**

Files to create:
- `app/account/profile/page.tsx` — name, avatar, email, phone, language
- `app/account/security/page.tsx` — password change, sessions, account deletion

What Phase 3 delivers:
- Users can update their name (most common account action)
- Users can change their password (without forgetting it)
- Users can see which devices are logged in

### Phase 4: /shop/settings (half day)
**Priority: MEDIUM — shop identity**

Files to create:
- `app/shop/settings/page.tsx` — name, city, currency, receipt footer, paper width

What Phase 4 delivers:
- Shop settings are no longer only configurable during onboarding
- Receipt design and shop info become editable post-setup

### Phase 5: /shop/team — Dashboard Users (1 day)
**Priority: MEDIUM — delegation enabler**

Files to create:
- `app/shop/team/page.tsx` — list + invite + manage dashboard users

What Phase 5 delivers:
- Owner can add a manager without sharing their own login
- Pending invitations visible and resendable

### Phase 6: /shop/team/employees — POS PIN Employees (1.5 days)
**Priority: MEDIUM — the Loyverse model**

Files to create:
- `app/shop/team/employees/page.tsx` — list + add/edit POS employees
- DB migration: employees table + employee_shifts table
- POS integration: PIN entry modal on the POS terminal

What Phase 6 delivers:
- Baristas clock in with PIN — no shared email/password
- Time tracking per employee
- Per-employee order attribution

### Phase 7: /account/notifications (half day)
**Priority: LOW — nice to have**

Files to create:
- `app/account/notifications/page.tsx`
- DB migration: notification_preferences table

### Phase 8: Staff Invitation Emails + Account Events Log (1.5 days)
**Priority: LOW — polish**

Files to create:
- `supabase/functions/send-invitation/index.ts` — Edge function
- Add account_events logging to all account actions

---

## Approval Checklist

Before implementation begins, confirm:

- [ ] **Phase order approved** (start with dropdown → forgot-password → profile)
- [ ] **PIN length confirmed** (4 digits recommended, or 6 digits if higher security preferred)
- [ ] **Invitation model confirmed** — email-based invitation (user must accept) vs direct add (owner sets password for them)
- [ ] **Supabase email confirmation** — should we require email confirmation on signup now?
- [ ] **Logout destination confirmed** — `/` (homepage) or `/login`?
- [ ] **Avatar policy** — initial circle only (MVP) or photo upload from Phase 1?
- [ ] **2FA scope** — mark as "Coming soon" and disable, or omit entirely?
- [ ] **Account deletion** — implement now or omit for MVP?
- [ ] **Audit log** — full `account_events` table from Phase 1, or defer?
- [ ] **Supabase Auth settings** — confirm Site URL and redirect URLs are set correctly in dashboard

---

*Document authored by Claude Sonnet 4.6 based on analysis of Square, Shopify, Loyverse, Notion, and Stripe account management systems.*
