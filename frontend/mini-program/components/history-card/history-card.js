// File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/mini-program/components/history-card/history-card.js
Component({
  properties: {
    historyId: {
      type: String,
      value: ''
    },
    testTitle: {
      type: String,
      value: ''
    },
    resultCode: {
      type: String,
      value: ''
    },
    resultName: {
      type: String,
      value: ''
    },
    formattedTime: {
      type: String,
      value: ''
    }
  },

  methods: {
    onCardTap() {
      this.triggerEvent('tapcard', { historyId: this.properties.historyId });
    },
    onDeleteTap() {
      this.triggerEvent('deletecard', { historyId: this.properties.historyId });
    }
  }
});
