"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../utils/logger");
const request_1 = require("../../utils/request");
const localHistory_1 = require("../../utils/localHistory");
// 用于管理页面私有变量，实现完美的内存管理和物理隔离
const privateStore = new WeakMap();
function getPrivate(instance) {
    let store = privateStore.get(instance);
    if (!store) {
        store = { confirmCallback: null, cancelCallback: null };
        privateStore.set(instance, store);
    }
    return store;
}
Page({
    data: {
        isOffline: false,
        historyList: [],
        page: 1,
        pageSize: 10,
        hasMore: true,
        refreshing: false,
        loading: false,
        userProfile: {
            nickname: '性格评估探索家',
            avatarUrl: '/static/default_avatar.png'
        },
        stats: {
            completedCount: 0,
            badgeCount: 0
        },
        // 自定义赛博弹窗状态
        showCyberModal: false,
        modalTitle: '',
        modalContent: '',
        modalShowCancel: true,
        modalConfirmText: '确定',
        modalCancelText: '取消',
        modalIsDanger: false,
        modalIsLoading: false,
        // 昵称编辑状态
        isEditingNickname: false,
        nicknameFocus: false
    },
    onShow() {
        logger_1.Logger.info('[Mine] 展示测评历史页面');
        const app = getApp();
        if (app && app.globalData) {
            this.setData({
                theme: app.globalData.theme === 'light' ? 'theme-light' : ''
            });
            app.applyTheme(app.globalData.theme);
        }
        this.loadUserProfile();
        this.loadHistoryList();
    },
    /**
     * 加载本地缓存的用户头像和昵称
     */
    loadUserProfile() {
        try {
            const cachedProfile = wx.getStorageSync('local_user_profile');
            if (cachedProfile) {
                this.setData({
                    userProfile: {
                        nickname: cachedProfile.nickname || '性格评估探索家',
                        avatarUrl: cachedProfile.avatarUrl || '/static/default_avatar.png'
                    }
                });
                logger_1.Logger.info('[Profile] 成功加载本地缓存的用户信息');
            }
        }
        catch (e) {
            logger_1.Logger.error('[Profile] 读取本地用户信息缓存失败:', e);
        }
    },
    /**
     * 选择头像事件处理
     */
    onChooseAvatar(e) {
        const { avatarUrl } = e.detail;
        logger_1.Logger.info(`[Profile] 用户授权选择头像: ${avatarUrl}`);
        if (!avatarUrl)
            return;
        const userProfile = Object.assign(Object.assign({}, this.data.userProfile), { avatarUrl });
        this.setData({ userProfile });
        try {
            wx.setStorageSync('local_user_profile', userProfile);
            logger_1.Logger.info('[Profile] 头像缓存写入成功');
        }
        catch (err) {
            logger_1.Logger.error('[Profile] 头像缓存写入失败:', err);
        }
    },
    /**
     * 点击昵称触发编辑 (DOM 渲染回调 + 延时双步聚焦)
     */
    onNicknameTap() {
        logger_1.Logger.info('[Profile] 用户点击昵称，开启昵称编辑模式');
        this.setData({
            isEditingNickname: true
        }, () => {
            // 延迟 50ms 等待 input 物理节点在 DOM 中被引擎挂载就绪，彻底规避自动聚焦失效问题
            setTimeout(() => {
                this.setData({
                    nicknameFocus: true
                });
            }, 50);
        });
    },
    /**
     * 昵称输入实时更新暂存并执行瞬时熔断
     */
    onNicknameInput(e) {
        const { value } = e.detail;
        const store = getPrivate(this);
        store.tempNickname = value;
        // 核心熔断机制：只要产生 input 变化（无论是一键填充还是手动输入），直接触发保存并缩回，彻底剥夺手动输入空间
        logger_1.Logger.info('[Profile] 监听到输入流变化，执行瞬时保存并收回键盘，封死自定义打字空间');
        this.saveNickname(value);
    },
    /**
     * 昵称输入框失去焦点
     */
    onNicknameBlur(e) {
        const { value } = e.detail;
        logger_1.Logger.info('[Profile] 昵称输入框失去焦点，尝试保存昵称');
        this.saveNickname(value);
    },
    /**
     * 键盘点击完成提交
     */
    onNicknameConfirm(e) {
        const { value } = e.detail;
        logger_1.Logger.info('[Profile] 用户点击键盘完成，尝试保存昵称');
        this.saveNickname(value);
    },
    /**
     * 公共保存昵称逻辑 (双通道保障与内存优先级绝对优先)
     */
    saveNickname(rawNickname) {
        // 幂等性控制：如果当前已经退出编辑态，说明已经完成过保存，直接拦截，防止后续事件（如 blur）的二次覆盖
        if (!this.data.isEditingNickname)
            return;
        const TRACE_ID = `T-PROFILE-${Date.now()}`;
        const store = getPrivate(this);
        // 绝对优先级决策：优先使用实时变动拦截的 store.tempNickname，其次才使用事件原生的 rawNickname
        const nickname = (store.tempNickname || rawNickname || '').trim();
        // 兜底值校验：若输入为空，重置为“性格评估探索家”
        const finalNickname = nickname.length > 0 ? nickname : '性格评估探索家';
        logger_1.Logger.info(`[${TRACE_ID}] 准备保存用户昵称，内存暂存值: "${store.tempNickname || ''}", 事件入参值: "${rawNickname}", 最终决定值: "${finalNickname}"`);
        // 及时释放内存
        store.tempNickname = '';
        const userProfile = Object.assign(Object.assign({}, this.data.userProfile), { nickname: finalNickname });
        this.setData({
            userProfile,
            isEditingNickname: false,
            nicknameFocus: false
        });
        try {
            wx.setStorageSync('local_user_profile', userProfile);
            logger_1.Logger.info(`[${TRACE_ID}] 用户昵称已成功写入本地缓存`);
        }
        catch (err) {
            logger_1.Logger.error(`[${TRACE_ID}] 用户昵称写入本地缓存失败:`, err);
        }
    },
    /**
     * 加载历史记录列表（具备在线/离线双模态与自适应切换）
     */
    loadHistoryList() {
        return __awaiter(this, void 0, void 0, function* () {
            const app = getApp();
            const isOffline = app.globalData.isOfflineMode;
            this.setData({ isOffline });
            // 1. 离线状态，直接载入本地历史
            if (isOffline) {
                logger_1.Logger.warn('[Mine] 离线模式下加载本地历史记录');
                this.loadLocalHistory();
                return;
            }
            // 2. 在线状态，拉取云端历史（分页）
            try {
                const { page, pageSize } = this.data;
                const res = yield (0, request_1.request)({
                    url: `/api/v1/quiz/test-history?page=${page}&pageSize=${pageSize}`,
                    method: 'GET'
                });
                if (res.code === 200) {
                    const newItems = res.data || [];
                    const formattedList = newItems.map(item => (Object.assign(Object.assign({}, item), { formattedTime: this.formatTime(item.timestamp) })));
                    if (page === 1) {
                        this.setData({ historyList: formattedList, hasMore: newItems.length >= pageSize }, () => {
                            this.calculateStats(formattedList);
                        });
                    } else {
                        const merged = [...this.data.historyList, ...formattedList];
                        this.setData({ historyList: merged, hasMore: newItems.length >= pageSize }, () => {
                            this.calculateStats(merged);
                        });
                    }
                }
                else {
                    throw new Error(res.message);
                }
            }
            catch (err) {
                logger_1.Logger.error('[Mine] 获取云端历史异常，降级为本地缓存历史:', err);
                // 网络请求失败，降级本地拉取
                this.loadLocalHistory();
            }
            // 重置刷新/加载状态
            this.setData({ refreshing: false, loading: false });
        });
    },
    /**
     * 降级载入本地缓存历史数据
     */
    loadLocalHistory() {
        const list = localHistory_1.LocalHistoryService.getHistoryList();
        const formattedList = list.map(item => (Object.assign(Object.assign({}, item), { formattedTime: this.formatTime(item.timestamp) })));
        this.setData({ historyList: formattedList, refreshing: false, loading: false }, () => {
            this.calculateStats(formattedList);
        });
    },
    /**
     * 辅助方法：重新计算仪表盘统计指标
     */
    calculateStats(list) {
        const completedCount = list.length;
        // 获取去重的人格代码数作为勋章数
        const codes = list.map(item => (item.resultCode || '').toUpperCase()).filter(Boolean);
        const badgeCount = new Set(codes).size;
        this.setData({
            stats: {
                completedCount,
                badgeCount
            }
        });
    },
    /**
     * 查看报告详情
     */
    onViewDetail(e) {
        const historyId = e.currentTarget.dataset.id;
        logger_1.Logger.info(`查看历史报告详情, 历史记录ID: ${historyId}`);
        wx.navigateTo({
            url: `/packageQuiz/pages/result/result?historyId=${historyId}`
        });
    },
    /**
     * 显示自定义赛博弹窗
     */
    showCyberModal(options) {
        const store = getPrivate(this);
        store.confirmCallback = options.confirm || null;
        store.cancelCallback = options.cancel || null;
        this.setData({
            showCyberModal: true,
            modalTitle: options.title,
            modalContent: options.content,
            modalShowCancel: options.showCancel !== false,
            modalConfirmText: options.confirmText || '确定',
            modalCancelText: options.cancelText || '取消',
            modalIsDanger: !!options.isDanger,
            modalIsLoading: !!options.isLoading
        });
    },
    /**
     * 弹窗确认事件
     */
    onCyberModalConfirm() {
        this.setData({ showCyberModal: false });
        const store = getPrivate(this);
        if (store.confirmCallback) {
            store.confirmCallback();
            store.confirmCallback = null;
        }
    },
    /**
     * 弹窗取消事件
     */
    onCyberModalCancel() {
        this.setData({ showCyberModal: false });
        const store = getPrivate(this);
        if (store.cancelCallback) {
            store.cancelCallback();
            store.cancelCallback = null;
        }
    },
    /**
     * 阻止弹窗滑动手势穿透
     */
    preventTouchMove() {
        // 阻止页面滚动穿透
    },
    /**
     * 触发“关于我们”说明弹窗
     */
    onAboutTap() {
        logger_1.Logger.info('用户点击“关于我们”说明');
        this.showCyberModal({
            title: '关于系统',
            content: '本系统是由极光深度AI性格实验室研发的专业MBTI/荣格性格评估工具，旨在帮助年轻人探索深层潜意识并促进社交共鸣。',
            showCancel: false,
            confirmText: '我知道了'
        });
    },
    /**
     * 触发“常见问题FAQ”说明弹窗
     */
    onHelpTap() {
        logger_1.Logger.info('用户点击“常见问题FAQ”说明');
        this.showCyberModal({
            title: '常见问题说明',
            content: '1. 为什么我的测评记录不见了？\n若您处于离线单机模式，测评结果仅保存在手机本地缓存中，清除微信缓存会导致记录丢失。请尽量联网使用以启用云端同步。\n\n2. 性格测评结果是否会改变？\n随着个人阅历成长，性格倾向有可能会微调，建议每隔3-6个月进行一次重测。',
            showCancel: false,
            confirmText: '明白'
        });
    },
    /**
     * 删除测评历史记录（使用catchtap阻止冒泡，支持在线/离线自适应删除）
     */
    onDeleteHistory(e) {
        const historyId = e.currentTarget.dataset.id;
        logger_1.Logger.info(`触发历史记录删除，准备移除 ID: ${historyId}`);
        this.showCyberModal({
            title: '删除历史记录',
            content: '确定要删除该条测评报告吗？删除后数据将无法找回。',
            isDanger: true,
            confirm: () => __awaiter(this, void 0, void 0, function* () {
                this.showCyberModal({
                    title: '请稍候',
                    content: '正在从云端清除您的测评历史...',
                    showCancel: false,
                    isDanger: true,
                    isLoading: true
                });
                if (this.data.isOffline) {
                    // 离线模式：直接删除本地
                    localHistory_1.LocalHistoryService.deleteHistory(historyId);
                    this.loadLocalHistory();
                    this.setData({ showCyberModal: false });
                    wx.showToast({ title: '删除成功' });
                }
                else {
                    // 在线模式：请求后端
                    try {
                        const delRes = yield (0, request_1.request)({
                            url: `/api/v1/quiz/test-history/${historyId}`,
                            method: 'DELETE'
                        });
                        this.setData({ showCyberModal: false });
                        if (delRes.code === 200) {
                            wx.showToast({ title: '删除成功' });
                            this.loadHistoryList();
                        }
                        else {
                            throw new Error(delRes.message);
                        }
                    }
                    catch (err) {
                        logger_1.Logger.error('[Mine] 云端删除失败，尝试降级本地清除:', err);
                        // 如果云端失败了（或者瞬间断网），同样在本地帮用户清理掉
                        localHistory_1.LocalHistoryService.deleteHistory(historyId);
                        this.loadLocalHistory();
                        this.setData({ showCyberModal: false });
                        wx.showToast({ title: '已本地清除' });
                    }
                }
            })
        });
    },
    /**
     * 无历史记录时引导去测一测
     */
    onGoToTest() {
        logger_1.Logger.info('[Mine] 引导前往首页答题');
        wx.switchTab({
            url: '/pages/map/index/index'
        });
    },
    /**
     * 辅助函数：Unix 时间戳格式化
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d} ${hh}:${mm}`;
    },

    /**
     * 下拉刷新历史列表
     */
    onRefresh() {
        this.setData({ refreshing: true, page: 1, hasMore: true });
        this.loadHistoryList();
    },

    /**
     * 上拉加载更多历史
     */
    loadNextPage() {
        if (this.data.loading || !this.data.hasMore) return;
        this.setData({ page: this.data.page + 1, loading: true });
        this.loadHistoryList();
    }
});
