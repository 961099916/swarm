export type CreditReason = 'TASK_COST' | 'AD_REWARD' | 'INVITE_BONUS' | 'ADMIN_ADJUST';

export interface CreditsLedgerRow {
  id: number;
  user_id: string;
  delta: number;
  balance: number;
  reason: CreditReason;
  ref_id: string | null;
  created_at: string;
}

export interface AdRewardLogRow {
  id: number;
  user_id: string;
  ad_token_hash: string;
  credits_added: number;
  created_at: string;
}

export interface UserInvitationRow {
  id: number;
  inviter_id: string;
  invitee_id: string;
  bonus_given: number;
  created_at: string;
}

export interface BindInviteReq {
  inviterId: string;
}

export interface AdRewardReq {
  adToken: string;
}
