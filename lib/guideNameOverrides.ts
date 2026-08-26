// TEMPORARY: the `guides.name` column has no English/romanized variant,
// only the native-script name. This provides a romanized display fallback
// for specific guides until a real name is added in the database.
// Remove an entry here once that guide's `name` is updated directly in Supabase.
const ROMANIZED_NAME_OVERRIDES: Record<string, string> = {
  '14174570-4a7d-4f8f-8db6-42cbeb9ba80d': 'Pasi', // guides.name is "ปาชี", no English version on file yet
}

export function displayGuideName(guide: { id?: string; name?: string | null } | null | undefined): string {
  if (!guide) return ''
  return (guide.id && ROMANIZED_NAME_OVERRIDES[guide.id]) || guide.name || ''
}
