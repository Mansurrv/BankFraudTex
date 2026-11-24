import {useEffect, useMemo, useRef} from 'react'
import {useOrbit} from './state'

const tints = ['82, 115, 182', '63, 130, 165', '115, 93, 170']
const maxStars = 560

function createStars() {
  return Array.from({length:maxStars}, () => {
    const depth = .8 + Math.random() * 2.8
    return {
      x:(Math.random() - .5) * 1.16 * depth,
      y:(Math.random() - .5) * 1.16 * depth,
      depth,
      radius:.75 + Math.random() * 1.05,
      opacity:.44 + Math.random() * .5,
      tint:Math.floor(Math.random() * tints.length),
      glow:Math.random() < .16,
    }
  })
}

function createGlow(tint:string) {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 32
  const ctx = sprite.getContext('2d')
  if(ctx) {
    const glow = ctx.createRadialGradient(16,16,0,16,16,16)
    glow.addColorStop(0, `rgba(${tint}, .7)`)
    glow.addColorStop(.3, `rgba(${tint}, .28)`)
    glow.addColorStop(1, `rgba(${tint}, 0)`)
    ctx.fillStyle = glow
    ctx.fillRect(0,0,32,32)
  }
  return sprite
}

export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)
  const still = useOrbit(state => state.reduced || state.large)
  const stars = useMemo(createStars, [])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if(!canvas || !ctx)return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const glows = tints.map(createGlow)
    const colors = tints.map(tint => `rgb(${tint})`)
    let width = 0, height = 0, count = 0
    let cameraX = 0, cameraY = 0, cursorX = 0, cursorY = 0
    let frame = 0, lastPaint = 0, time = 0

    const paint = () => {
      ctx.clearRect(0,0,width,height)
      const driftX = Math.sin(time * .14) * .035
      const driftY = Math.sin(time * .1) * .022
      const driftZ = Math.sin(time * .18) * .07
      for(let i = 0; i < count; i++) {
        const star = stars[i]
        // Perspective makes closer stars brighter, larger, and faster across the view.
        const distance = star.depth - driftZ
        const x = width * (.5 + (star.x - cameraX - driftX) / distance)
        const y = height * (.5 + (star.y - cameraY - driftY) / distance)
        if(x < -10 || x > width + 10 || y < -10 || y > height + 10)continue
        const radius = star.radius * 1.4 / distance
        ctx.globalAlpha = star.opacity * Math.min(1, 1.6 / distance)
        if(star.glow) {
          const spread = radius * 4.8
          ctx.drawImage(glows[star.tint],x-spread,y-spread,spread*2,spread*2)
        }
        ctx.fillStyle = colors[star.tint]
        ctx.beginPath()
        ctx.arc(x,y,radius,0,Math.PI*2)
        ctx.fill()
      }
    }

    const resize = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      count = Math.min(maxStars, Math.max(125, Math.round(width * height / 3150)))
      const scale = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      ctx.setTransform(scale,0,0,scale,0,0)
      paint()
    }

    function animate(now:number) {
      if(now - lastPaint >= 1000 / 24) {
        const delta = Math.min(.1, (now - lastPaint) / 1000)
        time += delta
        lastPaint = now
        const blend = 1 - Math.exp(-delta * 3)
        cameraX += (cursorX - cameraX) * blend
        cameraY += (cursorY - cameraY) * blend
        paint()
      }
      frame = requestAnimationFrame(animate)
    }

    function syncMotion() {
      cancelAnimationFrame(frame)
      if(still || media.matches || document.hidden || document.fullscreenElement)return
      lastPaint = performance.now()
      frame = requestAnimationFrame(animate)
    }

    function aim(event:PointerEvent) {
      if(event.pointerType !== 'mouse' || !width || !height)return
      cursorX = (.5 - event.clientX / width) * .044
      cursorY = (.5 - event.clientY / height) * .036
    }

    const observer = new ResizeObserver(resize)
    resize()
    observer.observe(canvas)
    syncMotion()
    window.addEventListener('pointermove',aim,{passive:true})
    document.addEventListener('visibilitychange',syncMotion)
    document.addEventListener('fullscreenchange',syncMotion)
    media.addEventListener('change',syncMotion)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove',aim)
      document.removeEventListener('visibilitychange',syncMotion)
      document.removeEventListener('fullscreenchange',syncMotion)
      media.removeEventListener('change',syncMotion)
    }
  }, [stars,still])

  return <canvas ref={ref} className="starfield" aria-hidden="true"/>
}
