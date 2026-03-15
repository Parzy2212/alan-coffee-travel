import type { Lang } from '@/contexts/LanguageContext'

type S = { en: string; lo: string; th: string }

const strings: Record<string, S> = {
  // ── Navbar ──────────────────────────────────────────────────────────
  nav_home:          { en: 'Home',             lo: 'ໜ້າຫຼັກ',      th: 'หน้าแรก'     },
  nav_destinations:  { en: 'Destinations',     lo: 'ສະຖານທີ່',     th: 'จุดหมาย'     },
  nav_guides:        { en: 'Guides',           lo: 'ມັກກ້ຽວ',      th: 'ไกด์'        },
  nav_map:           { en: 'Map',              lo: 'ແຜນທີ່',       th: 'แผนที่'      },
  nav_about:         { en: 'About',            lo: 'ກ່ຽວກັບ',      th: 'เกี่ยวกับ'   },
  nav_contact:       { en: 'Contact',          lo: 'ຕິດຕໍ່',       th: 'ติดต่อ'      },

  // ── Hero ─────────────────────────────────────────────────────────────
  // Eyebrow is a trilingual brand mark — intentionally kept the same across all versions
  hero_eyebrow: {
    en: 'ທ່ອງທ່ຽວລາວ · Laos Travel · ท่องเที่ยวลาว',
    lo: 'ທ່ອງທ່ຽວລາວ · Laos Travel · ท่องเที่ยวลาว',
    th: 'ທ່ອງທ່ຽວລາວ · Laos Travel · ท่องเที่ยวลาว',
  },
  hero_h1_line1: {
    en: 'Discover Laos.',
    lo: 'ສຳຫຼວດລາວ.',
    th: 'สัมผัสลาว.',
  },
  hero_h1_line2: {
    en: 'Travel Deeply.',
    lo: 'ທ່ຽວໃຫ້ຄຸ້ມ.',
    th: 'เที่ยวให้สุดใจ.',
  },
  hero_sub: {
    en: 'From a quiet café in Attapeu — the only travel-focused coffeehouse in Southern Laos — we find the places worth going, connect you with guides who actually know the land, and share the roads most travelers never find.',
    lo: 'ຈາກຮ້ານກາເຟໃນອັດຕະປື — ຮ້ານດຽວໃນລາວໃຕ້ທີ່ຕັ້ງໃຈຊ່ວຍນັກທ່ຽວ — ເຮົາຊ່ວຍຫາບ່ອນທ່ຽວດີໆ, ແນະນຳມັກກ້ຽວທ້ອງຖິ່ນທີ່ໄວ້ໃຈໄດ້, ແລະ ພາໄປຮູ້ຈັກເສັ້ນທາງທ່ຽວທີ່ຄົນສ່ວນໃຫຍ່ຍັງບໍ່ທັນຮູ້.',
    th: 'จากร้านกาแฟเล็กๆ ในอัตตะปือ — ร้านเดียวในลาวใต้ที่อยู่เพื่อนักเดินทางโดยเฉพาะ — เราคัดสรรสถานที่ที่ควรไป แนะนำไกด์ท้องถิ่นที่ไว้ใจได้ และพาคุณค้นพบเส้นทางที่คนส่วนใหญ่ไม่เคยรู้จัก',
  },
  hero_cta_explore: {
    en: 'Explore Destinations',
    lo: 'ເບິ່ງບ່ອນທ່ຽວ',
    th: 'สำรวจจุดหมาย',
  },
  hero_cta_map: {
    en: 'View the Map →',
    lo: 'ເບິ່ງແຜນທີ່ →',
    th: 'ดูแผนที่ →',
  },
  hero_trust: {
    en: 'Alan Coffee & Travel · Attapeu · Southern Laos',
    lo: 'ອາລັນ ກາເຟ & ທ່ຽວ · ອັດຕະປື · ລາວໃຕ້',
    th: 'Alan Coffee & Travel · อัตตะปือ · ลาวใต้',
  },
  scroll: {
    en: 'Scroll',
    lo: 'ເລື່ອນລົງ',
    th: 'เลื่อนลง',
  },

  // ── Stats ────────────────────────────────────────────────────────────
  stat_provinces:    { en: 'Provinces',    lo: 'ແຂວງ',          th: 'จังหวัด'      },
  stat_districts:    { en: 'Districts',    lo: 'ເມືອງ',         th: 'อำเภอ'        },
  stat_destinations: { en: 'Destinations', lo: 'ບ່ອນທ່ຽວ',      th: 'จุดหมาย'      },
  stat_homebase:     { en: 'Home Base',    lo: 'ຖານທີ່ຕັ້ງ',    th: 'ฐานที่ตั้ง'   },

  // ── Featured destinations ────────────────────────────────────────────
  section_curated:  {
    en: 'Curated Places',
    lo: 'ບ່ອນທ່ຽວທີ່ເລືອກໄວ້ໃຫ້',
    th: 'สถานที่คัดสรรมาเพื่อคุณ',
  },
  section_featured: {
    en: 'Featured Destinations',
    lo: 'ບ່ອນທ່ຽວແນະນຳ',
    th: 'จุดหมายแนะนำ',
  },
  view_all_dest: {
    en: 'All destinations →',
    lo: 'ເບິ່ງທຸກບ່ອນ →',
    th: 'ดูจุดหมายทั้งหมด →',
  },
  dest_coming_soon: {
    en: 'More places on the way.',
    lo: 'ກຳລັງເພີ່ມບ່ອນທ່ຽວໃໝ່.',
    th: 'กำลังเพิ่มจุดหมายใหม่เร็วๆ นี้',
  },
  not_assessed: {
    en: 'Not yet rated',
    lo: 'ຍັງບໍ່ທັນໃຫ້ຄະແນນ',
    th: 'ยังไม่ได้ให้คะแนน',
  },
  discover_arrow: {
    en: 'Explore →',
    lo: 'ເບິ່ງລາຍລະອຽດ →',
    th: 'ดูเพิ่มเติม →',
  },

  // ── Alan Travel Standard ─────────────────────────────────────────────
  standard_eyebrow: {
    en: 'The Alan Travel Standard',
    lo: 'ມາດຕະຖານ Alan Travel',
    th: 'มาตรฐาน Alan Travel',
  },
  standard_h2_line1: {
    en: 'Every destination earns',
    lo: 'ທຸກບ່ອນທ່ຽວຕ້ອງ',
    th: 'ทุกที่ที่อยู่ที่นี่',
  },
  standard_h2_line2: {
    en: 'its place here.',
    lo: 'ຜ່ານດ້ວຍຕົນເອງ.',
    th: 'ผ่านมาตรฐานจริงๆ.',
  },
  standard_cta: {
    en: 'See Rated Destinations',
    lo: 'ເບິ່ງບ່ອນທ່ຽວທີ່ຜ່ານມາດຕະຖານ',
    th: 'ดูจุดหมายที่ผ่านการประเมิน',
  },
  standard_note: {
    en: 'Honest ratings only. No sponsorships, ever.',
    lo: 'ຄະແນນຂອງເຮົາເປັນກາງ — ບໍ່ມີໃຜຈ່າຍໃຫ້.',
    th: 'คะแนนจริง ไม่มีสปอนเซอร์ ไม่เคยมี',
  },

  // ── Steps ─────────────────────────────────────────────────────────────
  step1_title: {
    en: 'We go there ourselves.',
    lo: 'ເຮົາໄປຕົ້ວເອງທຸກບ່ອນ.',
    th: 'เราลงพื้นที่เองทุกที่',
  },
  step1_desc: {
    en: "Every place on this site has been visited by our team before it goes live. No borrowed reviews. No educated guesses. If we haven't been there, it isn't here.",
    lo: 'ທຸກບ່ອນທ່ຽວໃນເວັບນີ້ — ທີມງານຂອງເຮົາໄປຮອດດ້ວຍຕົນເອງກ່ອນ. ບໍ່ໄດ້ເອົາຂໍ້ມູນຈາກທາງອ້ອມ. ຖ້າເຮົາຍັງບໍ່ທັນໄປ, ກໍຈະຍັງບໍ່ລົງໃນນີ້.',
    th: 'ทุกสถานที่ในเว็บนี้ ทีมงานเราเดินทางไปสำรวจด้วยตัวเองก่อนเสมอ ไม่มีรีวิวมือสอง ไม่มีการเดาเอา ถ้าเรายังไม่ได้ไป ก็จะยังไม่อยู่ที่นี่',
  },
  step2_title: {
    en: 'We rate what actually matters.',
    lo: 'ເຮົາໃຫ້ຄະແນນ 5 ດ້ານ.',
    th: 'เราวัดผลใน 5 มิติ',
  },
  step2_desc: {
    en: 'Experience, Accessibility, Authenticity, Tranquility, and Traveler Value — five dimensions, each scored 1–5 against a standard we built from the ground up in Attapeu.',
    lo: 'ປະສົບການ, ການເດີນທາງເຂົ້າຮອດ, ຄວາມເປັນຕົ້ນສະບັບ, ຄວາມສະຫງົບ, ແລະ ຄວາມຄຸ້ມຄ່າ — ແຕ່ລະດ້ານໃຫ້ຄະແນນ 1–5 ຕາມມາດຕະຖານທີ່ເຮົາສ້າງຂຶ້ນເອງໃນອັດຕະປື.',
    th: 'ประสบการณ์ การเข้าถึง ความเป็นเอกลักษณ์ ความสงบ และความคุ้มค่า — ห้ามิติที่วัดด้วยมาตรฐาน 1–5 ที่เราพัฒนาขึ้นเองจากอัตตะปือ',
  },
  step3_title: {
    en: "If it doesn't pass, it isn't here.",
    lo: 'ຖ້າບໍ່ຜ່ານ, ກໍຍັງບໍ່ລົງ.',
    th: 'ไม่ผ่าน ก็ไม่ลง',
  },
  step3_desc: {
    en: "No paid placements. No inflated scores. Every destination here cleared a bar most places can't reach — and that's exactly the point.",
    lo: 'ບໍ່ມີການຈ່າຍຕຳແໜ່ງ. ຄະແນນບໍ່ໄດ້ບວກໃຫ້. ທຸກບ່ອນທ່ຽວທີ່ຢູ່ໃນນີ້ — ຜ່ານມາດຕະຖານຂອງເຮົາແທ້ໆ. ນັ້ນຄືໃຈຄວາມ.',
    th: 'ไม่มีสปอนเซอร์ ไม่มีการบวกคะแนน ทุกสถานที่ที่อยู่ที่นี่ผ่านมาตรฐานจริงๆ — และนั่นคือสิ่งที่ทำให้ที่นี่ต่างออกไป',
  },

  // ── Guides ───────────────────────────────────────────────────────────
  section_local: {
    en: 'People Who Know the Land',
    lo: 'ຄົນທ້ອງຖິ່ນທີ່ຮູ້ຈັກດີ',
    th: 'คนท้องถิ่นที่รู้จักดีที่สุด',
  },
  section_guides: {
    en: 'Verified Local Guides',
    lo: 'ມັກກ້ຽວທ້ອງຖິ່ນທີ່ໄວ້ໃຈໄດ້',
    th: 'ไกด์ท้องถิ่นที่ผ่านการรับรอง',
  },
  view_all_guides: {
    en: 'All guides →',
    lo: 'ເບິ່ງທຸກຄົນ →',
    th: 'ดูไกด์ทั้งหมด →',
  },
  meet_all_guides: {
    en: 'Meet All Guides',
    lo: 'ພົບທຸກຄົນ',
    th: 'พบไกด์ทุกคน',
  },
  label_languages:   { en: 'Languages',   lo: 'ພາສາ',          th: 'ภาษา'           },
  label_specialties: { en: 'Specialties', lo: 'ຄວາມຊ່ຽວຊານ',   th: 'ความเชี่ยวชาญ'  },

  // ── Map teaser ───────────────────────────────────────────────────────
  map_eyebrow: {
    en: 'Interactive Map',
    lo: 'ແຜນທີ່ອອນໄລ',
    th: 'แผนที่ออนไลน์',
  },
  map_h2_line1: {
    en: 'All 18 provinces.',
    lo: 'ທັງ 18 ແຂວງ.',
    th: 'ทุก 18 จังหวัด.',
  },
  map_h2_line2: {
    en: 'One map.',
    lo: 'ໃນແຜນທີ່ດຽວ.',
    th: 'บนแผนที่เดียว.',
  },
  map_desc: {
    en: 'Tap a province, explore its districts. Tap a district, find pinned destinations with GPS coordinates you can use in the field. From Phongsali in the far north to Champasack along the Mekong — every corner of Laos, laid out.',
    lo: 'ກົດທີ່ແຂວງ, ເຫັນເມືອງ. ກົດທີ່ເມືອງ, ເຫັນບ່ອນທ່ຽວພ້ອມ GPS. ຕັ້ງແຕ່ຜົ້ງສາລີທາງເໜືອ ຈົນຮອດຈຳປາສັກທາງໃຕ້ — ລາວທັງໝົດ, ໃນທັດສະນະດຽວ.',
    th: 'คลิกจังหวัด ดูอำเภอ คลิกอำเภอ ดูจุดหมายพร้อมพิกัด GPS ที่ใช้งานได้จริง ตั้งแต่ผ้งสาลีทางเหนือสุดถึงจำปาสักริมโขง — ลาวทั้งหมด ในมุมเดียว',
  },
  map_cta: {
    en: 'Open the Map',
    lo: 'ເປີດແຜນທີ່',
    th: 'เปิดแผนที่',
  },

  // ── Footer ───────────────────────────────────────────────────────────
  footer_tagline: {
    en: "A café built for travelers in Attapeu — come for the coffee, leave knowing exactly where to go next.",
    lo: 'ຮ້ານກາເຟທີ່ຕັ້ງໃຈຊ່ວຍນັກທ່ຽວໃນອັດຕະປື — ແວ່ຍຄຸຍ, ດື່ມກາເຟ, ແລ້ວໄປທ່ຽວຕໍ່.',
    th: 'ร้านกาแฟในอัตตะปือที่มีไว้เพื่อนักเดินทาง — แวะดื่มกาแฟ แล้วออกเดินทางต่ออย่างมั่นใจ',
  },
  footer_location: {
    en: 'Attapeu Province · Southern Laos',
    lo: 'ແຂວງອັດຕະປື · ລາວໃຕ້',
    th: 'จังหวัดอัตตะปือ · ลาวใต้',
  },
  footer_hours: {
    en: 'Mon–Fri 8:00–18:00 · Sat–Sun 9:00–17:00',
    lo: 'ຈ–ສ 8:00–18:00 · ອາທິດ 9:00–17:00',
    th: 'จ–ศ 8:00–18:00 · ส–อ 9:00–17:00',
  },
  footer_nav:     { en: 'Navigate', lo: 'ລາຍການ',   th: 'เมนู'        },
  footer_company: { en: 'Company',  lo: 'ກ່ຽວກັບ',  th: 'เกี่ยวกับเรา' },
  footer_copy: {
    en: '© 2025 Alan Coffee & Travel — Attapeu, Laos',
    lo: '© 2025 ອາລັນ ກາເຟ & ທ່ຽວ — ອັດຕະປື, ລາວ',
    th: '© 2025 Alan Coffee & Travel — อัตตะปือ, ลาว',
  },
}

export function tr(key: keyof typeof strings, lang: Lang): string {
  return strings[key][lang]
}
