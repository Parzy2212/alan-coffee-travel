'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'
import Navbar from '@/components/Navbar'

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

type ViewLevel = 'laos' | 'province' | 'district'

export default function MapPage() {
  const { lang } = useLang()
  const [level, setLevel] = useState<ViewLevel>('laos')
  const [selectedProvince, setSelectedProvince] = useState<{ name: string } | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<{ name: string; slug: string } | null>(null)
  const [provinceDistricts, setProvinceDistricts] = useState<{ name: string; slug: string }[]>([])
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

  function clearMapMarkers(map: any) {
    if ((window as any)._markers) {
      ;(window as any)._markers.forEach((m: any) => map?.removeLayer(m))
      ;(window as any)._markers = []
    }
  }

  function goToLaos() {
    const map = (window as any)._map
    setLevel('laos')
    setSelectedProvince(null)
    setSelectedDistrict(null)
    setProvinceDistricts([])
    setDestinations([])
    clearMapMarkers(map)
    if ((window as any)._labelMarkers) {
      ;(window as any)._labelMarkers.forEach((m: any) => map?.removeLayer(m))
      ;(window as any)._labelMarkers = []
    }
    const fn = (window as any)._loadProvinces
    if (fn) fn()
    else window.location.reload()
  }

  function handleBack() {
    const map = (window as any)._map
    if (level === 'district') {
      setLevel('province')
      setSelectedDistrict(null)
      setDestinations([])
      clearMapMarkers(map)
      if (map && (window as any)._currentLayer) {
        map.fitBounds((window as any)._currentLayer.getBounds().pad(0.15))
      }
    } else if (level === 'province') {
      goToLaos()
    }
  }

  const eyebrowText = level === 'laos'
    ? `${tr('map_bc_laos', lang)} — 18 ${tr('map_province_suffix', lang)}s`
    : level === 'province'
    ? `${selectedProvince?.name} ${tr('map_province_suffix', lang)}`
    : `${selectedDistrict?.name} ${tr('map_district_suffix', lang)}`

  const h1Text = level === 'laos'
    ? tr('map_h1_laos', lang)
    : level === 'province'
    ? tr('map_h1_province', lang)
    : tr('map_h1_district', lang)

  // Strings passed into the Leaflet map (captured at mount)
  const mapStrings = {
    guideAvail: tr('map_guide_avail', lang),
    details:    tr('map_details', lang),
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>

      <Navbar />

      {/* HEADER */}
      <section style={{ backgroundColor: 'var(--color-black)', padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="map-header-inner">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>
                {eyebrowText}
              </span>
            </div>
            <h1 className="hero-h1-md" style={{ fontFamily: 'var(--font-heading)', color: 'white' }}>
              {h1Text}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                onClick={() => { if (level !== 'laos') goToLaos() }}
                style={{ color: level === 'laos' ? 'var(--color-gold)' : 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: level !== 'laos' ? 'pointer' : 'default' }}
              >{tr('map_bc_laos', lang)}</span>
              {level !== 'laos' && <>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>›</span>
                <span
                  style={{ color: level === 'province' ? 'var(--color-gold)' : 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: level === 'district' ? 'pointer' : 'default' }}
                  onClick={() => { if (level === 'district') handleBack() }}
                >{selectedProvince?.name}</span>
              </>}
              {level === 'district' && <>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>›</span>
                <span style={{ color: 'var(--color-gold)', fontSize: '12px' }}>{selectedDistrict?.name}</span>
              </>}
            </div>

            {level !== 'laos' && (
              <button onClick={handleBack} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                {tr('map_back', lang)}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* MAP + SIDEBAR */}
      <section className="map-layout">

        {/* MAP */}
        <div className="map-container">
          <InteractiveMap
            strings={mapStrings}
            onSelectProvince={(province) => {
              setSelectedProvince(province)
              setLevel('province')
            }}
            onSelectDistrict={(district) => {
              setSelectedDistrict(district)
              setLevel('district')
              loadDestinations(district.slug)
            }}
            onDistrictsLoaded={(districts) => setProvinceDistricts(districts)}
          />
        </div>

        {/* SIDEBAR */}
        <div className="map-sidebar">

          {level === 'laos' && (
            <div>
              <p style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '20px' }}>{tr('map_how_to', lang)}</p>
              {[
                { step: '1', text: tr('map_nav_step1', lang) },
                { step: '2', text: tr('map_nav_step2', lang) },
                { step: '3', text: tr('map_nav_step3', lang) },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <span style={{ backgroundColor: 'var(--color-gold)', color: '#0a0a0a', borderRadius: '999px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>{item.step}</span>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', lineHeight: 1.6, marginTop: '2px' }}>{item.text}</p>
                </div>
              ))}
              <div style={{ marginTop: '28px', backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: '8px', padding: '16px', border: '1px solid rgba(201,168,76,0.2)' }}>
                <p style={{ color: 'var(--color-gold)', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>{tr('map_starting_point', lang)}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.6 }}>{tr('map_starting_text', lang)}</p>
              </div>
            </div>
          )}

          {level === 'province' && (
            <div>
              <p style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{selectedProvince?.name}</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '20px' }}>
                {provinceDistricts.length} {tr('map_districts_label', lang)} — {tr('map_district_explore', lang)}
              </p>
              {provinceDistricts.map(d => (
                <div key={d.slug}
                  onClick={() => {
                    setSelectedDistrict(d)
                    setLevel('district')
                    loadDestinations(d.slug)
                  }}
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px 16px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{d.name}</p>
                </div>
              ))}
            </div>
          )}

          {level === 'district' && (
            <div>
              <p style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{selectedDistrict?.name}</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '20px' }}>{tr('map_pin_hint', lang)}</p>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '8px' }} />
                  ))}
                </div>
              ) : destinations.length === 0 ? (
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '24px', textAlign: 'center' as const, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', lineHeight: 1.7 }}>
                    {tr('map_no_dest', lang)}<br />{tr('map_no_dest_admin', lang)}
                  </p>
                  <a href="/admin" style={{ display: 'inline-block', marginTop: '12px', color: 'var(--color-gold)', fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}>{tr('map_go_admin', lang)}</a>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                  {destinations.map(dest => (
                    <div key={dest.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p style={{ color: 'white', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{dest.title_en}</p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: 1.5, marginBottom: '10px' }}>{dest.excerpt_en}</p>
                      {dest.transport_price && <p style={{ color: 'var(--color-gold)', fontSize: '12px', marginBottom: '6px', fontWeight: 600 }}>🚗 {dest.transport_price}</p>}
                      {dest.has_guide && <p style={{ color: '#4caf50', fontSize: '12px', marginBottom: '10px' }}>✓ {tr('map_guide_avail', lang)}</p>}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <a href={`/destinations/${dest.slug}`} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', padding: '8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', textAlign: 'center' as const }}>{tr('map_details', lang)}</a>
                        {dest.location_lat && dest.location_lng && (
                          <a href={`https://www.google.com/maps?q=${dest.location_lat},${dest.location_lng}`} target="_blank" style={{ flex: 1, backgroundColor: 'var(--color-gold)', color: '#0a0a0a', padding: '8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' as const }}>
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

function InteractiveMap({ onSelectProvince, onSelectDistrict, onDistrictsLoaded, strings }: {
  onSelectProvince: (p: { name: string }) => void
  onSelectDistrict: (d: { name: string; slug: string }) => void
  onDistrictsLoaded: (districts: { name: string; slug: string }[]) => void
  strings: { guideAvail: string; details: string }
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

      // CARTO's free basemap tiles now require a signed-up API key (their
      // anonymous tier was retired) -- without one every tile just shows an
      // "API KEY REQUIRED" watermark, which at a glance looks like a broken
      // map. Esri's World Dark Gray Base is a real no-signup alternative.
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 16,
      }).addTo(map)

      // Attapeu-specific corrections for backward compat with existing DB slugs
      const DISTRICT_MAP: Record<string, { slug: string; displayName: string }> = {
        'Samakkhixay': { slug: 'samakhi-xai', displayName: 'Samakhi Xai' },
        'Sanamxay':    { slug: 'sanamxay',    displayName: 'Sanamxay' },
        'Sanxay':      { slug: 'sanxay',      displayName: 'Sanxay' },
        'Phouvong':    { slug: 'phouvong',    displayName: 'Phouvong' },
        'Xaysetha':    { slug: 'xayxetha',    displayName: 'Xayxetha' },
      }

      const res = await fetch('/lao_admin1.geojson')
      const admin1 = await res.json()

      let admin2Cache: any = null
      let currentLayer: any = null

      function clearLabelMarkers() {
        if ((window as any)._labelMarkers) {
          ;(window as any)._labelMarkers.forEach((m: any) => map.removeLayer(m))
          ;(window as any)._labelMarkers = []
        }
      }

      function loadProvinces() {
        clearLabelMarkers()
        if (currentLayer) map.removeLayer(currentLayer)

        currentLayer = L.geoJSON(admin1, {
          style: () => ({
            color: '#c9a84c',
            weight: 1.5,
            fillColor: '#c9a84c',
            fillOpacity: 0.06,
          }),
          onEachFeature: (feature: any, layer: any) => {
            const name = feature.properties.adm1_name || ''

            layer.on('mouseover', () => {
              layer.setStyle({ fillOpacity: 0.35, weight: 2.5 })
              layer.bindTooltip(
                `<div style="background:#1a1a1a;color:#c9a84c;border:1px solid rgba(201,168,76,0.3);padding:6px 12px;border-radius:4px;font-size:12px;font-weight:600">${name}</div>`,
                { sticky: true, className: 'leaflet-tooltip-custom' }
              ).openTooltip()
            })
            layer.on('mouseout', () => { currentLayer.resetStyle(layer) })
            layer.on('click', () => {
              onSelectProvince({ name })
              loadProvinceDistricts(name)
            })
          }
        }).addTo(map)

        map.fitBounds(currentLayer.getBounds())
        ;(window as any)._currentLayer = currentLayer
      }

      // Expose for back navigation from React
      ;(window as any)._loadProvinces = loadProvinces

      async function loadProvinceDistricts(provinceName: string) {
        if (!admin2Cache) {
          const res2 = await fetch('/lao_admin2.geojson')
          admin2Cache = await res2.json()
        }

        const features = admin2Cache.features.filter((f: any) =>
          f.properties.adm1_name?.toLowerCase() === provinceName.toLowerCase()
        )
        const geo = { type: 'FeatureCollection', features }

        clearLabelMarkers()
        if (currentLayer) map.removeLayer(currentLayer)
        ;(window as any)._labelMarkers = []

        const districtList: { name: string; slug: string }[] = []

        currentLayer = L.geoJSON(geo, {
          style: () => ({
            color: '#c9a84c',
            weight: 2,
            fillColor: '#c9a84c',
            fillOpacity: 0.12,
          }),
          onEachFeature: (feature: any, layer: any) => {
            const geoName = feature.properties.adm2_name || ''
            const mapped = DISTRICT_MAP[geoName]
            const slug = mapped?.slug || geoName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            const displayName = mapped?.displayName || geoName

            districtList.push({ name: displayName, slug })

            layer.on('mouseover', () => {
              layer.setStyle({ fillOpacity: 0.4, weight: 3 })
              layer.bindTooltip(
                `<div style="background:#1a1a1a;color:#c9a84c;border:1px solid rgba(201,168,76,0.3);padding:6px 12px;border-radius:4px;font-size:12px;font-weight:700">${displayName}</div>`,
                { sticky: true }
              ).openTooltip()
            })
            layer.on('mouseout', () => { layer.setStyle({ fillOpacity: 0.12, weight: 2 }) })
            layer.on('click', async () => {
              onSelectDistrict({ name: displayName, slug })
              map.fitBounds(layer.getBounds().pad(0.3))

              const { data } = await supabase
                .from('destinations')
                .select('*')
                .eq('district', slug)
                .eq('status', 'active')

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
                      ${dest.has_guide ? `<p style="color:#4caf50;font-size:12px;margin:0 0 10px">✓ ${strings.guideAvail}</p>` : ''}
                      <div style="display:flex;gap:8px;margin-top:12px">
                        <a href="/destinations/${dest.slug}" style="flex:1;background:rgba(255,255,255,0.08);color:white;padding:8px;border-radius:4px;font-size:12px;font-weight:600;text-decoration:none;text-align:center">${strings.details}</a>
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
            const labelMarker = L.marker(center, { icon, interactive: false }).addTo(map)
            ;(window as any)._labelMarkers.push(labelMarker)
          }
        }).addTo(map)

        map.fitBounds(currentLayer.getBounds().pad(0.15))
        ;(window as any)._currentLayer = currentLayer

        onDistrictsLoaded(districtList)
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
      <div id="main-map" style={{ height: '100%', width: '100%', minHeight: '600px' }}></div>
    </>
  )
}
