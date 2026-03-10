import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.alan-coffee-travel.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hasEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let destinations: { slug: string; updated_at: string | null }[] = []

  if (hasEnv) {
    const { supabase } = await import('@/lib/supabase')
    const { data } = await supabase
      .from('destinations')
      .select('slug, updated_at')
      .eq('status', 'active')
    destinations = data ?? []
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/destinations`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/guides`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/map`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  const destinationRoutes: MetadataRoute.Sitemap = destinations.map(d => ({
    url: `${BASE_URL}/destinations/${d.slug}`,
    lastModified: d.updated_at ? new Date(d.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticRoutes, ...destinationRoutes]
}
