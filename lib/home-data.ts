import { getSupabase } from '@/lib/supabase'

export type Destination = {
  id: string
  slug: string
  title_en: string
  excerpt_en: string | null
  region: string | null
  image_urls: string[] | null
  assessment_status: string | null
  rating_experience: number | null
  rating_accessibility: number | null
  rating_authenticity: number | null
  rating_tranquility: number | null
  rating_traveler_value: number | null
  featured: boolean | null
}

export type Guide = {
  id: string
  slug: string | null
  name: string
  photo_url: string | null
  profile_photo_url: string | null
  province: string | null
  languages: string[] | null
  languages_spoken: string[] | null
  specialties: string[] | null
  is_verified: boolean | null
  verified: boolean | null
  experience_years: number | null
  years_experience: number | null
  rating_avg: number | null
  review_count: number | null
}

export type FeaturedExp = {
  id: string
  slug: string | null
  title_en: string | null
  cover_image_url: string | null
  category: string | null
  duration_hours: number | null
  duration_days: number | null
  price_per_person_lak: number | null
  region: string | null
  guides: { name: string } | null
}

export type HomeData = {
  destinations: Destination[] | null
  guides: Guide[] | null
  featuredExps: FeaturedExp[] | null
  heroImageUrl: string | null
  fetchedAt: number
}

// null in a list field means that query failed (UI shows its error state).
// Never throws.
export async function fetchHomeData(signal?: AbortSignal): Promise<HomeData> {
  const supabase = getSupabase()
  const s = signal ?? new AbortController().signal
  try {
    const [destRes, guideRes, expRes, heroRes] = await Promise.all([
      supabase
        .from('destinations')
        .select('id,slug,title_en,excerpt_en,region,image_urls,assessment_status,rating_experience,rating_accessibility,rating_authenticity,rating_tranquility,rating_traveler_value,featured')
        .eq('status', 'active')
        .order('featured', { ascending: false })
        .limit(6)
        .abortSignal(s),
      supabase
        .from('guides')
        .select('id,slug,name,photo_url,profile_photo_url,province,languages,languages_spoken,specialties,is_verified,verified,experience_years,years_experience,rating_avg,review_count')
        .or('status.eq.active,active.eq.true')
        .or('is_verified.eq.true,verified.eq.true')
        .order('featured', { ascending: false })
        .limit(3)
        .abortSignal(s),
      supabase
        .from('experiences')
        .select('id,slug,title_en,cover_image_url,category,duration_hours,duration_days,price_per_person_lak,region,guides(name)')
        .eq('status', 'active')
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(3)
        .abortSignal(s),
      supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'hero_image_url')
        .abortSignal(s)
        .maybeSingle(),
    ])
    if (destRes.error) console.error('fetchHomeData: destinations', destRes.error)
    if (guideRes.error) console.error('fetchHomeData: guides', guideRes.error)
    if (expRes.error) console.error('fetchHomeData: experiences', expRes.error)
    if (heroRes.error) console.error('fetchHomeData: hero image setting', heroRes.error)
    return {
      destinations: destRes.error ? null : (destRes.data ?? []),
      guides: guideRes.error ? null : ((guideRes.data ?? []) as Guide[]),
      featuredExps: expRes.error ? null : ((expRes.data ?? []) as unknown as FeaturedExp[]),
      heroImageUrl: heroRes.data?.value ?? null,
      fetchedAt: Date.now(),
    }
  } catch (err) {
    console.error('fetchHomeData: failed', err)
    return { destinations: null, guides: null, featuredExps: null, heroImageUrl: null, fetchedAt: Date.now() }
  }
}
