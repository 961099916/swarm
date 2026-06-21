/**
 * Swarm 微信小程序全局入口
 *
 * 职责：
 *  - 全局主题管理（暗色/亮色）
 *  - 网络状态监听
 *  - 全局字体预加载
 *
 * @typedef {object} GlobalData
 * @property {'dark'|'light'} theme - 当前主题
 * @property {number} userCredits - 用户积分
 * @property {boolean} isLoggedIn - 登录状态
 * @property {{ id: string; name: string; avatar: string }|null} userInfo - 用户信息
 *
 * @typedef {object} AppInstance
 * @property {GlobalData} globalData
 * @property {() => void} onLaunch
 * @property {() => void} loadIconFont
 * @property {() => void} monitorNetwork
 * @property {() => 'dark'|'light'} toggleTheme
 * @property {(theme: 'dark'|'light') => void} applyTheme
 */

App({
  /** @type {GlobalData} */
  globalData: {
    theme: 'dark', // 默认暗色
    userCredits: 0,
    isLoggedIn: false,
    userInfo: null
  },

  onLaunch: function () {
    console.log("App Launch");
    const savedTheme = /** @type {string|null} */ (wx.getStorageSync("theme"));
    if (savedTheme) {
      this.globalData.theme = savedTheme;
    }
    this.applyTheme(this.globalData.theme);

    // 预加载 TDesign 图标字体（本地缓存，避免 CDN 字体加载失败）
    this.loadIconFont();

    // 全局网络状态监听
    this.monitorNetwork();

    // 从缓存恢复登录态：如果有 token，尝试获取用户信息
    this.restoreLogin();
  },

  /**
   * 从缓存恢复登录态
   * 检查 wx.getStorageSync('authToken')，存在则尝试获取用户信息填充 globalData
   */
  restoreLogin: function () {
    const token = wx.getStorageSync('authToken');
    if (!token) {
      console.log('[App] No saved token, user needs to login');
      return;
    }

    const { request } = require('./utils/request');
    request({ url: '/api/v1/user/profile' })
      .then((res) => {
        if (res.code === 0 && res.data) {
          this.globalData.isLoggedIn = true;
          this.globalData.userInfo = res.data.user || res.data;
          this.globalData.userCredits = res.data.credits || 0;
          console.log('[App] Login state restored from token');
        }
      })
      .catch(() => {
        // Token 过期或无效，静默清除
        console.log('[App] Saved token invalid, clearing');
        wx.removeStorageSync('authToken');
      });
  },

  /**
   * 预加载 TDesign 图标字体 — 通过 wx.loadFontFace API
   * 将 CDN 字体缓存到本地，避免 @font-face 网络加载异常
   */
  loadIconFont: function () {
    wx.loadFontFace({
      family: 't',
      source: 'url("https://tdesign.gtimg.com/icon/0.4.2/fonts/t.woff")',
      global: true,
      scopes: ['webview', 'native'],
      success: () => {
        console.log('[Font] TDesign icon font loaded successfully');
      },
      fail: (/** @type {{ errMsg: string }} */ err) => {
        console.warn('[Font] TDesign icon font preload failed, will fallback to CDN:', err.errMsg);
      }
    });
  },

  /**
   * 全局网络状态监听 — 断网时全局提示
   */
  monitorNetwork: function () {
    wx.onNetworkStatusChange(function (/** @type {{ isConnected: boolean }} */ res) {
      if (!res.isConnected) {
        wx.showToast({
          title: '网络已断开，请检查连接',
          icon: 'none',
          duration: 3000,
        });
      } else {
        wx.showToast({
          title: '网络已恢复',
          icon: 'success',
          duration: 1500,
        });
      }
    });
  },

  /**
   * 切换亮色/暗色主题
   * @returns {'dark'|'light'} 切换后的主题
   */
  toggleTheme: function () {
    const nextTheme = this.globalData.theme === 'light' ? 'dark' : 'light';
    this.globalData.theme = nextTheme;
    wx.setStorageSync("theme", nextTheme);
    this.applyTheme(nextTheme);
    return nextTheme;
  },

  /**
   * 应用主题到导航栏、TabBar、页面背景
   * @param {'dark'|'light'} theme - 目标主题
   */
  applyTheme: function (theme) {
    const isDark = theme === 'dark';
    wx.setNavigationBarColor({
      frontColor: isDark ? "#ffffff" : "#000000",
      backgroundColor: isDark ? "#2D2A24" : "#FFF8F0",
      animation: { duration: 200, timingFunc: "easeInOut" }
    }).catch(() => {});

    wx.setTabBarStyle({
      color: isDark ? "#7A726A" : "#9A928A",
      selectedColor: "#FF6B6B",
      backgroundColor: isDark ? "#2D2A24" : "#FFF8F0",
      borderStyle: isDark ? "black" : "white"
    }).catch(() => {});

    wx.setBackgroundColor({
      backgroundColor: isDark ? "#2D2A24" : "#FFF8F0",
      backgroundColorTop: isDark ? "#2D2A24" : "#FFF8F0",
      backgroundColorBottom: isDark ? "#2D2A24" : "#FFF8F0"
    }).catch(() => {});
  },

  /**
   * 全局运行时未捕获异常监听
   */
  onError: function (msg) {
    console.error('[App Global Error]', msg);
    wx.showModal({
      title: '意外崩溃提醒',
      content: '很抱歉，应用在运行中发生了未知错误。如果该错误持续发生，您可以复制诊断日志提供给技术客服。',
      confirmText: '复制日志',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: msg || 'No message available',
            success: () => {
              wx.showToast({ title: '已复制日志', icon: 'success' });
            }
          });
        }
      }
    });
  }
});
