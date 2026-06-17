"use strict";
Component({
    properties: {
        show: {
            type: Boolean,
            value: false
        },
        title: {
            type: String,
            value: ''
        },
        content: {
            type: String,
            value: ''
        },
        showCancel: {
            type: Boolean,
            value: true
        },
        confirmText: {
            type: String,
            value: '确定'
        },
        cancelText: {
            type: String,
            value: '取消'
        },
        isDanger: {
            type: Boolean,
            value: false
        },
        isLoading: {
            type: Boolean,
            value: false
        }
    },
    methods: {
        onConfirm() {
            this.triggerEvent('confirm');
        },
        onCancel() {
            this.triggerEvent('cancel');
        },
        preventTouchMove() {
            // 阻止页面滚动穿透
        }
    }
});
