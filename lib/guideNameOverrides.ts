// TEMPORARY: the `guides.name` column has no English/romanized variant,
// only the native-script name. This provides a romanized display fallback
// for specific guides until a real name is added in the database.
//
// TODO: delete this whole file (and its two call sites in
// components/InquiryModal.tsx and app/destinations/[slug]/DestinationDetailClient.tsx)
// once the `guides` table has a real English/romanized name column (or this
// guide's `name` is updated directly in Supabase) -- whichever comes first.
// There is no other trigger to revisit this; it will not break or show up
// anywhere on its own once it's no longer needed.
const ROMANIZED_NAME_OVERRIDES: Record<string, string> = {
  '14174570-4a7d-4f8f-8db6-42cbeb9ba80d': 'Pasi', // guides.name is "ปาชี", no English version on file yet
}

export function displayGuideName(guide: { id?: string; name?: string | null } | null | undefined): string {
  if (!guide) return ''
  return (guide.id && ROMANIZED_NAME_OVERRIDES[guide.id]) || guide.name || ''
}
