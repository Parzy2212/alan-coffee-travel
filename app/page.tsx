import { supabase } from '@/lib/supabase'
import type { Metadata } from 'next'
import HomeClient from '@/components/HomeClient'

export const metadata: Metadata = {
  title: 'Alan Coffee & Travel — Discover Laos | ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว',
  description:
    'Alan Coffee & Travel in Attapeu — the only café in Laos built for international travelers. Authentic destinations, trusted local guides, and curated travel experiences. ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว | Laos travel | อัตตะปือ',
  keywords: [
    'Alan Coffee Travel', 'Laos travel', 'Attapeu', 'ທ່ອງທ່ຽວລາວ', 'ท่องเที่ยวลาว',
    'Laos destinations', 'authentic Laos', 'southern Laos travel', 'Attapeu tourism',
    'อัตตะปือ', 'ອັດຕະປື', 'Laos local guide', 'travel café Laos', 'ຄາເຟລາວ',
  ],
  alternates: {
    canonical: 'https://www.alan-coffee-travel.com',
  },
  openGraph: {
    title: 'Alan Coffee & Travel — Discover Laos | ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว',
    description:
      'The only café in Attapeu built for international travelers. Coffee, local guides, and curated Laos destinations. ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว',
    url: 'https://www.alan-coffee-travel.com',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Alan Coffee & Travel — Attapeu, Laos' }],
  },
}

export default async function Home() {
  const [{ data: destinations }, { data: guides }] = await Promise.all([
    supabase
      .from('destinations')
      .select('id,slug,title_en,excerpt_en,region,image_urls,assessment_status,rating_experience,rating_accessibility,rating_authenticity,rating_tranquility,rating_traveler_value,featured')
      .eq('status', 'active')
      .order('featured', { ascending: false })
      .limit(6),
    supabase
      .from('guides')
      .select('id,name,photo_url,province,languages,specialties,is_verified,experience_years')
      .eq('status', 'active')
      .eq('is_verified', true)
      .limit(3),
  ])

  return <HomeClient destinations={destinations ?? []} guides={guides ?? []} />
}
