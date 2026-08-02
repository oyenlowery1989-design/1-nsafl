// ── Admin shared types ────────────────────────────────────────────────────────

export interface WalletBalance {
  nsafl_balance: number
  xlm_balance: number
  balance_week_ago: number
  last_synced_at: string
}

export interface Wallet {
  id: string
  stellar_address: string
  label: string | null
  is_primary: boolean
  created_at: string
  last_connected_at: string | null
  wallet_balances: WalletBalance[]
}

export interface User {
  telegram_id: number
  telegram_username: string | null
  telegram_first_name: string | null
  telegram_photo_url: string | null
  telegram_phone: string | null
  favorite_team: string | null
  display_preference: string
  opt_in_telegram_notifications: boolean
  is_blocked: boolean
  referred_by: number | null
  created_at: string
  updated_at: string
  wallets: Wallet[]
  bonus_balls?: number
  bonus_spins?: number
}

export interface TeamRequest {
  id: string
  telegram_id: number
  requested_team: string
  status: string
  admin_note: string | null
  created_at: string
  resolved_at: string | null
}

export interface GameSession {
  id: string
  telegram_id: number | null
  wallet_id: string | null
  kicks: number
  balls_spawned: number
  duration_seconds: number
  created_at: string
}

export interface Donation {
  id: string
  wallet_id: string
  amount: number
  asset_code: string
  donation_type: string
  donation_target: string | null
  stellar_tx_hash: string | null
  verified: boolean
  created_at: string
}

export interface Purchase {
  id: string
  wallet_id: string
  xlm_amount: number
  token_amount: number
  stellar_tx_hash: string | null
  purchase_type: string
  verified: boolean
  created_at: string
}

export interface AccessAttempt {
  id: string
  ip: string | null
  user_agent: string | null
  tg_sdk_present: boolean
  tg_sdk_fake: boolean
  devtools_opened: boolean
  screen: string | null
  timezone: string | null
  language: string | null
  url: string | null
  telegram_id: number | null
  telegram_username: string | null
  telegram_first_name: string | null
  geo_location: string | null
  created_at: string
}

export interface ReferralStat {
  referrer_id: number
  referrer_name: string | null
  referrer_username: string | null
  referral_count: number
  last_referral_at: string
}

export interface ReferredUser {
  telegram_id: number
  telegram_first_name: string | null
  telegram_username: string | null
  referred_by: number | null
  created_at: string
}

export interface TrustlineSubmission {
  id: number
  ip: string | null
  xdr: string
  horizon_result: Record<string, unknown> | null
  success: boolean | null
  tx_hash: string | null
  type: string
  created_at: string
}

export interface AdminData {
  users: User[]
  teamRequests: TeamRequest[]
  gameSessions: GameSession[]
  donations: Donation[]
  purchases: Purchase[]
  accessAttempts: AccessAttempt[]
  referralStats: ReferralStat[]
  referredUsers: ReferredUser[]
  trustlineSubmissions: TrustlineSubmission[]
  totalNsafl?: number
  totalXlm?: number
}

export type Tab = 'overview' | 'users' | 'game' | 'donations' | 'purchases' | 'access' | 'referrals' | 'trustline' | 'activity' | 'broadcast' | 'usersearch'

export type ConfirmAction = { type: 'block' | 'delete' | 'logout' | 'unblock'; telegramId: number; name?: string } | null

export interface WalletRef { stellar_address: string; user: User }
