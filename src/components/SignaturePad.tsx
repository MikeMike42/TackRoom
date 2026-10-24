import { useEffect, useRef, useState } from 'react'

type Props = { id: string; onChange: (dataUrl: string | null) => void }

/** Finger/mouse signature pad. Exports a transparent PNG data URL. */
export function SignaturePad({ id, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = canvasRef.current!
    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      const rect = c.getBoundingClientRect()
      // Preserve strokes across resize
      const snapshot = c.width ? c.toDataURL() : null
      c.width = rect.width * ratio; c.height = rect.height * ratio
      const ctx = c.getContext('2d')!
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = getComputedStyle(c).getPropertyValue('--ink') || '#1b2219'
      if (snapshot) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height); img.src = snapshot }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    last.current = p
    if (empty) setEmpty(false)
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    onChange(empty ? null : canvasRef.current!.toDataURL('image/png'))
  }
  const clear = () => {
    const c = canvasRef.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="sigpad">
      <canvas
        id={id}
        ref={canvasRef}
        aria-label="Signature area. Draw your signature with your finger or mouse."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      />
      {empty && <span className="sigpad-hint">Sign here</span>}
      <span className="sigpad-line" aria-hidden="true" />
      <button type="button" className="link-btn sigpad-clear" onClick={clear} disabled={empty}>Clear</button>
    </div>
  )
}
