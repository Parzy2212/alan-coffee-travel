'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getFaceApi } from '@/lib/faceapi'
import { MoneyInput } from '@/components/MoneyInput'
import {
  GOLD, BLACK, CARD, CARD2, BORDER, RED, GREEN, ORANGE,
  StaffMember, StaffToday, StaffAnalytics, LeaveRequest, StaffForm,
  Badge, LoadingSpinner,
  inputStyle, btnStyle,
  emptyStaffForm,
} from '@/components/cafe/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffWithRole = StaffMember & { role: string | null; photo_url?: string | null }

type AttendanceLog = {
  id: string
  staff_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  status: string
  late_minutes: number | null
}

type StaffPerf = {
  days_present: number
  punctuality_pct: number
  days_late: number
  total_hours: number
}

type PerfMapEntry = {
  days_present: number
  punctuality_pct: number
}

type ScheduledShift = {
  date: string
  shift: string
}

// ─── StaffAvatar ──────────────────────────────────────────────────────────────

function StaffAvatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl: string | null | undefined; size?: number }) {
  const [err, setErr] = useState(false)
  const ini = name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      backgroundColor: `${GOLD}22`, border: `2px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {avatarUrl && !err
        ? <img src={avatarUrl} alt={name} width={size} height={size}
            style={{ width: size, height: size, objectFit: 'cover' }}
            onError={() => setErr(true)} />
        : <span style={{ fontSize: size * 0.35, fontWeight: 700, color: GOLD }}>{ini}</span>
      }
    </div>
  )
}

function staffStatusColor(s: string): string {
  if (s === 'present') return GREEN
  if (s === 'late')    return ORANGE
  if (s === 'absent')  return RED
  return 'rgba(255,255,255,0.3)'
}

function staffStatusLabel(s: string): string {
  if (s === 'present') return 'มาแล้ว'
  if (s === 'late')    return 'สาย'
  if (s === 'absent')  return 'ขาด'
  if (s === 'leave')   return 'ลา'
  return 'ยังไม่มา'
}

function roleLabel(role: string | null): string {
  if (role === 'owner')   return 'เจ้าของ'
  if (role === 'barista')  return 'บาริสต้า'
  if (role === 'cashier')  return 'แคชเชียร์'
  if (role === 'manager')  return 'ผู้จัดการ'
  return 'พนักงาน'
}

// ─── StaffTodayView ───────────────────────────────────────────────────────────

function StaffTodayView() {
  const [rows,    setRows]    = useState<StaffToday[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_staff_today_status').then(({ data }) => {
      setRows((data ?? []) as StaffToday[])
      setLoading(false)
    })
  }, [])

  const present = rows.filter(r => r.status === 'present' || r.status === 'late').length
  const absent  = rows.filter(r => r.status === 'absent').length
  const onTime  = rows.filter(r => r.status === 'present').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'มาทำงาน',  value: present,  color: GREEN },
          { label: 'ตรงเวลา',  value: onTime,   color: GOLD },
          { label: 'ขาดงาน',   value: absent,   color: RED },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: CARD, borderRadius: 12, padding: '16px 18px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              backgroundColor: CARD, borderRadius: 10, border: `1px solid ${BORDER}` }}>
              <StaffAvatar name={r.name} avatarUrl={r.avatar_url} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name_th ?? r.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                  {r.clock_in ? `เข้า ${new Date(r.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : 'ยังไม่ลงชื่อ'}
                  {r.clock_out ? ` · ออก ${new Date(r.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
                  color: staffStatusColor(r.status), backgroundColor: `${staffStatusColor(r.status)}18` }}>
                  {staffStatusLabel(r.status)}
                </span>
                {r.late_minutes && r.late_minutes > 0
                  ? <span style={{ fontSize: 10, color: ORANGE }}>สาย {r.late_minutes} นาที</span>
                  : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── StaffPerfView ────────────────────────────────────────────────────────────

function StaffPerfView() {
  const [rows,    setRows]    = useState<StaffAnalytics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_staff_analytics').then(({ data }) => {
      setRows((data ?? []) as StaffAnalytics[])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>กำลังโหลด...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>ประสิทธิภาพ 30 วันล่าสุด</div>
      {rows.map((r, i) => (
        <div key={r.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
          backgroundColor: CARD, borderRadius: 12, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.2)', width: 28 }}>#{i + 1}</div>
          <StaffAvatar name={r.name} avatarUrl={r.avatar_url} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name_th ?? r.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              {r.days_present} วัน · {r.total_hours.toFixed(0)} ชม. · {r.orders_served} ออเดอร์
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: r.punctuality_pct >= 90 ? GREEN : r.punctuality_pct >= 70 ? GOLD : RED }}>
              {r.punctuality_pct.toFixed(0)}%
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>ตรงเวลา</div>
          </div>
        </div>
      ))}
      {rows.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>ไม่มีข้อมูล</div>}
    </div>
  )
}

// ─── FaceEnrollModal ──────────────────────────────────────────────────────────

function FaceEnrollModal({ staff, onClose, onSaved }: { staff: StaffMember; onClose: () => void; onSaved: () => void }) {
  const streamRef  = useRef<MediaStream | null>(null)
  const videoRef   = useRef<HTMLVideoElement | null>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)

  const [status,   setStatus]  = useState<'idle' | 'live' | 'captured' | 'saving' | 'saved' | 'error'>('idle')
  const [saveStep, setSaveStep] = useState('')
  const [preview,  setPreview] = useState<string | null>(null)
  const [photoBlob,setPhotoBlob] = useState<Blob | null>(null)
  const [errMsg,   setErrMsg]  = useState('')

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    if (node && streamRef.current) {
      node.srcObject = streamRef.current
      node.onloadedmetadata = () => { node.play().catch(() => {}) }
    }
  }, [])

  async function openCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = s
      setStatus('live')
    } catch (e) {
      console.warn('[PhotoEnroll] Camera failed:', e)
      setErrMsg('ไม่สามารถเปิดกล้องได้')
      setStatus('error')
    }
  }

  function shoot() {
    const v = videoRef.current, c = canvasRef.current; if (!v || !c) return
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480
    c.getContext('2d')?.drawImage(v, 0, 0)
    c.toBlob(b => {
      if (!b) return
      setPreview(c.toDataURL())
      setPhotoBlob(b)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setStatus('captured')
    }, 'image/jpeg', 0.88)
  }

  function retake() {
    setPreview(null); setPhotoBlob(null); void openCamera()
  }

  async function save() {
    console.log('Starting save...')
    if (!photoBlob) { setErrMsg('กรุณาถ่ายรูปก่อน'); return }
    if (!preview) { setErrMsg('ไม่มีข้อมูลรูปภาพ'); return }
    setStatus('saving'); setErrMsg('')
    try {
      console.log('Loading face-api models...')
      setSaveStep('กำลังโหลด AI...')
      const fa = await getFaceApi()

      console.log('Detecting face...')
      setSaveStep('กำลังตรวจจับใบหน้า...')
      const img = document.createElement('img')
      img.src = preview
      await new Promise<void>(r => { img.onload = () => r() })
      const det = await fa.detectSingleFace(img, new fa.TinyFaceDetectorOptions())
        .withFaceLandmarks().withFaceDescriptor()
      if (!det) {
        console.warn('No face detected')
        setErrMsg('ไม่พบใบหน้าในรูป กรุณาถ่ายใหม่ให้เห็นหน้าชัดเจน')
        setStatus('captured'); setSaveStep(''); return
      }
      const descriptor = Array.from(det.descriptor as Float32Array)
      console.log('Face detected, descriptor length:', descriptor.length)

      console.log('Uploading photo...')
      setSaveStep('กำลังอัปโหลดรูป...')
      const path = `avatars/${staff.id}_${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('staff-photos').upload(path, photoBlob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) { console.error('Upload error:', upErr.message); setErrMsg(upErr.message); setStatus('captured'); setSaveStep(''); return }
      const url = supabase.storage.from('staff-photos').getPublicUrl(path).data?.publicUrl
      console.log('Uploaded:', url)

      console.log('Saving to DB...')
      setSaveStep('กำลังบันทึก...')
      const { error: dbErr } = await supabase.from('staff').update({ avatar_url: url, face_descriptor: descriptor }).eq('id', staff.id)
      if (dbErr) { console.error('DB error:', dbErr.message); setErrMsg(dbErr.message); setStatus('captured'); setSaveStep(''); return }

      console.log('Done!')
      setSaveStep(''); setStatus('saved')
      setTimeout(() => { onSaved(); onClose() }, 1500)
    } catch (e) {
      console.error('Save failed:', e)
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStatus('captured'); setSaveStep('')
    }
  }

  useEffect(() => {
    void openCamera()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
      <div style={{ backgroundColor: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 24, width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>ถ่ายรูปพนักงาน</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{staff.name_th ?? staff.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {status === 'idle' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>กำลังเปิดกล้อง...</div>
        )}
        {status === 'saved' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>บันทึกรูปถ่าย + ใบหน้าแล้ว</div>
          </div>
        )}
        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: RED, fontSize: 13 }}>{errMsg || 'เกิดข้อผิดพลาด'}</div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {status === 'live' && (
          <>
            <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, backgroundColor: '#000' }}>
              <video ref={setVideoRef} autoPlay playsInline muted
                style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'cover' }} />
            </div>
            <button onClick={shoot}
              style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', backgroundColor: GOLD, color: BLACK }}>
              📷 ถ่ายรูป
            </button>
          </>
        )}
        {(status === 'captured' || status === 'saving') && (
          <>
            {preview && <img src={preview} style={{ width: '100%', borderRadius: 10, marginBottom: 14, maxHeight: 260, objectFit: 'cover' }} />}
            {saveStep && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, backgroundColor: `${GOLD}12`, marginBottom: 8 }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${GOLD}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>{saveStep}</span>
              </div>
            )}
            {errMsg && <div style={{ color: RED, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{errMsg}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={retake} disabled={status === 'saving'}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${BORDER}`, background: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>
                ถ่ายใหม่
              </button>
              <button onClick={() => void save()} disabled={status === 'saving'}
                style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: status === 'saving' ? 'not-allowed' : 'pointer', backgroundColor: GOLD, color: BLACK, opacity: status === 'saving' ? 0.7 : 1 }}>
                {status === 'saving' ? '...' : 'บันทึกรูปถ่าย + ใบหน้า'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── LeavesView ───────────────────────────────────────────────────────────────

function LeavesView() {
  const [leaves,   setLeaves]   = useState<LeaveRequest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [noTable,  setNoTable]  = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, staff:staff_id(name)')
      .order('created_at', { ascending: false })
      .limit(100)
    if ((error as { code?: string } | null)?.code === '42P01') { setNoTable(true); setLoading(false); return }
    setLeaves((data as LeaveRequest[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setActingId(id)
    await supabase.from('leave_requests').update({ status }).eq('id', id)
    await load()
    setActingId(null)
  }

  const leaveLabel = (t: string) => t === 'sick' ? 'ลาป่วย' : t === 'personal' ? 'ลากิจ' : t === 'vacation' ? 'ลาพักร้อน' : t
  const statusColor = (s: string) => s === 'approved' ? GREEN : s === 'rejected' ? RED : GOLD
  const statusLabel = (s: string) => s === 'approved' ? 'อนุมัติแล้ว' : s === 'rejected' ? 'ปฏิเสธแล้ว' : 'รอดำเนินการ'

  if (noTable) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
      ยังไม่มีตาราง leave_requests — กรุณา run SQL migration ก่อน
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>คำขอลาทั้งหมด {leaves.length} รายการ · รอดำเนินการ {leaves.filter(l => l.status === 'pending').length} รายการ</span>
      </div>
      {loading ? <LoadingSpinner /> : leaves.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)' }}>ไม่มีคำขอลา</div>
      ) : (
        leaves.map(lv => (
          <div key={lv.id} style={{ padding: '16px 18px', borderRadius: 12, backgroundColor: CARD, border: `1px solid ${lv.status === 'pending' ? GOLD + '33' : BORDER}`, display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{lv.staff?.name ?? lv.staff_id.slice(0, 8)}</span>
                <Badge label={leaveLabel(lv.leave_type)} bg={GOLD + '18'} color={GOLD} />
                <Badge label={statusLabel(lv.status)} bg={statusColor(lv.status) + '18'} color={statusColor(lv.status)} />
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {lv.start_date} → {lv.end_date}
                {lv.reason && <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.3)' }}>· {lv.reason}</span>}
                <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>{new Date(lv.created_at).toLocaleDateString('th-TH')}</span>
              </div>
            </div>
            {lv.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => void updateStatus(lv.id, 'approved')} disabled={actingId === lv.id}
                  style={{ padding: '7px 16px', borderRadius: 7, border: 'none', backgroundColor: GREEN, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: actingId === lv.id ? 0.6 : 1 }}>อนุมัติ</button>
                <button onClick={() => void updateStatus(lv.id, 'rejected')} disabled={actingId === lv.id}
                  style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${RED}44`, backgroundColor: `${RED}10`, color: RED, fontWeight: 600, fontSize: 12, cursor: 'pointer', opacity: actingId === lv.id ? 0.6 : 1 }}>ปฏิเสธ</button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── StaffCardGrid ────────────────────────────────────────────────────────────

function StaffCardGrid({ onProfile, onAdd }: { onProfile: (s: StaffWithRole) => void; onAdd: () => void }) {
  const [staffList, setStaffList] = useState<StaffWithRole[]>([])
  const [todayMap,  setTodayMap]  = useState<Record<string, StaffToday>>({})
  const [perfMap,   setPerfMap]   = useState<Record<string, PerfMapEntry>>({})
  const [loading,   setLoading]   = useState(true)
  const [inactiveExpanded, setInactiveExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [staffRes, todayRes, perfRes] = await Promise.all([
      supabase.rpc('get_all_staff'),
      supabase.rpc('get_staff_today_status'),
      supabase.rpc('get_staff_analytics'),
    ])
    const staff = (staffRes.data ?? []) as StaffWithRole[]
    const today = (todayRes.data ?? []) as StaffToday[]
    const perf  = (perfRes.data ?? []) as StaffAnalytics[]

    const todayMapBuilt: Record<string, StaffToday> = {}
    today.forEach(t => { todayMapBuilt[t.id] = t })

    const perfMapBuilt: Record<string, PerfMapEntry> = {}
    perf.forEach(p => { perfMapBuilt[p.id] = { days_present: p.days_present, punctuality_pct: p.punctuality_pct } })

    setStaffList(staff)
    setTodayMap(todayMapBuilt)
    setPerfMap(perfMapBuilt)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function cardBarColor(s: StaffWithRole, t: StaffToday | undefined): string {
    if (!s.is_active) return RED
    if (!t) return '#f0a500'
    if (t.status === 'present') return GREEN
    if (t.status === 'late')    return ORANGE
    if (t.status === 'absent')  return RED
    return '#f0a500'
  }

  function renderCard(s: StaffWithRole) {
    const t = todayMap[s.id]
    const barColor = cardBarColor(s, t)
    const inactive = !s.is_active
    const pEntry = perfMap[s.id]

    let statusBadgeLabel = 'ยังไม่มา'
    let statusBadgeColor = 'rgba(255,255,255,0.3)'
    if (!s.is_active) {
      statusBadgeLabel = 'ปิดใช้งาน'
      statusBadgeColor = RED
    } else if (t) {
      statusBadgeLabel = staffStatusLabel(t.status)
      statusBadgeColor = staffStatusColor(t.status)
    }

    return (
      <div
        key={s.id}
        onClick={() => onProfile(s)}
        style={{
          backgroundColor: CARD,
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          padding: '14px 14px 14px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          opacity: inactive ? 0.4 : 1,
          overflow: 'hidden',
          position: 'relative',
          transition: 'border-color .15s',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          {/* Left color bar */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: 4, backgroundColor: barColor, borderRadius: '12px 0 0 12px',
          }} />
          <div style={{ width: 14, flexShrink: 0 }} />
          <StaffAvatar name={s.name} avatarUrl={s.avatar_url ?? s.photo_url} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {s.name_th ?? s.name}
            </div>
            <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 99,
                backgroundColor: `${GOLD}18`, color: GOLD, fontWeight: 600,
              }}>
                {roleLabel(s.role)}
              </span>
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 99,
                color: statusBadgeColor, backgroundColor: `${statusBadgeColor}18`,
              }}>
                {statusBadgeLabel}
              </span>
            </div>
            {t?.clock_in && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                เข้า {new Date(t.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
        {/* Stats row */}
        <div style={{
          width: '100%', paddingLeft: 18, paddingRight: 4,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'rgba(255,255,255,0.28)',
        }}>
          <span>{pEntry ? pEntry.days_present : 0} วัน</span>
          <span>·</span>
          <span>{pEntry ? pEntry.punctuality_pct.toFixed(0) : 0}% ตรงเวลา</span>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner />

  const activeStaff   = staffList.filter(s => s.is_active)
  const inactiveStaff = staffList.filter(s => !s.is_active)

  return (
    <div>
      {/* Active staff */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
        {activeStaff.map(s => renderCard(s))}
      </div>

      {/* Inactive staff collapsible section */}
      {inactiveStaff.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setInactiveExpanded(e => !e)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: `1px solid ${RED}22`, background: `${RED}06`,
              color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span>พนักงานปิดใช้งาน ({inactiveStaff.length} คน)</span>
            <span style={{ fontSize: 11 }}>{inactiveExpanded ? '▲' : '▼'}</span>
          </button>
          {inactiveExpanded && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 10 }}>
              {inactiveStaff.map(s => renderCard(s))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onAdd}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 10,
          border: `1px dashed ${GOLD}55`, background: 'none',
          color: GOLD, fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}
      >
        + เพิ่มพนักงาน
      </button>
    </div>
  )
}

// ─── StaffProfileView ─────────────────────────────────────────────────────────

function StaffProfileView({
  staff, todayStatus, onBack, onEnroll, onRefresh,
}: {
  staff: StaffWithRole
  todayStatus: StaffToday | null
  onBack: () => void
  onEnroll: () => void
  onRefresh: () => void
}) {
  const [perf,         setPerf]         = useState<StaffPerf | null>(null)
  const [attendance,   setAttendance]   = useState<AttendanceLog[]>([])
  const [loadingPerf,  setLoadingPerf]  = useState(true)
  const [showEdit,     setShowEdit]     = useState(false)
  const [form,         setForm]         = useState<StaffForm>(emptyStaffForm())
  const [saving,       setSaving]       = useState(false)
  const [errMsg,       setErrMsg]       = useState('')
  const [showPin,      setShowPin]      = useState(false)
  const [toggling,     setToggling]     = useState(false)
  const [leaveBalance, setLeaveBalance] = useState<number | null>(null)
  const [leaveDaysUsed, setLeaveDaysUsed] = useState<number>(0)
  const [weekShifts,   setWeekShifts]   = useState<ScheduledShift[]>([])
  const [deleteStep,   setDeleteStep]   = useState<0 | 1 | 2 | 3>(0)
  const [deleteNameInput, setDeleteNameInput] = useState('')
  const [deleting,     setDeleting]     = useState(false)

  useEffect(() => {
    // Compute current week Monday–Sunday
    const now = new Date()
    const day = now.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const mondayStr = monday.toISOString().slice(0, 10)
    const sundayStr = sunday.toISOString().slice(0, 10)
    const currentYear = now.getFullYear()

    Promise.all([
      supabase.rpc('get_staff_performance', { p_staff_id: staff.id, p_days: 30 }),
      supabase.from('attendance').select('*').eq('staff_id', staff.id).order('date', { ascending: false }).limit(7),
      supabase.from('leave_requests').select('start_date, end_date').eq('staff_id', staff.id).eq('status', 'approved'),
      supabase.from('staff_schedules').select('date, shift').eq('staff_id', staff.id).gte('date', mondayStr).lte('date', sundayStr),
    ]).then(([perfRes, attRes, leaveRes, shiftsRes]) => {
      const d = perfRes.data
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        setPerf(d as StaffPerf)
      } else if (Array.isArray(d) && d.length > 0) {
        setPerf(d[0] as StaffPerf)
      }
      setAttendance((attRes.data ?? []) as AttendanceLog[])

      // Calculate leave balance
      const leaveRows = (leaveRes.data ?? []) as { start_date: string; end_date: string }[]
      let daysUsed = 0
      for (const lv of leaveRows) {
        const start = new Date(lv.start_date + 'T00:00:00')
        const end   = new Date(lv.end_date   + 'T00:00:00')
        if (start.getFullYear() === currentYear || end.getFullYear() === currentYear) {
          const yearStart = new Date(`${currentYear}-01-01T00:00:00`)
          const yearEnd   = new Date(`${currentYear}-12-31T00:00:00`)
          const clampedStart = start < yearStart ? yearStart : start
          const clampedEnd   = end   > yearEnd   ? yearEnd   : end
          if (clampedEnd >= clampedStart) {
            const diffMs = clampedEnd.getTime() - clampedStart.getTime()
            daysUsed += Math.round(diffMs / 86400000) + 1
          }
        }
      }
      setLeaveDaysUsed(daysUsed)
      setLeaveBalance(30 - daysUsed)

      setWeekShifts((shiftsRes.data ?? []) as ScheduledShift[])
      setLoadingPerf(false)
    })
  }, [staff.id])

  function openEdit() {
    setForm({
      name: staff.name,
      name_th: staff.name_th ?? '',
      name_lo: '',
      phone: staff.phone ?? '',
      salary: String(staff.salary ?? ''),
      salary_type: staff.salary_type ?? 'monthly',
      role: staff.role ?? 'barista',
      start_date: staff.start_date ?? new Date().toISOString().slice(0, 10),
      scheduled_start_time: staff.scheduled_start_time ?? '08:00',
      skills: (staff.skills ?? []).join(', '),
      notes: staff.notes ?? '',
      pin: '',
    })
    setErrMsg('')
    setShowEdit(true)
  }

  async function saveEdit() {
    if (!form.name.trim()) { setErrMsg('กรุณากรอกชื่อ'); return }
    if (form.pin && !/^\d{4}$/.test(form.pin)) { setErrMsg('PIN ต้องเป็นตัวเลข 4 หลัก'); return }
    setSaving(true); setErrMsg('')
    try {
      const skillsArr = form.skills.split(',').map(s => s.trim()).filter(Boolean)
      const payload: Record<string, unknown> = {
        name: form.name || null,
        name_th: form.name_th || null,
        phone: form.phone || null,
        role: form.role || null,
        salary: form.salary ? parseFloat(form.salary) : null,
        salary_type: form.salary_type || null,
        start_date: form.start_date || null,
        scheduled_start_time: form.scheduled_start_time || null,
        skills: skillsArr.length ? skillsArr : null,
        notes: form.notes || null,
      }
      if (form.pin) payload.pin_code = form.pin
      const { error } = await supabase.from('staff').update(payload).eq('id', staff.id)
      if (error) { setErrMsg(error.message); return }
      setShowEdit(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive() {
    setToggling(true)
    await supabase.rpc('toggle_staff_active', { p_id: staff.id })
    // If deactivating, remove from all future schedule slots
    if (staff.is_active) {
      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('staff_schedules').delete()
        .eq('staff_id', staff.id).gte('date', today)
    }
    setToggling(false)
    onRefresh()
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await supabase.from('staff_schedules').delete().eq('staff_id', staff.id)
      await supabase.from('staff').delete().eq('id', staff.id)
      onRefresh()
    } finally {
      setDeleting(false)
    }
  }

  const fld = (k: keyof StaffForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))
  const fMoney = (k: keyof StaffForm) => (v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const fieldStyle: React.CSSProperties = {
    ...inputStyle, fontSize: 13,
  }
  const labelSt: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }

  const salaryTypeLabel = (t: string | null) =>
    t === 'daily' ? 'รายวัน' : t === 'hourly' ? 'รายชั่วโมง' : 'รายเดือน'

  function shiftLabel(shift: string): string {
    if (shift === 'morning')   return 'เช้า☀️'
    if (shift === 'afternoon') return 'บ่าย🌤️'
    if (shift === 'evening')   return 'เย็น🌙'
    return shift
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <StaffAvatar name={staff.name} avatarUrl={staff.avatar_url ?? staff.photo_url} size={80} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{staff.name_th ?? staff.name}</div>
          {staff.name_th && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{staff.name}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge label={roleLabel(staff.role)} bg={`${GOLD}18`} color={GOLD} />
            {staff.is_active
              ? <Badge label="ใช้งาน" bg={`${GREEN}18`} color={GREEN} />
              : <Badge label="ปิดใช้งาน" bg={`${RED}18`} color={RED} />
            }
          </div>
          {staff.start_date && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
              เริ่มงาน {new Date(staff.start_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {loadingPerf ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>กำลังโหลดข้อมูล...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'วันที่มา',   value: perf?.days_present ?? '—',                color: GREEN },
            { label: 'ตรงเวลา%',   value: perf ? `${perf.punctuality_pct.toFixed(0)}%` : '—', color: GOLD },
            { label: 'สายกี่ครั้ง', value: perf?.days_late ?? '—',                   color: ORANGE },
            { label: 'ชั่วโมง',    value: perf ? perf.total_hours.toFixed(0) : '—', color: 'rgba(255,255,255,0.7)' },
          ].map(k => (
            <div key={k.label} style={{ backgroundColor: CARD, borderRadius: 10, padding: '12px 10px', border: `1px solid ${BORDER}`, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{String(k.value)}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Salary */}
      <div style={{ backgroundColor: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>เงินเดือน</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>
            {staff.salary ? new Intl.NumberFormat('lo-LA').format(staff.salary) : '—'} ₭
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{salaryTypeLabel(staff.salary_type)}</span>
        </div>
      </div>

      {/* Leave balance */}
      {!loadingPerf && (
        <div style={{ backgroundColor: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>วันลาคงเหลือ</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: GREEN }}>{leaveBalance ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>ใช้ไปแล้ว {leaveDaysUsed} / 30 วัน</div>
        </div>
      )}

      {/* Scheduled shifts this week */}
      {!loadingPerf && (
        <div style={{ backgroundColor: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>กะสัปดาห์นี้</div>
          {weekShifts.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>ไม่มีกะ</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {weekShifts.map((ws, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 90 }}>
                    {new Date(ws.date + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </span>
                  <span style={{ fontSize: 12, color: GOLD }}>{shiftLabel(ws.shift)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Last 7 days attendance */}
      {attendance.length > 0 && (
        <div style={{ backgroundColor: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>การเข้างาน 7 วันล่าสุด</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attendance.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: staffStatusColor(a.status), flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', minWidth: 90 }}>
                  {new Date(a.date).toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: 'short' })}
                </div>
                <div style={{ fontSize: 11, color: staffStatusColor(a.status) }}>{staffStatusLabel(a.status)}</div>
                {a.clock_in && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
                    {new Date(a.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    {a.clock_out ? ` – ${new Date(a.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit form */}
      {showEdit && (
        <div style={{ backgroundColor: CARD, borderRadius: 14, padding: '18px 16px', border: `1px solid ${GOLD}44` }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>แก้ไขข้อมูลพนักงาน</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><div style={labelSt}>ชื่อ (EN) *</div><input value={form.name} onChange={fld('name')} style={fieldStyle} /></div>
            <div><div style={labelSt}>ชื่อ (ภาษาไทย)</div><input value={form.name_th} onChange={fld('name_th')} style={fieldStyle} /></div>
            <div><div style={labelSt}>เบอร์โทร</div><input value={form.phone} onChange={fld('phone')} style={fieldStyle} /></div>
            <div>
              <div style={labelSt}>ตำแหน่ง</div>
              <select value={form.role} onChange={fld('role')} style={fieldStyle}>
                <option value="owner">เจ้าของ</option>
                <option value="manager">ผู้จัดการ</option>
                <option value="barista">บาริสต้า</option>
                <option value="cashier">แคชเชียร์</option>
              </select>
            </div>
            <div>
              <div style={labelSt}>ประเภทเงินเดือน</div>
              <select value={form.salary_type} onChange={fld('salary_type')} style={fieldStyle}>
                <option value="monthly">รายเดือน</option>
                <option value="daily">รายวัน</option>
                <option value="hourly">รายชั่วโมง</option>
              </select>
            </div>
            <div><div style={labelSt}>เงินเดือน (LAK)</div><MoneyInput value={form.salary} onChange={fMoney('salary')} style={fieldStyle} placeholder="0" /></div>
            <div><div style={labelSt}>เวลาเริ่มงาน</div><input type="time" value={form.scheduled_start_time} onChange={fld('scheduled_start_time')} style={fieldStyle} /></div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelSt}>PIN (เว้นว่าง = ไม่เปลี่ยน)</div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={form.pin}
                  onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setForm(p => ({ ...p, pin: v })) }}
                  placeholder="••••"
                  style={{ ...fieldStyle, paddingRight: 36, letterSpacing: showPin ? 2 : 6 }}
                />
                <button type="button" onClick={() => setShowPin(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>
                  {showPin ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelSt}>ทักษะ (คั่นด้วยจุลภาค)</div>
              <input value={form.skills} onChange={fld('skills')} style={fieldStyle} placeholder="บาริสต้า, เบเกอรี่..." />
            </div>
          </div>
          {errMsg && <div style={{ color: RED, fontSize: 12, marginTop: 8 }}>{errMsg}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => void saveEdit()} disabled={saving}
              style={{ ...btnStyle(GOLD), padding: '9px 20px' }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={() => setShowEdit(false)}
              style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showEdit && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={openEdit}
            style={{ padding: '10px 18px', borderRadius: 9, border: `1px solid ${GOLD}44`, background: `${GOLD}10`, color: GOLD, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            แก้ไขข้อมูล
          </button>
          <button onClick={onEnroll}
            style={{ padding: '10px 18px', borderRadius: 9, border: `1px solid ${BORDER}`, background: 'none', color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            ถ่ายรูปหน้า
          </button>
          <button onClick={() => void toggleActive()} disabled={toggling}
            style={{
              padding: '10px 18px', borderRadius: 9, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              backgroundColor: staff.is_active ? `${RED}18` : `${GREEN}18`,
              color: staff.is_active ? RED : GREEN,
              opacity: toggling ? 0.6 : 1,
            }}>
            {toggling ? '...' : staff.is_active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
          </button>

          {/* Delete button — only for inactive staff */}
          {!staff.is_active && deleteStep === 0 && (
            <button
              onClick={() => setDeleteStep(1)}
              style={{ padding: '10px 18px', borderRadius: 9, border: `1px solid ${RED}44`, background: `${RED}10`, color: RED, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              ลบพนักงาน
            </button>
          )}
        </div>
      )}

      {/* Delete flow */}
      {!showEdit && !staff.is_active && deleteStep === 1 && (
        <div style={{ backgroundColor: CARD, borderRadius: 12, padding: '16px 18px', border: `2px solid ${RED}44` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: RED, marginBottom: 8 }}>⚠️ ลบพนักงานถาวร</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>
            ข้อมูลและประวัติทั้งหมดจะถูกลบ ไม่สามารถกู้คืนได้
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDeleteStep(2)}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', backgroundColor: RED, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ยืนยัน
            </button>
            <button onClick={() => setDeleteStep(0)}
              style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {!showEdit && !staff.is_active && deleteStep === 2 && (
        <div style={{ backgroundColor: CARD, borderRadius: 12, padding: '16px 18px', border: `2px solid ${RED}` }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
            พิมพ์ชื่อพนักงาน เพื่อยืนยัน:
            <span style={{ color: RED, fontWeight: 700, marginLeft: 6 }}>{staff.name_th ?? staff.name}</span>
          </div>
          <input
            value={deleteNameInput}
            onChange={e => setDeleteNameInput(e.target.value)}
            placeholder="พิมพ์ชื่อเพื่อยืนยัน"
            style={{ ...inputStyle, fontSize: 13, marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { void handleDelete() }}
              disabled={deleteNameInput !== (staff.name_th ?? staff.name) || deleting}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                backgroundColor: deleteNameInput === (staff.name_th ?? staff.name) ? RED : 'rgba(255,255,255,0.1)',
                color: deleteNameInput === (staff.name_th ?? staff.name) ? '#fff' : 'rgba(255,255,255,0.3)',
                fontWeight: 700, fontSize: 13,
                cursor: deleteNameInput === (staff.name_th ?? staff.name) && !deleting ? 'pointer' : 'not-allowed',
                opacity: deleting ? 0.6 : 1,
              }}>
              {deleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
            </button>
            <button onClick={() => { setDeleteStep(0); setDeleteNameInput('') }}
              style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AddStaffWizard ───────────────────────────────────────────────────────────

function AddStaffWizard({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(1)

  // Step 1 fields
  const [name,        setName]        = useState('')
  const [nameTh,      setNameTh]      = useState('')
  const [phone,       setPhone]       = useState('')
  const [role,        setRole]        = useState('barista')
  const [salary,      setSalary]      = useState('')
  const [salaryType,  setSalaryType]  = useState('monthly')
  const [startDate,   setStartDate]   = useState(new Date().toISOString().slice(0, 10))
  const [pin,         setPin]         = useState('')
  const [showPin,     setShowPin]     = useState(false)
  const [step1Err,    setStep1Err]    = useState('')

  // Step 2 fields
  const streamRef  = useRef<MediaStream | null>(null)
  const videoRef2  = useRef<HTMLVideoElement | null>(null)
  const canvasRef2 = useRef<HTMLCanvasElement | null>(null)
  const [camStatus, setCamStatus]   = useState<'idle' | 'live' | 'captured' | 'error'>('idle')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBlob,    setPhotoBlob]    = useState<Blob | null>(null)

  // Step 3 fields
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState('')

  const setVideoRef2 = useCallback((node: HTMLVideoElement | null) => {
    videoRef2.current = node
    if (node && streamRef.current) {
      node.srcObject = streamRef.current
      node.onloadedmetadata = () => { node.play().catch(() => {}) }
    }
  }, [])

  async function openCam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = s
      setCamStatus('live')
    } catch {
      setCamStatus('error')
    }
  }

  function shootPhoto() {
    const v = videoRef2.current
    const c = canvasRef2.current
    if (!v || !c) return
    c.width = v.videoWidth || 640
    c.height = v.videoHeight || 480
    c.getContext('2d')?.drawImage(v, 0, 0)
    c.toBlob(b => {
      if (!b) return
      setPhotoPreview(c.toDataURL())
      setPhotoBlob(b)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setCamStatus('captured')
    }, 'image/jpeg', 0.88)
  }

  function retakePhoto() {
    setPhotoPreview(null)
    setPhotoBlob(null)
    setCamStatus('idle')
    void openCam()
  }

  useEffect(() => {
    if (step === 2) { void openCam() }
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [step])

  function validateStep1(): boolean {
    if (!name.trim()) { setStep1Err('กรุณากรอกชื่อพนักงาน'); return false }
    if (!pin) { setStep1Err('กรุณากรอก PIN 4 หลัก'); return false }
    if (!/^\d{4}$/.test(pin)) { setStep1Err('PIN ต้องเป็นตัวเลข 4 หลักเท่านั้น'); return false }
    return true
  }

  async function handleSave() {
    setSaving(true); setSaveErr('')
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('staff')
        .insert({
          name,
          name_th: nameTh || null,
          phone: phone || null,
          role,
          salary: salary ? parseFloat(salary) : null,
          salary_type: salaryType,
          pin_code: pin,
          start_date: startDate,
          is_active: true,
        })
        .select('id')
        .single()

      if (insertErr) { setSaveErr(insertErr.message); return }

      const newId = inserted?.id
      if (newId && photoBlob) {
        const path = `staff-photos/${newId}.jpg`
        const { error: upErr } = await supabase.storage
          .from('staff-photos')
          .upload(path, photoBlob, { upsert: true, contentType: 'image/jpeg' })
        if (!upErr) {
          const url = supabase.storage.from('staff-photos').getPublicUrl(path).data?.publicUrl
          await supabase.from('staff').update({ avatar_url: url }).eq('id', newId)
        }
      }

      onDone()
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const inputSt: React.CSSProperties = {
    ...inputStyle, fontSize: 13, padding: '10px 12px',
  }
  const labelSt: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }

  // Step indicator
  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
      {[1, 2, 3].map((n, i) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            backgroundColor: step === n ? GOLD : step > n ? `${GOLD}55` : 'rgba(255,255,255,0.08)',
            color: step === n ? BLACK : step > n ? GOLD : 'rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, flexShrink: 0,
            border: step === n ? 'none' : `1px solid ${step > n ? GOLD + '44' : BORDER}`,
          }}>
            {n}
          </div>
          {i < 2 && (
            <div style={{
              width: 48, height: 2,
              backgroundColor: step > n ? `${GOLD}55` : 'rgba(255,255,255,0.08)',
            }} />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>
          ←
        </button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>เพิ่มพนักงานใหม่</div>
      </div>

      <StepIndicator />

      {/* Step 1 */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: GOLD }}>ข้อมูลพื้นฐาน</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <div style={labelSt}>ชื่อ (English) *</div>
              <input value={name} onChange={e => setName(e.target.value)} style={inputSt} placeholder="เช่น Somchai" />
            </div>
            <div>
              <div style={labelSt}>ชื่อ (ภาษาไทย)</div>
              <input value={nameTh} onChange={e => setNameTh(e.target.value)} style={inputSt} placeholder="เช่น สมชาย" />
            </div>
            <div>
              <div style={labelSt}>เบอร์โทร</div>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inputSt} placeholder="020-xxx-xxxx" />
            </div>
            <div>
              <div style={labelSt}>ตำแหน่ง *</div>
              <select value={role} onChange={e => setRole(e.target.value)} style={inputSt}>
                <option value="owner">เจ้าของ</option>
                <option value="manager">ผู้จัดการ</option>
                <option value="barista">บาริสต้า</option>
                <option value="cashier">แคชเชียร์</option>
              </select>
            </div>
            <div>
              <div style={labelSt}>เงินเดือน (LAK)</div>
              <MoneyInput value={salary} onChange={v => setSalary(v)} style={inputSt} placeholder="0" />
            </div>
            <div>
              <div style={labelSt}>ประเภทเงินเดือน</div>
              <select value={salaryType} onChange={e => setSalaryType(e.target.value)} style={inputSt}>
                <option value="monthly">รายเดือน</option>
                <option value="daily">รายวัน</option>
                <option value="hourly">รายชั่วโมง</option>
              </select>
            </div>
            <div>
              <div style={labelSt}>วันที่เริ่มงาน</div>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputSt} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelSt}>PIN * (4 หลัก)</div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setPin(v) }}
                  placeholder="กรอก PIN 4 หลัก"
                  style={{ ...inputSt, paddingRight: 40, letterSpacing: showPin ? 3 : 8 }}
                />
                <button type="button" onClick={() => setShowPin(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>
                  {showPin ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          </div>
          {step1Err && <div style={{ color: RED, fontSize: 12, marginTop: 10 }}>{step1Err}</div>}
          <button
            onClick={() => { setStep1Err(''); if (validateStep1()) setStep(2) }}
            style={{ ...btnStyle(GOLD), marginTop: 20, width: '100%', padding: 13, fontSize: 14 }}>
            ถัดไป →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: GOLD }}>รูปถ่าย (ไม่บังคับ)</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 18 }}>
            รูปถ่ายช่วยให้จดจำพนักงานได้ง่าย สามารถเพิ่มภายหลังได้
          </div>
          <canvas ref={canvasRef2} style={{ display: 'none' }} />

          {camStatus === 'idle' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>กำลังเปิดกล้อง...</div>
          )}
          {camStatus === 'error' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: RED, fontSize: 13 }}>ไม่สามารถเปิดกล้องได้</div>
          )}
          {camStatus === 'live' && (
            <div>
              <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, backgroundColor: '#000' }}>
                <video ref={setVideoRef2} autoPlay playsInline muted
                  style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'cover' }} />
              </div>
              <button onClick={shootPhoto}
                style={{ ...btnStyle(GOLD), width: '100%', padding: 12, fontSize: 14 }}>
                📷 ถ่าย
              </button>
            </div>
          )}
          {camStatus === 'captured' && photoPreview && (
            <div>
              <img src={photoPreview} style={{ width: '100%', borderRadius: 10, marginBottom: 14, maxHeight: 240, objectFit: 'cover' }} />
              <button onClick={retakePhoto}
                style={{ width: '100%', padding: 10, borderRadius: 9, border: `1px solid ${BORDER}`, background: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
                ถ่ายใหม่
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setStep(3) }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
              ข้ามขั้นตอนนี้
            </button>
            <button
              onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setStep(3) }}
              style={{ ...btnStyle(GOLD), padding: '10px 24px', fontSize: 14 }}>
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: GOLD }}>ยืนยันข้อมูล</div>
          <div style={{ backgroundColor: CARD, borderRadius: 12, padding: '18px 16px', border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'ชื่อ',         value: nameTh || name },
              { label: 'ตำแหน่ง',      value: roleLabel(role) },
              { label: 'เบอร์โทร',     value: phone || '—' },
              { label: 'วันที่เริ่มงาน', value: startDate },
              { label: 'เงินเดือน',    value: salary ? `${new Intl.NumberFormat('lo-LA').format(parseFloat(salary))} ₭` : '—' },
              { label: 'ประเภท',        value: salary ? (salaryType === 'daily' ? 'รายวัน' : salaryType === 'hourly' ? 'รายชั่วโมง' : 'รายเดือน') : '—' },
              { label: 'รูปถ่าย',      value: photoBlob ? 'มีรูปถ่าย' : 'ไม่มี (สามารถเพิ่มภายหลัง)' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {saveErr && <div style={{ color: RED, fontSize: 12, marginBottom: 12 }}>{saveErr}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)}
              style={{ flex: 1, padding: 12, borderRadius: 9, border: `1px solid ${BORDER}`, background: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13 }}>
              ← แก้ไข
            </button>
            <button onClick={() => void handleSave()} disabled={saving}
              style={{ flex: 2, ...btnStyle(GOLD), padding: 12, fontSize: 14, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── StaffTab ─────────────────────────────────────────────────────────────────

export default function StaffTab() {
  const [view,         setView]         = useState<'list' | 'profile' | 'wizard' | 'today' | 'perf' | 'leaves'>('list')
  const [selectedStaff, setSelectedStaff] = useState<StaffWithRole | null>(null)
  const [enrollTarget, setEnrollTarget] = useState<StaffMember | null>(null)
  const [todayData,    setTodayData]    = useState<StaffToday[]>([])
  const [refreshKey,   setRefreshKey]   = useState(0)

  useEffect(() => {
    supabase.rpc('get_staff_today_status').then(({ data }) => {
      setTodayData((data ?? []) as StaffToday[])
    })
  }, [refreshKey])

  const todayMap: Record<string, StaffToday> = {}
  todayData.forEach(t => { todayMap[t.id] = t })

  const subNavTabs: { id: 'list' | 'today' | 'perf' | 'leaves'; label: string }[] = [
    { id: 'list',   label: '📋 รายชื่อ' },
    { id: 'today',  label: '📅 วันนี้' },
    { id: 'perf',   label: '📈 ประสิทธิภาพ' },
    { id: 'leaves', label: '🌿 คำขอลา' },
  ]

  const showSubNav = view !== 'profile' && view !== 'wizard'

  function handleProfile(s: StaffWithRole) {
    setSelectedStaff(s)
    setView('profile')
  }

  function handleBack() {
    setSelectedStaff(null)
    setView('list')
  }

  function handleRefresh() {
    setRefreshKey(k => k + 1)
    setView('list')
    setSelectedStaff(null)
  }

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Enroll overlay */}
      {enrollTarget && (
        <FaceEnrollModal
          staff={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onSaved={() => { setEnrollTarget(null); setRefreshKey(k => k + 1) }}
        />
      )}

      {/* Sub-nav */}
      {showSubNav && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: `1px solid ${BORDER}` }}>
          {subNavTabs.map(s => (
            <button key={s.id} onClick={() => setView(s.id)}
              style={{
                padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                color: view === s.id ? GOLD : 'rgba(255,255,255,0.4)',
                fontWeight: view === s.id ? 600 : 400,
                borderBottom: view === s.id ? `2px solid ${GOLD}` : '2px solid transparent',
                marginBottom: -1, transition: 'all .15s',
              }}>
              {s.label}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={async () => {
                const { data } = await supabase.rpc('get_all_staff')
                const staff = (data ?? []) as StaffWithRole[]
                const date  = new Date().toISOString().slice(0, 10)
                const csvCell = (v: unknown) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }
                const rows = [
                  ['ชื่อ', 'ชื่อไทย', 'บทบาท', 'เงินเดือน (₭)', 'ประเภท', 'วันเริ่มงาน', 'โทรศัพท์', 'สถานะ'],
                  ...staff.map(s => [
                    s.name, s.name_th || '', s.role || '', s.salary || 0,
                    s.salary_type || '', s.start_date || '', s.phone || '',
                    s.is_active ? 'ทำงาน' : 'ไม่ได้ทำงาน',
                  ]),
                ]
                const content = rows.map(r => r.map(csvCell).join(',')).join('\n')
                const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement('a')
                a.href = url; a.download = `alan-staff-${date}.csv`; a.click()
                URL.revokeObjectURL(url)
              }}
              style={{ fontSize: 11, color: GREEN, background: 'none', border: `1px solid ${GREEN}44`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
            >
              ⬇ CSV
            </button>
            <a href="/staff"
              style={{ fontSize: 11, color: GOLD, textDecoration: 'none', padding: '4px 10px', border: `1px solid ${GOLD}44`, borderRadius: 6 }}>
              Kiosk →
            </a>
          </div>
        </div>
      )}

      {/* Views */}
      {view === 'list' && (
        <StaffCardGrid
          key={refreshKey}
          onProfile={handleProfile}
          onAdd={() => setView('wizard')}
        />
      )}

      {view === 'profile' && selectedStaff && (
        <div>
          <button onClick={handleBack}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13, marginBottom: 20, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← กลับรายชื่อ
          </button>
          <StaffProfileView
            staff={selectedStaff}
            todayStatus={todayMap[selectedStaff.id] ?? null}
            onBack={handleBack}
            onEnroll={() => setEnrollTarget(selectedStaff)}
            onRefresh={handleRefresh}
          />
        </div>
      )}

      {view === 'wizard' && (
        <AddStaffWizard
          onDone={() => { setRefreshKey(k => k + 1); setView('list') }}
          onCancel={() => setView('list')}
        />
      )}

      {view === 'today'  && <StaffTodayView />}
      {view === 'perf'   && <StaffPerfView />}
      {view === 'leaves' && <LeavesView />}
    </div>
  )
}
