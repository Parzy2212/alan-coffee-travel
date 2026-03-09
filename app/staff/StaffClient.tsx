'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getFaceApi } from '@/lib/faceapi'

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD   = '#c9a84c'
const BLACK  = '#0a0a0a'
const CARD   = '#161616'
const BORDER = 'rgba(201,168,76,0.18)'
const GREEN  = '#4cba7f'
const RED    = '#ff4d4d'
const ORANGE = '#ff9933'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'select' | 'pin' | 'face_verify' | 'action' | 'dashboard' | 'success' | 'purchase_form' | 'stock_audit'

type StaffEntry = {
  id: string; name: string; name_th: string | null
  avatar_url: string | null; scheduled_start_time: string | null
  face_descriptor: number[] | null
}
type TodayRecord = { clock_in: string | null; clock_out: string | null; status: string | null }
type SuccessInfo = { action: 'in' | 'out'; name: string; time: string; hours_worked?: number }
type InventorySimple = { id: string; name: string; unit: string }
type AuditItem = { audit_id: string; inventory_id: string; inventory_name: string; unit: string; counted: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(n: string) { return n.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase() }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' })
}
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
async function getGPS() {
  return new Promise<{ lat: number; lng: number } | null>(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null), { timeout: 8000, enableHighAccuracy: true },
    )
  })
}
async function uploadPhotoBlob(staffId: string, action: 'in' | 'out', blob: Blob): Promise<string | null> {
  try {
    const path = `attendance/${staffId}/${action}_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('staff-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) { console.warn('[Upload]', error.message); return null }
    return supabase.storage.from('staff-photos').getPublicUrl(path).data?.publicUrl ?? null
  } catch (e) { console.warn('[Upload]', e); return null }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, url, size = 56 }: { name: string; url: string | null; size?: number }) {
  const [err, setErr] = useState(false)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      backgroundColor: `${GOLD}22`, border: `2px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url && !err
        ? <img src={url} alt={name} style={{ width: size, height: size, objectFit: 'cover' }} onError={() => setErr(true)} />
        : <span style={{ fontSize: size * 0.35, fontWeight: 700, color: GOLD }}>{initials(name)}</span>}
    </div>
  )
}

// ─── CameraCapture (action phase) ────────────────────────────────────────────

function CameraCapture({ onCapture }: { onCapture: (b: Blob) => void }) {
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef  = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream,  setStream]  = useState<MediaStream | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [camErr,  setCamErr]  = useState(false)

  // Callback ref: binds stream as soon as video element mounts
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    if (node && streamRef.current) {
      node.srcObject = streamRef.current
      node.onloadedmetadata = () => { node.play().catch(() => {}) }
    }
  }, [])

  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = s
      setStream(s)
    } catch (e) { console.warn('[CameraCapture] getUserMedia failed:', e); setCamErr(true) }
  }
  function stop(s: MediaStream | null) { s?.getTracks().forEach(t => t.stop()) }
  function shoot() {
    const v = videoRef.current, c = canvasRef.current; if (!v || !c) return
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480
    c.getContext('2d')?.drawImage(v, 0, 0)
    c.toBlob(b => {
      if (!b) return
      setPreview(c.toDataURL())
      stop(stream); setStream(null); streamRef.current = null
      onCapture(b)
    }, 'image/jpeg', 0.85)
  }
  useEffect(() => () => stop(stream), [stream])

  if (preview) return (
    <div>
      <img src={preview} style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 8 }} />
      <button onClick={() => { setPreview(null); void start() }}
        style={{ marginTop: 6, width: '100%', padding: 6, borderRadius: 7, border: `1px solid ${BORDER}`,
          background: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12 }}>
        ถ่ายใหม่
      </button>
    </div>
  )
  if (stream) return (
    <div>
      <video ref={setVideoRef} autoPlay playsInline muted
        style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, backgroundColor: '#000' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button onClick={shoot}
        style={{ marginTop: 6, width: '100%', padding: 9, borderRadius: 8, border: 'none', backgroundColor: GOLD, color: BLACK, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
        📷 ถ่ายรูป
      </button>
    </div>
  )
  if (camErr) return (
    <label style={{ display: 'block', padding: 10, borderRadius: 8, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12, cursor: 'pointer', textAlign: 'center' }}>
      อัปโหลดรูปภาพ
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
        const f = e.target.files?.[0]; if (!f) return; setPreview(URL.createObjectURL(f)); onCapture(f)
      }} />
    </label>
  )
  return (
    <button onClick={() => void start()}
      style={{ width: '100%', padding: 9, borderRadius: 8, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
      📷 ถ่ายรูปยืนยัน (ไม่บังคับ)
    </button>
  )
}

// ─── Face Verify (Liveness via Blink Detection) ──────────────────────────────

type VerifyStatus = 'loading' | 'live' | 'verifying' | 'pass' | 'fail' | 'no_face' | 'no_descriptor' | 'error'

const REQUIRED_BLINKS = 2

function ptDist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
// pts = full landmarks array, start = 36 (left) or 42 (right)
function eyeEAR(pts: { x: number; y: number }[], start: number): number {
  return (ptDist(pts[start + 1], pts[start + 5]) + ptDist(pts[start + 2], pts[start + 4])) /
    (2 * ptDist(pts[start], pts[start + 3]))
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 16, height: 16, border: `2px solid ${GOLD}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', flexShrink: 0 }} />
}

function FaceVerify({ staff, onPass, onBack }: {
  staff: StaffEntry
  onPass: (blob: Blob) => void
  onBack: () => void
}) {
  const streamRef     = useRef<MediaStream | null>(null)
  const videoRef      = useRef<HTMLVideoElement | null>(null)
  const overlayRef    = useRef<HTMLCanvasElement>(null)
  const captureRef    = useRef<HTMLCanvasElement>(null)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const earBelowRef   = useRef(false)
  const blinkCountRef = useRef(0)
  const capturingRef  = useRef(false)

  const [status,     setStatus]     = useState<VerifyStatus>('loading')
  const [blinkCount, setBlinkCount] = useState(0)
  const [earVal,     setEarVal]     = useState<number | null>(null)
  const [faceFound,  setFaceFound]  = useState(false)
  const [preview,    setPreview]    = useState<string | null>(null)
  const [distance,   setDistance]   = useState<number | null>(null)
  const [errMsg,     setErrMsg]     = useState('')

  // Callback ref — binds stream once video element mounts
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    if (node && streamRef.current) {
      node.srcObject = streamRef.current
      node.onloadedmetadata = () => { node.play().catch(() => {}) }
    }
  }, [])

  // ── Init: load models + open camera ──
  useEffect(() => {
    if (!staff.face_descriptor || staff.face_descriptor.length !== 128) {
      setStatus('no_descriptor'); return
    }
    let cancelled = false
    void (async () => {
      try {
        console.log('[FaceVerify] Loading models...')
        await getFaceApi()
        if (cancelled) return
        console.log('[FaceVerify] Opening camera...')
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        })
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return }
        streamRef.current = s
        setStatus('live')
      } catch (e) {
        if (!cancelled) { setErrMsg(String(e)); setStatus('error') }
      }
    })()
    return () => {
      cancelled = true
      clearInterval(intervalRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [staff]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detection loop: runs while status === 'live' ──
  useEffect(() => {
    if (status !== 'live') return
    blinkCountRef.current = 0
    earBelowRef.current = false
    capturingRef.current = false

    intervalRef.current = setInterval(() => {
      void (async () => {
        const fa = await getFaceApi()
        const video = videoRef.current
        const over  = overlayRef.current
        if (!video || video.readyState < 2 || video.videoWidth === 0 || !over) return

        // Sync overlay size to video
        if (over.width !== video.videoWidth) {
          over.width  = video.videoWidth
          over.height = video.videoHeight
        }
        const ctx = over.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, over.width, over.height)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let det: any = null
        try {
          det = await fa.detectSingleFace(video, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor()
        } catch { return }

        if (!det) { setFaceFound(false); setEarVal(null); return }
        setFaceFound(true)

        // Draw face box
        const { x, y, width: w, height: h } = det.detection.box
        const ear = (eyeEAR(det.landmarks.positions, 36) + eyeEAR(det.landmarks.positions, 42)) / 2
        ctx.strokeStyle = ear < 0.25 ? GOLD : GREEN
        ctx.lineWidth   = 2.5
        ctx.strokeRect(x, y, w, h)

        // Draw eye landmarks
        ctx.fillStyle = ear < 0.25 ? `${GOLD}cc` : `${GREEN}99`
        for (let i = 36; i < 48; i++) {
          ctx.beginPath()
          ctx.arc(det.landmarks.positions[i].x, det.landmarks.positions[i].y, 2.2, 0, Math.PI * 2)
          ctx.fill()
        }

        const earRound = Math.round(ear * 100) / 100
        setEarVal(earRound)

        // ── Blink state machine ──
        if (ear < 0.25) {
          earBelowRef.current = true
        } else if (earBelowRef.current) {
          // Eyes reopened → blink complete
          earBelowRef.current = false
          blinkCountRef.current += 1
          setBlinkCount(blinkCountRef.current)
          console.log('[FaceVerify] Blink', blinkCountRef.current, '/', REQUIRED_BLINKS)

          if (blinkCountRef.current >= REQUIRED_BLINKS && !capturingRef.current) {
            capturingRef.current = true
            clearInterval(intervalRef.current)

            // Capture current video frame
            const cap = captureRef.current
            if (cap) {
              cap.width  = video.videoWidth
              cap.height = video.videoHeight
              cap.getContext('2d')?.drawImage(video, 0, 0)
              const dataUrl = cap.toDataURL('image/jpeg', 0.88)
              setPreview(dataUrl)
            }
            streamRef.current?.getTracks().forEach(t => t.stop())
            streamRef.current = null
            setStatus('verifying')
          }
        }
      })()
    }, 200)

    return () => clearInterval(intervalRef.current)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Face recognition after liveness pass ──
  useEffect(() => {
    if (status !== 'verifying' || !preview) return
    void (async () => {
      try {
        console.log('[FaceVerify] Recognizing face...')
        const fa  = await getFaceApi()
        const img = document.createElement('img')
        img.src   = preview
        await new Promise<void>(r => { img.onload = () => r() })
        const det = await fa.detectSingleFace(img, new fa.TinyFaceDetectorOptions())
          .withFaceLandmarks().withFaceDescriptor()
        if (!det) { setStatus('no_face'); return }
        const dist: number = fa.euclideanDistance(
          Array.from(det.descriptor as Float32Array),
          Array.from(new Float32Array(staff.face_descriptor!))
        )
        console.log('[FaceVerify] Distance:', dist.toFixed(3), dist < 0.5 ? '→ PASS' : '→ FAIL')
        setDistance(dist)
        if (dist < 0.5) {
          setStatus('pass')
          captureRef.current?.toBlob(b => { if (b) setTimeout(() => onPass(b), 1200) }, 'image/jpeg', 0.85)
        } else {
          setStatus('fail')
        }
      } catch (e) {
        console.error('[FaceVerify]', e)
        setErrMsg(String(e)); setStatus('error')
      }
    })()
  }, [status, preview]) // eslint-disable-line react-hooks/exhaustive-deps

  async function retry() {
    clearInterval(intervalRef.current)
    setPreview(null); setErrMsg(''); setDistance(null)
    setBlinkCount(0); setFaceFound(false); setEarVal(null)
    blinkCountRef.current = 0; earBelowRef.current = false; capturingRef.current = false
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = s
      setStatus('live')
    } catch (e) { setErrMsg(String(e)); setStatus('error') }
  }

  const accuracy = distance !== null ? Math.round(Math.max(0, (1 - distance / 0.8)) * 100) : null

  // Step indicator data
  const STEPS = [
    { key: 'loading',   icon: '⏳', label: 'โหลด AI' },
    { key: 'live',      icon: '👁', label: 'กระพริบตา' },
    { key: 'verifying', icon: '🔍', label: 'ตรวจสอบ' },
  ]
  const stepIdx = status === 'loading' ? 0 : status === 'live' ? 1 : status === 'verifying' ? 2 : -1

  return (
    <div style={{ width: '100%', maxWidth: 440, padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      <button onClick={onBack} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>← กลับ</button>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>ยืนยันตัวตนด้วยใบหน้า</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          {status === 'live' ? 'กระพริบตา 2 ครั้ง เพื่อยืนยันว่าเป็นบุคคลจริง' : 'กำลังดำเนินการ...'}
        </div>
      </div>

      {/* Step indicator */}
      {stepIdx >= 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {STEPS.map((s, i) => {
            const done   = i < stepIdx
            const active = i === stepIdx
            return (
              <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}>
                {i < STEPS.length - 1 && (
                  <div style={{ position: 'absolute', top: 13, left: '50%', width: '100%', height: 2,
                    backgroundColor: done ? GOLD : 'rgba(255,255,255,0.07)', zIndex: 0 }} />
                )}
                <div style={{ width: 26, height: 26, borderRadius: '50%', zIndex: 1, position: 'relative',
                  border: `2px solid ${active ? GOLD : done ? GOLD : 'rgba(255,255,255,0.12)'}`,
                  backgroundColor: done ? GOLD : active ? `${GOLD}20` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {active && i === 0 ? <Spinner /> : <span style={{ fontSize: 11 }}>{done ? '✓' : s.icon}</span>}
                </div>
                <div style={{ fontSize: 9, color: active ? GOLD : done ? `${GOLD}80` : 'rgba(255,255,255,0.18)', textAlign: 'center' }}>{s.label}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Hidden canvases — always mounted */}
      <canvas ref={captureRef} style={{ display: 'none' }} />

      {/* ── no_descriptor ── */}
      {status === 'no_descriptor' && (
        <div style={{ padding: 24, borderRadius: 12, border: `1px solid ${RED}44`, backgroundColor: `${RED}08`, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 14, color: RED, fontWeight: 600 }}>ยังไม่ได้บันทึกใบหน้า</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>กรุณาติดต่อผู้จัดการเพื่อบันทึกใบหน้าก่อนใช้งาน</div>
        </div>
      )}

      {/* ── loading ── */}
      {status === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderRadius: 10, backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}22` }}>
          <Spinner />
          <span style={{ fontSize: 13, color: GOLD }}>กำลังโหลด AI Model...</span>
        </div>
      )}

      {/* ── live: video + overlay + blink progress ── */}
      {status === 'live' && (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000',
          border: `2px solid ${faceFound ? GREEN : BORDER}`, transition: 'border-color .3s' }}>
          <video ref={setVideoRef} autoPlay playsInline muted
            style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'cover' }} />
          <canvas ref={overlayRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

          {/* Bottom HUD */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 16px 14px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.82))' }}>

            {/* Blink dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
              {Array.from({ length: REQUIRED_BLINKS }).map((_, i) => {
                const done = blinkCount > i
                const next = blinkCount === i
                return (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: '50%',
                    backgroundColor: done ? GREEN : next ? `${GOLD}33` : 'rgba(255,255,255,0.1)',
                    border: `2px solid ${done ? GREEN : next ? GOLD : 'rgba(255,255,255,0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, transition: 'all .2s',
                    animation: next && faceFound ? 'pulse 1s ease-in-out infinite' : 'none' }}>
                    {done ? '✓' : ''}
                  </div>
                )
              })}
            </div>

            {/* Status text */}
            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600,
              color: !faceFound ? 'rgba(255,255,255,0.4)' : blinkCount >= REQUIRED_BLINKS ? GREEN : '#fff' }}>
              {!faceFound
                ? 'ไม่พบใบหน้า — เข้ามาในกรอบ'
                : blinkCount >= REQUIRED_BLINKS
                  ? '✓ กระพริบครบแล้ว! กำลังบันทึก...'
                  : `กระพริบตา ${blinkCount}/${REQUIRED_BLINKS} ครั้ง`}
            </div>

            {/* EAR debug */}
            {earVal !== null && (
              <div style={{ textAlign: 'right', fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
                EAR: {earVal.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── captured preview ── */}
      {preview && status !== 'live' && (
        <img src={preview} style={{ width: '100%', borderRadius: 12, maxHeight: 240, objectFit: 'cover', animation: 'fadeIn .3s' }} />
      )}

      {/* ── verifying ── */}
      {status === 'verifying' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 10, backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}22` }}>
          <Spinner />
          <span style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>🔍 กำลังตรวจสอบใบหน้า...</span>
        </div>
      )}

      {/* ── pass ── */}
      {status === 'pass' && (
        <div style={{ textAlign: 'center', padding: '8px 0', animation: 'fadeIn .3s' }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>✅</div>
          <div style={{ color: GREEN, fontSize: 17, fontWeight: 800 }}>ยืนยันตัวตนสำเร็จ!</div>
          {accuracy !== null && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>ความแม่นยำ: {accuracy}%</div>}
        </div>
      )}

      {/* ── fail ── */}
      {status === 'fail' && (
        <div style={{ padding: 18, borderRadius: 10, border: `1px solid ${RED}44`, backgroundColor: `${RED}08`, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>❌</div>
          <div style={{ color: RED, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>ใบหน้าไม่ตรง กรุณาลองใหม่</div>
          {accuracy !== null && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>ความแม่นยำ: {accuracy}%</div>}
          <button onClick={() => void retry()} style={{ padding: '9px 24px', borderRadius: 8, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>ลองใหม่</button>
        </div>
      )}

      {/* ── no_face ── */}
      {status === 'no_face' && (
        <div style={{ padding: 18, borderRadius: 10, border: `1px solid ${ORANGE}44`, backgroundColor: `${ORANGE}08`, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🙈</div>
          <div style={{ color: ORANGE, fontSize: 14, fontWeight: 700, marginBottom: 14 }}>ไม่พบใบหน้าในภาพ กรุณาลองใหม่</div>
          <button onClick={() => void retry()} style={{ padding: '9px 24px', borderRadius: 8, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>ลองใหม่</button>
        </div>
      )}

      {/* ── error ── */}
      {status === 'error' && (
        <div style={{ padding: 18, borderRadius: 10, border: `1px solid ${RED}44`, backgroundColor: `${RED}08`, textAlign: 'center' }}>
          <div style={{ color: RED, fontSize: 13, marginBottom: 14 }}>{errMsg || 'เกิดข้อผิดพลาด'}</div>
          <button onClick={() => void retry()} style={{ padding: '9px 24px', borderRadius: 8, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>ลองใหม่</button>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffClient() {
  // ── Phase ──
  const [phase, setPhase] = useState<Phase>('select')

  // ── Staff data ──
  const [staffList,  setStaffList]  = useState<StaffEntry[]>([])
  const [todayMap,   setTodayMap]   = useState<Record<string, TodayRecord>>({})
  const [shopCoords, setShopCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [loading,    setLoading]    = useState(true)

  // ── PIN ──
  const [selected, setSelected] = useState<StaffEntry | null>(null)
  const [pin,      setPin]      = useState('')
  const [pinErr,   setPinErr]   = useState('')

  // ── Action phase ──
  const [action,     setAction]     = useState<'in' | 'out'>('in')
  const [gpsStatus,  setGpsStatus]  = useState<'idle' | 'loading' | 'ok' | 'skip'>('idle')
  const [gpsCoords,  setGpsCoords]  = useState<{ lat: number; lng: number } | null>(null)
  const [distanceM,  setDistanceM]  = useState<number | null>(null)
  const [photoBlob,  setPhotoBlob]  = useState<Blob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errMsg,     setErrMsg]     = useState('')
  const [successInfo,setSuccessInfo]= useState<SuccessInfo | null>(null)

  // ── Purchase form ──
  const [invList,      setInvList]      = useState<InventorySimple[]>([])
  const [purchaseForm, setPurchaseForm] = useState({ inventory_id: '', qty: '', unit_price: '', supplier: '' })
  const [receiptBlob,  setReceiptBlob]  = useState<Blob | null>(null)
  const [weighBlob,    setWeighBlob]    = useState<Blob | null>(null)
  const [purchaseStep, setPurchaseStep] = useState<'form' | 'receipt' | 'weigh'>('form')
  const [purchaseMsg,  setPurchaseMsg]  = useState('')
  const [purchasing,   setPurchasing]   = useState(false)

  // ── Stock audit ──
  const [auditItems,  setAuditItems]  = useState<AuditItem[]>([])
  const [auditLoading,setAuditLoading]= useState(false)
  const [auditMsg,    setAuditMsg]    = useState('')
  const [auditDone,   setAuditDone]   = useState(false)

  // ── Load staff + shop coords ──
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: allStaff }, { data: todayData }, { data: settingsData }] = await Promise.all([
        supabase.from('staff').select('id,name,name_th,avatar_url,scheduled_start_time,face_descriptor').eq('is_active', true),
        supabase.rpc('get_staff_today_status'),
        supabase.rpc('get_site_settings'),
      ])
      const list: StaffEntry[] = (allStaff ?? []).map((s: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: s.id, name: s.name, name_th: s.name_th ?? null,
        avatar_url: s.avatar_url ?? null, scheduled_start_time: s.scheduled_start_time ?? null,
        face_descriptor: Array.isArray(s.face_descriptor) ? s.face_descriptor : null,
      }))
      setStaffList(list)

      const map: Record<string, TodayRecord> = {}
      for (const r of (todayData ?? [])) map[r.id] = { clock_in: r.clock_in ?? null, clock_out: r.clock_out ?? null, status: r.status ?? null }
      setTodayMap(map)

      if (settingsData) {
        const lat = parseFloat(settingsData.shop_lat), lng = parseFloat(settingsData.shop_lng)
        if (!isNaN(lat) && !isNaN(lng)) setShopCoords({ lat, lng })
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  // ── Load inventory on purchase_form ──
  useEffect(() => {
    if (phase !== 'purchase_form') return
    void loadInventory()
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start audit on stock_audit ──
  useEffect(() => {
    if (phase !== 'stock_audit') return
    void startAudit()
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS on action phase ──
  useEffect(() => {
    if (phase !== 'action') return
    setGpsStatus('loading')
    void getGPS().then(pos => {
      if (!pos) { setGpsStatus('skip'); return }
      setGpsCoords(pos); setGpsStatus('ok')
      if (shopCoords) setDistanceM(Math.round(haversine(pos.lat, pos.lng, shopCoords.lat, shopCoords.lng)))
    })
  }, [phase, shopCoords])

  // ── Submit ──
  async function submitAction() {
    if (!selected) return
    setSubmitting(true); setErrMsg('')
    try {
      const uploadedUrl = photoBlob ? await uploadPhotoBlob(selected.id, action, photoBlob) : null
      if (action === 'in') {
        const { data, error } = await supabase.rpc('clock_in', {
          p_staff_id: selected.id, p_lat: gpsCoords?.lat ?? null, p_lng: gpsCoords?.lng ?? null,
          p_photo: uploadedUrl, p_distance_meters: distanceM ?? null,
        })
        if (error) { setErrMsg(error.message); return }
        const r = data as any // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!r?.success) { setErrMsg(r?.error ?? 'เกิดข้อผิดพลาด'); return }
        setSuccessInfo({ action: 'in', name: selected.name, time: fmtTime(new Date().toISOString()) })
        setPhase('dashboard')
        void loadData()
      } else {
        const today = new Date().toISOString().slice(0, 10)
        const { error } = await supabase.from('attendance').update({
          clock_out: new Date().toISOString(),
          clock_out_photo: uploadedUrl,
        }).eq('staff_id', selected.id).eq('date', today).is('clock_out', null)
        if (error) { setErrMsg(error.message); return }
        setSuccessInfo({ action: 'out', name: selected.name, time: fmtTime(new Date().toISOString()) })
        setPhase('success')
        setTimeout(() => {
          setPhase('select'); setSelected(null); setSuccessInfo(null); void loadData()
        }, 3000)
      }
    } finally { setSubmitting(false) }
  }

  // ── Purchase form actions ──
  async function loadInventory() {
    const { data } = await supabase.from('inventory').select('id,name,unit').eq('is_active', true).order('name')
    setInvList((data ?? []) as InventorySimple[])
  }

  async function submitPurchase() {
    if (!selected) return
    if (!purchaseForm.inventory_id) { setPurchaseMsg('เลือกวัตถุดิบ'); return }
    if (!purchaseForm.qty || !purchaseForm.unit_price) { setPurchaseMsg('กรอกจำนวนและราคา'); return }
    setPurchasing(true); setPurchaseMsg('')
    try {
      let receiptUrl: string | null = null
      let weighUrl: string | null = null
      if (receiptBlob) {
        const path = `purchases/${selected.id}_receipt_${Date.now()}.jpg`
        const { error: ue } = await supabase.storage.from('staff-photos').upload(path, receiptBlob, { upsert: true, contentType: 'image/jpeg' })
        if (!ue) receiptUrl = supabase.storage.from('staff-photos').getPublicUrl(path).data?.publicUrl ?? null
      }
      if (weighBlob) {
        const path = `purchases/${selected.id}_weigh_${Date.now()}.jpg`
        const { error: ue } = await supabase.storage.from('staff-photos').upload(path, weighBlob, { upsert: true, contentType: 'image/jpeg' })
        if (!ue) weighUrl = supabase.storage.from('staff-photos').getPublicUrl(path).data?.publicUrl ?? null
      }
      const { error } = await supabase.rpc('submit_purchase_request', {
        p_inventory_id:    purchaseForm.inventory_id,
        p_staff_id:        selected.id,
        p_qty:             parseFloat(purchaseForm.qty),
        p_unit_price:      parseFloat(purchaseForm.unit_price),
        p_supplier:        purchaseForm.supplier || null,
        p_receipt_url:     receiptUrl,
        p_weigh_image_url: weighUrl,
      })
      if (error) { setPurchaseMsg(error.message); return }
      setPurchaseMsg('✓ ส่งคำขอซื้อสำเร็จ! รอการอนุมัติ')
      setTimeout(() => { setPhase('dashboard'); setPurchaseForm({ inventory_id: '', qty: '', unit_price: '', supplier: '' }); setReceiptBlob(null); setWeighBlob(null); setPurchaseMsg(''); setPurchaseStep('form') }, 2500)
    } finally { setPurchasing(false) }
  }

  // ── Stock audit actions ──
  async function startAudit() {
    if (!selected) return
    setAuditLoading(true); setAuditMsg(''); setAuditDone(false)
    const { data, error } = await supabase.rpc('start_stock_audit', { p_staff_id: selected.id })
    setAuditLoading(false)
    if (error || !data) { setAuditMsg(error?.message ?? 'เกิดข้อผิดพลาด'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAuditItems((data as any[]).map((d: any) => ({ audit_id: d.audit_id, inventory_id: d.inventory_id, inventory_name: d.inventory_name, unit: d.unit, counted: '' })))
  }

  async function submitAudit() {
    setAuditLoading(true); setAuditMsg('')
    try {
      for (const item of auditItems) {
        if (item.counted === '') { setAuditMsg(`กรอกจำนวน: ${item.inventory_name}`); return }
        await supabase.rpc('submit_stock_audit', { p_audit_id: item.audit_id, p_counted_qty: parseFloat(item.counted) })
      }
      setAuditDone(true); setAuditMsg('✓ บันทึกผลการนับสต็อกแล้ว')
      setTimeout(() => { setPhase('dashboard'); setAuditItems([]); setAuditMsg(''); setAuditDone(false) }, 2500)
    } finally { setAuditLoading(false) }
  }

  // ── Select → PIN ──
  function selectStaff(s: StaffEntry) { setSelected(s); setPin(''); setPinErr(''); setPhase('pin') }
  function pressPin(k: string) {
    if (k === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 4) return
    const next = pin + k; setPin(next); if (next.length >= 4) void verifyPin(next)
  }
  async function verifyPin(code: string) {
    if (!selected) return
    const { data, error } = await supabase.rpc('verify_staff_pin', { p_staff_id: selected.id, p_pin: code })
    if (error || !data) { setPinErr('PIN ไม่ถูกต้อง'); setTimeout(() => { setPin(''); setPinErr('') }, 900); return }
    const today = todayMap[selected.id]
    setAction(!today?.clock_in ? 'in' : 'out')
    setPhotoBlob(null); setGpsStatus('idle'); setGpsCoords(null); setDistanceM(null); setErrMsg('')
    setPhase('face_verify')
  }

  function StatusBadge({ staffId }: { staffId: string }) {
    const t = todayMap[staffId]
    if (!t?.clock_in) return <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '2px 7px', borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.05)' }}>ยังไม่ลงชื่อ</span>
    if (!t.clock_out) return <span style={{ fontSize: 10, color: GREEN, padding: '2px 7px', borderRadius: 99, backgroundColor: `${GREEN}18` }}>ออนดิวตี้</span>
    return <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '2px 7px', borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.05)' }}>ออกแล้ว</span>
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BLACK, color: '#fff',
      fontFamily: 'var(--font-body, Inter, sans-serif)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 900, padding: '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '-0.5px' }}>ALAN</div>
          <div style={{ fontSize: 10, color: GOLD, letterSpacing: '4px', textTransform: 'uppercase' }}>STAFF KIOSK</div>
        </div>
        <a href="/cafe" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>← Admin</a>
      </div>

      {/* ── PHASE: select ── */}
      {phase === 'select' && (
        <div style={{ width: '100%', maxWidth: 900, padding: '32px 24px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 24 }}>เลือกชื่อพนักงาน</div>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 110, borderRadius: 14, backgroundColor: CARD, animation: 'pulse 1.5s infinite' }} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
              {staffList.map(s => (
                <button key={s.id} onClick={() => selectStaff(s)}
                  style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'all .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = GOLD)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
                  <Avatar name={s.name} url={s.avatar_url} size={52} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.name_th ?? s.name}</div>
                    <div style={{ marginTop: 5 }}><StatusBadge staffId={s.id} /></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PHASE: pin ── */}
      {phase === 'pin' && selected && (
        <div style={{ width: '100%', maxWidth: 380, padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <button onClick={() => setPhase('select')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>← กลับ</button>
          <Avatar name={selected.name} url={selected.avatar_url} size={80} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.name_th ?? selected.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>กรอก PIN ของคุณ</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: pin.length > i ? GOLD : 'rgba(255,255,255,0.12)', transition: 'background-color .15s' }} />
            ))}
          </div>
          {pinErr && <div style={{ color: RED, fontSize: 13, fontWeight: 600 }}>{pinErr}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11, width: '100%' }}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
              <button key={i} onClick={() => k && pressPin(k)} disabled={!k}
                style={{ height: 62, borderRadius: 11, border: `1px solid ${BORDER}`, cursor: k ? 'pointer' : 'default',
                  backgroundColor: k === '⌫' ? 'rgba(255,77,77,0.08)' : CARD,
                  color: k === '⌫' ? RED : '#fff', fontSize: k === '⌫' ? 20 : 22, fontWeight: 600,
                  opacity: k ? 1 : 0, transition: 'all .1s' }}>
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PHASE: face_verify ── */}
      {phase === 'face_verify' && selected && (
        <FaceVerify
          staff={selected}
          onPass={blob => { setPhotoBlob(blob); setPhase('action') }}
          onBack={() => setPhase('select')}
        />
      )}

      {/* ── PHASE: action ── */}
      {phase === 'action' && selected && (
        <div style={{ width: '100%', maxWidth: 460, padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button onClick={() => setPhase('select')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>← กลับ</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', backgroundColor: CARD, borderRadius: 14, border: `1px solid ${BORDER}` }}>
            <Avatar name={selected.name} url={selected.avatar_url} size={52} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{selected.name_th ?? selected.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                {action === 'in' ? 'เข้างาน' : 'ออกงาน'} — {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* GPS */}
          <div style={{ padding: '12px 16px', backgroundColor: CARD, borderRadius: 10, border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>📍</span>
              <div style={{ flex: 1, fontSize: 13, color: gpsStatus === 'ok' ? GREEN : gpsStatus === 'loading' ? GOLD : 'rgba(255,255,255,0.35)' }}>
                {gpsStatus === 'loading' && 'กำลังระบุตำแหน่ง...'}
                {gpsStatus === 'ok' && gpsCoords && `${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}`}
                {gpsStatus === 'skip' && 'ไม่สามารถระบุตำแหน่งได้'}
                {gpsStatus === 'idle' && '—'}
              </div>
              {distanceM !== null && (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                  color: distanceM <= 200 ? GREEN : ORANGE, backgroundColor: distanceM <= 200 ? `${GREEN}18` : `${ORANGE}18` }}>
                  {distanceM} ม.
                </span>
              )}
            </div>
            {distanceM !== null && distanceM > 200 && (
              <div style={{ marginTop: 8, fontSize: 12, color: ORANGE, padding: '6px 10px', borderRadius: 7, backgroundColor: `${ORANGE}10` }}>
                ⚠️ คุณอยู่ห่างจากร้าน {distanceM} เมตร — ยังสามารถ clock-in ได้
              </div>
            )}
          </div>

          {/* Camera */}
          <div style={{ padding: '14px 16px', backgroundColor: CARD, borderRadius: 10, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>ถ่ายรูปยืนยัน (ไม่บังคับ)</div>
            <CameraCapture onCapture={b => setPhotoBlob(b)} />
          </div>

          {errMsg && <div style={{ color: RED, fontSize: 13 }}>{errMsg}</div>}

          <button onClick={() => void submitAction()} disabled={submitting || gpsStatus === 'loading'}
            style={{ padding: 18, borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 800,
              backgroundColor: action === 'in' ? GREEN : ORANGE, color: '#fff',
              opacity: (submitting || gpsStatus === 'loading') ? 0.6 : 1, transition: 'all .15s' }}>
            {submitting ? 'กำลังบันทึก...' : action === 'in' ? '✓ เข้างาน' : '✓ ออกงาน'}
          </button>
        </div>
      )}

      {/* ── PHASE: dashboard ── */}
      {phase === 'dashboard' && selected && successInfo && (
        <div style={{ width: '100%', maxWidth: 480, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Logout */}
          <button onClick={() => { setPhase('select'); setSelected(null); setSuccessInfo(null) }}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>
            ← ออกจากระบบ
          </button>

          {/* Profile card */}
          <div style={{ padding: '20px 20px', borderRadius: 16, backgroundColor: CARD, border: `1px solid ${GOLD}33`, display: 'flex', alignItems: 'center', gap: 18 }}>
            <Avatar name={selected.name} url={selected.avatar_url} size={64} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{selected.name_th ?? selected.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, backgroundColor: `${GREEN}18`, color: GREEN, fontWeight: 600 }}>● ออนดิวตี้</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>เข้างาน {successInfo.time}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={() => setPhase('purchase_form')}
              style={{ padding: '18px 16px', borderRadius: 14, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}08`, color: GOLD, cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 30 }}>🧾</span>
              แจ้งซื้อวัตถุดิบ
            </button>
            <button onClick={() => setPhase('stock_audit')}
              style={{ padding: '18px 16px', borderRadius: 14, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 30 }}>📦</span>
              นับสต็อก
            </button>
          </div>

          {/* Clock-out button */}
          {(() => {
            const rec = todayMap[selected.id]
            if (rec?.clock_in && !rec?.clock_out) return (
              <button onClick={() => {
                setAction('out'); setPhotoBlob(null); setGpsStatus('idle'); setGpsCoords(null); setDistanceM(null); setErrMsg('')
                setPhase('action')
              }}
                style={{ padding: '16px', borderRadius: 14, border: 'none', backgroundColor: ORANGE, color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 800 }}>
                🚪 ออกงาน
              </button>
            )
            return null
          })()}
        </div>
      )}

      {/* ── PHASE: success (clock-out) ── */}
      {phase === 'success' && successInfo && (
        <div style={{ width: '100%', maxWidth: 400, padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 64 }}>👋</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>ออกงานสำเร็จ!</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>{successInfo.name} — {successInfo.time}</div>
          {successInfo.hours_worked !== undefined && (
            <div style={{ padding: '10px 20px', borderRadius: 99, backgroundColor: `${GREEN}18`, color: GREEN, fontSize: 14, fontWeight: 600 }}>
              ทำงาน {successInfo.hours_worked.toFixed(1)} ชั่วโมง
            </div>
          )}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>กลับหน้าหลักใน 3 วินาที...</div>
        </div>
      )}

      {/* ── PHASE: purchase_form ── */}
      {phase === 'purchase_form' && selected && (
        <div style={{ width: '100%', maxWidth: 460, padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button onClick={() => setPhase('dashboard')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>← กลับ</button>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🧾 แจ้งซื้อวัตถุดิบ</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>โดย {selected.name_th ?? selected.name}</div>

          {purchaseStep === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>วัตถุดิบ *</div>
                <select value={purchaseForm.inventory_id} onChange={e => setPurchaseForm(f => ({ ...f, inventory_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: '#fff', fontSize: 14 }}>
                  <option value="">-- เลือกรายการ --</option>
                  {invList.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>จำนวนที่ซื้อ *</div>
                  <input type="number" value={purchaseForm.qty} onChange={e => setPurchaseForm(f => ({ ...f, qty: e.target.value }))} placeholder="0"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>ราคาต่อหน่วย (LAK) *</div>
                  <input type="number" value={purchaseForm.unit_price} onChange={e => setPurchaseForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="0"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>ซัพพลายเออร์</div>
                <input value={purchaseForm.supplier} onChange={e => setPurchaseForm(f => ({ ...f, supplier: e.target.value }))} placeholder="ชื่อร้านค้า / บุคคล"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <button onClick={() => setPurchaseStep('receipt')}
                style={{ marginTop: 4, padding: 16, borderRadius: 12, border: 'none', backgroundColor: GOLD, color: '#000', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                ถัดไป → ถ่ายใบเสร็จ
              </button>
            </div>
          )}

          {purchaseStep === 'receipt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>ถ่ายรูปใบเสร็จ (ไม่บังคับ)</div>
              <CameraCapture onCapture={b => setReceiptBlob(b)} />
              {receiptBlob && <div style={{ fontSize: 12, color: GREEN }}>✓ ได้รูปใบเสร็จแล้ว</div>}
              <button onClick={() => setPurchaseStep('weigh')}
                style={{ padding: 14, borderRadius: 12, border: 'none', backgroundColor: GOLD, color: '#000', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                ถัดไป → ถ่ายรูปชั่งน้ำหนัก
              </button>
              <button onClick={() => setPurchaseStep('form')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>← ย้อนกลับ</button>
            </div>
          )}

          {purchaseStep === 'weigh' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>ถ่ายรูปชั่งน้ำหนัก (ไม่บังคับ)</div>
              <CameraCapture onCapture={b => setWeighBlob(b)} />
              {weighBlob && <div style={{ fontSize: 12, color: GREEN }}>✓ ได้รูปชั่งน้ำหนักแล้ว</div>}
              {purchaseMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 9, backgroundColor: purchaseMsg.startsWith('✓') ? `${GREEN}10` : `${RED}10`, color: purchaseMsg.startsWith('✓') ? GREEN : RED, fontSize: 13, fontWeight: 600 }}>{purchaseMsg}</div>
              )}
              <button onClick={() => void submitPurchase()} disabled={purchasing}
                style={{ padding: 16, borderRadius: 12, border: 'none', backgroundColor: GREEN, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: purchasing ? 0.6 : 1 }}>
                {purchasing ? 'กำลังส่ง...' : '✓ ส่งคำขอซื้อ'}
              </button>
              <button onClick={() => setPurchaseStep('receipt')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>← ย้อนกลับ</button>
            </div>
          )}
        </div>
      )}

      {/* ── PHASE: stock_audit ── */}
      {phase === 'stock_audit' && selected && (
        <div style={{ width: '100%', maxWidth: 460, padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <button onClick={() => setPhase('dashboard')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>← กลับ</button>
          <div style={{ fontSize: 18, fontWeight: 800 }}>📦 นับสต็อก</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>โดย {selected.name_th ?? selected.name}</div>

          {auditLoading && auditItems.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ height: 70, borderRadius: 12, backgroundColor: CARD, animation: 'pulse 1.5s infinite' }} />)}
            </div>
          )}

          {auditItems.length > 0 && !auditDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>ระบบสุ่ม {auditItems.length} รายการ — กรอกจำนวนที่นับได้จริง</div>
              {auditItems.map((item, idx) => (
                <div key={item.audit_id} style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: CARD, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.inventory_name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>หน่วย: {item.unit}</div>
                  </div>
                  <input type="number" value={item.counted} onChange={e => setAuditItems(prev => prev.map((a, i) => i === idx ? { ...a, counted: e.target.value } : a))}
                    placeholder="0" style={{ width: 90, padding: '10px 10px', borderRadius: 8, border: `1px solid ${GOLD}44`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 15, textAlign: 'right', fontWeight: 700 }} />
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 28 }}>{item.unit}</div>
                </div>
              ))}
              <button onClick={() => void submitAudit()} disabled={auditLoading}
                style={{ padding: 16, borderRadius: 12, border: 'none', backgroundColor: GREEN, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: auditLoading ? 0.6 : 1 }}>
                {auditLoading ? 'กำลังบันทึก...' : '✓ ยืนยันการนับ'}
              </button>
            </div>
          )}

          {auditMsg && (
            <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: auditMsg.startsWith('✓') ? `${GREEN}10` : `${RED}10`, color: auditMsg.startsWith('✓') ? GREEN : RED, fontSize: 14, fontWeight: 600 }}>
              {auditMsg}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  )
}
