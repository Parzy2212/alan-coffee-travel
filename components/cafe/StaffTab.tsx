'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getFaceApi } from '@/lib/faceapi'
import { MoneyInput } from '@/components/MoneyInput'
import {
  GOLD, BLACK, CARD, BORDER, RED, GREEN, ORANGE,
  StaffMember, StaffToday, StaffAnalytics, LeaveRequest, StaffForm,
  Badge, LoadingSpinner,
  emptyStaffForm,
} from '@/components/cafe/shared'

// ─── StaffAvatar ──────────────────────────────────────────────────────────────

function StaffAvatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl: string | null; size?: number }) {
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

// ─── StaffManageView ──────────────────────────────────────────────────────────

function StaffManageView() {
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState<StaffMember | null>(null)
  const [form,      setForm]      = useState<StaffForm>(emptyStaffForm())
  const [saving,       setSaving]       = useState(false)
  const [errMsg,       setErrMsg]       = useState('')
  const [showPin,      setShowPin]      = useState(false)
  const [enrollTarget, setEnrollTarget] = useState<StaffMember | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_all_staff')
    setStaffList((data ?? []) as StaffMember[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm(emptyStaffForm())
    setErrMsg('')
    setShowPin(false)
    setShowForm(true)
  }

  function openEdit(s: StaffMember) {
    setEditing(s)
    setForm({
      name: s.name, name_th: s.name_th ?? '', name_lo: s.name_lo ?? '',
      phone: s.phone ?? '', salary: String(s.salary ?? ''), salary_type: s.salary_type ?? 'monthly',
      start_date: s.start_date ?? new Date().toISOString().slice(0, 10),
      scheduled_start_time: s.scheduled_start_time ?? '08:00',
      skills: (s.skills ?? []).join(', '), notes: s.notes ?? '', pin: '',
    })
    setErrMsg('')
    setShowPin(false)
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setErrMsg('กรุณากรอกชื่อ'); return }
    if (form.pin && (!/^\d{4}$/.test(form.pin))) { setErrMsg('PIN ต้องเป็นตัวเลข 4 หลัก'); return }
    if (!editing && !form.pin) { setErrMsg('กรุณากรอก PIN 4 หลัก'); return }
    setSaving(true); setErrMsg('')
    try {
      const skillsArr = form.skills.split(',').map(s => s.trim()).filter(Boolean)
      if (editing) {
        const payload: Record<string, unknown> = {
          name:                   form.name || null,
          name_th:                form.name_th || null,
          name_lo:                form.name_lo || null,
          phone:                  form.phone || null,
          salary:                 form.salary ? parseFloat(form.salary) : null,
          salary_type:            form.salary_type || null,
          start_date:             form.start_date || null,
          scheduled_start_time:   form.scheduled_start_time || null,
          skills:                 skillsArr.length ? skillsArr : null,
          notes:                  form.notes || null,
        }
        if (form.pin) payload.pin_code = form.pin
        const { error } = await supabase.from('staff').update(payload).eq('id', editing.id)
        if (error) { setErrMsg(error.message); return }
      } else {
        const { error } = await supabase.from('staff').insert({
          name:                 form.name,
          name_th:              form.name_th || null,
          name_lo:              form.name_lo || null,
          phone:                form.phone || null,
          salary:               form.salary ? parseFloat(form.salary) : null,
          salary_type:          form.salary_type || null,
          start_date:           form.start_date || null,
          scheduled_start_time: form.scheduled_start_time || null,
          skills:               skillsArr.length ? skillsArr : null,
          notes:                form.notes || null,
          pin_code:             form.pin,
          role:                 'staff',
          is_active:            true,
        })
        if (error) { setErrMsg(error.message); return }
      }
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function toggle(id: string) {
    await supabase.rpc('toggle_staff_active', { p_id: id })
    load()
  }

  const f = (k: keyof StaffForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))
  const fMoney = (k: keyof StaffForm) => (v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const inputStyleLocal: React.CSSProperties = {
    width: '100%', padding: '10px 12px', backgroundColor: '#1a1a1a', border: `1px solid ${BORDER}`,
    borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyleLocal: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }

  return (
    <div>
      {enrollTarget && (
        <FaceEnrollModal
          staff={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onSaved={() => { setEnrollTarget(null); load() }}
        />
      )}

      {showForm && (
        <div style={{ marginBottom: 24, padding: '20px', backgroundColor: CARD, borderRadius: 14, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{editing ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><div style={labelStyleLocal}>ชื่อ (EN) *</div><input value={form.name} onChange={f('name')} style={inputStyleLocal} /></div>
            <div><div style={labelStyleLocal}>ชื่อ (TH)</div><input value={form.name_th} onChange={f('name_th')} style={inputStyleLocal} /></div>
            <div><div style={labelStyleLocal}>ชื่อ (LO)</div><input value={form.name_lo} onChange={f('name_lo')} style={inputStyleLocal} /></div>
            <div><div style={labelStyleLocal}>โทรศัพท์</div><input value={form.phone} onChange={f('phone')} style={inputStyleLocal} /></div>
            <div><div style={labelStyleLocal}>เงินเดือน (LAK)</div><MoneyInput value={form.salary} onChange={fMoney('salary')} style={inputStyleLocal} placeholder="0" /></div>
            <div>
              <div style={labelStyleLocal}>ประเภทเงินเดือน</div>
              <select value={form.salary_type} onChange={f('salary_type')} style={inputStyleLocal}>
                <option value="monthly">รายเดือน</option>
                <option value="daily">รายวัน</option>
                <option value="hourly">รายชั่วโมง</option>
              </select>
            </div>
            <div><div style={labelStyleLocal}>วันเริ่มงาน</div><input type="date" value={form.start_date} onChange={f('start_date')} style={inputStyleLocal} /></div>
            <div><div style={labelStyleLocal}>เวลาเริ่มงาน</div><input type="time" value={form.scheduled_start_time} onChange={f('scheduled_start_time')} style={inputStyleLocal} /></div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyleLocal}>ทักษะ (คั่นด้วยจุลภาค)</div>
              <input value={form.skills} onChange={f('skills')} placeholder="บาริสต้า, เบเกอรี่, ..." style={inputStyleLocal} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyleLocal}>หมายเหตุ</div>
              <textarea value={form.notes} onChange={f('notes')} rows={2} style={{ ...inputStyleLocal, resize: 'vertical' }} />
            </div>
            <div>
              <div style={{ ...labelStyleLocal, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>PIN {editing ? '(เว้นว่าง = ไม่เปลี่ยน)' : '* (4 หลัก)'}</span>
                {editing && form.pin === '' && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, pin: '' }))}
                    style={{ background: 'none', border: 'none', color: GOLD, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                    Reset PIN
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={form.pin}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setForm(p => ({ ...p, pin: v }))
                  }}
                  placeholder={editing ? '••••' : 'กรอก PIN 4 หลัก'}
                  style={{ ...inputStyleLocal, paddingRight: 36, letterSpacing: showPin ? 2 : 6 }}
                />
                <button type="button" onClick={() => setShowPin(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 15,
                    color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>
                  {showPin ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            {editing && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button"
                  onClick={() => { setForm(p => ({ ...p, pin: '' })); setShowPin(true) }}
                  style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${GOLD}44`,
                    cursor: 'pointer', backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12 }}>
                  Reset PIN
                </button>
              </div>
            )}
          </div>
          {errMsg && <div style={{ color: RED, fontSize: 12, marginTop: 8 }}>{errMsg}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={save} disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                backgroundColor: GOLD, color: BLACK, fontWeight: 700, fontSize: 13 }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, cursor: 'pointer',
                backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <button onClick={openNew}
        style={{ marginBottom: 16, padding: '9px 18px', borderRadius: 8, border: `1px solid ${GOLD}44`,
          cursor: 'pointer', backgroundColor: `${GOLD}14`, color: GOLD, fontSize: 13, fontWeight: 600 }}>
        + เพิ่มพนักงาน
      </button>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staffList.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              backgroundColor: CARD, borderRadius: 10, border: `1px solid ${BORDER}`,
              opacity: s.is_active ? 1 : 0.45 }}>
              <StaffAvatar name={s.name} avatarUrl={s.avatar_url} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name_th ?? s.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {s.phone ?? '—'} · {s.salary_type ?? 'monthly'}
                  {s.salary ? ` · ${new Intl.NumberFormat('lo-LA').format(s.salary)} ₭` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEnrollTarget(s)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${GOLD}44`, cursor: 'pointer',
                    backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 11 }}>
                  {s.avatar_url ? '🔄 รูปถ่าย' : '📷 รูปถ่าย'}
                </button>
                <button onClick={() => openEdit(s)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, cursor: 'pointer',
                    backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  แก้ไข
                </button>
                <button onClick={() => toggle(s.id)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    backgroundColor: s.is_active ? `${RED}18` : `${GREEN}18`,
                    color: s.is_active ? RED : GREEN, fontSize: 11 }}>
                  {s.is_active ? 'ปิดใช้' : 'เปิดใช้'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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

// ─── StaffTab ─────────────────────────────────────────────────────────────────

export default function StaffTab() {
  const [sub, setSub] = useState<'today' | 'perf' | 'manage' | 'leaves'>('today')
  const subs: { id: 'today' | 'perf' | 'manage' | 'leaves'; label: string }[] = [
    { id: 'today',  label: 'วันนี้' },
    { id: 'perf',   label: 'ประสิทธิภาพ' },
    { id: 'manage', label: 'จัดการ' },
    { id: 'leaves', label: 'คำขอลา' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: `1px solid ${BORDER}` }}>
        {subs.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            style={{ padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              color: sub === s.id ? GOLD : 'rgba(255,255,255,0.4)',
              fontWeight: sub === s.id ? 600 : 400,
              borderBottom: sub === s.id ? `2px solid ${GOLD}` : '2px solid transparent',
              marginBottom: -1, transition: 'all .15s' }}>
            {s.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <a href="/staff"
            style={{ fontSize: 11, color: GOLD, textDecoration: 'none', padding: '4px 10px',
              border: `1px solid ${GOLD}44`, borderRadius: 6 }}>
            Kiosk →
          </a>
        </div>
      </div>
      {sub === 'today'  && <StaffTodayView />}
      {sub === 'perf'   && <StaffPerfView />}
      {sub === 'manage' && <StaffManageView />}
      {sub === 'leaves' && <LeavesView />}
    </div>
  )
}
