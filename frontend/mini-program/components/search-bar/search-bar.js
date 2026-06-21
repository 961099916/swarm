// File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/mini-program/components/search-bar/search-bar.js
Component({
  externalClasses: ['custom-class'],
  
  properties: {
    value: {
      type: String,
      value: ''
    },
    placeholder: {
      type: String,
      value: '搜索...'
    }
  },

  methods: {
    onInput(e) {
      const val = e.detail.value;
      this.setData({ value: val });
      this.triggerEvent('change', { value: val });
    },

    onConfirm(e) {
      const val = e.detail.value;
      this.triggerEvent('confirm', { value: val });
    },

    onClear() {
      this.setData({ value: '' });
      this.triggerEvent('change', { value: '' });
      this.triggerEvent('clear');
    }
  }
});
