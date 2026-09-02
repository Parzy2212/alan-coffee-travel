import type { Metadata } from 'next'
import MapClient from './MapClient'

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://alancoffeetravel.com/map',
  },
}

export default function MapPage() {
  return <MapClient />
}
