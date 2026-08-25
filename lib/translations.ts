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

  // ── Map page ─────────────────────────────────────────────────────────
  map_page_all_dest:       { en: 'All Destinations →',     lo: 'ທຸກບ່ອນທ່ຽວ →',               th: 'จุดหมายทั้งหมด →'          },
  map_province_suffix:     { en: 'Province',               lo: 'ແຂວງ',                         th: 'จังหวัด'                   },
  map_district_suffix:     { en: 'District',               lo: 'ເມືອງ',                        th: 'อำเภอ'                     },
  map_h1_laos:             { en: 'Explore Laos.',          lo: 'ສຳຫຼວດລາວ.',                   th: 'สำรวจลาว.'                  },
  map_h1_province:         { en: 'Select a District.',     lo: 'ເລືອກເມືອງ.',                  th: 'เลือกอำเภอ.'                },
  map_h1_district:         { en: 'Destinations.',          lo: 'ບ່ອນທ່ຽວ.',                    th: 'จุดหมาย.'                  },
  map_bc_laos:             { en: 'Laos',                   lo: 'ລາວ',                          th: 'ลาว'                       },
  map_back:                { en: '← Back',                 lo: '← ກັບ',                        th: '← กลับ'                    },
  map_how_to:              { en: 'How to Navigate',        lo: 'ວິທີໃຊ້ງານ',                  th: 'วิธีใช้งาน'                },
  map_nav_step1: {
    en: 'Hover any province to highlight it',
    lo: 'ກົດໃສ່ແຂວງທີ່ຢາກສຳຫຼວດ',
    th: 'คลิกจังหวัดที่อยากสำรวจ',
  },
  map_nav_step2: {
    en: 'Click any province to explore its districts',
    lo: 'ກົດແຂວງ ເພື່ອເບິ່ງເມືອງໃນນັ້ນ',
    th: 'คลิกจังหวัดเพื่อดูอำเภอในนั้น',
  },
  map_nav_step3: {
    en: 'Click a district to see destinations & map pins',
    lo: 'ກົດເມືອງ ເພື່ອເບິ່ງບ່ອນທ່ຽວ ແລະ ຈຸດໝາຍ',
    th: 'คลิกอำเภอเพื่อดูจุดหมายและพินบนแผนที่',
  },
  map_starting_point: { en: '★ Starting Point', lo: '★ ຈຸດເລີ່ມ', th: '★ จุดเริ่มต้น' },
  map_starting_text: {
    en: 'Alan Coffee & Travel is based in Attapeu — Southern Laos. Click it to begin.',
    lo: 'Alan Coffee & Travel ຕັ້ງຢູ່ທີ່ອັດຕະປື — ລາວໃຕ້. ກົດທີ່ນັ້ນເພື່ອເລີ່ມ.',
    th: 'Alan Coffee & Travel ตั้งอยู่ที่อัตตะปือ — ลาวใต้ คลิกเพื่อเริ่ม',
  },
  map_districts_label:  { en: 'Districts',              lo: 'ເມືອງ',                  th: 'อำเภอ'                  },
  map_district_explore: { en: 'click one to explore',   lo: 'ກົດເພື່ອສຳຫຼວດ',         th: 'คลิกเพื่อสำรวจ'         },
  map_pin_hint: {
    en: 'Click a pin on the map to view details',
    lo: 'ກົດຈຸດໝາຍໃນແຜນທີ່ ເພື່ອດູລາຍລະອຽດ',
    th: 'คลิกพินบนแผนที่เพื่อดูรายละเอียด',
  },
  map_no_dest:       { en: 'No destinations yet.',   lo: 'ຍັງບໍ່ທັນມີບ່ອນທ່ຽວ.',  th: 'ยังไม่มีจุดหมาย.'       },
  map_no_dest_admin: { en: 'Add via Admin Panel.',   lo: 'ເພີ່ມຜ່ານ Admin.',        th: 'เพิ่มผ่าน Admin'         },
  map_go_admin:      { en: 'Go to Admin →',          lo: 'ໄປ Admin →',              th: 'ไปที่ Admin →'           },
  map_guide_avail:   { en: 'Guide Available',        lo: 'ມີມັກກ້ຽວ',              th: 'มีไกด์'                  },
  map_details:       { en: 'Details',                lo: 'ລາຍລະອຽດ',               th: 'รายละเอียด'              },
  map_coming_soon:   { en: 'Coming soon',            lo: 'ກຳລັງຈະມາ',             th: 'เร็วๆ นี้'               },
  dest_show_map:     { en: 'Show Map',               lo: 'ສະແດງແຜນທີ່',            th: 'แสดงแผนที่'              },
  dest_show_list:    { en: 'Show List',              lo: 'ສະແດງລາຍການ',           th: 'แสดงรายการ'              },

  // ── Destination detail page ───────────────────────────────────────────
  detail_all_dest:       { en: '← All Destinations',        lo: '← ທຸກບ່ອນທ່ຽວ',         th: '← จุดหมายทั้งหมด'       },
  detail_about_eyebrow:  { en: 'About',                      lo: 'ກ່ຽວກັບ',                th: 'เกี่ยวกับ'               },
  detail_desc_coming:    { en: 'Full description coming soon.', lo: 'ກຳລັງຂຽນ...',         th: 'กำลังเขียน...'           },
  detail_photo_coming:   { en: 'Photo coming soon',          lo: 'ກຳລັງເພີ່ມຮູບ',         th: 'กำลังเพิ่มรูป'           },
  detail_details_card:   { en: 'Details',                    lo: 'ລາຍລະອຽດ',               th: 'รายละเอียด'              },
  detail_label_region:   { en: 'Region',                     lo: 'ແຂວງ',                   th: 'จังหวัด'                 },
  detail_label_assessment: { en: 'Assessment',               lo: 'ການປະເມີນ',               th: 'การประเมิน'              },
  detail_assessed_badge: { en: '★ Assessed',                 lo: '★ ປະເມີນແລ້ວ',           th: '★ ผ่านการประเมิน'        },
  detail_not_assessed:   { en: 'Not yet assessed',           lo: 'ຍັງບໍ່ທັນປະເມີນ',        th: 'ยังไม่ได้ประเมิน'        },
  detail_label_transport: { en: 'Transport',                 lo: 'ການເດີນທາງ',              th: 'การเดินทาง'              },
  detail_guide_avail:    { en: '✓ Guide Available',          lo: '✓ ມີມັກກ້ຽວ',            th: '✓ มีไกด์'                },
  detail_view_maps:      { en: 'View on Google Maps 🗺️',    lo: 'ເບິ່ງໃນ Google Maps 🗺️',  th: 'ดูใน Google Maps 🗺️'    },
  detail_alan_standard:  { en: '★ Alan Travel Standard',    lo: '★ Alan Travel Standard',  th: '★ Alan Travel Standard'  },
  detail_book:           { en: 'Book Experience',            lo: 'ຈອງປະສົບການ',             th: 'จองประสบการณ์'           },
  detail_chat_whatsapp:  { en: 'Chat on WhatsApp',           lo: 'ສົນທະນາທາງ WhatsApp',      th: 'แชทผ่าน WhatsApp'        },
  detail_other_ways:     { en: 'Other ways to contact',      lo: 'ຊ່ອງທາງອື່ນ',              th: 'ช่องทางอื่น'             },
  detail_guides_h2:      { en: 'Available Guides',           lo: 'ມັກກ້ຽວທີ່ມີ',            th: 'ไกด์ที่พร้อม'            },
  detail_more_guides: {
    en: 'More guides available at',
    lo: 'ມີມັກກ້ຽວເພີ່ມເຕີມທີ່',
    th: 'มีไกด์เพิ่มเติมที่',
  },

  // ── Rating dimension labels ───────────────────────────────────────────
  rating_exp:    { en: 'Experience',    lo: 'ປະສົບການ',            th: 'ประสบการณ์'    },
  rating_access: { en: 'Accessibility', lo: 'ການເຂົ້າຮອດ',         th: 'การเข้าถึง'    },
  rating_auth:   { en: 'Authenticity',  lo: 'ຄວາມເປັນຕົ້ນສະບັບ',  th: 'ความเป็นเอกลักษณ์' },
  rating_tranq:  { en: 'Tranquility',   lo: 'ຄວາມສງົບ',            th: 'ความสงบ'       },
  rating_value:  { en: 'Traveler Value', lo: 'ຄວາມຄຸ້ມຄ່າ',        th: 'ความคุ้มค่า'   },

  // ── About page ───────────────────────────────────────────────────────
  about_eyebrow: { en: 'Attapeu, Laos', lo: 'ອັດຕະປື, ລາວ', th: 'อัตตะปือ, ลาว' },
  about_h1_line1: { en: 'A place to arrive.', lo: 'ມາຮອດ, ຫາຍໃຈ.', th: 'มาถึง หยุดพัก.' },
  about_h1_line2: { en: 'Before you continue.', lo: 'ກ່ອນທີ່ຈະໄປຕໍ່.', th: 'ก่อนจะเดินทางต่อ.' },
  about_sub: {
    en: 'Alan is a café in Attapeu built for those who travel with intention. Not a stopover. A destination in itself.',
    lo: 'ອາລັນ ຄືຮ້ານກາເຟໃນອັດຕະປື ທີ່ສ້າງຂຶ້ນສຳລັບຄົນທ່ຽວທີ່ມາດ້ວຍໃຈ. ບໍ່ແມ່ນໂດຍຜ່ານ — ແຕ່ເປັນຈຸດໝາຍໃນຕົນເອງ.',
    th: 'Alan คือร้านกาแฟในอัตตะปือที่สร้างขึ้นสำหรับนักเดินทางที่มีจุดมุ่งหมาย ไม่ใช่แค่ทางผ่าน แต่คือจุดหมายในตัวเอง',
  },
  about_s1_eyebrow: { en: 'What Alan Is', lo: 'ອາລັນ ຄືຫຍັງ', th: 'Alan คืออะไร' },
  about_s1_h2: { en: 'A meeting place for travelers.', lo: 'ສະຖານທີ່ສຳລັບນັກທ່ຽວ.', th: 'ที่พบปะของนักเดินทาง.' },
  about_s1_p1: {
    en: 'Alan is not defined by its menu. It is defined by its quality of space — calm, refined, and unhurried. A room where a traveller can sit without agenda, order something honest, and feel the weight of the road begin to lift.',
    lo: 'ອາລັນ ບໍ່ໄດ້ນິຍາມດ້ວຍເມນູ. ແຕ່ດ້ວຍຄຸນນະພາບຂອງບ່ອນ — ສະຫງົບ, ສ້ວຍງາມ, ແລະ ບໍ່ຮີບ. ຫ້ອງທີ່ນັກທ່ຽວສາມາດນັ່ງໂດຍບໍ່ຕ້ອງຄິດຫຍັງ, ສັ່ງຂອງດີໆ, ແລ້ວຮູ້ສຶກຜ່ອນຄາຍຈາກຄວາມເໜື່ອຍ.',
    th: 'Alan ไม่ได้นิยามตัวเองด้วยเมนู แต่ด้วยคุณภาพของพื้นที่ — สงบ ประณีต ไม่เร่งรีบ ห้องที่นักเดินทางนั่งได้โดยไม่ต้องมีวาระ สั่งอะไรที่ดีจริงๆ แล้วรู้สึกว่าความหนักของถนนเริ่มเบาลง',
  },
  about_s1_p2: {
    en: 'It exists at the intersection of coffee culture and travel culture — where the two have always belonged together.',
    lo: 'ຢູ່ທີ່ຈຸດຕັດຂອງວັດທະນະທຳກາເຟ ແລະ ການທ່ອງທ່ຽວ — ສອງສິ່ງທີ່ຕ້ອງຢູ່ດ້ວຍກັນສະເໝີ.',
    th: 'อยู่ที่จุดตัดระหว่างวัฒนธรรมกาแฟและการเดินทาง — สองสิ่งที่ควรอยู่ด้วยกันมาตลอด',
  },
  about_s2_eyebrow: { en: 'Why It Exists', lo: 'ເປັນຫຍັງຈຶ່ງມີ', th: 'ทำไมถึงมีที่นี่' },
  about_s2_h2_line1: { en: 'Built from doubt.', lo: 'ເກີດຈາກຄວາມສົງໄສ.', th: 'เกิดจากความสงสัย.' },
  about_s2_h2_line2: { en: 'Shaped by stillness.', lo: 'ຖືກຮູບຮ່າງໂດຍຄວາມສງົບ.', th: 'หล่อหลอมด้วยความสงบ.' },
  about_s2_p1: {
    en: 'Alan did not begin with confidence. It began with the honest recognition that we were not yet good enough — and the decision to build anyway. Quietly. Carefully. Without noise.',
    lo: 'ອາລັນ ບໍ່ໄດ້ເລີ່ມດ້ວຍຄວາມໝັ້ນໃຈ. ມັນເລີ່ມດ້ວຍການຍອມຮັບຢ່າງຈິງໃຈວ່າ ເຮົາຍັງບໍ່ດີພໍ — ແລ້ວຕັດສິນໃຈສ້າງຢ່າງໃດກໍດ. ຢ່າງງຽບໆ. ຢ່າງລະອຽດ. ໂດຍບໍ່ມີສຽງໂຫ່ຮ້ອງ.',
    th: 'Alan ไม่ได้เริ่มต้นด้วยความมั่นใจ แต่เริ่มจากการยอมรับอย่างตรงไปตรงมาว่าเรายังไม่ดีพอ — แล้วตัดสินใจสร้างมันขึ้นมาอยู่ดี อย่างเงียบๆ อย่างพิถีพิถัน ไม่มีเสียงโห่ฮิ้ว',
  },
  about_s2_p2: {
    en: 'That origin is still present in every corner of the space. Not as a story we tell — but as a quality you feel when you walk in.',
    lo: 'ຮ່ອງຮອຍຂອງຕົ້ນກຳເນີດນັ້ນ ຍັງຢູ່ໃນທຸກໆ ມຸມຂອງສະຖານທີ່. ບໍ່ແມ່ນໃນຮູບຂອງເລື່ອງທີ່ເຮົາເລົ່າ — ແຕ່ເປັນຄຸນນະພາບທີ່ເຈົ້າຮູ້ສຶກໄດ້ຕອນກ້າວເຂົ້າມາ.',
    th: 'ร่องรอยของจุดเริ่มต้นนั้นยังอยู่ในทุกมุมของพื้นที่ ไม่ใช่เป็นเรื่องเล่า แต่เป็นคุณภาพที่คุณสัมผัสได้เมื่อก้าวเข้ามา',
  },
  about_s3_eyebrow: { en: 'What Makes It Different', lo: 'ສິ່ງທີ່ເຮັດໃຫ້ຕ່າງ', th: 'อะไรที่ทำให้แตกต่าง' },
  about_s3_h2_line1: { en: 'The only café in Attapeu', lo: 'ຮ້ານກາເຟດຽວໃນອັດຕະປື', th: 'ร้านกาแฟเดียวในอัตตะปือ' },
  about_s3_h2_line2: { en: 'built for the world.', lo: 'ທີ່ຊ່ວຍນັກທ່ຽວໂລກ.', th: 'ที่สร้างเพื่อนักเดินทางโลก.' },
  about_s3_p1: {
    en: 'Most cafés in this region serve locals. Alan serves anyone who travels with purpose. It is the only space in Attapeu that positions itself as a direct touchpoint for international travellers — offering not just coffee, but cultural orientation, local knowledge, and curated travel guidance.',
    lo: 'ຮ້ານກາເຟສ່ວນໃຫຍ່ໃນພາກນີ້ຮັບໃຊ້ຄົນທ້ອງຖິ່ນ. ອາລັນ ຮັບໃຊ້ທຸກຄົນທີ່ທ່ຽວດ້ວຍຈຸດປະສົງ. ມັນເປັນສະຖານທີ່ດຽວໃນອັດຕະປື ທີ່ເປັນຈຸດເຊື່ອມຕໍ່ສຳລັບນັກທ່ຽວຕ່າງປະເທດ — ໃຫ້ບໍ່ພຽງແຕ່ກາເຟ, ແຕ່ຄວາມຮູ້ດ້ານວັດທະນະທຳ, ຂໍ້ມູນທ້ອງຖິ່ນ, ແລະ ຄຳແນະນຳການທ່ຽວ.',
    th: 'ร้านกาแฟส่วนใหญ่ในภูมิภาคนี้ให้บริการคนท้องถิ่น Alan ให้บริการทุกคนที่เดินทางอย่างมีจุดมุ่งหมาย มันคือพื้นที่เดียวในอัตตะปือที่เป็นจุดสัมผัสโดยตรงสำหรับนักเดินทางนานาชาติ ไม่ใช่แค่กาแฟ แต่ยังมีความรู้ทางวัฒนธรรม ข้อมูลท้องถิ่น และคำแนะนำการท่องเที่ยว',
  },
  about_s3_p2: {
    en: 'Coffee. Cultural discovery. Travel guidance. In one room.',
    lo: 'ກາເຟ. ການຄົ້ນພົບວັດທະນະທຳ. ຄຳແນະນຳການທ່ຽວ. ໃນຫ້ອງດຽວ.',
    th: 'กาแฟ ความค้นพบทางวัฒนธรรม คำแนะนำการเดินทาง ในที่เดียว',
  },
  about_s4_eyebrow: { en: 'What You Will Feel Here', lo: 'ສິ່ງທີ່ເຈົ້າຈະຮູ້ສຶກທີ່ນີ້', th: 'สิ่งที่คุณจะรู้สึกที่นี่' },
  about_s4_h2: { en: 'Quiet courage.', lo: 'ຄວາມກ້າ ຢ່າງງຽບໆ.', th: 'ความกล้าอย่างสงบ.' },
  about_s4_p1: {
    en: 'Not inspiration. Not motivation. Something quieter than that.',
    lo: 'ບໍ່ແມ່ນການດົນໃຈ. ບໍ່ແມ່ນແຮງຈູງໃຈ. ແຕ່ເປັນບາງສິ່ງທີ່ງຽບກວ່ານັ້ນ.',
    th: 'ไม่ใช่แรงบันดาลใจ ไม่ใช่แรงกระตุ้น แต่เป็นสิ่งที่เงียบกว่านั้น',
  },
  about_s4_p2: {
    en: 'Alan is for the traveller who is tired — not of the journey, but of the noise around it. For those who feel lost and need space to think. For those who already know what they want to do, but need a moment of stillness before they begin.',
    lo: 'ອາລັນ ສຳລັບນັກທ່ຽວທີ່ເໜື່ອຍ — ບໍ່ແມ່ນເໜື່ອຍກັບການທ່ຽວ, ແຕ່ເໜື່ອຍກັບສຽງຮົບກວນອ້ອມຂ້າງ. ສຳລັບຄົນທີ່ຮູ້ສຶກສູນເສຍ ແລ້ວຕ້ອງການທີ່ວ່າງໃຫ້ຄິດ. ສຳລັບຄົນທີ່ຮູ້ຢູ່ແລ້ວວ່າຢາກເຮັດຫຍັງ, ແຕ່ຕ້ອງການຄວາມສງົບກ່ອນຈະເລີ່ມ.',
    th: 'Alan สำหรับนักเดินทางที่เหนื่อย ไม่ใช่เหนื่อยกับการเดินทาง แต่เหนื่อยกับเสียงรบกวนรอบข้าง สำหรับคนที่รู้สึกหลงทางและต้องการพื้นที่คิด สำหรับคนที่รู้อยู่แล้วว่าอยากทำอะไร แต่ต้องการความสงบก่อนจะเริ่ม',
  },
  about_s4_p3: {
    en: 'You will leave feeling ready. Not loud. Not rushed. Just ready.',
    lo: 'ເຈົ້າຈະອອກໄປດ້ວຍຄວາມພ້ອມ. ບໍ່ດ້ວຍສຽງໂຫ່. ບໍ່ດ້ວຍຄວາມຮີບ. ພ້ອມ.',
    th: 'คุณจะออกไปด้วยความพร้อม ไม่ใช่ด้วยเสียงโห่ร้อง ไม่ใช่ด้วยความรีบ แค่พร้อม',
  },
  about_closing_h2_line1: { en: 'Attapeu, Laos.', lo: 'ອັດຕະປື, ລາວ.', th: 'อัตตะปือ, ลาว.' },
  about_closing_h2_line2: { en: 'Where the journey slows down.', lo: 'ທີ່ທີ່ການທ່ຽວຊ້າລົງ.', th: 'ที่ที่การเดินทางช้าลง.' },
  about_closing_cta: { en: 'Explore Destinations', lo: 'ເບິ່ງບ່ອນທ່ຽວ', th: 'สำรวจจุดหมาย' },

  // ── Contact page ─────────────────────────────────────────────────────
  contact_eyebrow:    { en: 'Contact',       lo: 'ຕິດຕໍ່',          th: 'ติดต่อ'              },
  contact_h1_line1:   { en: 'Come find us.', lo: 'ມາຫາເຮົາ.',        th: 'มาหาเรา.'            },
  contact_h1_line2:   { en: 'Or reach out.', lo: 'ຫຼື ຕິດຕໍ່ຫາ.',   th: 'หรือส่งข้อความมา.'  },
  contact_sub: {
    en: 'We are always happy to hear from travelers, partners, and anyone curious about Attapeu and Laos.',
    lo: 'ເຮົາຍິນດີສະເໝີ ທີ່ຈະຮັບຟັງຈາກນັກທ່ຽວ, ພາກີ, ແລະ ທຸກຄົນທີ່ຢາກຮູ້ຈັກອັດຕະປື ແລະ ລາວ.',
    th: 'เรายินดีรับฟังเสมอ ไม่ว่าจะเป็นนักเดินทาง พาร์ตเนอร์ หรือใครก็ตามที่อยากรู้จักอัตตะปือและลาว',
  },
  contact_find_us:         { en: 'Find Us',       lo: 'ຫາເຮົາ',          th: 'หาเรา'            },
  contact_location_label:  { en: 'Location',      lo: 'ທີ່ຕັ້ງ',         th: 'ที่ตั้ง'           },
  contact_hours_label:     { en: 'Hours',         lo: 'ເວລາທຳການ',      th: 'เวลาทำการ'         },
  contact_hours_weekday:   { en: 'Monday — Friday',       lo: 'ຈັນ — ສຸກ',       th: 'จันทร์ — ศุกร์'  },
  contact_hours_weekday_t: { en: '8:00 AM — 6:00 PM',     lo: '8:00 — 18:00',    th: '8:00 — 18:00'    },
  contact_hours_weekend:   { en: 'Saturday — Sunday: 9:00 AM — 5:00 PM', lo: 'ເສົາ — ອາທິດ: 9:00 — 17:00', th: 'เสาร์ — อาทิตย์: 9:00 — 17:00' },
  contact_social_label:    { en: 'Social',        lo: 'ສັງຄົມ',          th: 'โซเชียล'           },
  contact_partners_label:  { en: 'For Partners',  lo: 'ສຳລັບພາກີ',      th: 'สำหรับพาร์ตเนอร์'  },
  contact_partners_text: {
    en: "Want to list your province or local experience on Alan Coffee Travel? We'd love to hear from you.",
    lo: 'ຢາກລົງທະບຽນແຂວງ ຫຼື ປະສົບການທ້ອງຖິ່ນຂອງທ່ານກັບ Alan Coffee Travel ບໍ? ເຮົາຍິນດີຮັບຟັງ.',
    th: 'อยากลงรายชื่อจังหวัดหรือประสบการณ์ท้องถิ่นของคุณบน Alan Coffee Travel? เรายินดีรับฟัง',
  },
  contact_send_label:    { en: 'Send a Message', lo: 'ສົ່ງຂໍ້ຄວາມ',   th: 'ส่งข้อความ'    },
  contact_name_label:    { en: 'Name',            lo: 'ຊື່',             th: 'ชื่อ'           },
  contact_name_ph:       { en: 'Your name',       lo: 'ຊື່ຂອງທ່ານ',    th: 'ชื่อของคุณ'    },
  contact_email_label:   { en: 'Email',           lo: 'ອີເມວ',           th: 'อีเมล'          },
  contact_msg_label:     { en: 'Message',         lo: 'ຂໍ້ຄວາມ',         th: 'ข้อความ'        },
  contact_msg_ph: {
    en: "Tell us what's on your mind...",
    lo: 'ບອກເຮົາວ່າທ່ານຢາກຖາມຫຍັງ...',
    th: 'บอกเราว่าคุณอยากพูดถึงอะไร...',
  },
  contact_send_btn: { en: 'Send Message', lo: 'ສົ່ງຂໍ້ຄວາມ', th: 'ส่งข้อความ' },
  contact_sent_h3:  { en: 'Message received.', lo: 'ໄດ້ຮັບຂໍ້ຄວາມແລ້ວ.', th: 'ได้รับข้อความแล้ว.' },
  contact_sent_p: {
    en: 'Thank you for reaching out. We will get back to you shortly — over a good cup of coffee.',
    lo: 'ຂອບໃຈທີ່ຕິດຕໍ່ຫາ. ເຮົາຈະຕອບທ່ານໄວໆ ນີ້ — ພ້ອມກາເຟຮ້ອນໆ ໃນໃຈ.',
    th: 'ขอบคุณที่ติดต่อมา เราจะตอบกลับเร็วๆ นี้ — พร้อมกาแฟดีๆ ในใจ',
  },

  // ── Destinations page ─────────────────────────────────────────────────
  dest_eyebrow: { en: 'Laos', lo: 'ລາວ', th: 'ลาว' },
  dest_h1:      { en: 'All Destinations', lo: 'ທຸກບ່ອນທ່ຽວ', th: 'จุดหมายทั้งหมด' },
  dest_sub: {
    en: 'Curated places across Laos — assessed for experience, authenticity, and tranquility.',
    lo: 'ບ່ອນທ່ຽວທີ່ຄັດເລືອກທົ່ວລາວ — ປະເມີນດ້ານປະສົບການ, ຄວາມເປັນຕົ້ນສະບັບ, ແລະ ຄວາມສງົບ.',
    th: 'สถานที่คัดสรรทั่วลาว — ประเมินด้านประสบการณ์ ความเป็นเอกลักษณ์ และความสงบ',
  },
  dest_search_ph:           { en: 'Search destinations...',  lo: 'ຄົ້ນຫາບ່ອນທ່ຽວ...',  th: 'ค้นหาจุดหมาย...'      },
  dest_all_provinces:       { en: 'All Provinces',           lo: 'ທຸກແຂວງ',             th: 'ทุกจังหวัด'            },
  dest_all_status:          { en: 'All Status',              lo: 'ທຸກສະຖານະ',           th: 'ทุกสถานะ'              },
  dest_filter_assessed:     { en: 'Assessed',                lo: 'ໄດ້ຮັບການປະເມີນ',    th: 'ผ่านการประเมิน'        },
  dest_filter_not_assessed: { en: 'Not Yet Assessed',        lo: 'ຍັງບໍ່ທັນປະເມີນ',    th: 'ยังไม่ได้ประเมิน'      },
  dest_singular:            { en: 'destination',             lo: 'ບ່ອນທ່ຽວ',            th: 'จุดหมาย'               },
  dest_plural:              { en: 'destinations',            lo: 'ບ່ອນທ່ຽວ',            th: 'จุดหมาย'               },
  dest_no_results:          { en: 'No destinations found',   lo: 'ບໍ່ພົບບ່ອນທ່ຽວ',     th: 'ไม่พบจุดหมาย'          },
  dest_no_results_sub:      { en: 'Try adjusting your filters or search term.', lo: 'ລອງປ່ຽນການກັ່ນຕອງ ຫຼື ຄຳຄົ້ນຫາ.', th: 'ลองปรับตัวกรองหรือคำค้นหา' },
  dest_discover_link:       { en: 'Discover →',              lo: 'ເບິ່ງ →',              th: 'ดูเพิ่มเติม →'         },
  dest_not_assessed_label:  { en: 'Not assessed',            lo: 'ຍັງບໍ່ທັນປະເມີນ',    th: 'ยังไม่ได้ประเมิน'      },
  dest_badge_assessed:      { en: '★ Assessed',              lo: '★ ປະເມີນແລ້ວ',       th: '★ ผ่านการประเมิน'      },
  try_again:                { en: 'Try Again',               lo: 'ລອງໃໝ່',              th: 'ลองอีกครั้ง'           },

  // ── Guides page ───────────────────────────────────────────────────────
  guides_eyebrow: { en: 'Local Expertise', lo: 'ຄວາມຊ່ຽວຊານທ້ອງຖິ່ນ', th: 'ความเชี่ยวชาญท้องถิ่น' },
  guides_h1:      { en: 'Find Your Guide', lo: 'ຫາມັກກ້ຽວຂອງທ່ານ',    th: 'หาไกด์ของคุณ'         },
  guides_sub: {
    en: 'Trusted local guides who know Laos deeply — its paths, its people, and the places that never appear on maps.',
    lo: 'ມັກກ້ຽວທ້ອງຖິ່ນທີ່ໄວ້ໃຈໄດ້ — ຮູ້ຈັກລາວລຶ້ກ, ຮູ້ທາງ, ຮູ້ຄົນ, ແລະ ຮູ້ບ່ອນທ່ຽວທີ່ຍັງບໍ່ທັນຂຶ້ນແຜນທີ່.',
    th: 'ไกด์ท้องถิ่นที่ไว้วางใจได้ — รู้จักลาวลึกซึ้ง รู้เส้นทาง รู้จักผู้คน และรู้สถานที่ที่ไม่เคยปรากฏบนแผนที่',
  },
  guides_all_provinces:  { en: 'All Provinces',  lo: 'ທຸກແຂວງ',   th: 'ทุกจังหวัด' },
  guides_all_languages:  { en: 'All Languages',  lo: 'ທຸກພາສາ',   th: 'ทุกภาษา'    },
  guides_singular:       { en: 'guide',          lo: 'ຄົນ',        th: 'คน'          },
  guides_plural:         { en: 'guides',         lo: 'ຄົນ',        th: 'คน'          },
  guides_no_results:     { en: 'No guides found',   lo: 'ບໍ່ພົບມັກກ້ຽວ', th: 'ไม่พบไกด์'    },
  guides_no_results_sub: { en: 'Try adjusting your filters.', lo: 'ລອງປ່ຽນການກັ່ນຕອງ.', th: 'ลองปรับตัวกรอง' },
  guides_yrs_exp:     { en: 'yrs exp',              lo: 'ປີ',                  th: 'ปี'                  },
  guides_verified:    { en: 'VERIFIED',              lo: 'ຜ່ານການຢັ້ງຢືນ',    th: 'ผ่านการรับรอง'       },
  guides_contact_via: { en: 'Contact via Alan Café', lo: 'ຕິດຕໍ່ຜ່ານ Alan Café', th: 'ติดต่อผ่าน Alan Café' },
  guides_call:        { en: 'Call',                  lo: 'ໂທ',                 th: 'โทร'                 },
  guides_cta_h2: {
    en: 'Not sure which guide is right for you?',
    lo: 'ບໍ່ຮູ້ວ່າຈະເລືອກມັກກ້ຽວຄົນໃດ?',
    th: 'ไม่แน่ใจว่าไกด์คนไหนเหมาะกับคุณ?',
  },
  guides_cta_p: {
    en: 'Come to Alan Café in Attapeu. We know every guide personally and can match you to the right person for your journey.',
    lo: 'ມາທີ່ Alan Café ໃນອັດຕະປື. ເຮົາຮູ້ຈັກທຸກຄົນໂດຍສ່ວນຕົວ ແລະ ຈະຊ່ວຍຈັບຄູ່ທ່ານກັບຄົນທີ່ເໝາະສົມທີ່ສຸດ.',
    th: 'มาที่ Alan Café ในอัตตะปือ เรารู้จักไกด์ทุกคนเป็นการส่วนตัว และจะช่วยจับคู่คุณกับคนที่เหมาะสมที่สุดสำหรับการเดินทางของคุณ',
  },
  guides_cta_btn: { en: 'Get in Touch', lo: 'ຕິດຕໍ່ຫາ', th: 'ติดต่อเรา' },

  // ── AlanGuide Marketplace ─────────────────────────────────────────────
  nav_experiences: { en: 'Experiences', lo: 'ທ່ຽວ', th: 'ทัวร์' },
  nav_become_guide: { en: 'List Your Tours', lo: 'ລົງທະບຽນໄກດ໌', th: 'ลงทะเบียนไกด์' },

  // Guides browse
  guides_search:      { en: 'Search guides…',   lo: 'ຄົ້ນຫາ…',     th: 'ค้นหาไกด์…'    },
  guides_all_ratings: { en: 'All Ratings',       lo: 'ທຸກຄະແນນ',   th: 'ทุกเรตติ้ง'   },
  guides_sort_rating: { en: 'Top Rated',         lo: 'ຄະແນນສູງສຸດ', th: 'เรตติ้งสูงสุด' },
  guides_sort_exp:    { en: 'Most Experienced',  lo: 'ປະສົບການສູງ',  th: 'ประสบการณ์สูง' },
  guides_sort_feat:   { en: 'Featured',          lo: 'ແນະນຳ',       th: 'แนะนำ'         },
  guides_view_profile: { en: 'View Profile',     lo: 'ເບິ່ງໂປຣໄຟລ໌', th: 'ดูโปรไฟล์'   },
  guides_review:      { en: 'review',            lo: 'รีวิว',        th: 'รีวิว'          },
  guides_reviews:     { en: 'reviews',           lo: 'รีวิว',        th: 'รีวิว'          },
  guides_rating:      { en: 'Rating',            lo: 'ຄະແນນ',       th: 'เรตติ้ง'       },

  // Guide profile
  gp_about:         { en: 'About',              lo: 'ກ່ຽວກັບ',     th: 'เกี่ยวกับ'    },
  gp_experiences:   { en: 'Experiences',        lo: 'ທ່ຽວ',        th: 'ทัวร์'        },
  gp_reviews:       { en: 'Reviews',            lo: 'ລີວີວ',       th: 'รีวิว'        },
  gp_photos:        { en: 'Photos',             lo: 'ຮູບ',         th: 'รูปภาพ'       },
  gp_contact:       { en: 'Contact Guide',      lo: 'ຕິດຕໍ່ໄກດ໌', th: 'ติดต่อไกด์'  },
  gp_specialties:   { en: 'Specialties',        lo: 'ຄວາມຊ່ຽວຊານ', th: 'ความเชี่ยวชาญ' },
  gp_languages:     { en: 'Languages',          lo: 'ພາສາ',        th: 'ภาษา'         },
  gp_license:       { en: 'License Verified',   lo: 'ໃບອະນຸຍາດ',  th: 'ใบอนุญาต'    },
  gp_years_exp:     { en: 'Years Experience',   lo: 'ປີປະສົບການ',  th: 'ปีประสบการณ์' },
  gp_write_review:  { en: 'Write a Review',     lo: 'ຂຽນລີວີວ',   th: 'เขียนรีวิว'   },
  gp_no_exp:        { en: 'No experiences listed yet.', lo: 'ຍັງບໍ່ມີທ່ຽວ', th: 'ยังไม่มีทัวร์' },
  gp_no_reviews:    { en: 'No reviews yet — be the first!', lo: 'ຍັງບໍ່ມີລີວີວ', th: 'ยังไม่มีรีวิว' },

  // Experiences browse
  exp_eyebrow:  { en: 'Curated Tours & Trips', lo: 'ທ່ຽວລາວ',           th: 'ทัวร์คัดสรร'         },
  exp_h1:       { en: 'Find an Experience',    lo: 'ຄົ້ນຫາທ່ຽວ',        th: 'ค้นหาประสบการณ์'    },
  exp_sub:      {
    en: 'Handpicked tours, treks, and cultural experiences led by certified local guides across Laos.',
    lo: 'ທ່ຽວ, ເດີນປ່າ, ແລະ ປະສົບການວັດທະນະທຳ ນຳໂດຍໄກດ໌ທ້ອງຖິ່ນ.',
    th: 'ทัวร์ เดินป่า และประสบการณ์วัฒนธรรม นำโดยไกด์ท้องถิ่นที่ผ่านการรับรองทั่วลาว',
  },
  exp_all_cats:    { en: 'All Categories', lo: 'ທຸກປະເພດ',   th: 'ทุกหมวด'        },
  exp_all_regions: { en: 'All Regions',    lo: 'ທຸກພາກ',     th: 'ทุกภาค'         },
  exp_all_diff:    { en: 'All Levels',     lo: 'ທຸກລະດັບ',   th: 'ทุกระดับ'       },
  exp_sort_feat:   { en: 'Featured',       lo: 'ແນະນຳ',      th: 'แนะนำ'          },
  exp_sort_price:  { en: 'Lowest Price',   lo: 'ລາຄາຕ່ຳ',   th: 'ราคาต่ำสุด'     },
  exp_sort_pop:    { en: 'Most Popular',   lo: 'ນິຍົມ',      th: 'ยอดนิยม'        },
  exp_sort_rating: { en: 'Top Rated',      lo: 'ຄະແນນສູງ',  th: 'เรตติ้งสูง'     },
  exp_from:        { en: 'From',           lo: 'ເລີ່ມ',      th: 'เริ่มต้น'        },
  exp_per_person:  { en: 'per person',     lo: 'ຕໍ່ຄົນ',     th: 'ต่อคน'          },
  exp_hrs:         { en: 'hrs',            lo: 'ຊົ່ວໂມງ',    th: 'ชม.'            },
  exp_days:        { en: 'days',           lo: 'ວັນ',        th: 'วัน'             },
  exp_singular:    { en: 'experience',     lo: 'ທ່ຽວ',       th: 'ทัวร์'          },
  exp_plural:      { en: 'experiences',    lo: 'ທ່ຽວ',       th: 'ทัวร์'          },
  exp_no_results:  { en: 'No experiences found', lo: 'ບໍ່ພົບ', th: 'ไม่พบทัวร์'    },

  // Experience detail
  exp_highlights:    { en: 'Highlights',       lo: 'ຈຸດເດັ່ນ',    th: 'จุดเด่น'      },
  exp_includes:      { en: "What's Included",  lo: 'ລວມ',         th: 'รวมอยู่ด้วย'  },
  exp_excludes:      { en: 'Not Included',     lo: 'ບໍ່ລວມ',      th: 'ไม่รวม'       },
  exp_bring:         { en: 'What to Bring',    lo: 'ສິ່ງທີ່ຕ້ອງຢ່',th: 'สิ่งที่ต้องนำ' },
  exp_meeting:       { en: 'Meeting Point',    lo: 'ຈຸດພົບ',      th: 'จุดนัดพบ'     },
  exp_about_guide:   { en: 'About Your Guide', lo: 'ກ່ຽວກັບໄກດ໌', th: 'เกี่ยวกับไกด์' },
  exp_similar:       { en: 'Similar Experiences', lo: 'ທ່ຽວທີ່ຄ້າຍ', th: 'ทัวร์ที่คล้ายกัน' },
  exp_contact_guide: { en: 'Contact Guide',    lo: 'ຕິດຕໍ່ໄກດ໌',  th: 'ติดต่อไกด์'  },
  exp_book:          { en: 'Book This Tour',   lo: 'ຈອງທ່ຽວນີ້',  th: 'จองทัวร์นี้'  },
  exp_group:         { en: 'Group',            lo: 'ກຸ່ມ',        th: 'กลุ่ม'        },
  exp_min_max:       { en: 'people',           lo: 'ຄົນ',         th: 'คน'           },
  exp_difficulty:    { en: 'Difficulty',       lo: 'ລະດັບ',       th: 'ระดับ'        },
  exp_lang:          { en: 'Available In',     lo: 'ພາສາ',        th: 'ภาษา'         },

  // Inquiry modal
  inq_name:     { en: 'Your Name',        lo: 'ຊື່',          th: 'ชื่อ'            },
  inq_email:    { en: 'Email',            lo: 'ອີເມວ',        th: 'อีเมล'           },
  inq_country:  { en: 'Country',          lo: 'ປະເທດ',        th: 'ประเทศ'          },
  inq_date:     { en: 'Preferred Date',   lo: 'ວັນທີ່ຕ້ອງການ', th: 'วันที่ต้องการ'  },
  inq_group:    { en: 'Group Size',       lo: 'ຈຳນວນຄົນ',    th: 'จำนวนคน'        },
  inq_message:  { en: 'Message',          lo: 'ຂໍ້ຄວາມ',     th: 'ข้อความ'         },
  inq_via:      { en: 'Contact via',      lo: 'ຕິດຕໍ່ຜ່ານ',  th: 'ติดต่อผ่าน'      },
  inq_submit:   { en: 'Send Inquiry',     lo: 'ສົ່ງ',         th: 'ส่งข้อความ'      },
  inq_success:  { en: 'Inquiry sent! The guide will contact you soon.', lo: 'ສົ່ງແລ້ວ!', th: 'ส่งแล้ว! ไกด์จะติดต่อกลับเร็วๆ นี้' },
  inq_or_open:  { en: 'Or open directly:', lo: 'ຫຼື:', th: 'หรือเปิดตรง:' },

  // Become a Guide
  bag_eyebrow:  { en: 'Join AlanGuide', lo: 'ເຂົ້າຮ່ວມ', th: 'เข้าร่วม AlanGuide' },
  bag_h1:       { en: 'List Your Tours on AlanGuide', lo: 'ລົງທະບຽນທ່ຽວຂອງທ່ານ', th: 'ลงทะเบียนทัวร์ของคุณ' },
  bag_sub:      {
    en: 'Connect with travelers from around the world. Share your knowledge of Laos and earn from what you love.',
    lo: 'ຕິດຕໍ່ນັກທ່ຽວທົ່ວໂລກ. ແບ່ງປັນຄວາມຮູ້ Laos ຂອງທ່ານ.',
    th: 'เชื่อมต่อกับนักท่องเที่ยวทั่วโลก แบ่งปันความรู้เกี่ยวกับลาว',
  },
  bag_apply:    { en: 'Apply Now', lo: 'ສະໝັກດຽວນີ້', th: 'สมัครเลย' },
  bag_free:     { en: 'Free to list', lo: 'ຟຣີ', th: 'ลงทะเบียนฟรี' },

  // Guide Dashboard
  gdash_overview:    { en: 'Overview',        lo: 'ພາບລວມ',      th: 'ภาพรวม'       },
  gdash_profile:     { en: 'My Profile',      lo: 'ໂປຣໄຟລ໌',    th: 'โปรไฟล์'      },
  gdash_tours:       { en: 'My Experiences',  lo: 'ທ່ຽວຂອງຂ້ອຍ', th: 'ทัวร์ของฉัน'  },
  gdash_inquiries:   { en: 'Inquiries',       lo: 'ຄຳຖາມ',       th: 'สอบถาม'       },
  gdash_reviews:     { en: 'Reviews',         lo: 'ລີວີວ',       th: 'รีวิว'        },
  gdash_logout:      { en: 'Sign Out',        lo: 'ອອກ',         th: 'ออกจากระบบ'   },
  gdash_views:       { en: 'Profile Views',   lo: 'ການເບິ່ງ',     th: 'ยอดวิว'       },
  gdash_inq_count:   { en: 'Inquiries',       lo: 'ຄຳຖາມ',       th: 'สอบถาม'       },
  gdash_add_tour:    { en: '+ Add Experience', lo: '+ ເພີ່ມທ່ຽວ', th: '+ เพิ่มทัวร์' },
  gdash_save:        { en: 'Save Changes',    lo: 'ບັນທຶກ',      th: 'บันทึก'       },
  gdash_saving:      { en: 'Saving…',         lo: 'ບັນທຶກ…',     th: 'กำลังบันทึก…' },
  gdash_saved:       { en: 'Saved ✓',         lo: 'ບັນທຶກແລ້ວ ✓', th: 'บันทึกแล้ว ✓' },
  gdash_login_email: { en: 'Your registered email', lo: 'ອີເມວ', th: 'อีเมลที่ลงทะเบียน' },
  gdash_login_phone: { en: 'Your phone number', lo: 'ເບີໂທ', th: 'หมายเลขโทรศัพท์' },
  gdash_login_btn:   { en: 'Sign In', lo: 'ເຂົ້າສູ່ລະບົບ', th: 'เข้าสู่ระบบ' },
  gdash_login_err:   { en: 'Email or phone not found. Contact AlanGuide support.', lo: 'ບໍ່ພົບ. ຕິດຕໍ່ AlanGuide.', th: 'ไม่พบข้อมูล กรุณาติดต่อ AlanGuide' },

  // ── Homepage — AlanGuide sections ───────────────────────────────────
  home_exp_eyebrow: { en: 'Popular Tours & Trips',            lo: 'ທ່ຽວທີ່ນິຍົມ',               th: 'ทัวร์ยอดนิยม'              },
  home_exp_h2:      { en: 'Book a Real Laos Experience',      lo: 'ຈອງທ່ຽວລາວແທ້ໆ',             th: 'จองประสบการณ์ลาวแท้ๆ'      },
  home_exp_sub: {
    en: 'Day trips, multi-day treks, cultural encounters — curated by guides who live the land.',
    lo: 'ທ່ຽວໜຶ່ງວັນ, ທ່ຽວຫຼາຍວັນ, ພົບປະວັດທະນະທຳ — ຈັດໂດຍໄກດ໌ທ້ອງຖິ່ນ.',
    th: 'ทริปหนึ่งวัน เดินป่าหลายวัน สัมผัสวัฒนธรรม — คัดสรรโดยไกด์ท้องถิ่น',
  },
  view_all_exp:     { en: 'All experiences →',               lo: 'ເບິ່ງທັງໝົດ →',              th: 'ดูทั้งหมด →'               },
  home_guide_cta:   { en: 'Find a Guide',                    lo: 'ຫາມັກກ້ຽວ',                  th: 'หาไกด์'                    },
  home_exp_cta:     { en: 'Browse Experiences',              lo: 'ເບິ່ງທ່ຽວ',                  th: 'ดูทัวร์ทั้งหมด'            },
  home_exp_empty:   { en: 'Tours coming soon — guides are building their listings.', lo: 'ກຳລັງເພີ່ມທ່ຽວ...', th: 'กำลังเพิ่มทัวร์เร็วๆ นี้' },

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
