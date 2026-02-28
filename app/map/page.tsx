'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Destination = {
  id: string
  title_en: string
  excerpt_en: string
  slug: string
  transport_price: string
  has_guide: boolean
  location_lat: number
  location_lng: number
  district: string
}

type ViewLevel = 'laos' | 'attapeu' | 'district'

export default function MapPage() {
  const [level, setLevel] = useState<ViewLevel>('laos')
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(false)
  const [mapInstance, setMapInstance] = useState<any>(null)

  async function loadDestinations(districtSlug: string) {
    setLoading(true)
    const { data } = await supabase
      .from('destinations')
      .select('*')
      .eq('district', districtSlug)
      .eq('status', 'active')
    setDestinations((data as Destination[]) || [])
    setLoading(false)
  }

  function handleBack() {
    if (level === 'district') {
      setLevel('attapeu')
      setSelectedDistrict(null)
      setDestinations([])
      if (mapInstance) {
        mapInstance.setView([14.75, 107.05], 9)
      }
    } else if (level === 'attapeu') {
      setLevel('laos')
      setSelectedProvince(null)
      if (mapInstance) {
        mapInstance.setView([18.0, 103.0], 6)
      }
    }
  }

  return (
    <main style={{minHeight: '100vh', backgroundColor: '#0a0a0a'}}>

      {/* HEADER */}
      <section style={{backgroundColor: 'var(--color-black)', padding: '48px 32px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
              <div style={{height: '1px', width: '32px', backgroundColor: 'var(--color-gold)'}}></div>
              <span style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const}}>
                {level === 'laos' ? 'Laos — 18 Provinces' : level === 'attapeu' ? 'Attapeu Province' : `Attapeu — ${selectedDistrict?.name}`}
              </span>
            </div>
            <h1 style={{fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 800, color: 'var(--color-white)', letterSpacing: '-1.5px'}}>
              {level === 'laos' ? 'Explore Laos.' : level === 'attapeu' ? 'Select a District.' : 'Destinations.'}
            </h1>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
            {level !== 'laos' && (
              <button onClick={handleBack} style={{backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--color-white)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600}}>
                ← Back
              </button>
            )}
            {/* Breadcrumb */}
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span style={{color: level === 'laos' ? 'var(--color-gold)' : 'rgba(255,255,255,0.3)', fontSize: '12px', cursor: 'pointer'}} onClick={() => { setLevel('laos'); setSelectedProvince(null); setSelectedDistrict(null); }}>Laos</span>
              {level !== 'laos' && <>
                <span style={{color: 'rgba(255,255,255,0.2)', fontSize: '12px'}}>›</span>
                <span style={{color: level === 'attapeu' ? 'var(--color-gold)' : 'rgba(255,255,255,0.3)', fontSize: '12px', cursor: 'pointer'}} onClick={() => { if (level === 'district') { setLevel('attapeu'); setSelectedDistrict(null); }}}>Attapeu</span>
              </>}
              {level === 'district' && <>
                <span style={{color: 'rgba(255,255,255,0.2)', fontSize: '12px'}}>›</span>
                <span style={{color: 'var(--color-gold)', fontSize: '12px'}}>{selectedDistrict?.name}</span>
              </>}
            </div>
          </div>
        </div>
      </section>

      {/* MAP + SIDEBAR */}
      <section style={{display: 'grid', gridTemplateColumns: '1fr 360px', height: 'calc(100vh - 160px)'}}>

        {/* MAP */}
        <div style={{position: 'relative' as const, overflow: 'hidden'}}>
          <InteractiveMap
            level={level}
            onSelectProvince={(name) => {
              if (name === 'Attapeu' || name === 'Attapu' || name.includes('Attap')) {
                setSelectedProvince(name)
                setLevel('attapeu')
              }
            }}
            onSelectDistrict={(district) => {
              setSelectedDistrict(district)
              setLevel('district')
              loadDestinations(district.slug)
            }}
            onMapReady={(map) => setMapInstance(map)}
          />
        </div>

        {/* SIDEBAR */}
        <div style={{backgroundColor: '#111111', borderLeft: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto' as const, padding: '28px'}}>

          {level === 'laos' && (
            <div>
              <p style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '16px'}}>How to Navigate</p>
              <div style={{display: 'flex', flexDirection: 'column' as const, gap: '16px'}}>
                {[
                  { step: '1', text: 'Hover over any province to highlight it' },
                  { step: '2', text: 'Click Attapeu province to explore' },
                  { step: '3', text: 'Select a district to see destinations' },
                ].map(item => (
                  <div key={item.step} style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
                    <span style={{backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', borderRadius: '999px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0}}>{item.step}</span>
                    <p style={{color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: 1.6, marginTop: '2px'}}>{item.text}</p>
                  </div>
                ))}
              </div>
              <div style={{marginTop: '32px', backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: '8px', padding: '16px', border: '1px solid rgba(201,168,76,0.2)'}}>
                <p style={{color: 'var(--color-gold)', fontSize: '12px', fontWeight: 700, marginBottom: '6px'}}>★ Featured</p>
                <p style={{color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.6}}>Attapeu Province — Southern Laos. The starting point of Alan Coffee & Travel.</p>
              </div>
            </div>
          )}

          {level === 'attapeu' && (
            <div>
              <p style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '16px'}}>Attapeu Districts</p>
              <p style={{color: 'rgba(255,255,255,0.4)', fontSize: '13px', lineHeight: 1.7, marginBottom: '24px'}}>Click a district on the map or select below to explore destinations.</p>
              {['Samakhi Xai', 'Xayxetha', 'Sanxay', 'Phouvong', 'Sanamxay'].map(name => (
                <div key={name} style={{backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px 16px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer'}}
                  onClick={() => {
                    const slug = name.toLowerCase().replace(' ', '-')
                    setSelectedDistrict({ name, slug })
                    setLevel('district')
                    loadDestinations(slug)
                  }}>
                  <p style={{color: 'var(--color-white)', fontSize: '14px', fontWeight: 600}}>{name}</p>
                </div>
              ))}
            </div>
          )}

          {level === 'district' && (
            <div>
              <p style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '8px'}}>{selectedDistrict?.name}</p>
              <p style={{color: 'rgba(255,255,255,0.35)', fontSize: '13px', marginBottom: '24px'}}>Destinations in this district</p>
              {loading ? (
                <p style={{color: 'rgba(255,255,255,0.3)', fontSize: '13px'}}>Loading...</p>
              ) : destinations.length === 0 ? (
                <div style={{backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '24px', textAlign: 'center' as const, border: '1px solid rgba(255,255,255,0.06)'}}>
                  <p style={{color: 'rgba(255,255,255,0.25)', fontSize: '13px', lineHeight: 1.7}}>No destinations yet.<br />Add via Admin Panel.</p>
                  <a href="/admin" style={{display: 'inline-block', marginTop: '12px', color: 'var(--color-gold)', fontSize: '12px', textDecoration: 'none', fontWeight: 600}}>Go to Admin →</a>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column' as const, gap: '10px'}}>
                  {destinations.map(dest => (
                    <a key={dest.id} href={'/destinations/' + dest.slug} style={{backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', display: 'block'}}>
                      <p style={{color: 'var(--color-white)', fontWeight: 700, fontSize: '14px', marginBottom: '4px'}}>{dest.title_en}</p>
                      <p style={{color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: 1.5}}>{dest.excerpt_en}</p>
                      {dest.transport_price && <p style={{color: 'var(--color-gold)', fontSize: '12px', marginTop: '8px', fontWeight: 600}}>🚗 {dest.transport_price}</p>}
                      {dest.has_guide && <p style={{color: '#4caf50', fontSize: '12px', marginTop: '4px'}}>✓ Guide Available</p>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </section>

    </main>
  )
}

function InteractiveMap({ level, onSelectProvince, onSelectDistrict, onMapReady }: {
  level: ViewLevel
  onSelectProvince: (name: string) => void
  onSelectDistrict: (d: { name: string, slug: string }) => void
  onMapReady: (map: any) => void
}) {
  const mapRef = { current: null as any }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any)._mapReady) return

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = async () => {
      const L = (window as any).L
      if ((window as any)._mapReady) return
      ;(window as any)._mapReady = true

      const map = L.map('main-map', { zoomControl: true, scrollWheelZoom: true })
      ;(window as any)._map = map
      onMapReady(map)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO'
      }).addTo(map)

      // Load Laos admin1 (provinces)
      const res = await fetch('/lao_admin1.geojson')
      const admin1 = await res.json()

      let currentLayer: any = null
      let hoveredLayer: any = null

      function loadProvinces() {
        if (currentLayer) { map.removeLayer(currentLayer) }

        currentLayer = L.geoJSON(admin1, {
          style: (feature: any) => {
            const isAttapeu = feature.properties.ADM1_EN?.toLowerCase().includes('attap')
            return {
              color: isAttapeu ? '#c9a84c' : 'rgba(255,255,255,0.3)',
              weight: isAttapeu ? 2 : 1,
              fillColor: isAttapeu ? '#c9a84c' : '#ffffff',
              fillOpacity: isAttapeu ? 0.15 : 0.04,
            }
          },
          onEachFeature: (feature: any, layer: any) => {
            const name = feature.properties.ADM1_EN || ''
            const isAttapeu = name.toLowerCase().includes('attap')

            layer.on('mouseover', () => {
              layer.setStyle({
                fillOpacity: isAttapeu ? 0.45 : 0.15,
                weight: isAttapeu ? 3 : 2,
                color: isAttapeu ? '#c9a84c' : 'rgba(255,255,255,0.6)',
              })
              layer.bindTooltip(`<div style="background:#1a1a1a;color:white;border:1px solid rgba(255,255,255,0.1);padding:6px 12px;border-radius:4px;font-size:12px;font-weight:600">${name}</div>`, { sticky: true, className: 'custom-tooltip' }).openTooltip()
            })

            layer.on('mouseout', () => {
              currentLayer.resetStyle(layer)
            })

            layer.on('click', () => {
              if (isAttapeu) {
                onSelectProvince(name)
                loadAttapeu()
              }
            })
          }
        }).addTo(map)

        map.fitBounds(currentLayer.getBounds())
      }

      async function loadAttapeu() {
        const res2 = await fetch('/lao_admin2.geojson')
        const admin2 = await res2.json()

        // Filter only Attapeu districts
        const attapeuFeatures = admin2.features.filter((f: any) =>
          f.properties.ADM1_EN?.toLowerCase().includes('attap')
        )
        const attapeuGeoJSON = { type: 'FeatureCollection', features: attapeuFeatures }

        if (currentLayer) map.removeLayer(currentLayer)

        currentLayer = L.geoJSON(attapeuGeoJSON, {
          style: () => ({
            color: '#c9a84c',
            weight: 2,
            fillColor: '#c9a84c',
            fillOpacity: 0.15,
          }),
          onEachFeature: (feature: any, layer: any) => {
            const name = feature.properties.ADM2_EN || ''
            const slug = name.toLowerCase().replace(/\s+/g, '-')

            layer.on('mouseover', () => {
              layer.setStyle({ fillOpacity: 0.45, weight: 3 })
              layer.bindTooltip(`<div style="background:#1a1a1a;color:#c9a84c;border:1px solid rgba(201,168,76,0.3);padding:6px 12px;border-radius:4px;font-size:12px;font-weight:700">${name}</div>`, { sticky: true }).openTooltip()
            })

            layer.on('mouseout', () => {
              layer.setStyle({ fillOpacity: 0.15, weight: 2 })
            })

            layer.on('click', () => {
              onSelectDistrict({ name, slug })
              map.fitBounds(layer.getBounds().pad(0.3))
            })

            // Label
            const center = layer.getBounds().getCenter()
            const icon = L.divIcon({
              className: '',
              html: `<div style="color:white;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,0.9);pointer-events:none">${name}</div>`,
              iconAnchor: [40, 8]
            })
            L.marker(center, { icon, interactive: false }).addTo(map)
          }
        }).addTo(map)

        map.fitBounds(currentLayer.getBounds().pad(0.15))
      }

      loadProvinces()
    }
    document.head.appendChild(script)
  }, [])

  return <div id="main-map" style={{height: '100%', width: '100%', minHeight: '600px'}}></div>
}