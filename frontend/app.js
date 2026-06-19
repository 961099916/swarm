App({
  globalData: {
    theme: 'dark', // 默认暗色
    userCredits: 100,
    isLoggedIn: true,
    userInfo: { id: "mock_user_1", name: "用户", avatar: "" }
  },

  onLaunch: function () {
    console.log("App Launch");
    const savedTheme = wx.getStorageSync("theme");
    if (savedTheme) {
      this.globalData.theme = savedTheme;
    }
    this.applyTheme(this.globalData.theme);

    // 预加载 TDesign 图标字体（本地缓存，避免 CDN 字体加载失败）
    this.loadIconFont();

    // 全局网络状态监听
    this.monitorNetwork();
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
      fail: (err) => {
        console.warn('[Font] TDesign icon font preload failed, will fallback to CDN:', err.errMsg);
      }
    });
  },

  /**
   * 全局网络状态监听 — 断网时全局提示
   */
  monitorNetwork: function () {
    const that = this;
    wx.onNetworkStatusChange(function (res) {
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

  toggleTheme: function () {
    const nextTheme = this.globalData.theme === 'light' ? 'dark' : 'light';
    this.globalData.theme = nextTheme;
    wx.setStorageSync("theme", nextTheme);
    this.applyTheme(nextTheme);
    return nextTheme;
  },

  applyTheme: function (theme) {
    const isDark = theme === 'dark';
    // 1. 导航栏（frontColor 仅支持 #ffffff / #000000）
    wx.setNavigationBarColor({
      frontColor: isDark ? "#ffffff" : "#000000",
      backgroundColor: isDark ? "#2D2A24" : "#FFF8F0",
      animation: { duration: 200, timingFunc: "easeInOut" }
    }).catch(() => {});

    // 2. TabBar
    wx.setTabBarStyle({
      color: isDark ? "#7A726A" : "#9A928A",
      selectedColor: "#FF6B6B",
      backgroundColor: isDark ? "#2D2A24" : "#FFF8F0",
      borderStyle: isDark ? "black" : "white"
    }).catch(() => {});

    // 3. 页面背景色
    wx.setBackgroundColor({
      backgroundColor: isDark ? "#2D2A24" : "#FFF8F0",
      backgroundColorTop: isDark ? "#2D2A24" : "#FFF8F0",
      backgroundColorBottom: isDark ? "#2D2A24" : "#FFF8F0"
    }).catch(() => {});
  }
});
