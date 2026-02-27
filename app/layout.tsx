import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
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

export const metadata: Metadata = {
  metadataBase: new URL('https://alan-coffee-travel.vercel.app'),
  title: {
    default: 'Alan Coffee & Travel — Attapeu, Laos',
    template: '%s | Alan Coffee & Travel',
  },
  description: 'A calm meeting place for travelers in Attapeu, Laos. Coffee, cultural discovery, and travel guidance — in one space.',
  keywords: ['Attapeu café', 'coffee in Attapeu', 'Laos coffee', 'travel café Laos', 'café for travelers', 'Attapeu Laos', 'Alan Coffee'],
  authors: [{ name: 'Alan Coffee & Travel' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://alan-coffee-travel.vercel.app',
    siteName: 'Alan Coffee & Travel',
    title: 'Alan Coffee & Travel — Attapeu, Laos',
    description: 'A calm meeting place for travelers in Attapeu, Laos. Coffee, cultural discovery, and travel guidance — in one space.',
    images: [
      {
        url: '/logo-dark.webp',
        width: 1200,
        height: 630,
        alt: 'Alan Coffee & Travel — Attapeu, Laos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Alan Coffee & Travel — Attapeu, Laos',
    description: 'A calm meeting place for travelers in Attapeu, Laos.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${inter.variable}`}>
        {children}
      </body>
    </html>
  )
}