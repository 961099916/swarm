/**
 * @swarm/identity — 身份与访问控制限界上下文
 *
 * Bounded Context (DDD): 用户身份、认证鉴权、角色权限
 * Aggregate Roots: User (用户聚合)
 */

// Schema
export { users, rolePermissions } from './schema';

// Types
export type {
  UserRow, UserRole, RolePermissionRow,
  LoginReq, LoginRes,
  UpdateRoleReq, AdjustCreditsReq, BanUserReq,
} from './types';

// Constants
export {
  TOKEN_EXPIRY_DAYS,
  TOKEN_EXPIRY_SECONDS,
} from './constants';
