export type InvitationRole = 'manager' | 'cashier' | 'viewer'

export type InvitationDetails = {
  found: boolean
  email?: string
  role?: InvitationRole
  status?: string
  expires_at?: string
  shop_name?: string
  inviter_name?: string
  message?: string
}

export async function getInvitationDetails(token: string): Promise<InvitationDetails> {
  const { authClient } = await import('./supabase-auth')
  const { data } = await authClient.rpc('get_invitation_details', { p_token: token })
  return (data as InvitationDetails) ?? { found: false }
}

export async function acceptInvitation(
  token: string,
  userId: string,
): Promise<{ success: boolean; error?: string; shop_id?: string }> {
  const { authClient } = await import('./supabase-auth')
  const { data } = await authClient.rpc('accept_shop_invitation', {
    p_token: token,
    p_user_id: userId,
  })
  return (data as { success: boolean; error?: string; shop_id?: string }) ?? { success: false }
}

export function buildInviteLink(token: string): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://alan-coffee-travel.vercel.app'
  return `${origin}/accept-invite?token=${encodeURIComponent(token)}`
}

export function roleLabel(role: string): string {
  return { owner: 'เจ้าของ', manager: 'ผู้จัดการ', cashier: 'แคชเชียร์', viewer: 'ผู้ดู' }[role] ?? role
}

export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date()
}
