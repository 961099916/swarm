// ─── 枚举/字面量类型 ───
export type UserRole = 'FREE_USER' | 'VIP' | 'ADMIN';

// ─── 数据库行类型 ───
export interface UserRow {
  id: string;
  wx_open_id: string;
  nickname: string | null;
  avatar_url: string | null;
  role: UserRole;
  credits: number;
  token_version: number;
  is_banned: number;
  banned_reason: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermissionRow {
  id: number;
  role: UserRole;
  resource: string;
  action: string;
}

// ─── API DTO ───
export interface LoginReq {
  code: string;
}

export interface LoginRes {
  token: string;
  user: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
    role: UserRole;
    credits: number;
  };
}

export interface UpdateRoleReq {
  role: UserRole;
}

export interface AdjustCreditsReq {
  delta: number;
  reason: string;
}

export interface BanUserReq {
  reason: string;
}
