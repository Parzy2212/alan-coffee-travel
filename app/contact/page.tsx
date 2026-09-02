import type { Metadata } from 'next'
import ContactClient from './ContactClient'

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://alancoffeetravel.com/contact',
  },
}

export default function ContactPage() {
  return <ContactClient />
}
