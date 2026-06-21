/**
 * 自定义底部 Tabbar 组件
 * 用法：在页面 WXML 底部引入 <custom-tabbar current="{{currentTab}}" />
 * currentTab 取值: 'task' | 'knowledge' | 'chat' | 'quiz' | 'profile'
 */
Component({
  properties: {
    current: {
      type: String,
      value: 'task',
    },
  },

  data: {
    tabs: [
      { key: 'task',     text: '任务',   icon: 'assignment',     path: '/pages/task/list/index' },
      { key: 'deploy',   text: '部署',   icon: 'play-circle',    path: '/pages/deploy/index' },
      { key: 'knowledge',text: '知识库', icon: 'bookmark',       path: '/packageKnowledge/list/index' },
      { key: 'quiz',     text: '测评',   icon: 'compass',        path: '/pages/map/index/index' },
      { key: 'profile',  text: '我的',   icon: 'user-avatar',    path: '/pages/profile/index' },
    ],
  },

  methods: {
    onTabTap(e) {
      const { key, path } = e.currentTarget.dataset;
      const { current } = this.data;

      if (key === current) return;

      // 自定义 tabbar 用 redirectTo 切换（比 reLaunch 快，无白屏）
      wx.redirectTo({ url: path });
    },
  },
});
