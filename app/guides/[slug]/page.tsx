import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import GuideProfileClient from './GuideProfileClient'

export const runtime = 'edge'

const BASE_URL = 'https://alancoffeetravel.com'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabase
    .from('guides')
    .select('name, bio, bio_en, province, profile_photo_url, photo_url, specialties, languages, languages_spoken')
    .eq('slug', slug)
    .single()

  if (!data) return { title: 'Guide' }

  const name = data.name
  const province = data.province || 'Laos'
  const bio = data.bio_en ?? data.bio
  const photo = data.profile_photo_url ?? data.photo_url
  const description = bio
    ? `${bio.slice(0, 150)}${bio.length > 150 ? '…' : ''} — ${province}, Laos`
    : `Meet ${name} — local guide from ${province}, Laos. Specializing in authentic Laos experiences with Alan Coffee & Travel.`

  return {
    title: `${name} — Local Guide, ${province}`,
    description,
    keywords: [
      name, province, 'Laos guide', 'local guide Laos',
      'ທ່ອງທ່ຽວລາວ', 'ท่องเที่ยวลาว', 'AlanGuide',
      ...(data.specialties ?? []),
      ...(data.languages_spoken ?? data.languages ?? []),
    ],
    alternates: { canonical: `${BASE_URL}/guides/${slug}` },
    openGraph: {
      title: `${name} — Local Guide | AlanGuide`,
      description,
      url: `${BASE_URL}/guides/${slug}`,
      images: photo
        ? [{ url: photo, width: 800, height: 800, alt: name }]
        : [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'AlanGuide — Laos' }],
    },
  }
}

export default async function GuideProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: guide } = await supabase
    .from('guides')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!guide) notFound()

  const [{ data: experiences }, { data: reviews }] = await Promise.all([
    supabase.from('experiences').select('*').eq('guide_id', guide.id).eq('status', 'active').order('featured', { ascending: false }),
    supabase.from('guide_reviews').select('*').eq('guide_id', guide.id).order('created_at', { ascending: false }),
  ])

  const guideJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: guide.name,
    description: guide.bio_en ?? guide.bio ?? '',
    url: `${BASE_URL}/guides/${slug}`,
    ...(guide.profile_photo_url ?? guide.photo_url
      ? { image: guide.profile_photo_url ?? guide.photo_url }
      : {}),
    jobTitle: 'Local Tour Guide',
    worksFor: { '@type': 'LocalBusiness', name: 'Alan Coffee & Travel', url: BASE_URL },
    ...(guide.province ? { address: { '@type': 'PostalAddress', addressRegion: guide.province, addressCountry: 'LA' } } : {}),
  }

  return (
    <GuideProfileClient
      guide={guide}
      experiences={experiences ?? []}
      reviews={reviews ?? []}
      guideJsonLd={guideJsonLd}
    />
  )
}
