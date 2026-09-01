# เว็บท่องเที่ยว Alan Coffee & Travel — ตรวจธีมจริง + สถานะโดเมน (ก่อนเริ่มรีแวมป์)

> ตรวจ 2026-09-01 โดยอ่านโค้ดจริง + เปิดเว็บจริงผ่านเบราว์เซอร์ (ทั้ง production domain และ dev server ในเครื่อง) แล้วแคปหน้าจอทุกหน้าหลัก — ไม่ใช่เดาจาก CLAUDE.md หรือรายงานรอบก่อน

---

## ส่วนที่ 1 — โดเมนไหนคือของจริง (เช็คด่วนแล้ว ยืนยัน 100%)

### สรุปคำตอบ

**`alancoffeetravel.com` (ไม่มีขีด) คือโดเมน production จริงที่ใช้งานอยู่** ยืนยันจาก 3 ทาง ตรงกันหมด:

1. **DNS resolve จริง** — `alancoffeetravel.com` ชี้ไปที่ Cloudflare IP จริง (`172.67.146.32`, `104.21.10.169` + IPv6 range ของ Cloudflare) ส่วน `alan-coffee-travel.com` (มีขีด) **ไม่ resolve เลย — NXDOMAIN** (ไม่ใช่แค่ deploy ไม่ถึง แต่ไม่มี DNS record ใดๆ ทั้งสิ้น เหมือนไม่เคยจดโดเมนนี้ หรือไม่เคยตั้งค่า DNS zone)
2. **เปิดจริงในเบราว์เซอร์** — `https://alancoffeetravel.com` โหลดเว็บจริงขึ้นมา (หน้า "Discover Laos. Travel Deeply." พร้อม navbar/hero/เนื้อหาครบ) ส่วน `https://alan-coffee-travel.com` เบราว์เซอร์ขึ้น DNS error ทันที (จอ error ที่ Chrome สร้างเอง ไม่ใช่หน้าเว็บของเรา)
3. **โค้ดในโปรเจกต์เองก็ยืนยัน** — `middleware.ts` บรรทัด 23 มี comment ของทีมเขียนไว้ตรงๆ ว่า *"The host is 'alancoffeetravel.com'"* สำหรับ production — แปลว่าทีมพัฒนารู้อยู่แล้วว่านี่คือโดเมนจริง

**ข้อสรุป: `alancoffeetravel.com` ที่คุณทดสอบมาทั้งวันคือของจริง ใช้งานได้จริง ถูกต้องแล้ว**

### 🐛 บั๊กที่เจอระหว่างตรวจ (ควรแก้)

**1. Metadata/SEO ทั้งเว็บอ้างอิงโดเมนผิด** — ไฟล์ 7 ไฟล์นี้ใช้ `alan-coffee-travel.com` (โดเมนที่ไม่มีจริง) เป็น canonical URL / OpenGraph URL / sitemap:
   - `app/layout.tsx`, `app/page.tsx`, `app/about/page.tsx`, `app/sitemap.ts`
   - `app/destinations/[slug]/page.tsx`, `app/guides/[slug]/page.tsx`, `app/experiences/[slug]/page.tsx`

   ผลกระทบจริง: Google/Facebook/Twitter ที่ไป fetch canonical URL หรือ sitemap.xml จะเจอโดเมนที่ไม่มีตัวตน — กระทบ SEO และการแชร์ลิงก์บนโซเชียล

   **✅ แก้แล้ว (2026-09-01)** — เปลี่ยนทั้ง 7 ไฟล์เป็น `https://alancoffeetravel.com` (ไม่มีขีด) นอกจากนี้ยังตัด `www.` ออกด้วย เพราะเช็ค DNS จริงพบว่า `www.alancoffeetravel.com` **ก็ไม่ resolve เช่นกัน (NXDOMAIN)** — มีแค่ apex domain (`alancoffeetravel.com` เปล่าๆ) ที่ตอบ 200 จริง ถ้าใส่ `www.` เข้าไปแม้จะสะกดถูกก็ยังชี้ไป host ที่ไม่มีอยู่จริงอยู่ดี — และแก้ `public/robots.txt` (Sitemap/Host directive) ที่มีบั๊กเดียวกันแต่ไม่ได้อยู่ใน 7 ไฟล์ที่ระบุไว้ตอนแรกด้วย
   ยืนยันด้วย `npm run build` จริง (46/46 static pages generate สำเร็จ) แล้วอ่าน HTML ที่ build ออกมาโดยตรง: `.next/server/app/index.html` และ `about.html` มี `rel="canonical" href="https://alancoffeetravel.com..."` และ `property="og:url" content="https://alancoffeetravel.com..."` ถูกต้อง, `.next/server/app/sitemap.xml.body` มี `<loc>https://alancoffeetravel.com...</loc>` ถูกต้องทุก entry

**2. เจอ `ChunkLoadError` ตอนเปิดครั้งแรก (โหลดครั้งเดียว ไม่ persistent)** — เปิด `https://alancoffeetravel.com` ครั้งแรกจากแคชเบราว์เซอร์เจอ `ChunkLoadError: Loading chunk 8974 failed` (หน้าเว็บ crash เป็น "Application error") กด hard refresh (`Ctrl+Shift+R`) แล้วกลับมาใช้งานได้ปกติทันที — เป็นอาการมาตรฐานของ Next.js เมื่อเบราว์เซอร์แคช HTML เก่าไว้แล้วอ้างอิง JS chunk hash ที่ถูกลบไปหลัง deploy รอบใหม่ทับ **ไม่ใช่เว็บพัง แต่เป็นความเสี่ยงจริงที่ผู้ใช้บางคนอาจเจอหน้าขาวหลังมีการ deploy ใหม่จนกว่าจะ refresh** — ไม่ใช่เรื่องด่วนที่ต้องแก้ตอนนี้ แค่บันทึกไว้ให้ทราบ

### ข้อจำกัดของการตรวจนี้
ไม่มีสิทธิ์เข้าถึง Cloudflare Pages dashboard โดยตรงจากเครื่องนี้ (ไม่มี `CLOUDFLARE_API_TOKEN` ตั้งไว้ให้ wrangler CLI ใช้ auth และ MCP server `cloudflare-builds` ที่ตั้งไว้ใน `.mcp.json` ยังไม่ได้เชื่อมต่อในเซสชันนี้) จึงไม่สามารถดึงรายการ "custom domains" ที่ตั้งค่าไว้ในหน้า dashboard ตรงๆ ได้ตามที่ขอในข้อ 1 — แต่หลักฐาน DNS + เบราว์เซอร์จริง + comment ในโค้ดข้างบนเพียงพอที่จะสรุปคำตอบได้ชัดเจนแล้วโดยไม่ต้องพึ่ง dashboard ถ้าต้องการดูรายการ custom domain แบบเป๊ะๆ ต้อง login เข้า Cloudflare dashboard เองหรือให้ CLOUDFLARE_API_TOKEN มา

---

## ส่วนที่ 2 — กฎธีม (ตัดสินใจแล้ว: คงความหลากหลาย แต่บังคับให้สม่ำเสมอภายในกลุ่ม)

พื้นฐานจาก `app/globals.css`: `body` ตั้ง `background-color: var(--background)` = `#faf8f4` (ครีม) เป็นค่าเริ่มต้นของทั้งเว็บ แต่ละหน้าโอเวอร์ไรด์เป็น `var(--color-black)`/`#0a0a0a`/`#111` ในบางส่วนตามกลุ่มด้านล่าง

### กฎที่ใช้ยึดทุกหน้า (ไม่มีข้อยกเว้น)
- **Navbar บนสุด = ขาว/ครีม พื้นหลัง ตัวอักษรดำ ปุ่มทอง/ดำ เสมอทุกหน้า ไม่ขึ้นกับกลุ่ม A/B** ไม่มีข้อยกเว้นจากเนื้อหาข้างล่างว่าจะมืดแค่ไหน — เหตุผล: navbar ครีมทำหน้าที่เป็นจุดยึดสายตา/ทางออกที่สม่ำเสมอทั้งเว็บ ผู้ใช้ต้องหาทางกลับ/สลับหน้าได้จากจุดเดิมเสมอไม่ว่าจะอยู่หน้าไหน (ตัดสินใจแล้ว 2026-09-01 หลังพบว่า `/map` เคยไม่ตรงกับเพื่อนกลุ่ม B — ดูรายละเอียดด้านล่าง) กรณีเดียวที่แยกธีม navbar ไปเลยคือ `pos-product` ซึ่งเป็นแอป SaaS คนละหมวดจากเว็บท่องเที่ยว ไม่นับเป็นข้อยกเว้นของกฎนี้
- **Footer = มืด (ดำ) เสมอ** ทุกหน้า ไม่มีข้อยกเว้น
- **Hero section แรกสุดใต้ navbar = มืดเสมอ** ทุกหน้า ไม่มีข้อยกเว้น
- สีทอง `#c9a84c` เป็น accent เดียวกันทั้งฝั่งมืดและฝั่งครีม

### กลุ่ม A — "หน้าข้อมูล/แลนดิ้ง" (สลับมืด-ครีมเป็นจังหวะ)

**สมาชิกกลุ่ม:** Home (`/`), About (`/about`), Contact (`/contact`), Destination detail (`/destinations/[slug]`)

**Pattern มาตรฐาน (ใช้เป็นแม่แบบตอนออกแบบหน้าใหม่ในกลุ่มนี้):**
```
Navbar (ครีม, fixed)
  ↓
Hero — มืด เสมอ (eyebrow gold caps + headline ขาว/ทอง + subtext เทา)
  ↓
เนื้อหาสลับตามจำนวน section จริงของหน้านั้น:
  - หน้าสั้น/editorial (About, Contact): มืด(hero) → ครีม(เนื้อหาหลักยาวรวดเดียว) → ดำ(footer)
    กล่าวคือมีแค่ 1 จุดเปลี่ยนสี (มืด→ครีม) ก่อนเข้า footer
  - หน้ายาว/มีหลาย section (Home): มืด(hero) → ครีม(grid/card block) → มืด(CTA block)
    → ครีม(อีก grid/card block) → มืด(CTA สุดท้าย + footer) — สลับสีทุกครั้งที่ขึ้น section ใหม่
    ที่มีจุดประสงค์ต่างกัน (การ์ดโชว์สินค้า vs. CTA เรียกให้ทำอะไรสักอย่าง)
  - หน้า detail ที่มีการ์ดข้อมูลลอย (Destination detail): มืด(hero/breadcrumb/รูป)
    → ครีม(กล่องบรรยาย) ซึ่งมีการ์ดข้อมูลย่อยสีมืดวางซ้อนอยู่ด้านในได้ (การ์ดมืดบนพื้นครีม ไม่ใช่ทั้ง section)
    → มืด(guides/related section) → มืด(footer)
  ↓
Footer — มืด เสมอ
```
**กฎเลือกสีของแต่ละ section:** section ที่เป็น "โชว์เนื้อหา/อ่านยาว" (บรรยาย, การ์ดข้อมูลลิสต์สั้นๆ, ฟอร์ม) → ครีม เพื่ออ่านง่าย ส่วน section ที่เป็น "hero/CTA/ปิดท้ายให้ action" → มืด เพื่อเน้นความสำคัญ ใช้หลักนี้ตัดสินสีของ section ใหม่ๆ ที่จะเพิ่มเข้าไปในหน้ากลุ่ม A

### กลุ่ม B — "หน้าเรียกดู/browsing" (มืดล้วน ไม่มีครีมเลย)

**สมาชิกกลุ่ม:** Destinations list (`/destinations`), Guides list (`/guides`), Experiences list (`/experiences`), Map (`/map`) — ตรวจเพิ่มครบแล้วทั้ง 2 หน้าที่ค้างไว้

**Pattern มาตรฐาน:**
```
Navbar (ครีม เหมือนกันทุกหน้าในกลุ่ม รวม /map) → Hero มืด → filter bar มืด → grid/list การ์ดมืดทั้งหมด
  → (ถ้ามี) CTA section ปิดท้ายมืด → Footer มืด
```
ไม่มีจุดเปลี่ยนเป็นครีมเลยตลอดทั้งหน้า การ์ดแต่ละใบใช้โทนมืดเข้มกว่าพื้นหลังเล็กน้อย (เช่น `#111` บนพื้น `#0a0a0a`) เพื่อสร้างมิติ ไม่ใช่เปลี่ยนธีม

**หมายเหตุ Experiences list:** ยังไม่มีข้อมูลจริง (ขึ้น "0 experiences" / "No experiences found") แต่โครงสร้างหน้าที่มีอยู่แล้วเป็นมืดล้วนตรงตามกลุ่ม B ครบถ้วน — ใช้แม่แบบเดียวกับ Destinations/Guides list ได้เลยเมื่อมีข้อมูลจริง

**✅ แก้แล้ว/ยืนยันแล้ว (2026-09-01):** ตัดสินใจแล้วว่า `/map` ต้องใช้ navbar ครีมเหมือนเพื่อนกลุ่ม B ที่เหลือ (Destinations/Guides/Experiences list) ไม่ใช่ดึงทั้งกลุ่มไปเป็นดำ — เหตุผลอยู่ในกฎด้านบน (navbar = จุดยึดสายตา/ทางออกที่สม่ำเสมอ)

ตรวจโค้ดจริงพบว่า `app/map/page.tsx` **ใช้ shared `<Navbar />` component เดียวกับหน้าอื่นอยู่แล้ว** ไม่มี dark-theme override ใดๆ ในโค้ด — แก้ไปแล้วตั้งแต่ commit `03065cb` (2026-08-25, "unify /map navbar") ซึ่งอยู่ใน `main` ปัจจุบันแล้ว เช็คบน production จริงผ่านเบราว์เซอร์ (`getComputedStyle` บน `<nav>` ของทั้ง `/map` และ `/destinations`) ยืนยันตรงกัน: `background-color: rgb(255, 255, 255)` ทั้งคู่ — **ไม่ต้องแก้โค้ดเพิ่ม เพียงบันทึกกฎไว้กันหลุดในอนาคต** (รายงานเดิมที่บอกว่า `/map` navbar ดำอาจมาจากแคชเบราว์เซอร์เก่าตอนตรวจ — ดูบั๊ก ChunkLoadError/แคชด้านบนประกอบ)

### pos-product — แยกธีมต่างหาก ไม่รวมในกลุ่ม A/B
`pos-product` (`/pos-product`, หน้าขาย SaaS ให้ร้านอื่น) ยืนยันแล้วว่าเป็นธีมดำ-ทองเดียวกับ POS ภายใน ไม่ต้องปรับให้เข้ากับกลุ่มไหนของเว็บท่องเที่ยว

---

## สรุปสถานะ (สำหรับใช้เป็น input งานรีดีไซน์)

| รายการ | สถานะ |
|---|---|
| โดเมนจริงคือ `alancoffeetravel.com` (ไม่มีขีด) | ✅ ยืนยัน 100% |
| เว็บ production ใช้งานได้ปกติ | ✅ ยืนยัน (มี ChunkLoadError เป็นครั้งคราวหลัง deploy ใหม่ — ไม่ block) |
| Metadata/sitemap อ้างอิงโดเมนผิด (`alan-coffee-travel.com`) | ✅ แก้แล้ว 2026-09-01 (7 ไฟล์ + robots.txt, ตัด www. ออกด้วยเพราะไม่ resolve) |
| กลุ่ม A (Home/About/Contact/Destination detail) — pattern สลับมืด-ครีม | ✅ บันทึกเป็นมาตรฐานแล้ว |
| กลุ่ม B (Destinations/Guides/Experiences list, Map) — มืดล้วน | ✅ บันทึกเป็นมาตรฐานแล้ว |
| Navbar = ครีมเสมอทุกหน้า ไม่ขึ้นกับกลุ่ม A/B (รวม `/map`) | ✅ ตัดสินใจแล้ว + ยืนยันตรงกับ production จริง 2026-09-01 |
| pos-product | ✅ ยืนยันแยกธีม ไม่ต้องปรับ |
