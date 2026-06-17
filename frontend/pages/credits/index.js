const { request, generateUUID } = require("../../utils/request.js");

Page({
  data: {
    theme: '',
    userCredits: 100,
    ledgers: [],
    groupedLedgers: [],
    loading: false,
    currentType: 'ALL',
    showMockAd: false,
    adCountdown: 5,
    adProgressWidth: '0%',
    adLoading: false,
    typeOptions: [
      { label: "全部账单", value: "ALL" },
      { label: "算力补给", value: "INCOME" },
      { label: "资源消耗", value: "OUTCOME" }
    ]
  },

  onShow: function () {
    const app = getApp();
    const currentTheme = app.globalData.theme;
    app.applyTheme(currentTheme);

    this.setData({
      theme: currentTheme === 'light' ? 'theme-light' : '',
      userCredits: app.globalData.userCredits
    });

    this.loadData();
  },

  onPullDownRefresh: function () {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadData: async function () {
    this.setData({ loading: true });
    try {
      // 1. 同步个人积分余额
      const profileRes = await request({ url: "/api/v1/user/profile" });
      if (profileRes.success && profileRes.data) {
        const app = getApp();
        app.globalData.userCredits = profileRes.data.credits;
        this.setData({
          userCredits: profileRes.data.credits
        });
      }

      // 2. 加载流水明细
      const historyRes = await request({
        url: `/api/v1/credits/history?type=${this.data.currentType}&limit=100`
      });

      if (historyRes.success && historyRes.data) {
        // 进行数据结构清洗（时间清洗和标签清洗）
        const processedLedgers = historyRes.data.map(item => ({
          ...item,
          reasonLabel: this.getReasonLabel(item.reason),
          timeOnly: this.formatTimeOnly(item.created_at)
        }));

        this.setData({
          ledgers: processedLedgers,
          groupedLedgers: this.groupLedgers(processedLedgers)
        });
      }
    } catch (err) {
      console.error("加载算力流水失败:", err);
    } finally {
      this.setData({ loading: false });
    }
  },

  switchType: function (e) {
    const val = e.currentTarget.dataset.value;
    this.setData({ currentType: val });
    this.loadData();
  },

  playVideoAd: function () {
    if (this.data.adLoading || this.data.showMockAd) return;
    this.setData({
      adLoading: true,
      showMockAd: true,
      adCountdown: 5,
      adProgressWidth: "0%"
    });

    const interval = setInterval(() => {
      const countdown = this.data.adCountdown - 1;
      const progress = `${((5 - countdown) / 5) * 100}%`;
      
      this.setData({
        adCountdown: countdown,
        adProgressWidth: progress
      });

      if (countdown <= 0) {
        clearInterval(interval);
        this.setData({ showMockAd: false });
        this.claimAdCredits();
      }
    }, 1000);
  },

  onAdVisibleChange: function (e) {
    this.setData({ showMockAd: e.detail.visible });
  },

  claimAdCredits: async function () {
    try {
      const mockToken = `mock_ad_token_${generateUUID()}_${Date.now()}`;
      const res = await request({
        url: "/api/v1/credits/reward",
        method: "POST",
        data: { adToken: mockToken }
      });

      if (res.success && res.data) {
        wx.showToast({
          title: "补给成功 +20 积分",
          icon: "success",
          duration: 2000
        });
        
        const app = getApp();
        app.globalData.userCredits = res.data.newBalance;

        this.setData({
          userCredits: res.data.newBalance
        });
        
        await this.loadData();
      } else {
        wx.showToast({
          title: res.error || "获取补给失败",
          icon: "none"
        });
      }
    } catch (err) {
      console.error("发分失败:", err);
    } finally {
      this.setData({ adLoading: false });
    }
  },

  getReasonLabel: function (reason) {
    switch (reason) {
      case "TASK_COST":
        return "编排分布式智能体";
      case "AD_REWARD":
        return "看板激励算力补给";
      case "INVITE_BONUS":
        return "邀请好友推广奖励";
      case "ADMIN_ADJUST":
        return "系统管理员后台调配";
      default:
        return reason;
    }
  },

  groupLedgers: function (list) {
    const groups = {};
    list.forEach(item => {
      const dateStr = this.formatGroupDate(item.created_at);
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(item);
    });

    return Object.keys(groups).map(date => ({
      date,
      items: groups[date]
    }));
  },

  formatGroupDate: function (isoStr) {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    } catch (e) {
      return isoStr;
    }
  },

  formatTimeOnly: function (isoStr) {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      const hour = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      const sec = String(d.getSeconds()).padStart(2, "0");
      return `${hour}:${min}:${sec}`;
    } catch (e) {
      return isoStr;
    }
  },

  onShareAppMessage: function () {
    const app = getApp();
    const myUserId = app.globalData.userInfo?.id || "";
    return {
      title: "Swarm 智能体任务管理系统",
      path: `/pages/login/login?inviterId=${myUserId}`
    };
  }
});
