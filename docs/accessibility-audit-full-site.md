> **อัปเดต 2026-09-01 (รอบที่ 2):** แก้ 3 ปัญหาที่ซ้ำหลายหน้าแล้ว (PWA banner, navbar/footer contrast, filter select label) — deploy ขึ้น production จริงแล้ว (commit `d616662`) และตรวจซ้ำครบทั้ง 8 หน้า+โมดัลด้วย Chrome DevTools MCP ยืนยันผ่านจริง ดูตารางเทียบก่อน-หลังท้ายเอกสาร
>
> **อัปเดต 2026-09-02 (รอบที่ 3):** แก้ปัญหาที่เหลือครบทั้ง 5 ข้อ (canonical, touch target, Leaflet marker label, heading order, font/gtag preload) — deploy ขึ้น production แล้ว (commit `2d449f1`) ยืนยันด้วย Chrome DevTools MCP ทั้ง 9 หน้าอีกรอบ ดูตาราง "ผลการแก้ไขรอบที่ 3" ท้ายเอกสาร **ตอนนี้ไม่มีปัญหาที่ตั้งใจเหลือค้างจากรายงานนี้แล้ว** เหลือแต่ contrast เฉพาะหน้า (นอก Navbar/Footer) ที่ยังไม่ได้ตัดสินใจว่าจะแก้หรือไม่ — ดูรายละเอียดในหัวข้อ "ปัญหาเฉพาะหน้า" ด้านล่าง (ยังเป็นข้อมูลเดิมจากรอบที่ 1)

# Accessibility Audit — เว็บทั้งเว็บ (Chrome DevTools MCP + Modern Web Guidance)

> ตรวจ 2026-09-01 ผ่าน `alancoffeetravel.com` (production จริง) ด้วย Chrome DevTools MCP (Lighthouse a11y/SEO/Best Practices/**Agentic Browsing**, accessibility tree snapshot, console Issues panel, network) ทั้ง desktop และ mobile viewport (emulated, มือถือ = Moto G Power) ครบ 8 หน้าตามที่ขอ (ไม่รวม Sae Pong Lai ที่ตรวจไปแล้วรอบก่อน — เอาผลรอบนั้นมารวมในเอกสารนี้ด้วย) **ยังไม่มีการแก้โค้ดใดๆ ทั้งสิ้น — เอกสารนี้บันทึกไว้เพื่อวางแผนแก้ทีเดียวเท่านั้น**

หน้าที่ 9 ("Experience detail ตัวอย่าง") **ข้ามไป** เพราะ `/experiences` ยังไม่มีข้อมูลจริง (ขึ้น "0 experiences" ทุก viewport) — ไม่มีหน้า detail ให้ตรวจ

---

## สรุปคะแนนต่อหน้า

| หน้า | A11y (desktop/mobile) | SEO | Agentic Browsing | หมายเหตุ |
|---|---|---|---|---|
| Home `/` | 95 / 95 | 100 | 100 | — |
| Destinations list `/destinations` | 88 / 88 | 92 | 50 | มี mini-map (Leaflet) |
| Guides list `/guides` | 90 / 90 | 92 | 50 | — |
| Experiences list `/experiences` | 90 / 90 | 92 | 50 | ยังไม่มีข้อมูลจริง |
| Map `/map` | **100** / **100** | 92 | 100 | คะแนน a11y ดีที่สุดในเว็บ |
| About `/about` | 95 / 95 | 100 | 100 | — |
| Contact `/contact` | 96 / 96 | 92 | 100 | ฟอร์มมี label ถูกต้อง |
| Guide profile `/guides/alan` | 95 / 95 | 100 | 100 | มี sticky contact bar + modal |
| Destination detail `/destinations/sae-pong-lai-waterfall` | 94 / 88* | 100 | 100 / **0**\*\* | *snapshot mode ตอน modal เปิด, **agentic บน snapshot mode เท่านั้น |

---

## ส่วนที่ 1 — ปัญหาที่เจอซ้ำหลายหน้า (เรียงตามความรุนแรง × จำนวนหน้าที่กระทบ — แก้ตรงนี้ทีเดียวคุ้มสุด)

### 🔴 1. PWA install banner ("Install Alan Cafe OS") บังเนื้อหา/ปุ่มสำคัญ — **พบทุกหน้าที่ตรวจ (8/8), รุนแรงสุด 2 หน้า**

Banner เด้งขึ้นอัตโนมัติที่ล่างจอทุกครั้งที่โหลดหน้าบนมือถือ (fixed position, ไม่มี dismiss แบบถาวรที่ทดสอบได้ในเซสชันนี้) และปุ่ม "Later" เองก็ contrast ไม่ผ่าน (2.28–3.83:1 ต่ำกว่า 4.5:1 ที่ต้องการ) เจอผลกระทบต่างระดับตามหน้า:

- **บล็อกการใช้งานจริง (severity สูงสุด):**
  - **Destination detail (Sae Pong Lai)** — banner ทับปุ่ม "Contact Guide" ที่อยู่ใน flow ปกติของหน้า จนคลิกอัตโนมัติ (chrome-devtools MCP) **timeout จริง** ต้องขยับตำแหน่งเช็คใหม่ถึงคลิกได้
  - **Sae Pong Lai + Guide profile (`/guides/alan`)** — เปิด inquiry modal แล้ว banner ทับปุ่ม **"Cancel"/"Send Inquiry"** (และลิงก์ WhatsApp ใน modal ของ guide profile) อยู่นอกจอที่มองเห็น ต้อง scroll/ปิด banner ก่อนถึงจะกดส่งฟอร์มได้จริงบนมือถือ
  - **Guide profile** มีจุดเสี่ยงเพิ่ม: หน้านี้มี sticky bar ล่างจอ (ปุ่ม "Contact Guide" + ไอคอน WhatsApp) อยู่แล้ว banner มาเด้งซ้อนติดกันแทบไม่มีช่องไฟ — คลิกอัตโนมัติยังผ่านได้ แต่ควรเช็คบนมือถือจริงอีกที เพราะ hit-testing ของนิ้วอาจต่างจาก synthetic click
- **บังเนื้อหา ไม่บล็อกปุ่ม (severity กลาง):** Home (บัง tagline "Alan Coffee & Travel · Attapeu · Southern Laos"), Destinations list (บังรูปการ์ดปลายทาง), Guides list (บังจำนวน guide + การ์ดใบแรกบางส่วน), Map (บังขั้นตอนที่ 1 ของคำแนะนำ "Click any province..." + พื้นที่แผนที่ที่ใช้งานได้), About (บังย่อหน้าเนื้อหา), Contact (บังเวลาเปิด-ปิดวันเสาร์-อาทิตย์)

**ข้อเสนอสำหรับตอนแก้จริง (ยังไม่ทำตอนนี้):** ต้องแก้ตำแหน่ง/z-index ของ banner ไม่ให้ทับ interactive element ใดๆ เป็นอย่างน้อย และควรมี dismiss ที่จำค่าไว้ (เช่น `localStorage`) ไม่ให้เด้งซ้ำทุกครั้งที่โหลดหน้า — ตอนนี้เด้งทุกหน้าทุกครั้งแม้จะกด "Later" ไปแล้วในหน้าก่อน (ทดสอบข้ามหน้าแล้วเด้งใหม่ทุกครั้ง)

### 🟠 2. Contrast ของ nav language-switch buttons (EN / ລາວ / ไทย) และปุ่ม CAFEOS — **shared navbar ทุกหน้า**

ตัวหนังสือสีทอง `#c9a84c` หรือเทา `#9e9e9e` บนพื้นขาว contrast แค่ 2.28–2.67:1 (ต้องการ 4.5:1) — **Lighthouse ยืนยันเจอจริงบน Home, Guides list, Experiences list, Contact, About, Sae Pong Lai** (6 หน้า) แต่ **ไม่ขึ้น fail บน Map (ทั้ง desktop/mobile) และ Destinations list (เฉพาะ desktop)** ทั้งที่เป็น component เดียวกันทุกหน้า (ยืนยันจาก `tourism-site-theme-audit.md` ว่า navbar shared ทุกหน้า) — **สันนิษฐานว่าเป็นความไม่นิ่ง (timing) ของ Lighthouse ตอน snapshot ไม่ใช่ component จริงผ่านบนหน้านั้น** ควรถือว่าเป็นปัญหาทั้งเว็บ ไม่ใช่เฉพาะ 6 หน้าที่ Lighthouse จับได้ — แนะนำ verify ด้วยเครื่องมืออื่น (เช่น axe DevTools บนเบราว์เซอร์จริง) ก่อนตัดสินใจแก้ ถ้าอยากได้ความชัวร์ 100%

### 🟠 3. Contrast ของ footer (ลิงก์/ตัวหนังสือเทาเข้มบนพื้นดำ) — **shared footer ทุกหน้าที่ตรวจ (8/8 ที่มี footer แบบเต็ม)**

ตัวหนังสือเทา `#545454`–`#707070` บนพื้น `#0a0a0a`/`#111`/`#1a1a1a` contrast เหลือ 1.24–3.83:1 เท่านั้น (บางจุดต่ำสุด 1.24:1 คือบรรทัด "ທ່ອງທ່ຽວລາວ · ท่องเที่ยวลาว..." ท้าย footer ของ Home — อ่านแทบไม่ออกจริง) เจอที่ Home, Destinations(mobile), Guides, Experiences, About, Contact — ลิงก์ Destinations/Guides/About/Contact ในหมวด NAVIGATE ของ footer เจอทุกครั้ง

### 🟡 4. Filter `<select>` ไม่มี label ผูกไว้ — **ทุกหน้า "รายการ browsing" ที่มีตัวกรอง (3/3: Destinations, Guides, Experiences list)**

`<select class="filter-select">` (จังหวัด/สถานะ/ภาษา/ระดับ/เรียงลำดับ — รวม 9 ตัวทั่วเว็บ) ไม่มี `<label>` ผูก ทั้ง axe และ Lighthouse "Agentic Browsing" (ตัวใหม่) ต่างก็ฟ้องตัวเดียวกันตรงกัน — เป็นสาเหตุหลักที่ทำให้ 3 หน้านี้ Agentic Browsing score เหลือแค่ 50/100 (ต่ำสุดในเว็บ)

### 🟡 5. Canonical URL หายไปทั้งดวง (ไม่ใช่แค่สะกดผิดแบบที่เคยแก้ไปแล้ว) — **5/9 หน้า**

`/destinations`, `/guides`, `/experiences`, `/map`, `/contact` — ทั้ง 5 หน้านี้ **ไม่มี `rel="canonical"` เลย** (คนละปัญหากับที่ `tourism-site-theme-audit.md` เคยแก้ — รอบนั้นแก้แค่ domain สะกดผิดใน 7 ไฟล์ ซึ่งไม่ครอบคลุม list pages กับ contact page) กระทบ SEO ไม่ใช่ accessibility โดยตรง แต่เจอจาก audit เดียวกันเลยบันทึกรวมไว้

### 🟢 6. Font/asset โหลดเกินจำเป็น (unused preload) — **2 กลุ่มแยกกัน**

- **Google Tag Manager (`gtag.js`)** preload แต่ไม่ถูกใช้ทันหลังโหลดเสร็จ — เจอ 7/8 หน้า (Home, Destinations, Guides, Experiences, Map, About, Contact) — เบาแต่ทั่วเว็บ
- **ฟอนต์ 11–12 ไฟล์ (`.woff2`)** preload แต่ไม่ได้ใช้ — เจอเฉพาะหน้า template แบบ "detail" (Sae Pong Lai, Guide profile `/guides/alan`) ไม่เจอในหน้า list/landing — สันนิษฐานว่า detail-page template โหลด font weight เกินความจำเป็น

---

## ส่วนที่ 2 — ปัญหาเฉพาะหน้า (ไม่ซ้ำที่อื่น)

### Destinations list (`/destinations`)
- **Touch target เล็กเกิน:** ลิงก์ "DISCOVER →" บนการ์ดปลายทาง ขนาดจริง 87.4×**18px** (ต้องการอย่างน้อย 24×24px) — เจอเฉพาะหน้านี้ การ์ดของ Guides list ("View Profile →") ไม่โดนฟ้อง ควรเช็คด้วยตาอีกทีว่าการ์ดสองแบบต่างกันตรงไหน
- **Mini-map marker ไม่มีชื่อที่อ่านได้:** หมุด Leaflet (`role="button"`) บนแผนที่ย่อในหน้านี้ไม่มี accessible name — screen reader จะได้ยินแค่ "button" เฉยๆ ไม่รู้ว่าเป็นหมุดของที่ไหน
- Contrast บน **mobile เจอ 14 จุด แต่ desktop เจอ 0 จุด** สำหรับหน้าเดียวกัน — ผลต่างชัดกว่าปกติ (ดูข้อ 2 ด้านบนเรื่องความไม่นิ่งของ Lighthouse ประกอบ) น่าจะคุ้มที่จะ verify มือถือจริงอีกรอบ

### Destination detail (`/destinations/sae-pong-lai-waterfall`) — จากรอบตรวจก่อนหน้า
- Heading skip ระดับ: มี `<h3>` "DETAILS" โดยไม่มี `<h2>` นำหน้าตามลำดับ (เจอเฉพาะหน้านี้ในบรรดาหน้าที่ตรวจ — แต่หน้านี้ใช้ template เดียวกับปลายทางอื่นทุกที่ในอนาคต ตอนนี้ในเว็บมีปลายทางจริงแค่ 1 ที่ ยังไม่มีตัวอย่างที่ 2 ให้เทียบ)
- Inquiry modal: input วันเดือนปีเกิด ไม่มี label ผูก + ฟอร์ม 6 ช่องไม่มี `id`/`name` (Chrome Issues panel ฟ้องตรง ๆ ผ่าน console)

### Guide profile (`/guides/alan`)
- มีปุ่ม "Contact Guide" **ซ้ำ 2 จุด** ในหน้าเดียว (จุดบนใต้รูปโปรไฟล์ + sticky bar ล่างจอ) — ไม่ใช่บั๊ก accessibility โดยตรง แต่เป็นความซ้ำซ้อนของ UI ที่สังเกตเห็นระหว่างตรวจ บันทึกไว้เผื่อเป็นประโยชน์
- Inquiry modal ของหน้านี้มีลิงก์ "Or open directly: WhatsApp" เพิ่มมาที่ modal ของ Sae Pong Lai ไม่มี — modal สองหน้าเนื้อหาไม่ตรงกัน 100% (ไม่ใช่บั๊ก แค่บันทึกความต่างไว้)

### Map (`/map`)
- ภาพ tile แผนที่ (Leaflet, บุคคลที่สาม) ความละเอียดต่ำเกินไปสำหรับขนาดที่แสดงบนมือถือ (9 tile) — เป็นปัญหา Best Practices ไม่ใช่ accessibility และควบคุมได้จำกัดเพราะเป็น tile server ภายนอก

### Contact (`/contact`)
- ฟอร์มติดต่อ (Name/Email/Message) มี `<label>` ผูกถูกต้องครบ — **ไม่พบปัญหา label ที่หน้านี้** ต่างจาก inquiry modal ของหน้าอื่น (ดูข้อ Sae Pong Lai ด้านบน) น่าจะเป็นเพราะฟอร์มนี้คนละ component กับ "Contact Guide" modal

---

## ผลการแก้ไขรอบที่ 2 (2026-09-01) — เทียบก่อน-หลัง บน production จริง

| หน้า | A11y ก่อน | A11y หลัง | Agentic ก่อน | Agentic หลัง |
|---|---|---|---|---|
| Home | 95 | 95* | 100 | 100 |
| Destinations list | 88 | **93** | 50 | **100** |
| Guides list | 90 | **96** | 50 | **100** |
| Experiences list | 90 | **96** | 50 | **100** |
| Map | 100 | 100 | 100 | 100 |
| About | 95 | 95* | 100 | 100 |
| Contact | 96 | 96* | 100 | 100 |
| Guide profile | 95 | 95* | 100 | 100 |
| Destination detail (Sae Pong Lai) | 94 | 94* | 100 | 100 |

*หน้าที่ตัวเลขเท่าเดิม (Home/About/Contact/Guide profile/Destination detail) เป็นเพราะ contrast ของ navbar/footer หายไปจากรายการ fail จริง แต่บังเอิญมีจำนวนปัญหาอื่นที่ยังไม่แก้ (เช่น cream-section labels ของ About/Contact, tab button ของ guide profile) มาแทนที่พอดี — ตรวจสอบรายการ fail จริงแล้วยืนยันว่า navbar/footer ไม่ติดในรายการอีกต่อไป

**ยืนยันด้วยตาจริง:** คลิก "Contact Guide" บนหน้า Sae Pong Lai (production) สำเร็จ ไม่ timeout, modal เปิดแล้วปุ่ม Cancel/Send Inquiry มองเห็นเต็ม ไม่ถูก banner บัง — banner ถูกย้ายไปแสดงใต้ navbar (บนสุด) แทนที่จะลอยชนกับปุ่มต่างๆ ที่ก้นจอ

### สิ่งที่แก้จริง
1. **`components/InstallPrompt.tsx`** — ย้ายจาก `position:fixed;bottom:80;zIndex:9999` เป็น `top:84;zIndex:45` (ต่ำกว่า modal's zIndex 1000 และต่ำกว่า mobile menu's zIndex 49) + เพิ่ม contrast ของตัวหนังสือในการ์ดเอง (0.4→0.6 alpha) ระบบจำค่า dismiss (`localStorage`, throttle 7 วัน) มีอยู่แล้วในโค้ด ไม่ต้องเพิ่ม — ยืนยันจากการทดสอบว่าไม่เด้งซ้ำในเซสชันเดียวกันหลัง trigger ครั้งแรก
2. **`components/Navbar.tsx`** — ปุ่มภาษาที่ active + ปุ่ม CafeOS: `var(--color-gold)` → `var(--color-gold-dark)` (ปรับค่าเป็น `#826A27`, 5.19:1); ปุ่มภาษาที่ไม่ active: `var(--color-gray-400)` → `var(--color-gray-600)` (token ที่มีอยู่แล้ว, 6.9:1) ไม่แตะ `--color-gold`/`--color-gray-400` ตรงๆ เพราะใช้ร่วมกับพื้นหลังดำที่อื่นอยู่
3. **Footer (ไม่มี component ร่วมจริง — เป็น 8 ไฟล์ที่ copy โค้ดแยกกัน):** `app/page.tsx`(ผ่าน `HomeClient.tsx`), `app/guides/page.tsx`, `app/experiences/page.tsx`, `app/become-a-guide/page.tsx`, `app/contact/page.tsx`, `app/about/AboutClient.tsx`, `app/destinations/page.tsx`, `app/destinations/[slug]/DestinationDetailClient.tsx` — ปรับ `rgba(255,255,255, 0.09–0.4)` เป็น `0.6` ทุกจุด (คำนวณให้ผ่าน 4.5:1 บนพื้นมืดช่วง `#0a0a0a`–`#1a1a1a` ที่แต่ละไฟล์ใช้ พร้อม margin ปลอดภัย)
4. **9 filter `<select>`** ใน `app/destinations/page.tsx`, `app/guides/page.tsx`, `app/experiences/page.tsx` — เพิ่ม `aria-label` ทุกตัว (ไม่กระทบหน้าตา)

### Deploy
Commit `d616662` push ขึ้น `main` → GitHub Actions "Deploy to Cloudflare Pages" รันสำเร็จ (2m24s) → ยืนยันบน `alancoffeetravel.com` จริงตามตารางด้านบน

---

## ผลการแก้ไขรอบที่ 3 (2026-09-02) — ปัญหาที่เหลือทั้ง 5 ข้อ

| หน้า | A11y ก่อน (รอบ 2) | A11y หลัง (รอบ 3) | SEO ก่อน | SEO หลัง |
|---|---|---|---|---|
| Home | 95 | 95 | 100 | 100 |
| Destinations list | 93 | **96** | 92 | **100** |
| Guides list | 96 | 96 | 92 | **100** |
| Experiences list | 96 | 96 | 92 | **100** |
| Map | 100 | 100 | 92 | **100** |
| About | 95 | 95 | 100 | 100 |
| Contact | 96 | 96 | 92 | **100** |
| Guide profile | 95 | 95 | 100 | 100 |
| Destination detail (Sae Pong Lai) | 94 | **96** | 100 | 100 |

**Font preload บน production จริง (นับ `<link rel="preload" as="font">` ในเอชทีเอ็มแอลจริง):**
- Home: 12 ไฟล์ → **2 ไฟล์**
- Sae Pong Lai / Guide profile (หน้าที่เจอปัญหาหนักสุดตอนแรก): 11–12 ไฟล์ → **0 ไฟล์**
- ไม่มีไฟล์ Sarabun (ไทย) หรือ Noto Sans Lao (ลาว) ติด preload บนหน้าไหนเลยหลังแก้ (ตรวจด้วย `curl` จริงกับ production)
- gtag.js: เปลี่ยนจาก `strategy="afterInteractive"` เป็น `"lazyOnload"` แล้วไม่มี `<link rel="preload">` สำหรับ gtag ในเอชทีเอ็มแอลอีกต่อไป

**ยืนยันด้วยตาจริงอีกรอบ:** heading order บน Sae Pong Lai เป็น h1→h2→h2 แล้ว (เดิม h1→h3), คลิก "Contact Guide" ยังใช้งานได้ปกติไม่ timeout (ไม่กระทบจากการแก้รอบนี้)

### สิ่งที่แก้จริง
1. **Canonical URL หายทั้งดวง** — ต้นเหตุจริงคือ `/destinations` `/guides` `/experiences` `/map` `/contact` เป็น **Client Component ที่ page.tsx เอง** (`'use client'` ตรงๆ) ซึ่ง Next.js ไม่อนุญาตให้ export `metadata` จาก Client Component ได้เลย ไม่ใช่แค่ลืมใส่ — แก้โดยแยกเป็น Server Component `page.tsx` บางๆ (export `metadata.alternates.canonical` แบบเดียวกับ `/` และ `/about`) + ย้ายโค้ดเดิมทั้งหมดไปเป็น `XxxClient.tsx` (`DestinationsClient.tsx`, `GuidesClient.tsx`, `ExperiencesClient.tsx`, `ContactClient.tsx`, `MapClient.tsx`) ไม่แตะ logic เดิมเลย
2. **Touch target เล็กเกิน** — ลิงก์ "DISCOVER →" ใน `DestinationsClient.tsx`: เพิ่ม `padding` + `margin` ติดลบเท่ากันเพื่อขยายพื้นที่แตะเป็น 44×44px โดยไม่ขยับตำแหน่ง/ขนาดตัวอักษรที่เห็น; `<select>`/`<input>` ทั้งหมดใน 3 หน้า list: เพิ่ม `minHeight: 44px` เข้าไปใน `selectStyle`/`selStyle` ที่ใช้ร่วมกันอยู่แล้ว จุดเดียวจบทั้งไฟล์
3. **Leaflet marker ไม่มีชื่อ** — ทั้ง `components/DestinationMap.tsx` (mini-map) และ `app/map/MapClient.tsx` (หน้า `/map` เต็ม): เพิ่ม `alt` ใน marker options (สำหรับ marker ที่เป็น `<img>`) **และ** `marker.getElement()?.setAttribute('aria-label'|'title', ...)` เพิ่มอีกชั้น เพราะ `alt` ของ Leaflet ใช้ไม่ได้กับ divIcon ที่เรนเดอร์เป็น `<div>` (ไม่ใช่ `<img>`) — ชื่อที่ใส่คือ "ชื่อสถานที่ — จังหวัด/อำเภอ"
4. **Heading order ข้ามระดับ** — `DestinationDetailClient.tsx`: เปลี่ยน `<h3>` ของการ์ด "DETAILS" และ "Alan Travel Standard" เป็น `<h2>` ทำให้ลำดับเป็น h1→h2→h2→h2 (h2 "Available Guides" เดิม) ไม่ข้ามระดับอีก
5. **Font/gtag preload เกินจำเป็น** — `app/layout.tsx`: Sarabun (ไทย) กับ Noto Sans Lao ตั้ง `preload: false` เพราะภาษา default ของเว็บคือ `en` การโหลดหน้าส่วนใหญ่ไม่ได้ใช้ตัวอักษรไทย/ลาวเลย (ฟอนต์ยังโหลดได้ปกติตอนสลับภาษา แค่ไม่ preload ล่วงหน้า); gtag.js script tag เปลี่ยน `strategy` จาก `afterInteractive` เป็น `lazyOnload`

### ข้อจำกัดของการยืนยันรอบนี้
ไม่สามารถทดสอบคลิกหมุด (marker) บนหน้า `/map` แบบ end-to-end อัตโนมัติได้จริง เพราะต้องคลิกลาก polygon จังหวัด→อำเภอก่อนหมุดจะโผล่ ซึ่ง Leaflet ใช้ event system ของตัวเองที่ synthetic click ผ่าน DevTools MCP จำลองแทนไม่ได้ตรงๆ — ยืนยันด้วยการอ่านโค้ดแทนว่าใช้ pattern เดียวกับ mini-map ที่ยืนยันผ่านแล้วจริงทุกตัวอักษร (ยกเว้นชื่อ label ที่ใส่จังหวัด/อำเภอต่างกันตามบริบทของแต่ละไฟล์)

### Deploy
Commit `2d449f1` push ขึ้น `main` → GitHub Actions "Deploy to Cloudflare Pages" รันสำเร็จ (2m23s) → ยืนยันด้วย `curl` + Chrome DevTools MCP บน `alancoffeetravel.com` จริงตามตารางด้านบน

---

## หมายเหตุวิธีตรวจ / ข้อจำกัด

- ใช้ `chrome-devtools` MCP รันบน Chromium ของ Playwright ที่มีอยู่ในเครื่องนี้แล้ว (ไม่มี Chrome/Edge ติดตั้งจริงบนเครื่อง) — ผล Lighthouse ควรใกล้เคียงเบราว์เซอร์จริงมาก แต่ไม่ใช่ Chrome stable เป๊ะๆ
- คะแนนบางหน้าขึ้น "ผ่าน" ใน Lighthouse ทั้งที่ component เดียวกัน "ไม่ผ่าน" ที่หน้าอื่น (nav contrast, destinations desktop-vs-mobile) — เป็นความไม่นิ่งของเครื่องมือ ไม่ใช่หลักฐานว่าหน้านั้นแก้ปัญหาแล้วจริง ระบุไว้ในแต่ละจุดแล้ว
- ยังไม่ได้ตรวจ keyboard navigation แบบ manual (tab order, focus trap ของ modal) เพราะโจทย์รอบนี้เน้น Lighthouse + console/network — ถ้าต้องการความมั่นใจเรื่อง modal focus trap ต้องตรวจเพิ่มแยกต่างหาก
