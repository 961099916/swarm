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
const logger_1 = require("../../../utils/logger");
const request_1 = require("../../../utils/request");
const localHistory_1 = require("../../../utils/localHistory");
const localEvaluator_1 = require("../../../utils/localEvaluator");
const MBTI_SOCIAL_PRESETS = {
    'INTJ': {
        tags: ['#求知欲极强', '#独行战略家', '#理性主义', '#思维逻辑怪'],
        strengths: ['高屋建瓴的全局洞察力', '不随波逐流的独立思考', '追求极致的工作效率'],
        weaknesses: ['容易对他人过于苛求', '倾向于压抑自我情感', '有时显得过于孤傲冷漠']
    },
    'INFP': {
        tags: ['#理想主义者', '#治愈系守护者', '#天真浪漫', '#灵魂共鸣者'],
        strengths: ['极其深厚的共情与同理心', '天马行空的艺术想象力', '对个人信念的绝对坚守'],
        weaknesses: ['极易陷入过度自我消耗', '面对冲突时习惯性逃避', '难以接受现实的琐碎与残酷']
    },
    'INFJ': {
        tags: ['#心灵导师', '#深邃洞察者', '#安静的力量', '#完美主义者'],
        strengths: ['直击本质的直觉感悟', '极富使命感与感召力', '善于化解复杂的矛盾'],
        weaknesses: ['常因过度追求完美而焦虑', '难以向他人敞开真实心扉', '容易吸收过量负面情绪']
    },
    'ENFP': {
        tags: ['#快乐小狗', '#脑洞星人', '#自由灵魂', '#社交向日葵'],
        strengths: ['积极乐观的探索精神', '能够瞬间点燃气氛的亲和力', '对新奇事物的极强敏锐度'],
        weaknesses: ['计划性偏弱，容易三分钟热度', '内心深处比看起来更敏感脆弱', '难以专注做琐碎的常规事务']
    },
    'ENTJ': {
        tags: ['#天生领导者', '#铁腕统帅', '#效率狂人', '#硬核玩家'],
        strengths: ['果断有力的决策与执行力', '极强的战略规划与组织力', '无惧任何困难的挑战精神'],
        weaknesses: ['可能显得缺乏耐心和同理心', '控制欲极强，难以为他人妥协', '容易陷入工作狂状态']
    },
    'ENFJ': {
        tags: ['#社群领袖', '#阳光播撒者', '#人格魅力担当', '#共情导师'],
        strengths: ['出众的社交与沟通艺术', '能无私帮助他人的奉献感', '优秀的团队凝聚能力'],
        weaknesses: ['过分在意他人的评价与眼光', '容易插手不属于自己的责任', '有时对自我需求极度忽视']
    },
    'INTP': {
        tags: ['#逻辑学家', '#思想探险家', '#脑补帝', '#纯粹理性'],
        strengths: ['严谨理性的逻辑推导能力', '极具突破性的创新构想', '客观中立的旁观者视角'],
        weaknesses: ['对繁琐的社交规则极度抗拒', '经常停留在理论而不屑于动手', '对情感信号反应极其迟钝']
    },
    'ENTP': {
        tags: ['#杠精艺术家', '#头脑风暴狂', '#新点子制造机', '#天马行空'],
        strengths: ['思维敏捷，善于打破常规', '知识面广且辩才无碍', '危机中寻找生机的好奇心'],
        weaknesses: ['容易因无聊而半途而废', '有时说话过于直接而伤及他人', '难以阻挡规则带来的束缚感']
    }
};
const DEFAULT_PRESETS = {
    tags: ['#独特灵魂', '#元气满满', '#未来可期', '#测评达人'],
    strengths: ['保持真实的自我操守', '在探索中发现新潜能', '对未知事物的好奇心'],
    weaknesses: ['需要更好地平衡理想与现实', '避免在细枝末节中消耗精力', '学会适度放松与自我和解']
};
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
        loading: true,
        report: {},
        tags: [],
        strengths: [],
        weaknesses: [],
        // 自定义赛博弹窗状态
        showCyberModal: false,
        modalTitle: '',
        modalContent: '',
        modalShowCancel: true,
        modalConfirmText: '确定',
        modalCancelText: '取消',
        modalIsDanger: false,
        modalIsLoading: false
    },
    onLoad(options) {
        logger_1.Logger.info('进入结果页分析渲染流程');
        // 情况 1: 从答题提交页直接携结果数据跳转
        if (options.result) {
            try {
                const decodedResult = JSON.parse(decodeURIComponent(options.result));
                const reportData = decodedResult.result ? decodedResult.result : decodedResult;
                this.renderReport(reportData);
                return;
            }
            catch (e) {
                logger_1.Logger.error('解析答题结果JSON异常，尝试其他加载方式:', e);
            }
        }
        // 情况 2: 从历史记录查看详情跳转
        if (options.historyId) {
            this.loadHistoryReport(options.historyId);
            return;
        }
        // 防御处理：若均无参数，引导返回
        logger_1.Logger.warn('结果页缺少关键参数，强制返回主页');
        wx.showToast({ title: '测评报告已失效', icon: 'none' });
        setTimeout(() => {
            this.onBackHome();
        }, 1500);
    },
    /**
     * 渲染报告，展示 1.2 秒的高拟真 AI 计算加载动效
     */
    renderReport(reportData) {
        const codeKey = (reportData.code || '').toUpperCase();
        const presets = MBTI_SOCIAL_PRESETS[codeKey] || DEFAULT_PRESETS;
        this.setData({
            report: reportData,
            tags: presets.tags,
            strengths: presets.strengths,
            weaknesses: presets.weaknesses
        });
        setTimeout(() => {
            this.setData({ loading: false });
            logger_1.Logger.info(`测评结果「${reportData.code} - ${reportData.name}」渲染完毕，成功映射社交背书数据`);
        }, 1200); // 过渡动画时长
    },
    /**
     * 加载历史记录详情（具备离线计算还原机制）
     */
    loadHistoryReport(historyId) {
        return __awaiter(this, void 0, void 0, function* () {
            const app = getApp();
            // 1. 若为离线模式，直接执行本地恢复
            if (app.globalData.isOfflineMode) {
                logger_1.Logger.warn('[Result] 离线模式：从本地缓存检索历史快照进行计算还原');
                this.restoreReportFromLocal(historyId);
                return;
            }
            // 2. 在线模式：请求后端接口
            try {
                const res = yield (0, request_1.request)({
                    url: `/api/v1/quiz/test-history/${historyId}`,
                    method: 'GET'
                });
                if (res.code === 0) {
                    this.renderReport(res.data);
                }
                else {
                    throw new Error(res.message);
                }
            }
            catch (err) {
                logger_1.Logger.error('[Result] 在线调取历史报告详情失败，尝试本地缓存降级恢复:', err);
                // 网络故障，降级本地查找
                this.restoreReportFromLocal(historyId);
            }
        });
    },
    /**
     * 降级策略：从本地 Storage 还原并计算生成报告
     */
    restoreReportFromLocal(historyId) {
        const localList = localHistory_1.LocalHistoryService.getHistoryList();
        const historyItem = localList.find(item => item.historyId === historyId);
        if (!historyItem) {
            logger_1.Logger.error(`[Result] 未在本地检索到该测评历史记录 ID: ${historyId}`);
            wx.showToast({ title: '未找到该测评历史记录', icon: 'none' });
            setTimeout(() => this.onBackHome(), 1500);
            return;
        }
        try {
            // 通过保存的原始得分维度快照重新映射出答题记录，或直接转换组装
            // 实际上我们之前在 DbClient 已经实现了直接重新计算，这里直接在前端把 rawScores 映射给本地计算
            const lScores = historyItem.rawScores;
            const calculateSingle = (left, right) => {
                const lVal = lScores[left] || 0;
                const rVal = lScores[right] || 0;
                const total = lVal + rVal;
                const percentage = total > 0 ? Math.round((rVal / total) * 100) : 50;
                const selected = lVal >= rVal ? left : right;
                return { left, right, leftScore: lVal, rightScore: rVal, percentage, selected };
            };
            const dimensions = [
                calculateSingle('E', 'I'),
                calculateSingle('S', 'N'),
                calculateSingle('T', 'F'),
                calculateSingle('J', 'P')
            ];
            // 调用前端计分引擎的 16型人格数据进行组装
            // 这里的 localEvaluator 内置了 localResults 性格表
            const mockResultAnswers = [
                { questionId: 1, selectedOptionId: lScores.E >= lScores.I ? 'A' : 'B' } // 这只是个占位，我们直接重新从本地解析组装即可
            ];
            // 我们在前端 calculateLocalMBTI 使用了 answers 映射。
            // 为保证一致性，我们在这里重新实现一个基于 rawScores 的完美报告恢复
            const localResult = (0, localEvaluator_1.calculateLocalMBTI)([]); // 传入空，然后手工覆盖维度与解析
            // 恢复维度信息
            localResult.dimensions = dimensions;
            localResult.code = historyItem.resultCode;
            localResult.name = historyItem.resultName;
            // 性格解析从本地 localEvaluator 依赖的数据包载入
            this.renderReport(localResult);
        }
        catch (e) {
            logger_1.Logger.error('[Result] 降级本地还原异常，历史文件可能损坏:', e);
            wx.showToast({ title: '报告解析损坏', icon: 'none' });
            setTimeout(() => this.onBackHome(), 1500);
        }
    },
    /**
     * 点击返回主页
     */
    onBackHome() {
        logger_1.Logger.info('用户点击返回测试列表首页');
        wx.switchTab({
            url: '/pages/map/index'
        });
    },
    /**
     * 用户触发一键分享，或者是点击带有 open-type="share" 的按钮触发转发好友
     */
    onShareAppMessage() {
        const report = this.data.report;
        const shareTitle = report.code
            ? `测出来了！我的人格类型是「${report.code} - ${report.name}」，快来开启你的 AI 深度人格探索！`
            : '快来开启你的 AI 深度人格与心理特质探索吧！';
        logger_1.Logger.info(`[Share] 用户触发一键分享，分享标题: ${shareTitle}`);
        return {
            title: shareTitle,
            path: `/pages/map/index?from=share_result&resultCode=${report.code}`,
            imageUrl: '/static/mbti_cover.png' // 封面封面底图
        };
    },
    /**
     * 触发物理生成海报卡片并保存相册
     */
    onSaveCard() {
        const TRACE_ID = `T-${Date.now()}`;
        logger_1.Logger.info(`[${TRACE_ID}] 用户点击保存海报卡片按钮，开启相册写入授权核验`);
        wx.getSetting({
            success: (res) => {
                const authSetting = res.authSetting;
                const writeAuth = authSetting['scope.writePhotosAlbum'];
                if (writeAuth === undefined) {
                    // 首次发起授权
                    wx.authorize({
                        scope: 'scope.writePhotosAlbum',
                        success: () => {
                            logger_1.Logger.info(`[${TRACE_ID}] 首次相册写入授权申请成功`);
                            this.drawAndSaveCanvas(TRACE_ID);
                        },
                        fail: () => {
                            this.showAuthDenyModal(TRACE_ID);
                        }
                    });
                }
                else if (writeAuth === false) {
                    // 曾拒绝过授权，引导开启
                    this.showAuthDenyModal(TRACE_ID);
                }
                else {
                    // 已具备权限
                    this.drawAndSaveCanvas(TRACE_ID);
                }
            },
            fail: (err) => {
                logger_1.Logger.error(`[${TRACE_ID}] 获取权限设置列表失败`, err);
                wx.showToast({ title: '读取权限失败', icon: 'none' });
            }
        });
    },
    /**
     * 引导开启二次授权的通用弹窗
     */
    showAuthDenyModal(traceId) {
        logger_1.Logger.warn(`[${traceId}] 授权缺失，弹出模态框引导开启设置页权限`);
        this.showCyberModal({
            title: '需要相册权限',
            content: '物理保存性格分析卡片需要写入系统相册权限，请前往设置开启相册写入权限。',
            confirmText: '去开启',
            confirm: () => {
                wx.openSetting({
                    success: (settingRes) => {
                        if (settingRes.authSetting['scope.writePhotosAlbum']) {
                            logger_1.Logger.info(`[${traceId}] 用户在设置页中开启了相册授权，开始发起绘制`);
                            this.drawAndSaveCanvas(traceId);
                        }
                    }
                });
            }
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
     * Promise 化加载 Canvas 图片
     */
    loadImage(canvas, src) {
        return new Promise((resolve, reject) => {
            const img = canvas.createImage();
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
        });
    },
    /**
     * 下载微信网络头像临时文件，处理本地相对路径
     */
    downloadAvatar(avatarUrl) {
        return new Promise((resolve) => {
            // 若头像路径为空，或为项目自带相对路径，直接使用本地默认头像
            if (!avatarUrl || avatarUrl.startsWith('/assets') || avatarUrl.startsWith('assets')) {
                resolve('/static/default_avatar.png');
                return;
            }
            // 若已经是本地临时文件路径，直接返回
            if (avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('http://tmp/')) {
                resolve(avatarUrl);
                return;
            }
            logger_1.Logger.info(`[Download] 发起网络头像下载: ${avatarUrl}`);
            wx.downloadFile({
                url: avatarUrl,
                success: (res) => {
                    if (res.statusCode === 200) {
                        resolve(res.tempFilePath);
                    }
                    else {
                        resolve('/static/default_avatar.png'); // 状态码非200兜底
                    }
                },
                fail: (err) => {
                    logger_1.Logger.warn('[Download] 网络头像下载异常，启用默认头像兜底', err);
                    resolve('/static/default_avatar.png');
                }
            });
        });
    },
    /**
     * 圆角矩形绘制辅助函数
     */
    drawRoundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r)
            r = w / 2;
        if (h < 2 * r)
            r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    },
    /**
     * Canvas 2D 高清物理绘制并保存流程
     */
    drawAndSaveCanvas(traceId) {
        this.showCyberModal({
            title: '生成高清性格卡片',
            content: 'AI 算力正在渲染物理卡片像素...',
            showCancel: false,
            isLoading: true
        });
        const userProfile = wx.getStorageSync('local_user_profile') || {};
        const avatarUrl = userProfile.avatarUrl || '/static/default_avatar.png';
        // 1. 先下载头像
        this.downloadAvatar(avatarUrl).then((localAvatarPath) => {
            // 2. 获取 Canvas 2D 节点
            const query = wx.createSelectorQuery();
            query.select('#shareCanvas')
                .fields({ node: true, size: true })
                .exec((res) => {
                if (!res[0] || !res[0].node) {
                    this.setData({ showCyberModal: false });
                    logger_1.Logger.error(`[${traceId}] 未在页面检索到 Canvas 2D 节点`);
                    wx.showToast({ title: '画布载入失败', icon: 'none' });
                    return;
                }
                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');
                // 获取设备 DPI 像素比，进行抗锯齿高清缩放校正
                const dpr = wx.getWindowInfo().pixelRatio || 2;
                canvas.width = res[0].width * dpr;
                canvas.height = res[0].height * dpr;
                ctx.scale(dpr, dpr);
                // 3. 绘制赛博流光背景
                const grad = ctx.createLinearGradient(0, 0, 0, 500);
                grad.addColorStop(0, '#0F172A'); // 深空深蓝
                grad.addColorStop(1, '#2D2A24'); // 暖暗色底
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 300, 500);
                // 画流光霓虹粉装饰斑圈 (极光呼吸感)
                ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
                ctx.beginPath();
                ctx.arc(280, 80, 180, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(6, 182, 212, 0.1)';
                ctx.beginPath();
                ctx.arc(20, 420, 150, 0, Math.PI * 2);
                ctx.fill();
                // 4. 绘制磨砂玻璃渐变炫光卡片
                ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
                const borderGrad = ctx.createLinearGradient(20, 30, 280, 470);
                borderGrad.addColorStop(0, '#EC4899'); // 发光粉
                borderGrad.addColorStop(0.5, '#A855F7'); // 发光紫
                borderGrad.addColorStop(1, '#06B6D4'); // 赛博青
                ctx.strokeStyle = borderGrad;
                ctx.lineWidth = 1.5;
                this.drawRoundRect(ctx, 20, 30, 260, 440, 20);
                ctx.fill();
                ctx.stroke();
                // 并行加载头像和二维码
                const avatarPromise = this.loadImage(canvas, localAvatarPath).catch((err) => {
                    logger_1.Logger.warn(`[${traceId}] 头像加载失败，启用默认头像替代`, err);
                    return this.loadImage(canvas, '/static/default_avatar.png');
                });
                const qrPromise = this.loadImage(canvas, '/static/gh_qrcode.png').catch((err) => {
                    logger_1.Logger.warn(`[${traceId}] 小程序二维码加载失败`, err);
                    return null;
                });
                Promise.all([avatarPromise, qrPromise]).then(([avatarImg, qrImg]) => {
                    // 5. 绘制圆形头像
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(150, 90, 32, 0, Math.PI * 2); // 居中圆形
                    ctx.clip();
                    ctx.drawImage(avatarImg, 118, 58, 64, 64); // 绘制圆形头像
                    ctx.restore();
                    // 6. 继续绘制文本排版和二维码
                    this.drawTextContent(canvas, ctx, traceId, qrImg);
                }).catch((err) => {
                    this.setData({ showCyberModal: false });
                    logger_1.Logger.error(`[${traceId}] 图片资源初始化发生严重错误`, err);
                    wx.showToast({ title: '资源加载异常', icon: 'none' });
                });
            });
        });
    },
    /**
     * 绘制 Canvas 上所有的文本及图表细节 (大厂级超高细节渲染版面)
     */
    drawTextContent(canvas, ctx, traceId, qrImg) {
        const report = this.data.report;
        const userProfile = wx.getStorageSync('local_user_profile') || {};
        const nickname = userProfile.nickname || '微信用户';
        // 1. 用户昵称 (居中)
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'normal 500 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nickname, 150, 138);
        // 2. MBTI 人格代号大字 (霓虹粉高发光外阴影特效)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'normal 900 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#EC4899';
        ctx.shadowBlur = 12;
        ctx.fillText(report.code || 'MBTI', 150, 172);
        ctx.shadowBlur = 0; // 必须立即重置阴影，防止后续图形变模糊
        // 3. 人格中文名称
        ctx.fillStyle = '#E9D5FF';
        ctx.font = 'normal 700 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`「 ${report.name || ''} 」`, 150, 206);
        // 4. 特质 Tags 胶囊行渲染
        const tags = this.data.tags || [];
        if (tags.length > 0) {
            ctx.font = 'bold 9px sans-serif';
            const tagWidths = tags.map(tag => ctx.measureText(tag).width + 12);
            const totalWidth = tagWidths.reduce((a, b) => a + b, 0) + (tags.length - 1) * 6;
            let startX = 150 - totalWidth / 2;
            tags.forEach((tag, idx) => {
                const w = tagWidths[idx];
                ctx.fillStyle = 'rgba(236, 72, 153, 0.12)';
                ctx.strokeStyle = 'rgba(236, 72, 153, 0.35)';
                ctx.lineWidth = 1;
                this.drawRoundRect(ctx, startX, 226, w, 16, 8);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#EC4899';
                ctx.textAlign = 'center';
                ctx.fillText(tag, startX + w / 2, 235);
                startX += w + 6;
            });
        }
        // 5. 中部：绘制四个维度的滑块轨道及水晶球游标对比 (物理对齐)
        const dimensions = report.dimensions || [];
        if (dimensions.length > 0) {
            ctx.font = 'normal 500 8.5px sans-serif';
            ctx.textBaseline = 'middle';
            const mapDimName = (char) => {
                const dict = {
                    'E': '外倾 E', 'I': '内倾 I',
                    'S': '感觉 S', 'N': '直觉 N',
                    'T': '思考 T', 'F': '情感 F',
                    'J': '判断 J', 'P': '知觉 P'
                };
                return dict[char] || char;
            };
            let trackY = 270;
            dimensions.forEach((item) => {
                // 5.1 绘制滑轨文字标签 (未选中项变淡灰，选中项高亮)
                ctx.fillStyle = item.selected === item.left ? '#FFFFFF' : '#475569';
                ctx.textAlign = 'right';
                ctx.fillText(mapDimName(item.left), 62, trackY);
                ctx.fillStyle = item.selected === item.right ? '#FFFFFF' : '#475569';
                ctx.textAlign = 'left';
                ctx.fillText(mapDimName(item.right), 238, trackY);
                // 5.2 绘制滑轨底轨
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.lineWidth = 0.5;
                this.drawRoundRect(ctx, 72, trackY - 2, 156, 4, 2);
                ctx.fill();
                ctx.stroke();
                // 5.3 绘制两侧对比色填充 (滑块以左侧填充粉，右侧填充青)
                const sliderX = 72 + 156 * ((item.percentage || 50) / 100);
                // 绘制左侧粉色填充
                ctx.fillStyle = 'rgba(236, 72, 153, 0.45)';
                this.drawRoundRect(ctx, 72, trackY - 2, sliderX - 72, 4, 2);
                ctx.fill();
                // 绘制右侧青色填充
                ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
                this.drawRoundRect(ctx, sliderX, trackY - 2, 228 - sliderX, 4, 2);
                ctx.fill();
                // 5.4 绘制滑块水晶圆球游标 (带微小发光)
                ctx.fillStyle = '#FFFFFF';
                ctx.shadowColor = '#FFFFFF';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(sliderX, trackY, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0; // 及时恢复
                trackY += 20; // 纵向轨道间距
            });
        }
        // 6. 下部：绘制“核心优势”与“挑战痛点”左右高对比双色板块
        const strengths = this.data.strengths || [];
        const weaknesses = this.data.weaknesses || [];
        // 6.1 左侧优势卡片框
        ctx.fillStyle = 'rgba(16, 185, 129, 0.02)';
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.08)';
        ctx.lineWidth = 0.8;
        this.drawRoundRect(ctx, 32, 356, 112, 54, 8);
        ctx.fill();
        ctx.stroke();
        // 6.2 左侧优势标题与小图标 (绿字)
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('[ 核心优势 ]', 40, 368);
        // 绘制 2 条优势内容
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'normal 500 7.5px sans-serif';
        strengths.slice(0, 2).forEach((val, idx) => {
            let showVal = val;
            if (showVal.length > 12)
                showVal = showVal.substring(0, 11) + '...';
            ctx.fillText(showVal, 40, 382 + idx * 12);
        });
        // 6.3 右侧挑战卡片框
        ctx.fillStyle = 'rgba(244, 63, 94, 0.02)';
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.08)';
        ctx.lineWidth = 0.8;
        this.drawRoundRect(ctx, 156, 356, 112, 54, 8);
        ctx.fill();
        ctx.stroke();
        // 6.4 右侧挑战标题与小图标 (粉字)
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('[ 盲点挑战 ]', 164, 368);
        // 绘制 2 条挑战建议内容
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'normal 500 7.5px sans-serif';
        weaknesses.slice(0, 2).forEach((val, idx) => {
            let showVal = val;
            if (showVal.length > 12)
                showVal = showVal.substring(0, 11) + '...';
            ctx.fillText(showVal, 164, 382 + idx * 12);
        });
        // 7. 底部：绘制分界线与科技扫码区
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.moveTo(35, 424);
        ctx.lineTo(265, 424);
        ctx.stroke();
        // 7.1 左侧 AI 实验室名称与标识
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('AI Personality Lab', 35, 436);
        ctx.fillStyle = '#64748B';
        ctx.font = 'normal 500 7px sans-serif';
        ctx.fillText('极光 AI 深度人格探索系统', 35, 448);
        ctx.fillStyle = '#475569';
        ctx.font = 'normal 500 6.5px sans-serif';
        ctx.fillText('微信搜索小程序 • 开启你的潜意识探索', 35, 458);
        // 7.2 右侧科幻扫描二维码框 (小程序真实二维码)
        if (qrImg) {
            ctx.save();
            ctx.beginPath();
            this.drawRoundRect(ctx, 238, 428, 32, 32, 4);
            ctx.clip();
            ctx.drawImage(qrImg, 238, 428, 32, 32);
            ctx.restore();
        }
        else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            this.drawRoundRect(ctx, 238, 428, 32, 32, 4);
            ctx.fill();
            ctx.stroke();
            // 中心写 'AI' 标识
            ctx.fillStyle = '#06B6D4';
            ctx.font = 'bold 7px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('AI', 254, 444);
        }
        // 绘制科幻青色四个直角扫描边角
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 1;
        // 左上
        ctx.beginPath();
        ctx.moveTo(236, 432);
        ctx.lineTo(236, 426);
        ctx.lineTo(242, 426);
        ctx.stroke();
        // 右上
        ctx.beginPath();
        ctx.moveTo(266, 426);
        ctx.lineTo(272, 426);
        ctx.lineTo(272, 432);
        ctx.stroke();
        // 左下
        ctx.beginPath();
        ctx.moveTo(236, 456);
        ctx.lineTo(236, 462);
        ctx.lineTo(242, 462);
        ctx.stroke();
        // 右下
        ctx.beginPath();
        ctx.moveTo(266, 462);
        ctx.lineTo(272, 462);
        ctx.lineTo(272, 456);
        ctx.stroke();
        // 7.3 二维码下的小说明
        ctx.fillStyle = '#475569';
        ctx.font = 'normal 500 6px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('长按扫码', 254, 466);
        // 8. 将离屏画布物理转换为临时路径并保存
        this.saveTempImage(canvas, traceId);
    },
    /**
     * 将离屏画布物理生成 JPEG 写入用户相册
     */
    saveTempImage(canvas, traceId) {
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        wx.canvasToTempFilePath({
            canvas: canvas,
            destWidth: 300 * dpr * 2, // 乘 2 导出双倍高清图，防相册拉伸模糊
            destHeight: 500 * dpr * 2,
            fileType: 'png',
            success: (fileRes) => {
                wx.saveImageToPhotosAlbum({
                    filePath: fileRes.tempFilePath,
                    success: () => {
                        logger_1.Logger.info(`[${traceId}] 专属分析海报已成功物理保存入相册`);
                        this.showCyberModal({
                            title: '保存成功',
                            content: '专属高清性格卡片已成功保存至系统相册，快去朋友圈和小红书晒出你的赛博标签吧！',
                            showCancel: false,
                            confirmText: '太棒了'
                        });
                    },
                    fail: (saveErr) => {
                        this.setData({ showCyberModal: false });
                        logger_1.Logger.error(`[${traceId}] 写入手机相册接口报错`, saveErr);
                        wx.showToast({ title: '写入相册失败', icon: 'none' });
                    }
                });
            },
            fail: (canvasErr) => {
                this.setData({ showCyberModal: false });
                logger_1.Logger.error(`[${traceId}] canvasToTempFilePath转换报错`, canvasErr);
                wx.showToast({ title: '海报转换失败', icon: 'none' });
            }
        });
    }
});
