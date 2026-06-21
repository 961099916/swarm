// File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/mini-program/components/empty-state/empty-state.js
Component({
  externalClasses: ['custom-class'],

  properties: {
    icon: {
      type: String,
      value: 'info-circle'
    },
    label: {
      type: String,
      value: '暂无数据'
    },
    desc: {
      type: String,
      value: ''
    },
    iconSize: {
      type: Number,
      value: 80
    },
    iconWrapSize: {
      type: Number,
      value: 140
    }
  }
});
