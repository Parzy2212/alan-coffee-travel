export type NotificationPrefs = {
  id?: string
  user_id?: string
  shop_id?: string | null
  email_daily_report: boolean
  email_weekly_report: boolean
  email_low_stock: boolean
  email_large_order: boolean
  email_new_member: boolean
  email_security_alerts: boolean
  email_marketing: boolean
  telegram_enabled: boolean
  telegram_chat_id: string | null
  daily_report_time: string
  weekly_report_day: string
  notification_language: string
}

export const DEFAULT_PREFS: Omit<NotificationPrefs, 'id' | 'user_id' | 'shop_id'> = {
  email_daily_report: true,
  email_weekly_report: true,
  email_low_stock: true,
  email_large_order: false,
  email_new_member: true,
  email_security_alerts: true,
  email_marketing: false,
  telegram_enabled: false,
  telegram_chat_id: null,
  daily_report_time: '22:00',
  weekly_report_day: 'monday',
  notification_language: 'th',
}

export async function loadNotificationPrefs(userId: string, shopId: string | null): Promise<NotificationPrefs> {
  const { authClient } = await import('./supabase-auth')
  let q = authClient.from('notification_preferences').select('*').eq('user_id', userId)
  if (shopId) q = q.eq('shop_id', shopId)
  else q = q.is('shop_id', null)
  const { data } = await q.maybeSingle()
  if (!data) return { ...DEFAULT_PREFS, user_id: userId, shop_id: shopId }
  return {
    ...data,
    daily_report_time: (data.daily_report_time as string).slice(0, 5), // trim seconds
  } as NotificationPrefs
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  const { authClient } = await import('./supabase-auth')
  const { id, ...rest } = prefs
  if (id) {
    await authClient.from('notification_preferences').update(rest).eq('id', id)
  } else {
    await authClient.from('notification_preferences').insert(rest)
  }
}
