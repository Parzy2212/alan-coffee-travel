import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const BASE_URL = 'https://www.alan-coffee-travel.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Alan Coffee & Travel — ທ່ອງທ່ຽວລາວ | Attapeu, Laos',
    template: '%s | Alan Coffee & Travel',
  },
  description:
    'Alan Coffee & Travel — the only café in Attapeu built for international travelers. Discover authentic Laos: local guides, curated destinations, and cultural travel across all 18 provinces. ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว | Laos travel',
  keywords: [
    // English
    'Laos travel', 'Attapeu', 'Laos tourism', 'southern Laos', 'authentic Laos experiences',
    'Laos local guide', 'Attapeu café', 'coffee Laos', 'Alan Coffee Travel',
    'things to do in Laos', 'Laos destinations', 'Laos travel guide', 'Laos off the beaten path',
    // Thai
    'ท่องเที่ยวลาว', 'อัตตะปือ', 'กาแฟลาว', 'ลาวใต้', 'ไกด์ท้องถิ่นลาว',
    'เที่ยวลาว', 'ท่องเที่ยวอัตตะปือ', 'สถานที่ท่องเที่ยวลาว', 'ร้านกาแฟลาว',
    // Lao
    'ທ່ອງທ່ຽວລາວ', 'ອັດຕະປື', 'ກາເຟລາວ', 'ລາວໃຕ້', 'ທ່ຽວລາວ',
    'ສະຖານທີ່ທ່ອງທ່ຽວລາວ', 'ມັກກ້ຽວລາວ',
  ],
  authors: [{ name: 'Alan Coffee & Travel', url: BASE_URL }],
  creator: 'Alan Coffee & Travel',
  publisher: 'Alan Coffee & Travel',
  alternates: {
    canonical: BASE_URL,
    languages: {
      'en': BASE_URL,
      'th': BASE_URL,
      'lo': BASE_URL,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['th_TH', 'lo_LA'],
    url: BASE_URL,
    siteName: 'Alan Coffee & Travel',
    title: 'Alan Coffee & Travel — Attapeu, Laos | ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว',
    description:
      'Discover authentic Laos from Attapeu. Coffee, trusted local guides, and curated travel experiences across all 18 provinces. ທ່ອງທ່ຽວລາວ · ท่องเที่ยวลาว',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Alan Coffee & Travel — Attapeu, Laos',
    description:
      'Discover authentic Laos. Coffee, local guides, and curated travel experiences from Attapeu.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'xTwdmmRaJpsQ0_ZjkZl3AUtaHMcNch1Ke_fkqydIfqc',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['LocalBusiness', 'CafeOrCoffeeShop', 'TouristInformationCenter'],
      '@id': `${BASE_URL}/#business`,
      name: 'Alan Coffee & Travel',
      alternateName: [
        'ອາລັນ ກາເຟ ແລະ ການທ່ອງທ່ຽວ',
        'อาลัน คอฟฟี่ แอนด์ ทราเวล',
        'Alan Coffee Travel Attapeu',
      ],
      description:
        'The only café in Attapeu built for international travelers. Coffee, cultural discovery, and curated local travel guidance in one space. ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว',
      url: BASE_URL,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Attapeu',
        addressRegion: 'Attapeu Province',
        addressCountry: 'LA',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 14.8017,
        longitude: 106.8404,
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '08:00',
          closes: '18:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Saturday', 'Sunday'],
          opens: '09:00',
          closes: '17:00',
        },
      ],
      priceRange: '$$',
      currenciesAccepted: 'LAK, THB, USD',
      areaServed: { '@type': 'Country', name: 'Laos' },
      knowsAbout: ['Laos travel', 'ທ່ອງທ່ຽວລາວ', 'ท่องเที่ยวลาว', 'Attapeu tourism', 'Laos local guides'],
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: BASE_URL,
      name: 'Alan Coffee & Travel',
      description: 'Discover authentic Laos travel experiences from Attapeu.',
      inLanguage: ['en', 'lo', 'th'],
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE_URL}/destinations?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${plusJakarta.variable} ${inter.variable}`}>
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CM6TTHL7CZ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CM6TTHL7CZ');
          `}
        </Script>
      </body>
    </html>
  )
}
