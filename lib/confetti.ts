const COLORS = ['#c9a84c', '#f0d060', '#e8c84a', '#ffffff', '#ffd700']

interface Particle {
  x: number; y: number
  vx: number; vy: number
  color: string
  w: number; h: number
  rotation: number; rotSpeed: number
  opacity: number
}

export function launchConfetti(canvas: HTMLCanvasElement, duration = 1500): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const W = canvas.offsetWidth || 480
  const H = canvas.offsetHeight || 320
  canvas.width = W
  canvas.height = H

  const cx = W / 2
  const particles: Particle[] = Array.from({ length: 60 }, () => ({
    x: cx + (Math.random() - 0.5) * 120,
    y: -10,
    vx: (Math.random() - 0.5) * 10,
    vy: Math.random() * 6 + 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    w: Math.random() * 10 + 4,
    h: Math.random() * 5 + 3,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 14,
    opacity: 1,
  }))

  let startTime = 0
  let rafId = 0

  const tick = (now: number) => {
    if (!startTime) startTime = now
    const elapsed = now - startTime

    ctx.clearRect(0, 0, W, H)

    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.2
      p.rotation += p.rotSpeed
      p.opacity = Math.max(0, 1 - elapsed / (duration * 1.1))

      if (p.opacity <= 0.01) continue

      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }

    if (elapsed < duration * 1.3) {
      rafId = requestAnimationFrame(tick)
    } else {
      ctx.clearRect(0, 0, W, H)
    }
  }

  rafId = requestAnimationFrame(tick)
  return () => { cancelAnimationFrame(rafId); ctx.clearRect(0, 0, W, H) }
}
