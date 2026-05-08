export type AccountEventType =
  | 'login'
  | 'logout'
  | 'password_changed'
  | 'password_reset'
  | 'profile_updated'
  | 'sessions_revoked'
  | 'account_deleted'
  | 'shop_settings_updated'
  | 'team_invitation_sent'
  | 'team_invitation_accepted'

export async function logAccountEvent(
  eventType: AccountEventType,
  description?: string
): Promise<void> {
  try {
    const { authClient } = await import('@/lib/supabase-auth')
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return
    await authClient.from('account_events').insert({
      user_id: user.id,
      event_type: eventType,
      description: description ?? null,
    })
  } catch { /* non-fatal */ }
}
