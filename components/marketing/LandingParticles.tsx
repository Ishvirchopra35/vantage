'use client'

import { useEffect, useState } from 'react'
import { Particles } from '@/components/marketing/Particles'

// Variations of --gold (#d4a847) tuned for contrast against each theme's --bg.
// Dark mode (#0a0a0a): a brighter, warmer gold so the dots read on near-black.
// Light mode (#fafafa): a deeper amber-gold so the dots don't wash out on white.
const GOLD_DARK = '#e0bd6a'
const GOLD_LIGHT = '#c08a2d'

function resolveGold(): string {
  if (typeof document === 'undefined') return GOLD_LIGHT
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'light' ? GOLD_LIGHT : GOLD_DARK
}

export default function LandingParticles(): React.ReactElement {
  const [color, setColor] = useState<string>(GOLD_LIGHT)

  useEffect(() => {
    setColor(resolveGold())

    const observer = new MutationObserver(() => {
      setColor(resolveGold())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => observer.disconnect()
  }, [])

  return (
    <Particles
      className="absolute inset-0 z-0"
      quantity={250}
      staticity={60}
      ease={60}
      size={0.6}
      color={color}
    />
  )
}
