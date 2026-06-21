// File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/router/guard.ts

import router from './index';

// 路由安全守卫
router.beforeEach((to, _from, next) => {
  // 动态修改文档标题
  const title = (to.meta.title as string) || 'Swarm 管理后台';
  document.title = `${title} - Swarm Cluster`;

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth !== false);
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin === true);

  const token = localStorage.getItem('admin_token');
  const rawUser = localStorage.getItem('admin_user');
  
  let user: { role?: string } | null = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      user = null;
    }
  }

  // 1. 若路由需要登录但本地无 Token，强制重定向登录页
  if (requiresAuth && !token) {
    console.warn('[Router Guard] 检测到未授权访问受保护路由，重定向至登录页。');
    next({ name: 'Login', query: { redirect: to.fullPath } });
    return;
  }

  // 2. 若路由需要管理员权限但当前角色不匹配，重定向 403 页面
  if (requiresAuth && requiresAdmin) {
    if (!user || user.role !== 'ADMIN') {
      console.warn('[Router Guard] 非管理员用户尝试越权访问管理员页面，强行拦截。');
      next({ name: 'Forbidden' });
      return;
    }
  }

  // 3. 已登录状态下避免重复访问登录页
  if (to.name === 'Login' && token && user?.role === 'ADMIN') {
    next({ name: 'Dashboard' });
    return;
  }

  // 放行路由
  next();
});
