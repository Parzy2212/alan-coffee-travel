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
  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(false)

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
      const map = (window as any)._map
      if (map) map.setView([14.75, 107.05], 9)
      if ((window as any)._markers) {
        (window as any)._markers.forEach((m: any) => map.removeLayer(m))
        ;(window as any)._markers = []
      }
    } else if (level === 'attapeu') {
      setLevel('laos')
      const map = (window as any)._map
      if (map) map.setView([18.0, 103.0], 6)
      if ((window as any)._currentLayer) {
        map.removeLayer((window as any)._currentLayer)
        ;(window as any)._currentLayer = null
      }
      ;(window as any)._mapReady = false
      ;(window as any)._mapReady = true
      window.location.reload()
    }
  }

  return (
    <main style={{minHeight: '100vh', backgroundColor: '#0a0a0a'}}>

      {/* HEADER */}
      <section style={{backgroundColor: 'var(--color-black)', padding: '40px 32px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px'}}>
              <div style={{height: '1px', width: '32px', backgroundColor: 'var(--color-gold)'}}></div>
              <span style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const}}>
                {level === 'laos' ? 'Laos — 18 Provinces' : level === 'attapeu' ? 'Attapeu Province — 5 Districts' : `${selectedDistrict?.name} District`}
              </span>
            </div>
            <h1 style={{fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 800, color: 'white', letterSpacing: '-1px'}}>
              {level === 'laos' ? 'Explore Laos.' : level === 'attapeu' ? 'Select a District.' : 'Destinations.'}
            </h1>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
            {/* Breadcrumb */}
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span
                onClick={() => { if (level !== 'laos') { handleBack(); if (level === 'district') handleBack() } }}
                style={{color: level === 'laos' ? 'var(--color-gold)' : 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: level !== 'laos' ? 'pointer' : 'default'}}
              >Laos</span>
              {level !== 'laos' && <>
                <span style={{color: 'rgba(255,255,255,0.2)'}}>›</span>
                <span style={{color: level === 'attapeu' ? 'var(--color-gold)' : 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: level === 'district' ? 'pointer' : 'default'}}
                  onClick={() => { if (level === 'district') handleBack() }}>Attapeu</span>
              </>}
              {level === 'district' && <>
                <span style={{color: 'rgba(255,255,255,0.2)'}}>›</span>
                <span style={{color: 'var(--color-gold)', fontSize: '12px'}}>{selectedDistrict?.name}</span>
              </>}
            </div>

            {level !== 'laos' && (
              <button onClick={handleBack} style={{backgroundColor: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: 600}}>
                ← Back
              </button>
            )}
          </div>
        </div>
      </section>

      {/* MAP + SIDEBAR */}
      <section style={{display: 'grid', gridTemplateColumns: '1fr 360px', height: 'calc(100vh - 148px)'}}>

        {/* MAP */}
        <div style={{position: 'relative' as const, overflow: 'hidden'}}>
          <InteractiveMap
            onSelectProvince={() => setLevel('attapeu')}
            onSelectDistrict={(district) => {
              setSelectedDistrict(district)
              setLevel('district')
              loadDestinations(district.slug)
            }}
          />
        </div>

        {/* SIDEBAR */}
        <div style={{backgroundColor: '#111', borderLeft: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto' as const, padding: '28px'}}>

          {level === 'laos' && (
            <div>
              <p style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '20px'}}>How to Navigate</p>
              {[
                { step: '1', text: 'Hover any province to highlight it' },
                { step: '2', text: 'Click Attapeu to explore districts' },
                { step: '3', text: 'Click a district to see destinations & map pins' },
              ].map(item => (
                <div key={item.step} style={{display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px'}}>
                  <span style={{backgroundColor: 'var(--color-gold)', color: '#0a0a0a', borderRadius: '999px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0}}>{item.step}</span>
                  <p style={{color: 'rgba(255,255,255,0.45)', fontSize: '14px', lineHeight: 1.6, marginTop: '2px'}}>{item.text}</p>
                </div>
              ))}
              <div style={{marginTop: '28px', backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: '8px', padding: '16px', border: '1px solid rgba(201,168,76,0.2)'}}>
                <p style={{color: 'var(--color-gold)', fontSize: '12px', fontWeight: 700, marginBottom: '6px'}}>★ Starting Point</p>
                <p style={{color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.6}}>Alan Coffee & Travel is based in Attapeu — Southern Laos. Click it to begin.</p>
              </div>
            </div>
          )}

          {level === 'attapeu' && (
            <div>
              <p style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '14px'}}>5 Districts</p>
              <p style={{color: 'rgba(255,255,255,0.35)', fontSize: '13px', lineHeight: 1.7, marginBottom: '20px'}}>Click a district on the map to see destinations and navigation pins.</p>
              {['Samakhi Xai', 'Xayxetha', 'Sanxay', 'Phouvong', 'Sanamxay'].map(name => (
                <div key={name}
                  onClick={() => {
                    const slug = name.toLowerCase().replace(/\s+/g, '-')
                    setSelectedDistrict({ name, slug })
                    setLevel('district')
                    loadDestinations(slug)
                  }}
                  style={{backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px 16px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer'}}>
                  <p style={{color: 'white', fontSize: '14px', fontWeight: 600}}>{name}</p>
                </div>
              ))}
            </div>
          )}

          {level === 'district' && (
            <div>
              <p style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '6px'}}>{selectedDistrict?.name}</p>
              <p style={{color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '20px'}}>Click a pin on the map to view details</p>

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
                    <div key={dest.id} style={{backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)'}}>
                      <p style={{color: 'white', fontWeight: 700, fontSize: '14px', marginBottom: '4px'}}>{dest.title_en}</p>
                      <p style={{color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: 1.5, marginBottom: '10px'}}>{dest.excerpt_en}</p>
                      {dest.transport_price && <p style={{color: 'var(--color-gold)', fontSize: '12px', marginBottom: '6px', fontWeight: 600}}>🚗 {dest.transport_price}</p>}
                      {dest.has_guide && <p style={{color: '#4caf50', fontSize: '12px', marginBottom: '10px'}}>✓ Guide Available</p>}
                      <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                        <a href={`/destinations/${dest.slug}`} style={{flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', padding: '8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', textAlign: 'center' as const}}>Details</a>
                        {dest.location_lat && dest.location_lng && (
                          <a href={`https://www.google.com/maps?q=${dest.location_lat},${dest.location_lng}`} target="_blank" style={{flex: 1, backgroundColor: 'var(--color-gold)', color: '#0a0a0a', padding: '8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' as const}}>
                            Google Maps 🗺️
                          </a>
                        )}
                      </div>
                    </div>
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

function InteractiveMap({ onSelectProvince, onSelectDistrict }: {
  onSelectProvince: () => void
  onSelectDistrict: (d: { name: string, slug: string }) => void
}) {
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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO'
      }).addTo(map)

      // Mapping from GeoJSON adm2_name → { DB slug, display name }
      const DISTRICT_MAP: Record<string, { slug: string; displayName: string }> = {
        'Samakkhixay': { slug: 'samakhi-xai', displayName: 'Samakhi Xai' },
        'Sanamxay':    { slug: 'sanamxay',    displayName: 'Sanamxay' },
        'Sanxay':      { slug: 'sanxay',      displayName: 'Sanxay' },
        'Phouvong':    { slug: 'phouvong',    displayName: 'Phouvong' },
        'Xaysetha':    { slug: 'xayxetha',   displayName: 'Xayxetha' },
      }

      const res = await fetch('/lao_admin1.geojson')
      const admin1 = await res.json()

      let currentLayer: any = null

      function loadProvinces() {
        if (currentLayer) map.removeLayer(currentLayer)

        currentLayer = L.geoJSON(admin1, {
          style: (feature: any) => {
            const isAttapeu = feature.properties.adm1_name?.toLowerCase().includes('attap')
            return {
              color: isAttapeu ? '#c9a84c' : 'rgba(255,255,255,0.25)',
              weight: isAttapeu ? 2 : 1,
              fillColor: isAttapeu ? '#c9a84c' : '#ffffff',
              fillOpacity: isAttapeu ? 0.12 : 0.03,
            }
          },
          onEachFeature: (feature: any, layer: any) => {
            const name = feature.properties.adm1_name || ''
            const isAttapeu = name.toLowerCase().includes('attap')

            layer.on('mouseover', () => {
              layer.setStyle({ fillOpacity: isAttapeu ? 0.4 : 0.12, weight: 2, color: isAttapeu ? '#c9a84c' : 'rgba(255,255,255,0.5)' })
              layer.bindTooltip(`<div style="background:#1a1a1a;color:${isAttapeu ? '#c9a84c' : 'white'};border:1px solid rgba(255,255,255,0.1);padding:6px 12px;border-radius:4px;font-size:12px;font-weight:600">${name}</div>`, { sticky: true, className: 'leaflet-tooltip-custom' }).openTooltip()
            })
            layer.on('mouseout', () => { currentLayer.resetStyle(layer) })
            layer.on('click', () => {
              if (isAttapeu) {
                onSelectProvince()
                loadAttapeu()
              }
            })
          }
        }).addTo(map)

        map.fitBounds(currentLayer.getBounds())
        ;(window as any)._currentLayer = currentLayer
      }

      async function loadAttapeu() {
        const res2 = await fetch('/lao_admin2.geojson')
        const admin2 = await res2.json()

        const attapeuFeatures = admin2.features.filter((f: any) =>
          f.properties.adm1_name?.toLowerCase().includes('attap')
        )
        const attapeuGeo = { type: 'FeatureCollection', features: attapeuFeatures }

        if (currentLayer) map.removeLayer(currentLayer)

        currentLayer = L.geoJSON(attapeuGeo, {
          style: () => ({
            color: '#c9a84c',
            weight: 2,
            fillColor: '#c9a84c',
            fillOpacity: 0.12,
          }),
          onEachFeature: (feature: any, layer: any) => {
            const geoName = feature.properties.adm2_name || ''
            const mapped = DISTRICT_MAP[geoName]
            const slug = mapped?.slug || geoName.toLowerCase().replace(/\s+/g, '-')
            const displayName = mapped?.displayName || geoName

            layer.on('mouseover', () => {
              layer.setStyle({ fillOpacity: 0.4, weight: 3 })
              layer.bindTooltip(`<div style="background:#1a1a1a;color:#c9a84c;border:1px solid rgba(201,168,76,0.3);padding:6px 12px;border-radius:4px;font-size:12px;font-weight:700">${displayName}</div>`, { sticky: true }).openTooltip()
            })
            layer.on('mouseout', () => { layer.setStyle({ fillOpacity: 0.12, weight: 2 }) })
            layer.on('click', async () => {
              onSelectDistrict({ name: displayName, slug })
              map.fitBounds(layer.getBounds().pad(0.3))

              // Load & show pins using the shared supabase client
              const { data, error } = await supabase
                .from('destinations')
                .select('*')
                .eq('district', slug)
                .eq('status', 'active')

              console.log('[map] district click slug:', slug, '| data:', data, '| error:', error)

              if ((window as any)._markers) {
                ;(window as any)._markers.forEach((m: any) => map.removeLayer(m))
              }
              ;(window as any)._markers = []

              if (!data) return
              data.forEach((dest: any) => {
                if (!dest.location_lat || !dest.location_lng) return

                const pinIcon = L.divIcon({
                  className: '',
                  html: `<div style="background:#c9a84c;width:14px;height:14px;border-radius:999px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.6);cursor:pointer"></div>`,
                  iconAnchor: [7, 7]
                })

                const marker = L.marker([dest.location_lat, dest.location_lng], { icon: pinIcon })
                  .addTo(map)
                  .bindPopup(`
                    <div style="background:#1a1a1a;border:1px solid rgba(201,168,76,0.25);border-radius:8px;padding:16px;min-width:220px;font-family:sans-serif">
                      <p style="color:#c9a84c;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px">${displayName}</p>
                      <p style="color:white;font-weight:700;font-size:15px;margin:0 0 6px">${dest.title_en}</p>
                      <p style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.5;margin:0 0 10px">${dest.excerpt_en || ''}</p>
                      ${dest.transport_price ? `<p style="color:#c9a84c;font-size:12px;margin:0 0 6px">🚗 ${dest.transport_price}</p>` : ''}
                      ${dest.has_guide ? `<p style="color:#4caf50;font-size:12px;margin:0 0 10px">✓ Guide Available</p>` : ''}
                      <div style="display:flex;gap:8px;margin-top:12px">
                        <a href="/destinations/${dest.slug}" style="flex:1;background:rgba(255,255,255,0.08);color:white;padding:8px;border-radius:4px;font-size:12px;font-weight:600;text-decoration:none;text-align:center">Details</a>
                        <a href="https://www.google.com/maps?q=${dest.location_lat},${dest.location_lng}" target="_blank" style="flex:1;background:#c9a84c;color:#0a0a0a;padding:8px;border-radius:4px;font-size:12px;font-weight:700;text-decoration:none;text-align:center">Google Maps 🗺️</a>
                      </div>
                    </div>
                  `, { className: 'custom-popup', maxWidth: 280 })

                ;(window as any)._markers.push(marker)
              })
            })

            // District label
            const center = layer.getBounds().getCenter()
            const icon = L.divIcon({
              className: '',
              html: `<div style="color:white;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,0.9);pointer-events:none">${displayName}</div>`,
              iconAnchor: [40, 8]
            })
            L.marker(center, { icon, interactive: false }).addTo(map)
          }
        }).addTo(map)

        map.fitBounds(currentLayer.getBounds().pad(0.15))
        ;(window as any)._currentLayer = currentLayer
      }

      loadProvinces()
    }
    document.head.appendChild(script)
  }, [])

  return (
    <>
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper { background:transparent !important; border:none !important; box-shadow:none !important; padding:0 !important; }
        .custom-popup .leaflet-popup-content { margin:0 !important; }
        .custom-popup .leaflet-popup-tip-container { display:none !important; }
        .leaflet-popup-close-button { color:rgba(255,255,255,0.5) !important; top:8px !important; right:8px !important; }
        .leaflet-tooltip-custom { background:transparent; border:none; box-shadow:none; }
      `}</style>
      <div id="main-map" style={{height: '100%', width: '100%', minHeight: '600px'}}></div>
    </>
  )
}