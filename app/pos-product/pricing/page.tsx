import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ราคา — Alan CafeOS',
  description: 'ฟรีในช่วง Beta ทุกฟีเจอร์ปลดล็อก ไม่ต้องใช้บัตรเครดิต',
}

const GOLD = '#c9a84c'

const FREE_FEATURES = [
  'เมนูไม่จำกัด',
  'สต็อกอัตโนมัติ',
  'พนักงานและตารางกะ',
  'POS Terminal บน Browser',
  'ปริ้นใบเสร็จ (ESC/POS)',
  'รายงานยอดขายและกำไร',
  'AI วิเคราะห์ธุรกิจ',
  'รองรับ LAK / THB / USD',
  'ภาษาไทย · ลาว · อังกฤษ',
  'Cloud — ใช้งานได้ทุกอุปกรณ์',
  'Support ทาง LINE / WhatsApp',
]

const COMING_SOON = [
  'บัญชีพนักงานหลายคน',
  'รายงาน Export Excel / PDF',
  'เมนู QR Code สำหรับลูกค้า',
  'ระบบสมาชิกและสะสมแต้ม',
  'Dashboard มือถือ (PWA)',
  'API สำหรับนักพัฒนา',
]

function Check() {
  return <span style={{ color: '#4cba7f', fontWeight: 700, fontSize: 16, marginRight: 10 }}>✓</span>
}

function Clock() {
  return <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, marginRight: 10 }}>○</span>
}

export default function PricingPage() {
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
        <a href="/pos-product" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, color: GOLD }}>ALAN</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', marginLeft: 8 }}>CafeOS</span>
        </a>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="/login" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none' }}>เข้าสู่ระบบ</a>
          <a href="/signup" style={{ backgroundColor: GOLD, color: '#000', padding: '8px 18px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
            ทดลองใช้ฟรี
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: 'center', padding: 'clamp(60px, 8vw, 100px) 24px 40px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(201,168,76,0.1)', color: GOLD, padding: '5px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '2px', marginBottom: 24 }}>
            PRICING
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(32px, 5vw, 52px)', color: 'white', letterSpacing: '-1.5px', marginBottom: 16 }}>
            ง่ายมาก — ฟรีตอนนี้
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 17, lineHeight: 1.7 }}>
            ในช่วง Beta ทุกฟีเจอร์ปลดล็อกหมด ไม่มีข้อจำกัด
            ราคาจะประกาศเมื่อเปิดตัวอย่างเป็นทางการ
          </p>
        </div>
      </section>

      {/* PLANS */}
      <section style={{ padding: '20px 24px 80px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'start' }}>

          {/* FREE BETA — highlighted */}
          <div style={{
            backgroundColor: '#111',
            border: `2px solid ${GOLD}`,
            borderRadius: 20,
            padding: '32px 28px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: -14,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: GOLD,
              color: '#000',
              padding: '4px 18px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '1.5px',
              whiteSpace: 'nowrap',
            }}>
              ✓ พร้อมใช้งานแล้ว
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: '1px' }}>FREE BETA</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: 48, fontFamily: 'var(--font-heading)', lineHeight: 1 }}>฿0</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginLeft: 8 }}>/ เดือน</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
              ฟรีตลอดช่วง Beta ทุกฟีเจอร์ปลดล็อก
            </p>
            <a href="/signup" style={{
              display: 'block',
              backgroundColor: GOLD,
              color: '#000',
              textAlign: 'center',
              padding: '14px',
              borderRadius: 10,
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: 15,
              marginBottom: 28,
            }}>
              สมัครฟรี →
            </a>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FREE_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
                  <Check />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* PRO — coming soon */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: '32px 28px',
            opacity: 0.7,
          }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 13, letterSpacing: '1px' }}>PRO</span>
              <span style={{ marginLeft: 10, backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', padding: '2px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '1px' }}>COMING SOON</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: 48, fontFamily: 'var(--font-heading)', lineHeight: 1 }}>$29</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginLeft: 8 }}>/ เดือน</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
              สำหรับร้านที่ขยายสาขา มีทีมงานมากกว่า 1 คน
            </p>
            <div style={{ display: 'block', backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '14px', borderRadius: 10, fontWeight: 700, fontSize: 14, marginBottom: 28, border: '1px solid rgba(255,255,255,0.08)' }}>
              เร็ว ๆ นี้
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 16 }}>ทุกอย่างใน Free Beta บวก:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {COMING_SOON.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  <Clock />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* ENTERPRISE */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: '32px 28px',
            opacity: 0.7,
          }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 13, letterSpacing: '1px' }}>ENTERPRISE</span>
              <span style={{ marginLeft: 10, backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', padding: '2px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '1px' }}>CUSTOM</span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: 36, fontFamily: 'var(--font-heading)', lineHeight: 1 }}>ติดต่อเรา</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
              สำหรับเชนร้านกาแฟ หลายสาขา API integration
            </p>
            <a href="/contact" style={{
              display: 'block',
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
              padding: '14px',
              borderRadius: 10,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 28,
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              ติดต่อทีม
            </a>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['ทุกอย่างใน Pro', 'Multi-branch dashboard', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'On-premise option'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  <Clock />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 680, margin: '72px auto 0' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28, color: 'white', textAlign: 'center', marginBottom: 40 }}>
            คำถามที่พบบ่อย
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              {
                q: 'Beta ฟรีถึงเมื่อไหร่?',
                a: 'เราจะแจ้งล่วงหน้าอย่างน้อย 30 วันก่อนเปลี่ยนเป็นแบบมีค่าใช้จ่าย ผู้ใช้ Beta จะได้รับส่วนลดพิเศษ'
              },
              {
                q: 'ข้อมูลของฉันปลอดภัยไหม?',
                a: 'เก็บบน Supabase (PostgreSQL) ที่เข้ารหัสทุกชั้น ข้อมูลของคุณเป็นของคุณ Export ได้ตลอด'
              },
              {
                q: 'ต้องมีเครื่องพิมพ์ไหม?',
                a: 'ไม่จำเป็น ระบบทำงานได้ครบโดยไม่มีเครื่องพิมพ์ เพิ่มเครื่องพิมพ์ภายหลังได้ตลอด'
              },
              {
                q: 'รองรับหลายอุปกรณ์ไหม?',
                a: 'รองรับ ใช้งานได้บน Browser ทุกอุปกรณ์ — คอมพิวเตอร์ แท็บเล็ต มือถือ'
              },
            ].map(item => (
              <div key={item.q} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px' }}>
                <p style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{item.q}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
          <a href="/pos-product" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', marginRight: 20 }}>← กลับหน้าหลัก</a>
          Alan CafeOS by Alan Coffee & Travel · Attapeu, Laos
        </div>
      </footer>
    </main>
  )
}
