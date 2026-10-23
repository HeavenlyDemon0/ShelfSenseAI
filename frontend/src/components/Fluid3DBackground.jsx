import React, { useEffect, useRef } from 'react'

export default function Fluid3DBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    const handleMouseMove = (e) => {
      mouse.targetX = e.clientX
      mouse.targetY = e.clientY
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)

    let animationId
    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // Smooth mouse follow
      mouse.x += (mouse.targetX - mouse.x) * 0.06
      mouse.y += (mouse.targetY - mouse.y) * 0.06

      // Base canvas fill (deep charcoal obsidian)
      ctx.fillStyle = '#0e0f12'
      ctx.fillRect(0, 0, width, height)

      // Elegant radial spotlight following mouse
      const spotlight = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        650
      )
      spotlight.addColorStop(0, 'rgba(255, 255, 255, 0.035)')
      spotlight.addColorStop(0.4, 'rgba(255, 255, 255, 0.012)')
      spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = spotlight
      ctx.fillRect(0, 0, width, height)

      // Subtle architectural dot grid
      const gridSize = 32
      const startX = 0
      const startY = 0

      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
      for (let x = startX; x < width; x += gridSize) {
        for (let y = startY; y < height; y += gridSize) {
          // Distance to cursor modulates opacity slightly
          const dx = mouse.x - x
          const dy = mouse.y - y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 400) {
            const alpha = 0.035 + (1 - dist / 400) * 0.06
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'
          }
          ctx.fillRect(x, y, 1.2, 1.2)
        }
      }

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.95 }}
    />
  )
}
