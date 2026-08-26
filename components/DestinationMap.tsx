'use client'
import { useEffect, useRef, useState } from 'react'
import { tr } from '@/lib/translations'
import type { Lang } from '@/contexts/LanguageContext'

type Destination = {
  id: string
  slug: string
  title_en: string
  excerpt_en: string | null
  region: string | null
  transport_price: string | null
  has_guide: boolean | null
  location_lat: number | null
  location_lng: number | null
}

const HOME_PROVINCE = 'Attapeu'

export default function DestinationMap({
  destinations,
  lang,
  selectedId,
  onSelect,
}: {
  destinations: Destination[]
  lang: Lang
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  const destinationsRef = useRef(destinations)
  destinationsRef.current = destinations

  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const markersByIdRef = useRef<Record<string, any>>({})
  // 'marker' when the current selectedId change originated from clicking a
  // pin directly (Leaflet already opened its popup with zero camera move --
  // panning/zooming again would be an unrequested, jarring side effect).
  // Left null/'list' for a card click, where the map genuinely needs to fly.
  const selectSourceRef = useRef<'marker' | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const stringsRef = useRef({ guideAvail: tr('map_guide_avail', lang), details: tr('map_details', lang), comingSoon: tr('map_coming_soon', lang) })
  stringsRef.current = { guideAvail: tr('map_guide_avail', lang), details: tr('map_details', lang), comingSoon: tr('map_coming_soon', lang) }

  // Redraw markers + re-check which provinces have data whenever the
  // (filtered) destination list changes. This also covers the initial
  // load, where the map's Leaflet/GeoJSON setup finishes before the
  // parent's Supabase fetch resolves.
  useEffect(() => {
    const redrawMarkers = (window as any)._destRedrawMarkers
    if (redrawMarkers) redrawMarkers(destinations)
    const updateProvinces = (window as any)._destUpdateProvinces
    if (updateProvinces) updateProvinces(destinations)
  }, [destinations])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    function ensureLeafletAssets(): Promise<any> {
      return new Promise(resolve => {
        if ((window as any).L) return resolve((window as any).L)
        if (!document.querySelector('link[data-leaflet]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          link.setAttribute('data-leaflet', 'true')
          document.head.appendChild(link)
        }
        const existing = document.querySelector('script[data-leaflet]') as HTMLScriptElement | null
        if (existing) {
          existing.addEventListener('load', () => resolve((window as any).L))
          if ((window as any).L) resolve((window as any).L)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.setAttribute('data-leaflet', 'true')
        script.onload = () => resolve((window as any).L)
        document.head.appendChild(script)
      })
    }

    ensureLeafletAssets().then(async (L: any) => {
      if (cancelled) return

      const map = L.map('dest-map', { zoomControl: true, scrollWheelZoom: true })

      // CARTO's free basemap tiles now require a signed-up API key (their
      // anonymous tier was retired) -- without one every tile just shows an
      // "API KEY REQUIRED" watermark, which at a glance looks like a broken
      // map. Esri's World Dark Gray Base is a real no-signup alternative.
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 16,
      }).addTo(map)

      const res = await fetch('/lao_admin1.geojson')
      const admin1 = await res.json()
      if (cancelled) return

      const activeStyle = { color: '#c9a84c', weight: 1.5, fillColor: '#c9a84c', fillOpacity: 0.06 }
      const dimStyle = { color: 'rgba(255,255,255,0.15)', weight: 1, fillColor: '#333', fillOpacity: 0.03 }

      let homeBounds: any = null

      const provinceLayer = L.geoJSON(admin1, {
        style: () => dimStyle,
        onEachFeature: (feature: any, layer: any) => {
          const name = feature.properties.adm1_name || ''
          layer._provinceName = name
          layer._hasData = false

          if (name === HOME_PROVINCE) homeBounds = layer.getBounds()

          layer.on('mouseover', () => {
            layer.setStyle(layer._hasData ? { fillOpacity: 0.35, weight: 2.5 } : { fillOpacity: 0.08 })
          })
          layer.on('mouseout', () => layer.setStyle(layer._hasData ? activeStyle : dimStyle))
          layer.on('click', () => {
            if (layer._hasData) {
              map.fitBounds(layer.getBounds().pad(0.15))
            } else {
              layer.bindTooltip(
                `<div style="background:#1a1a1a;color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.15);padding:6px 12px;border-radius:4px;font-size:12px;font-weight:600">${name} — ${stringsRef.current.comingSoon}</div>`,
                { sticky: true }
              ).openTooltip(layer.getBounds().getCenter())
              setTimeout(() => layer.closeTooltip(), 2000)
            }
          })
        },
      }).addTo(map)

      map.fitBounds((homeBounds ?? provinceLayer.getBounds()).pad(0.1))

      function updateProvinceStyles(list: Destination[]) {
        const provincesWithData = new Set(
          list.map(d => d.region?.trim().toLowerCase()).filter(Boolean)
        )
        provinceLayer.eachLayer((layer: any) => {
          const hasData = provincesWithData.has((layer._provinceName || '').trim().toLowerCase())
          layer._hasData = hasData
          layer.setStyle(hasData ? activeStyle : dimStyle)
        })
      }
      updateProvinceStyles(destinationsRef.current)

      let markers: any[] = []

      function drawMarkers(list: Destination[]) {
        markers.forEach(m => map.removeLayer(m))
        markers = []
        markersByIdRef.current = {}
        list.forEach(dest => {
          if (!dest.location_lat || !dest.location_lng) return
          const pinIcon = L.divIcon({
            className: '',
            html: `<div style="background:#c9a84c;width:14px;height:14px;border-radius:999px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.6);cursor:pointer"></div>`,
            iconAnchor: [7, 7],
          })
          const marker = L.marker([dest.location_lat, dest.location_lng], { icon: pinIcon })
            .addTo(map)
            .bindPopup(
              `<div style="background:#1a1a1a;border:1px solid rgba(201,168,76,0.25);border-radius:8px;padding:16px;min-width:220px;font-family:sans-serif">
                <p style="color:white;font-weight:700;font-size:15px;margin:0 0 6px">${dest.title_en}</p>
                <p style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.5;margin:0 0 10px">${dest.excerpt_en || ''}</p>
                ${dest.transport_price ? `<p style="color:#c9a84c;font-size:12px;margin:0 0 6px">🚗 ${dest.transport_price}</p>` : ''}
                ${dest.has_guide ? `<p style="color:#4caf50;font-size:12px;margin:0 0 10px">✓ ${stringsRef.current.guideAvail}</p>` : ''}
                <a href="/destinations/${dest.slug}" style="display:block;background:var(--color-gold,#c9a84c);color:#0a0a0a;padding:8px;border-radius:4px;font-size:12px;font-weight:700;text-decoration:none;text-align:center;margin-top:4px">${stringsRef.current.details}</a>
              </div>`,
              { className: 'custom-popup', maxWidth: 280 }
            )
            .on('click', () => {
              selectSourceRef.current = 'marker'
              onSelectRef.current?.(dest.id)
            })
          markers.push(marker)
          markersByIdRef.current[dest.id] = { marker, dest }
        })
      }

      function flyToMarker(id: string | null | undefined) {
        if (!id) return
        const entry = markersByIdRef.current[id]
        if (!entry) return
        const { marker, dest } = entry
        map.flyTo([dest.location_lat, dest.location_lng], Math.max(map.getZoom(), 11), { duration: 0.6 })
        marker.openPopup()
      }

      drawMarkers(destinationsRef.current)
      ;(window as any)._destRedrawMarkers = drawMarkers
      ;(window as any)._destUpdateProvinces = updateProvinceStyles
      ;(window as any)._destFlyToMarker = flyToMarker
      ;(window as any)._destMap = map
      if (!cancelled) setMapReady(true)
    })

    return () => {
      cancelled = true
      const map = (window as any)._destMap
      if (map) {
        map.remove()
        ;(window as any)._destMap = null
        ;(window as any)._destRedrawMarkers = null
        ;(window as any)._destUpdateProvinces = null
        ;(window as any)._destFlyToMarker = null
      }
    }
  }, [])

  // Card (in the list) was clicked/selected from outside -- pan the map to
  // that marker and open its popup, mirroring what clicking the marker
  // itself already does in the other direction. Depends on mapReady too:
  // Leaflet's script/CSS load asynchronously, so a card click that lands
  // before that resolves must still be honored once the map finishes
  // setting up, not silently dropped.
  useEffect(() => {
    if (selectSourceRef.current === 'marker') {
      // Selection came from clicking the pin itself -- Leaflet already
      // opened its popup with no camera move needed; don't re-pan/zoom.
      selectSourceRef.current = null
      return
    }
    const flyToMarker = (window as any)._destFlyToMarker
    if (flyToMarker) flyToMarker(selectedId)
  }, [selectedId, mapReady])

  return (
    <>
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper { background:transparent !important; border:none !important; box-shadow:none !important; padding:0 !important; }
        .custom-popup .leaflet-popup-content { margin:0 !important; }
        .custom-popup .leaflet-popup-tip-container { display:none !important; }
        .leaflet-popup-close-button { color:rgba(255,255,255,0.5) !important; top:8px !important; right:8px !important; }
      `}</style>
      <div id="dest-map" style={{ height: '100%', width: '100%', minHeight: '360px' }} />
    </>
  )
}
