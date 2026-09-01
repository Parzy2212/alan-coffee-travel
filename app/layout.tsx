import type { Metadata } from 'next'
import { Playfair_Display, Inter, Noto_Sans_Lao, Sarabun } from 'next/font/google'
import Script from 'next/script'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { ShopProvider } from '@/contexts/ShopContext'
import { PWAProvider } from '@/components/PWAProvider'
import { InstallPrompt } from '@/components/InstallPrompt'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['400', '700', '800'],
})

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  variable: '--font-thai',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const notoSansLao = Noto_Sans_Lao({
  subsets: ['lao'],
  variable: '--font-lao',
  display: 'swap',
  weight: ['400', '700'],
})

const BASE_URL = 'https://alancoffeetravel.com'

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Synchronously set data-lang before first paint to avoid font FOUC */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var l = localStorage.getItem('alan_lang');
            document.documentElement.setAttribute('data-lang', (l === 'lo' || l === 'th') ? l : 'en');
          } catch(e) {
            document.documentElement.setAttribute('data-lang', 'en');
          }
        `}} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#c9a84c" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Alan Cafe OS" />
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${playfair.variable} ${inter.variable} ${notoSansLao.variable} ${sarabun.variable}`}>
        <PWAProvider>
          <AuthProvider>
            <ShopProvider>
              <LanguageProvider>
                {children}
              </LanguageProvider>
            </ShopProvider>
          </AuthProvider>
          <InstallPrompt />
          <OfflineIndicator />
        </PWAProvider>
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
