import type { Metadata } from 'next'
import ExperiencesClient from './ExperiencesClient'

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://alancoffeetravel.com/experiences',
  },
}

export default function ExperiencesPage() {
  return <ExperiencesClient />
}
