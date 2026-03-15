import type { Lang } from '@/contexts/LanguageContext'

type S = { en: string; lo: string; th: string }

const strings: Record<string, S> = {
  // ── Navbar ──────────────────────────────────────────────────────────
  nav_home:          { en: 'Home',                    lo: 'ໜ້າຫຼັກ',                   th: 'หน้าแรก'                },
  nav_destinations:  { en: 'Destinations',            lo: 'ສະຖານທີ່',                  th: 'จุดหมาย'                },
  nav_guides:        { en: 'Guides',                  lo: 'ມັກກ້ຽວ',                   th: 'ไกด์'                   },
  nav_map:           { en: 'Map',                     lo: 'ແຜນທີ່',                    th: 'แผนที่'                 },
  nav_about:         { en: 'About',                   lo: 'ກ່ຽວກັບ',                   th: 'เกี่ยวกับ'              },
  nav_contact:       { en: 'Contact',                 lo: 'ຕິດຕໍ່',                    th: 'ติดต่อ'                 },

  // ── Hero ─────────────────────────────────────────────────────────────
  hero_eyebrow:      { en: 'ທ່ອງທ່ຽວລາວ · Laos Travel · ท่องเที่ยวลาว', lo: 'ທ່ອງທ່ຽວລາວ · ການທ່ອງທ່ຽວ · ລາວ', th: 'ท่องเที่ยวลาว · ลาวทราเวล · ທ່ອງທ່ຽວ' },
  hero_h1_line1:     { en: 'Discover Laos.',          lo: 'ຄົ້ນພົບລາວ.',                th: 'ค้นพบลาว.'              },
  hero_h1_line2:     { en: 'Travel Deeply.',          lo: 'ທ່ອງທ່ຽວເລິກເຊິ່ງ.',         th: 'เดินทางอย่างลึกซึ้ง.'  },
  hero_sub:          {
    en: 'From a quiet café in Attapeu — the only travel-focused coffeehouse in Southern Laos — we curate authentic destinations, connect you with verified local guides, and map the roads less traveled.',
    lo: 'ຈາກຮ້ານກາເຟໃນອັດຕະປື — ຮ້ານກາເຟດ້ານການທ່ອງທ່ຽວດຽວໃນລາວໃຕ້ — ພວກເຮົາຄັດສັນສະຖານທີ່ແທ້ຈິງ, ເຊື່ອມຕໍ່ທ່ານກັບມັກກ້ຽວທ້ອງຖິ່ນ, ແລະ ສ້າງແຜນທີ່ເສັ້ນທາງທີ່ຫາຍາກ.',
    th: 'จากร้านกาแฟเงียบสงบในอัตตะปือ — ร้านกาแฟเพื่อการท่องเที่ยวแห่งเดียวในลาวใต้ — เราคัดสรรจุดหมายแท้จริง เชื่อมคุณกับไกด์ท้องถิ่น และวาดเส้นทางที่ยังไม่มีใครเดิน',
  },
  hero_cta_explore:  { en: 'Explore Destinations',   lo: 'ສຳຫຼວດສະຖານທີ່',             th: 'สำรวจจุดหมาย'           },
  hero_cta_map:      { en: 'View Interactive Map →', lo: 'ເບິ່ງແຜນທີ່ →',              th: 'ดูแผนที่ →'             },
  hero_trust:        { en: 'Alan Coffee & Travel · Based in Attapeu · Southern Laos', lo: 'ອາລັນ ກາເຟ ແລະ ການທ່ອງທ່ຽວ · ອັດຕະປື · ລາວໃຕ້', th: 'อาลัน คอฟฟี่ แอนด์ ทราเวล · อัตตะปือ · ลาวใต้' },
  scroll:            { en: 'Scroll',                 lo: 'ເລື່ອນ',                    th: 'เลื่อน'                 },

  // ── Stats ────────────────────────────────────────────────────────────
  stat_provinces:    { en: 'Provinces',              lo: 'ແຂວງ',                      th: 'จังหวัด'                },
  stat_districts:    { en: 'Districts',              lo: 'ເມືອງ',                     th: 'อำเภอ'                  },
  stat_destinations: { en: 'Destinations',           lo: 'ສະຖານທີ່',                  th: 'จุดหมาย'                },
  stat_homebase:     { en: 'Home Base',              lo: 'ຖານທີ່ຕັ້ງ',                th: 'ฐานที่ตั้ง'             },

  // ── Featured destinations ────────────────────────────────────────────
  section_curated:   { en: 'Curated Places',         lo: 'ສະຖານທີ່ຄັດສັນ',            th: 'สถานที่คัดสรร'          },
  section_featured:  { en: 'Featured Destinations',  lo: 'ສະຖານທີ່ແນະນຳ',             th: 'จุดหมายแนะนำ'           },
  view_all_dest:     { en: 'View all destinations →',lo: 'ເບິ່ງທັງໝົດ →',             th: 'ดูทั้งหมด →'            },
  dest_coming_soon:  { en: 'Destinations coming soon.', lo: 'ສະຖານທີ່ກຳລັງຈະມາ.',    th: 'จุดหมายเร็วๆ นี้.'     },
  not_assessed:      { en: 'Not yet assessed',       lo: 'ຍັງບໍ່ໄດ້ປະເມີນ',            th: 'ยังไม่ได้ประเมิน'       },
  discover_arrow:    { en: 'Discover →',             lo: 'ຄົ້ນຫາ →',                  th: 'สำรวจ →'                },

  // ── Alan Travel Standard ─────────────────────────────────────────────
  standard_eyebrow:  { en: 'The Alan Travel Standard',   lo: 'ມາດຕະຖານການທ່ອງທ່ຽວ',    th: 'มาตรฐานอาลัน ทราเวล'   },
  standard_h2_line1: { en: 'Every destination earns',    lo: 'ທຸກສະຖານທີ່ຕ້ອງ',         th: 'ทุกจุดหมายต้อง'        },
  standard_h2_line2: { en: 'its place here.',            lo: 'ສົມຄວນຢູ່ທີ່ນີ້.',         th: 'สมควรอยู่ที่นี่.'      },
  standard_cta:      { en: 'See Assessed Destinations',  lo: 'ເບິ່ງສະຖານທີ່ທີ່ໄດ້ປະເມີນ', th: 'ดูจุดหมายที่ประเมินแล้ว' },
  standard_note:     { en: 'All ratings are independent — no sponsorship, ever.', lo: 'ຄະແນນທັງໝົດເປັນອິດສະຫຼະ — ບໍ່ມີການສະໜັບສະໜູນ.', th: 'คะแนนทั้งหมดเป็นอิสระ — ไม่มีสปอนเซอร์' },

  // step titles + descs flattened
  step1_title: { en: 'We visit every destination personally.', lo: 'ພວກເຮົາໄປຢ້ຽມຢາມທຸກສະຖານທີ່ດ້ວຍຕົນເອງ.', th: 'เราเยี่ยมชมทุกจุดหมายด้วยตัวเอง' },
  step1_desc:  { en: "Our team travels to each location before it appears on this platform. No second-hand reports. No guesswork. If we haven't been there, it isn't here.", lo: 'ທີມງານຂອງພວກເຮົາເດີນທາງໄປທຸກສະຖານທີ່ກ່ອນທີ່ຈະລົງໃນເວັບໄຊ. ບໍ່ມີລາຍງານທາງອ້ອມ. ຖ້າພວກເຮົາຍັງບໍ່ໄດ້ໄປ, ສະຖານທີ່ນັ້ນຍັງບໍ່ຢູ່ທີ່ນີ້.', th: 'ทีมงานของเราเดินทางไปทุกสถานที่ก่อนที่จะลงในแพลตฟอร์ม ไม่มีรายงานมือสอง ถ้าเรายังไม่ได้ไป จุดหมายนั้นยังไม่อยู่ที่นี่' },
  step2_title: { en: 'We rate across five dimensions.', lo: 'ພວກເຮົາໃຫ້ຄະແນນ 5 ມິຕິ.', th: 'เราให้คะแนน 5 มิติ' },
  step2_desc:  { en: 'Experience, Accessibility, Authenticity, Tranquility, and Traveler Value — each scored on a strict 1–5 standard developed in Attapeu.', lo: 'ປະສົບການ, ການເຂົ້າເຖິງ, ຄວາມແທ້ຈິງ, ຄວາມສະຫງົບ, ແລະ ຄຸນຄ່ານັກທ່ອງທ່ຽວ — ຄະແນນ 1–5 ຕາມມາດຕະຖານອັດຕະປື.', th: 'ประสบการณ์ การเข้าถึง ความแท้จริง ความสงบ และคุณค่าสำหรับนักท่องเที่ยว — แต่ละด้านให้คะแนน 1–5 ตามมาตรฐานอัตตะปือ' },
  step3_title: { en: 'We publish only what earns its place.', lo: 'ພວກເຮົາເຜີຍແຜ່ສະເພາະສິ່ງທີ່ສົມຄວນ.', th: 'เราเผยแพร่เฉพาะสิ่งที่สมควร' },
  step3_desc:  { en: 'No sponsored listings. No inflated scores. If a destination does not meet the Alan Travel Standard, it does not appear here.', lo: 'ບໍ່ມີການລົງທະບຽນທີ່ໄດ້ຮັບການສະໜັບສະໜູນ. ຖ້າສະຖານທີ່ບໍ່ໄດ້ຕາມມາດຕະຖານ Alan Travel Standard, ສະຖານທີ່ນັ້ນຈະບໍ່ປາກົດທີ່ນີ້.', th: 'ไม่มีรายการสปอนเซอร์ ถ้าจุดหมายใดไม่ผ่านมาตรฐาน Alan Travel Standard จุดหมายนั้นจะไม่ปรากฏที่นี่' },

  // ── Guides ───────────────────────────────────────────────────────────
  section_local:     { en: 'Local Expertise',        lo: 'ຄວາມຊ່ຽວຊານທ້ອງຖິ່ນ',       th: 'ความเชี่ยวชาญท้องถิ่น'  },
  section_guides:    { en: 'Verified Local Guides',  lo: 'ມັກກ້ຽວທ້ອງຖິ່ນທີ່ຢືນຢັນ',   th: 'ไกด์ท้องถิ่นที่ยืนยันแล้ว' },
  view_all_guides:   { en: 'View all guides →',      lo: 'ເບິ່ງທັງໝົດ →',             th: 'ดูไกด์ทั้งหมด →'        },
  meet_all_guides:   { en: 'Meet All Guides',        lo: 'ພົບທຸກໆ ມັກກ້ຽວ',           th: 'พบไกด์ทั้งหมด'          },
  label_languages:   { en: 'Languages',              lo: 'ພາສາ',                      th: 'ภาษา'                   },
  label_specialties: { en: 'Specialties',            lo: 'ຄວາມຊ່ຽວຊານ',               th: 'ความเชี่ยวชาญ'          },

  // ── Map teaser ───────────────────────────────────────────────────────
  map_eyebrow:       { en: 'Interactive Map',            lo: 'ແຜນທີ່ໂຕ້ຕອບ',           th: 'แผนที่โต้ตอบ'            },
  map_h2_line1:      { en: 'Explore all 18 provinces',   lo: 'ສຳຫຼວດທັງ 18 ແຂວງ',       th: 'สำรวจทั้ง 18 จังหวัด'   },
  map_h2_line2:      { en: 'on one map.',                lo: 'ໃນແຜນທີ່ດຽວ.',            th: 'บนแผนที่เดียว.'          },
  map_desc:          { en: 'Click any province to explore its districts. Click any district to reveal pinned destinations with GPS coordinates. From Phongsali in the north to Champasack in the south — all of Laos, in one view.', lo: 'ຄລິກແຂວງໃດກໍໄດ້ເພື່ອສຳຫຼວດເມືອງ. ຄລິກເມືອງໃດກໍໄດ້ເພື່ອເຫັນສະຖານທີ່ທ່ອງທ່ຽວພ້ອມ GPS. ຈາກຜົ້ງສາລີຈົນຮອດຈຳປາສັກ — ລາວທັງໝົດໃນທັດສະນະດຽວ.', th: 'คลิกจังหวัดใดก็ได้เพื่อสำรวจอำเภอ คลิกอำเภอใดก็ได้เพื่อดูจุดหมายพร้อมพิกัด GPS จากผ้งสาลีถึงจำปาสัก — ลาวทั้งหมดในมุมเดียว' },
  map_cta:           { en: 'Open the Map',               lo: 'ເປີດແຜນທີ່',              th: 'เปิดแผนที่'              },

  // ── Footer ───────────────────────────────────────────────────────────
  footer_tagline:    { en: 'The only travel-focused café in Attapeu — a calm meeting place for those who travel with intention.', lo: 'ຮ້ານກາເຟດ້ານການທ່ອງທ່ຽວດຽວໃນອັດຕະປື — ສະຖານທີ່ພົບປະສຸງໃຈ.', th: 'ร้านกาแฟเพื่อการท่องเที่ยวแห่งเดียวในอัตตะปือ — สถานที่พบปะสงบสำหรับผู้เดินทาง' },
  footer_location:   { en: 'Attapeu Province · Southern Laos', lo: 'ແຂວງອັດຕະປື · ລາວໃຕ້',   th: 'จังหวัดอัตตะปือ · ลาวใต้' },
  footer_hours:      { en: 'Mon–Fri 8:00–18:00 · Sat–Sun 9:00–17:00', lo: 'ຈ–ສ 8:00–18:00 · ອາ 9:00–17:00', th: 'จ–ศ 8:00–18:00 · ส–อ 9:00–17:00' },
  footer_nav:        { en: 'Navigate',   lo: 'ນຳທາງ',   th: 'นำทาง'  },
  footer_company:    { en: 'Company',    lo: 'ບໍລິສັດ', th: 'บริษัท' },
  footer_copy:       { en: '© 2025 Alan Coffee & Travel — Attapeu, Laos', lo: '© 2025 ອາລັນ ກາເຟ ແລະ ການທ່ອງທ່ຽວ — ອັດຕະປື, ລາວ', th: '© 2025 อาลัน คอฟฟี่ แอนด์ ทราเวล — อัตตะปือ, ลาว' },
}

export function tr(key: keyof typeof strings, lang: Lang): string {
  return strings[key][lang]
}
