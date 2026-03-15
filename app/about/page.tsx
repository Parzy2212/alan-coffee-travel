import type { Metadata } from 'next'
import AboutClient from './AboutClient'

export const metadata: Metadata = {
  title: 'About — ກ່ຽວກັບເຮົາ | ท่องเที่ยวลาว',
  description:
    'Alan Coffee & Travel was born in Attapeu — the only café in the province built for international travelers. A calm space for coffee, reflection, and cultural discovery. ອັດຕະປື ລາວ | อัตตะปือ ลาว | Attapeu Laos',
  keywords: [
    'about Alan Coffee Travel', 'Attapeu café story', 'Laos travel café',
    'ກ່ຽວກັບ Alan Coffee', 'ອັດຕະປື', 'อัตตะปือ', 'ท่องเที่ยวลาว', 'ທ່ອງທ່ຽວລາວ',
  ],
  alternates: {
    canonical: 'https://www.alan-coffee-travel.com/about',
  },
  openGraph: {
    title: 'About Alan Coffee & Travel — Attapeu, Laos',
    description:
      'A calm meeting place for travelers in Attapeu. Built from quiet resilience. Shaped by stillness. ອັດຕະປື ລາວ | อัตตะปือ',
    url: 'https://www.alan-coffee-travel.com/about',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Alan Coffee & Travel — Attapeu, Laos' }],
  },
}

export default function AboutPage() {
  return <AboutClient />
}
