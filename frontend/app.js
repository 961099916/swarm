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
    // 1. 导航栏
    wx.setNavigationBarColor({
      frontColor: isDark ? "#ffffff" : "#000000",
      backgroundColor: isDark ? "#0D0D10" : "#F2F2F7",
      animation: { duration: 200, timingFunc: "easeInOut" }
    }).catch(() => {});

    // 2. TabBar
    wx.setTabBarStyle({
      color: isDark ? "#636366" : "#8E8E93",
      selectedColor: "#1E6FFF",
      backgroundColor: isDark ? "#0D0D10" : "#FFFFFF",
      borderStyle: isDark ? "black" : "white"
    }).catch(() => {});

    // 3. 页面背景色
    wx.setBackgroundColor({
      backgroundColor: isDark ? "#0D0D10" : "#F2F2F7",
      backgroundColorTop: isDark ? "#0D0D10" : "#F2F2F7",
      backgroundColorBottom: isDark ? "#0D0D10" : "#F2F2F7"
    }).catch(() => {});
  }
});
