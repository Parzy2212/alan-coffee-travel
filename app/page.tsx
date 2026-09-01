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
    canonical: 'https://alancoffeetravel.com',
  },
  openGraph: {
    title: 'Alan Coffee & Travel — Discover Laos | ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว',
    description:
      'The only café in Attapeu built for international travelers. Coffee, local guides, and curated Laos destinations. ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว',
    url: 'https://alancoffeetravel.com',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Alan Coffee & Travel — Attapeu, Laos' }],
  },
}

export default function Home() {
  return <HomeClient />
}
