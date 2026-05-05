import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Alan CafeOS — ระบบ POS สำหรับร้านกาแฟลาว',
  description: 'ระบบจัดการร้านกาแฟครบวงจร เมนู สต็อก พนักงาน รายงาน และปริ้นใบเสร็จ ฟรีในช่วง Beta',
}

const GOLD = '#c9a84c'

const FEATURES = [
  {
    icon: '☕',
    title: 'จัดการเมนูง่าย',
    body: 'เพิ่ม แก้ไข ซ่อนเมนูได้ทันที พร้อมระบบหมวดหมู่และราคาหลายสกุล',
  },
  {
    icon: '📦',
    title: 'สต็อกอัตโนมัติ',
    body: 'ตัดสต็อกวัตถุดิบทุกครั้งที่ขาย แจ้งเตือนเมื่อของใกล้หมด',
  },
  {
    icon: '👥',
    title: 'จัดการพนักงาน',
    body: 'บันทึกเวลาเข้า-ออก ตารางกะ และติดตามประสิทธิภาพรายคน',
  },
  {
    icon: '📊',
    title: 'รายงานแบบ Real-time',
    body: 'ยอดขาย กำไร ต้นทุน — ดูได้ทันทีจากทุกอุปกรณ์',
  },
  {
    icon: '🖨️',
    title: 'ปริ้นใบเสร็จ',
    body: 'รองรับเครื่องพิมพ์ความร้อน Xprinter และ ESC/POS ทุกรุ่น',
  },
  {
    icon: '🤖',
    title: 'AI วิเคราะห์ธุรกิจ',
    body: 'Claude AI วิเคราะห์ยอดขาย แนะนำเมนูขายดี และแจ้งสิ่งที่ควรปรับปรุง',
  },
]

const HOW = [
  { n: '01', title: 'สมัครฟรี', body: 'ไม่ต้องใช้บัตรเครดิต สมัครด้วยอีเมลใน 30 วินาที' },
  { n: '02', title: 'ตั้งค่าร้าน', body: 'กรอกชื่อร้าน เพิ่มเมนู เชื่อมเครื่องพิมพ์ — ใช้งานได้เลย' },
  { n: '03', title: 'เริ่มขาย', body: 'เปิดหน้า POS บนแท็บเล็ตหรือคอมพิวเตอร์ แล้วเริ่มรับออเดอร์' },
]

const STATS = [
  { value: '∞', label: 'เมนูไม่จำกัด' },
  { value: 'LAK', label: 'รองรับสกุลเงินกีบ' },
  { value: '0฿', label: 'ฟรีในช่วง Beta' },
  { value: '24/7', label: 'Cloud พร้อมใช้' },
]

export default function POSProductPage() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', fontFamily: 'var(--font-body)' }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: 'rgba(10,10,10,0.92)',
        borderBottom: '1px solid rgba(201,168,76,0.12)',
        backdropFilter: 'blur(12px)',
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, color: GOLD }}>ALAN</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', marginLeft: 8 }}>CafeOS</span>
        </a>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="/pos-product/pricing" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none' }}>ราคา</a>
          <a href="/login" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none' }}>เข้าสู่ระบบ</a>
          <a href="/signup" style={{
            backgroundColor: GOLD, color: '#000',
            padding: '8px 18px', borderRadius: 8,
            textDecoration: 'none', fontWeight: 700, fontSize: 13,
          }}>
            ทดลองใช้ฟรี
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        background: 'linear-gradient(160deg, #0a0a0a 0%, #13100a 55%, #0a0a0a 100%)',
        padding: 'clamp(80px, 10vw, 140px) 24px clamp(80px, 8vw, 120px)',
        textAlign: 'center',
        borderBottom: '1px solid rgba(201,168,76,0.08)',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: 'rgba(201,168,76,0.12)',
            color: GOLD,
            padding: '5px 16px',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}>
            Beta · ฟรีทุกฟีเจอร์
          </div>

          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 'clamp(38px, 7vw, 72px)',
            color: 'white',
            letterSpacing: '-2px',
            lineHeight: 1.05,
            marginBottom: 24,
          }}>
            ระบบ POS<br />
            <span style={{ color: GOLD }}>สำหรับร้านกาแฟลาว</span>
          </h1>

          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 'clamp(16px, 2.5vw, 20px)',
            lineHeight: 1.7,
            maxWidth: 560,
            margin: '0 auto 40px',
          }}>
            จัดการเมนู สต็อก พนักงาน และรายงาน — ครบในที่เดียว
            ใช้งานง่าย รองรับภาษาไทย ลาว และอังกฤษ
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="/signup" style={{
              backgroundColor: GOLD,
              color: '#000',
              padding: '16px 40px',
              borderRadius: 12,
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: '0.2px',
            }}>
              ทดลองใช้ฟรี →
            </a>
            <a href="/cafe" style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              padding: '16px 32px',
              borderRadius: 12,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 15,
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              ดูตัวอย่าง Demo
            </a>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 16 }}>
            ไม่ต้องใช้บัตรเครดิต · ฟรีในช่วง Beta · ยกเลิกได้ตลอด
          </p>
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '28px 24px',
        backgroundColor: '#0d0d0d',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '8px 0', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 24, color: GOLD }}>{s.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: 'clamp(60px, 8vw, 100px) 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 40px)', color: 'white', letterSpacing: '-0.5px', marginBottom: 12 }}>
            ทุกอย่างที่ร้านกาแฟต้องการ
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16 }}>
            ออกแบบมาสำหรับร้านกาแฟในลาวโดยเฉพาะ
          </p>
        </div>

        <div className="grid-3">
          {FEATURES.map(f => (
            <div key={f.title} style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: '28px 24px',
              transition: 'border-color 0.2s',
            }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ color: 'white', fontWeight: 700, fontSize: 17, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{
        backgroundColor: '#0c0c0c',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: 'clamp(60px, 8vw, 100px) 24px',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 40px)', color: 'white', letterSpacing: '-0.5px', marginBottom: 12 }}>
              เริ่มต้นใน 3 ขั้นตอน
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {HOW.map((h, i) => (
              <div key={h.n} style={{ display: 'flex', gap: 28, alignItems: 'flex-start', paddingBottom: i < HOW.length - 1 ? 40 : 0, position: 'relative' }}>
                <div style={{ flexShrink: 0, textAlign: 'center', width: 52 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    backgroundColor: 'rgba(201,168,76,0.1)',
                    border: `2px solid ${GOLD}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: GOLD, fontWeight: 800, fontSize: 14,
                    fontFamily: 'var(--font-heading)',
                  }}>
                    {h.n}
                  </div>
                  {i < HOW.length - 1 && <div style={{ width: 2, height: 32, backgroundColor: 'rgba(201,168,76,0.15)', margin: '8px auto 0' }} />}
                </div>
                <div style={{ flex: 1, paddingTop: 12 }}>
                  <h3 style={{ color: 'white', fontWeight: 700, fontSize: 19, marginBottom: 8 }}>{h.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7, margin: 0 }}>{h.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BUILT FOR LAOS */}
      <section style={{ padding: 'clamp(60px, 8vw, 100px) 24px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          backgroundColor: 'rgba(201,168,76,0.05)',
          border: '1px solid rgba(201,168,76,0.15)',
          borderRadius: 20,
          padding: 'clamp(36px, 5vw, 60px)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🇱🇦</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(24px, 3.5vw, 36px)', color: 'white', letterSpacing: '-0.5px', marginBottom: 16 }}>
            สร้างมาสำหรับลาวโดยเฉพาะ
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, lineHeight: 1.8, maxWidth: 560, margin: '0 auto 28px' }}>
            รองรับสกุลเงินกีบ (LAK) ภาษาไทย ลาว อังกฤษ
            เขตเวลา Asia/Vientiane และปริ้นใบเสร็จด้วยอักขระพิเศษได้ถูกต้อง
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['🇱🇦 ลาว', '🇹🇭 ไทย', '🇬🇧 English', 'LAK ·฿ · $', 'GMT+7'].map(tag => (
              <span key={tag} style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 99,
                padding: '6px 14px',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
              }}>{tag}</span>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section style={{
        backgroundColor: '#0c0c0c',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: 'clamp(60px, 8vw, 100px) 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(201,168,76,0.1)', color: GOLD, padding: '5px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '2px', marginBottom: 24 }}>
            PRICING
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 40px)', color: 'white', letterSpacing: '-0.5px', marginBottom: 12 }}>
            ฟรี 100% ในช่วง Beta
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            ทุกฟีเจอร์ปลดล็อกหมด ไม่ต้องใช้บัตรเครดิต
            ราคาจะเริ่มเมื่อเปิดตัวอย่างเป็นทางการ
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <a href="/signup" style={{ backgroundColor: GOLD, color: '#000', padding: '15px 36px', borderRadius: 10, textDecoration: 'none', fontWeight: 800, fontSize: 15 }}>
              เริ่มฟรีเลย
            </a>
            <a href="/pos-product/pricing" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', padding: '15px 28px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
              ดูราคา →
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section style={{
        background: 'linear-gradient(160deg, #13100a 0%, #0a0a0a 100%)',
        padding: 'clamp(60px, 8vw, 100px) 24px',
        textAlign: 'center',
        borderTop: '1px solid rgba(201,168,76,0.1)',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 44px)', color: 'white', letterSpacing: '-1px', marginBottom: 16 }}>
            พร้อมเริ่มต้นแล้วหรือยัง?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, marginBottom: 36 }}>
            เข้าร่วม Beta และเป็นส่วนหนึ่งของการพัฒนา Alan CafeOS
          </p>
          <a href="/signup" style={{
            backgroundColor: GOLD,
            color: '#000',
            padding: '18px 52px',
            borderRadius: 12,
            textDecoration: 'none',
            fontWeight: 800,
            fontSize: 17,
            display: 'inline-block',
          }}>
            สมัครฟรี ไม่ต้องใช้บัตรเครดิต
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, color: 'white' }}>ALAN</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', marginLeft: 8 }}>CafeOS</span>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>by Alan Coffee & Travel · Attapeu, Laos</p>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[['/', 'หน้าแรก'], ['/pos-product/pricing', 'ราคา'], ['/login', 'เข้าสู่ระบบ'], ['/signup', 'สมัคร'], ['/contact', 'ติดต่อ']].map(([href, label]) => (
              <a key={href} href={href} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textDecoration: 'none' }}>{label}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  )
}
