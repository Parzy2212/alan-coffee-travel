import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import DestinationDetailClient from './DestinationDetailClient'

export const runtime = 'edge'

const BASE_URL = 'https://alancoffeetravel.com'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabase
    .from('destinations')
    .select('title_en, title_lo, excerpt_en, region, district, image_urls')
    .eq('slug', slug)
    .single()

  if (!data) return { title: 'Destination' }

  const heroImage = data.image_urls?.[0]
  const region = data.region || 'Laos'
  const title = data.title_en
  const description =
    data.excerpt_en
      ? `${data.excerpt_en} — ${region}, Laos. ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว`
      : `Discover ${title} — ${region}, Laos. Authentic local experience curated by Alan Coffee & Travel. ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว`

  return {
    title: `${title} — ${region}`,
    description,
    keywords: [
      title, region, 'Laos travel', 'ທ່ອງທ່ຽວລາວ', 'ท่องเที่ยวลาว',
      `${region} tourism`, `${region} Laos`, 'authentic Laos', 'Laos destinations',
      `สถานที่ท่องเที่ยว${region}`, `ທ່ຽວ${region}`,
      ...(data.title_lo ? [data.title_lo] : []),
    ],
    alternates: {
      canonical: `${BASE_URL}/destinations/${slug}`,
    },
    openGraph: {
      title: `${title} — ${region}, Laos | Alan Coffee & Travel`,
      description: data.excerpt_en || `Discover ${title} in ${region}, Laos.`,
      url: `${BASE_URL}/destinations/${slug}`,
      images: heroImage
        ? [{ url: heroImage, width: 1200, height: 630, alt: `${title} — ${region}, Laos` }]
        : [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Alan Coffee & Travel — Laos' }],
    },
  }
}

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: destination } = await supabase
    .from('destinations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!destination) notFound()

  const attractionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: destination.title_en,
    ...(destination.title_lo && { alternateName: destination.title_lo }),
    description: destination.excerpt_en || destination.description_en || `${destination.title_en} — ${destination.region}, Laos`,
    url: `${BASE_URL}/destinations/${slug}`,
    ...(destination.image_urls?.[0] && { image: destination.image_urls[0] }),
    touristType: ['Adventure', 'Nature', 'Cultural'],
    address: {
      '@type': 'PostalAddress',
      addressLocality: destination.district || destination.region,
      addressRegion: destination.region,
      addressCountry: 'LA',
    },
    ...(destination.location_lat && destination.location_lng && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: destination.location_lat,
        longitude: destination.location_lng,
      },
    }),
    isAccessibleForFree: true,
    inLanguage: ['en', 'lo', 'th'],
    provider: {
      '@type': 'LocalBusiness',
      name: 'Alan Coffee & Travel',
      url: BASE_URL,
    },
  }

  const { data: guideRows } = await supabase
    .from('guide_destinations')
    .select('guides(*)')
    .eq('destination_id', destination.id)
  const linkedGuides: any[] = (guideRows ?? []).map((r: any) => r.guides).filter(Boolean)

  return (
    <DestinationDetailClient
      destination={destination}
      linkedGuides={linkedGuides}
      attractionJsonLd={attractionJsonLd}
    />
  )
}
