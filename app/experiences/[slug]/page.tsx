import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ExperienceDetailClient from './ExperienceDetailClient'

export const runtime = 'edge'

const BASE_URL = 'https://alancoffeetravel.com'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabase
    .from('experiences')
    .select('title_en, summary_en, cover_image_url, region, category, price_per_person_lak')
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .single()

  if (!data) return { title: 'Experience' }

  const title = data.title_en ?? 'Experience in Laos'
  const description = data.summary_en ?? `Authentic travel experience in ${data.region ?? 'Laos'} — curated by AlanGuide.`

  return {
    title: `${title} — ${data.region ?? 'Laos'} | AlanGuide`,
    description,
    keywords: [title, data.region ?? 'Laos', data.category ?? '', 'Laos tour', 'ທ່ອງທ່ຽວລາວ', 'ท่องเที่ยวลาว', 'AlanGuide'],
    alternates: { canonical: `${BASE_URL}/experiences/${slug}` },
    openGraph: {
      title: `${title} | AlanGuide`,
      description,
      url: `${BASE_URL}/experiences/${slug}`,
      images: data.cover_image_url
        ? [{ url: data.cover_image_url, width: 1200, height: 630, alt: title }]
        : [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'AlanGuide — Laos' }],
    },
  }
}

export default async function ExperienceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: experience } = await supabase
    .from('experiences')
    .select('*, guides(*)')
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .single()

  if (!experience) notFound()

  const [{ data: reviews }, { data: similar }] = await Promise.all([
    supabase.from('guide_reviews').select('*').eq('experience_id', experience.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('experiences').select('id, slug, title_en, cover_image_url, category, price_per_person_lak, duration_hours, duration_days, region')
      .eq('status', 'active').neq('id', experience.id).eq('category', experience.category ?? '').limit(3),
  ])

  const expJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: experience.title_en,
    description: experience.summary_en ?? '',
    url: `${BASE_URL}/experiences/${slug}`,
    ...(experience.cover_image_url ? { image: experience.cover_image_url } : {}),
    ...(experience.price_per_person_lak ? {
      offers: {
        '@type': 'Offer',
        price: experience.price_per_person_lak,
        priceCurrency: 'LAK',
        availability: 'https://schema.org/InStock',
      }
    } : {}),
    provider: {
      '@type': 'LocalBusiness',
      name: 'Alan Coffee & Travel',
      url: BASE_URL,
    },
  }

  return (
    <ExperienceDetailClient
      experience={experience}
      guide={experience.guides ?? null}
      reviews={reviews ?? []}
      similar={similar ?? []}
      expJsonLd={expJsonLd}
    />
  )
}
