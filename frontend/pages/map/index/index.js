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
const localQuestions_1 = require("../../../utils/localQuestions");
const localEvaluator_1 = require("../../../utils/localEvaluator");
const soundManager_1 = require("../../../utils/soundManager");
const npcConfig_1 = require("../npcConfig");
const avatarColorExtractor_1 = require("../../../utils/avatarColorExtractor");
const posterDrawer_1 = require("../../../utils/posterDrawer");
// === 常量配置定义，彻底杜绝魔法数字与字符串 ===
const MAP_CONFIG = {
    WIDTH: 1200,
    HEIGHT: 1200,
    PLAYER_WIDTH: 32,
    PLAYER_HEIGHT: 48,
    PLAYER_SPEED: 8,
    COLLIDE_RADIUS_ADD: 15, // 玩家碰撞补偿半径
    INTERACT_RADIUS: 80, // NPC 交互检测范围半径
    FPS_INTERVAL: 33 // ~30 FPS 主循环间隔 (ms)
};
// 静态年级关卡元数据，用于关卡选择与副本内直接传送
const STAGE_CONFIGS_META = [
    { id: 'kindergarten_1', order: 1, name: '幼儿园小班' },
    { id: 'kindergarten_2', order: 2, name: '幼儿园大班' },
    { id: 'primary_1', order: 3, name: '小学一年级' },
    { id: 'primary_2', order: 4, name: '小学二年级' },
    { id: 'primary_3', order: 5, name: '小学三年级' },
    { id: 'primary_4', order: 6, name: '小学四年级' },
    { id: 'primary_5', order: 7, name: '小学五年级' },
    { id: 'primary_6', order: 8, name: '小学六年级' }
];
/**
 * 计算点 (px, py) 到线段 (x1, y1) - (x2, y2) 的最短距离
 */
function getDistanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        return Math.sqrt(Math.pow((px - x1), 2) + Math.pow((py - y1), 2));
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    return Math.sqrt(Math.pow((px - closestX), 2) + Math.pow((py - closestY), 2));
}
/**
 * 将线段平铺离散采样为地砖位置列表
 */
function generateSegmentBricks(x1, y1, x2, y2, step = 28) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0)
        return [{ x: x1, y: y1 }];
    const count = Math.ceil(len / step);
    const bricks = [];
    for (let i = 0; i <= count; i++) {
        const alpha = i / count;
        bricks.push({
            x: x1 + alpha * dx,
            y: y1 + alpha * dy
        });
    }
    return bricks;
}
/**
 * 沿线段两侧生成平行排布的围墙砖块点列表
 */
function generateParallelWalls(x1, y1, x2, y2, offset = 45, step = 28) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0)
        return [];
    // 计算单位法向量
    const nx = -dy / len;
    const ny = dx / len;
    // 左右两侧 of 线段端点
    const lx1 = x1 + offset * nx;
    const ly1 = y1 + offset * ny;
    const lx2 = x2 + offset * nx;
    const ly2 = y2 + offset * ny;
    const rx1 = x1 - offset * nx;
    const ry1 = y1 - offset * ny;
    const rx2 = x2 - offset * nx;
    const ry2 = y2 - offset * ny;
    return [
        ...generateSegmentBricks(lx1, ly1, lx2, ly2, step),
        ...generateSegmentBricks(rx1, ry1, rx2, ry2, step)
    ];
}
function isFunHistoryItem(item) {
    if (item.testType === 'MBTI' || item.testType === 'QUIZ')
        return true;
    if (item.testType === 'STUDY')
        return false;
    if (item.testId) {
        return npcConfig_1.FUN_TEST_IDS.has(item.testId);
    }
    return false;
}
// 享元缓存，缓存已分析的玩家头像色彩，避免并发 Canvas 分析
const avatarColorCache = {};
const analyzingAvatars = new Set();
function getDynamicPlayerSvgs(colors) {
    const hat = colors.hat;
    const skin = colors.skin;
    const cloth = colors.cloth;
    const pants = colors.pants;
    const outline = '%2357371d'; // 经典褐色边缘轮廓
    const shoe = '%23854c30'; // 褐鞋
    return {
        down: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="4" y="10" width="24" height="4" fill="${encodeURIComponent(hat)}"/><rect x="8" y="6" width="16" height="4" fill="${encodeURIComponent(hat)}"/><rect x="10" y="14" width="12" height="8" fill="${encodeURIComponent(skin)}"/><rect x="12" y="17" width="2" height="2" fill="${outline}"/><rect x="18" y="17" width="2" height="2" fill="${outline}"/><rect x="9" y="22" width="14" height="14" fill="${encodeURIComponent(cloth)}"/><rect x="10" y="36" width="4" height="8" fill="${encodeURIComponent(pants)}"/><rect x="18" y="36" width="4" height="8" fill="${encodeURIComponent(pants)}"/><rect x="9" y="44" width="5" height="2" fill="${shoe}"/><rect x="18" y="44" width="5" height="2" fill="${shoe}"/></g></svg>`,
        up: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="4" y="10" width="24" height="4" fill="${encodeURIComponent(hat)}"/><rect x="8" y="6" width="16" height="6" fill="${encodeURIComponent(hat)}"/><rect x="9" y="16" width="14" height="20" fill="${encodeURIComponent(cloth)}"/><rect x="10" y="36" width="4" height="8" fill="${encodeURIComponent(pants)}"/><rect x="18" y="36" width="4" height="8" fill="${encodeURIComponent(pants)}"/><rect x="9" y="44" width="5" height="2" fill="${shoe}"/><rect x="18" y="44" width="5" height="2" fill="${shoe}"/></g></svg>`,
        left: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="6" y="10" width="20" height="4" fill="${encodeURIComponent(hat)}"/><rect x="10" y="6" width="12" height="4" fill="${encodeURIComponent(hat)}"/><rect x="11" y="14" width="10" height="8" fill="${encodeURIComponent(skin)}"/><rect x="12" y="17" width="2" height="2" fill="${outline}"/><rect x="10" y="22" width="12" height="14" fill="${encodeURIComponent(cloth)}"/><rect x="12" y="36" width="6" height="8" fill="${encodeURIComponent(pants)}"/><rect x="11" y="44" width="6" height="2" fill="${shoe}"/><rect x="8" y="24" width="4" height="8" fill="${encodeURIComponent(skin)}"/></g></svg>`,
        right: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="6" y="10" width="20" height="4" fill="${encodeURIComponent(hat)}"/><rect x="10" y="6" width="12" height="4" fill="${encodeURIComponent(hat)}"/><rect x="11" y="14" width="10" height="8" fill="${encodeURIComponent(skin)}"/><rect x="18" y="17" width="2" height="2" fill="${outline}"/><rect x="10" y="22" width="12" height="14" fill="${encodeURIComponent(cloth)}"/><rect x="14" y="36" width="6" height="8" fill="${encodeURIComponent(pants)}"/><rect x="15" y="44" width="6" height="2" fill="${shoe}"/><rect x="20" y="24" width="4" height="8" fill="${encodeURIComponent(skin)}"/></g></svg>`
    };
}
// === 纯正像素风 (Pixel Art) SVG 精灵图定义 ===
const SPRITE_SVGS = {
    npc: {
        mbti: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><path d="M16,2 L6,14 L26,14 Z" fill="%234b3d7a"/><rect x="4" y="14" width="24" height="2" fill="%23e2a85c"/><rect x="10" y="16" width="12" height="6" fill="%23ffddc0"/><rect x="8" y="18" width="16" height="4" fill="%23ffffff"/><rect x="8" y="22" width="16" height="14" fill="%234b3d7a"/><rect x="10" y="36" width="12" height="8" fill="%233d2511"/><rect x="12" y="26" width="8" height="6" fill="%23e2a85c"/><rect x="14" y="28" width="4" height="2" fill="%233d2511"/></g></svg>`,
        career: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="8" y="6" width="16" height="6" fill="%23e67e22"/><rect x="6" y="12" width="20" height="2" fill="%23d35400"/><rect x="10" y="14" width="12" height="6" fill="%23ffddc0"/><rect x="8" y="20" width="16" height="16" fill="%237f8c8d"/><rect x="10" y="20" width="2" height="8" fill="%23b88655"/><rect x="20" y="20" width="2" height="8" fill="%23b88655"/><rect x="10" y="36" width="4" height="8" fill="%233d2511"/><rect x="18" y="36" width="4" height="8" fill="%233d2511"/></g></svg>`,
        love: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="8" y="4" width="16" height="12" fill="%23ff9999"/><rect x="10" y="12" width="12" height="8" fill="%23ffddc0"/><rect x="10" y="4" width="12" height="2" fill="%232ecc71"/><rect x="8" y="20" width="16" height="18" fill="%23ffb3ba"/><rect x="10" y="38" width="4" height="6" fill="%23ffddc0"/><rect x="18" y="38" width="4" height="6" fill="%23ffddc0"/></g></svg>`,
        bigfive: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="8" y="4" width="16" height="8" fill="%233d2511"/><rect x="10" y="12" width="12" height="8" fill="%23ffddc0"/><rect x="9" y="14" width="4" height="4" stroke="%23111827" stroke-width="1.5"/><rect x="19" y="14" width="4" height="4" stroke="%23111827" stroke-width="1.5"/><line x1="13" y1="16" x2="19" y2="16" stroke="%23111827" stroke-width="1.5"/><rect x="8" y="20" width="16" height="16" fill="%23f1f5f9"/><rect x="14" y="24" width="4" height="4" fill="%230ea5e9"/><rect x="10" y="36" width="4" height="8" fill="%23475569"/><rect x="18" y="36" width="4" height="8" fill="%23475569"/></g></svg>`,
        enneagram: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="6" y="6" width="20" height="14" fill="%23064e3b"/><rect x="10" y="10" width="12" height="8" fill="%23ffddc0"/><rect x="8" y="18" width="16" height="4" fill="%23ffffff"/><rect x="6" y="20" width="20" height="16" fill="%23064e3b"/><rect x="10" y="20" width="12" height="8" fill="%23ffffff"/><rect x="10" y="36" width="4" height="8" fill="%2378350f"/><rect x="18" y="36" width="4" height="8" fill="%2378350f"/></g></svg>`,
        disc: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="8" y="6" width="16" height="6" fill="%23eab308"/><rect x="10" y="12" width="12" height="8" fill="%23ffddc0"/><rect x="8" y="20" width="16" height="16" fill="%231e3a8a"/><rect x="14" y="20" width="4" height="6" fill="%23ef4444"/><rect x="10" y="36" width="4" height="8" fill="%233d2511"/><rect x="18" y="36" width="4" height="8" fill="%233d2511"/></g></svg>`,
        holland: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="8" y="6" width="16" height="6" fill="%23dc2626"/><rect x="10" y="12" width="12" height="8" fill="%23ffddc0"/><rect x="8" y="20" width="16" height="16" fill="%232563eb"/><rect x="10" y="20" width="2" height="12" fill="%23f59e0b"/><rect x="20" y="20" width="2" height="12" fill="%23f59e0b"/><rect x="10" y="36" width="4" height="8" fill="%233d2511"/><rect x="18" y="36" width="4" height="8" fill="%233d2511"/></g></svg>`,
        gallup: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="10" y="6" width="16" height="6" fill="%23b91c1c"/><rect x="6" y="8" width="6" height="2" fill="%23b91c1c"/><rect x="10" y="12" width="12" height="8" fill="%23ffddc0"/><rect x="8" y="20" width="16" height="16" fill="%23dc2626"/><rect x="12" y="20" width="8" height="6" fill="%23ffffff"/><circle cx="16" cy="28" r="2" fill="%23e2e8f0"/><rect x="10" y="36" width="4" height="8" fill="%236b7280"/><rect x="18" y="36" width="4" height="8" fill="%236b7280"/></g></svg>`,
        belbin: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="8" y="6" width="16" height="8" fill="%237c2d12"/><rect x="6" y="12" width="20" height="2" fill="%237c2d12"/><rect x="10" y="14" width="12" height="6" fill="%23ffddc0"/><rect x="8" y="20" width="16" height="16" fill="%237c2d12"/><rect x="12" y="20" width="8" height="16" fill="%23ffedd5"/><rect x="10" y="36" width="4" height="8" fill="%23111827"/><rect x="18" y="36" width="4" height="8" fill="%23111827"/></g></svg>`,
        color: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="8" y="6" width="16" height="6" fill="%23f59e0b"/><rect x="10" y="12" width="12" height="8" fill="%23ffddc0"/><rect x="8" y="20" width="8" height="8" fill="%23ef4444"/><rect x="16" y="20" width="8" height="8" fill="%233b82f6"/><rect x="8" y="28" width="8" height="8" fill="%23f59e0b"/><rect x="16" y="28" width="8" height="8" fill="%2310b981"/><rect x="22" y="24" width="4" height="4" fill="%23ffffff"/><rect x="10" y="36" width="4" height="8" fill="%233d2511"/><rect x="18" y="36" width="4" height="8" fill="%233d2511"/></g></svg>`,
        harry: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><path d="M16,2 L8,14 L24,14 Z" fill="%23451a03"/><rect x="6" y="12" width="20" height="2" fill="%23451a03"/><rect x="10" y="14" width="12" height="6" fill="%23ffddc0"/><rect x="8" y="20" width="16" height="16" fill="%23991b1b"/><rect x="8" y="24" width="16" height="4" fill="%23f59e0b"/><rect x="10" y="36" width="4" height="8" fill="%23451a03"/><rect x="18" y="36" width="4" height="8" fill="%23451a03"/></g></svg>`,
        mmpi: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="8" y="6" width="16" height="6" fill="%233d2511"/><rect x="10" y="12" width="12" height="8" fill="%23ffddc0"/><rect x="8" y="20" width="16" height="16" fill="%230d9488"/><rect x="10" y="22" width="12" height="2" fill="%23e2e8f0"/><path d="M12,24 L12,28 L20,28 L20,24" stroke="%23e2e8f0" stroke-width="1"/><rect x="10" y="36" width="4" height="8" fill="%230369a1"/><rect x="18" y="36" width="4" height="8" fill="%230369a1"/></g></svg>`,
        rorschach: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><rect x="8" y="4" width="16" height="8" fill="%231f2937"/><rect x="10" y="12" width="12" height="8" fill="%23ffffff"/><circle cx="13" cy="16" r="1.5" fill="%23000000"/><circle cx="19" cy="16" r="1.5" fill="%23000000"/><circle cx="16" cy="18" r="1" fill="%23000000"/><rect x="6" y="20" width="20" height="16" fill="%231f2937"/><rect x="6" y="20" width="2" height="16" fill="%23111827"/><rect x="24" y="20" width="2" height="16" fill="%23111827"/><rect x="10" y="36" width="4" height="8" fill="%23111827"/><rect x="18" y="36" width="4" height="8" fill="%23111827"/></g></svg>`
    }
};
// 物理与私有全局状态 WeakMap 物理隔离，确保内存安全
const privateStore = new WeakMap();
function getPrivate(instance) {
    let store = privateStore.get(instance);
    if (!store) {
        store = {
            loopTimer: null,
            vx: 0,
            vy: 0,
            touchId: null,
            joystickCenterX: 0,
            joystickCenterY: 0,
            joystickMaxDistance: 50,
            confirmCallback: null,
            cancelCallback: null
        };
        privateStore.set(instance, store);
    }
    return store;
}
Page({
    data: {
        // 1. RPG 引擎核心坐标状态
        playerX: 400,
        playerY: 400,
        playerXRound: 400,
        playerYRound: 400,
        showMinimapDetail: false,
        showSoundPanel: false,
        bgmEnabled: true,
        sfxEnabled: true,
        isTesting: false,
        testQuestions: [],
        currentQuestionIndex: 0,
        userAnswers: [],
        showTestSummary: false,
        testResultData: null,
        submitting: false,
        showResultModal: false,
        testReport: {},
        isSavingPoster: false,
        playerDir: 'down',
        playerMoving: false,
        playerSvgs: getDynamicPlayerSvgs(avatarColorExtractor_1.AvatarColorExtractor.DEFAULT_PLAYER_COLORS),
        cameraX: 0,
        cameraY: 0,
        mapWidth: MAP_CONFIG.WIDTH,
        mapHeight: MAP_CONFIG.HEIGHT,
        windowWidth: 375,
        windowHeight: 667,
        // 虚拟摇杆与交互 UI
        showJoystick: false,
        joystickX: 0,
        joystickY: 0,
        joystickStickX: 0,
        joystickStickY: 0,
        showInteractBtn: false,
        activeNpcId: '',
        currentInteractNpc: null,
        // NPC 集合数据契约（完全由云端配置动态下发，本地默认留空）
        npcList: {},
        // 障碍物列表（完全由云端动态生成，包含物理屏障延伸，本地留空）
        obstacles: [],
        // 关卡答题进度状态
        userStageProgress: {
            currentLevel: 1,
            stageName: '幼儿园小班',
            progress: []
        },
        npcInteractStatus: 'todo',
        npcInteractBtnText: '开始挑战',
        // 关卡传送与副本状态
        currentStageId: 'lobby',
        showStageSelectorModal: false,
        renderedNpcList: [],
        stageListForSelector: [],
        roomBricks: [],
        roomWalls: [],
        blockerGates: [],
        // NPC 对话状态
        showNpcDialogue: false,
        dialogueText: '',
        dialogueNpcName: '',
        // 2. 个人中心业务逻辑状态
        showProfileModal: false,
        isOffline: false,
        historyList: [],
        funHistoryList: [],
        studyHistoryList: [],
        activeHistoryTab: 'fun',
        userProfile: {
            nickname: npcConfig_1.MAP_CONFIG_CONSTANTS.DEFAULT_NICKNAME,
            avatarUrl: '/static/default_avatar.png'
        },
        stats: {
            completedCount: 0,
            differentCount: 0,
            exp: 0,
            level: 1,
            title: '小镇新手',
            progressPercent: 0
        },
        // 个人修改状态
        isEditingNickname: false,
        nicknameFocus: false,
        // 安全保护跳转锁
        isTransitioning: false,
        // 赛博弹窗状态 (供删除历史等使用)
        showCyberModal: false,
        modalTitle: '',
        modalContent: '',
        modalShowCancel: true,
        modalConfirmText: '确定',
        modalCancelText: '取消',
        modalIsDanger: false,
        modalIsLoading: false
    },
    onLoad() {
        const TRACE_ID = `T-LOAD-${Date.now()}`;
        logger_1.Logger.info(`[${TRACE_ID}] 主游戏页面加载，获取视口大小及初始化`);
        // 1. 获取设备物理视口
        try {
            const sysInfo = wx.getSystemInfoSync();
            this.setData({
                windowWidth: sysInfo.windowWidth,
                windowHeight: sysInfo.windowHeight
            });
        }
        catch (e) {
            logger_1.Logger.error(`[${TRACE_ID}] 获取系统信息失败，启用 375x667 默认视口`, e);
        }
        // 2. 恢复持久化的音频设置
        try {
            const bgm = wx.getStorageSync('sound_bgm_enabled');
            const sfx = wx.getStorageSync('sound_sfx_enabled');
            const bgmEnabled = bgm === '' ? true : bgm; // 首次默认开启
            const sfxEnabled = sfx === '' ? true : sfx;
            this.setData({ bgmEnabled, sfxEnabled });
            soundManager_1.SoundManager.setBgmEnabled(bgmEnabled);
            soundManager_1.SoundManager.setSfxEnabled(sfxEnabled);
        }
        catch (_e) { /* 忽略 */ }
        // 3. 异步拉取云端场景配置并渲染
        this.loadCloudMapConfig(TRACE_ID);
        this.fetchUserStageProgress();
    },
    /**
     * 拉取中国学生进阶关卡各NPC进度与升级状态
     */
    fetchUserStageProgress() {
        return __awaiter(this, void 0, void 0, function* () {
            const app = getApp();
            if (app.globalData.isOfflineMode)
                return;
            try {
                const res = yield (0, request_1.request)({
                    url: '/api/v1/quiz/stages/status',
                    method: 'GET'
                });
                if (res.code === 200 && res.data) {
                    this.setData({
                        userStageProgress: res.data
                    });
                    logger_1.Logger.info(`[StageProgress] 成功拉取关卡状态。当前等级: ${res.data.currentLevel}`);
                    this.updateRenderedNpcList();
                }
            }
            catch (e) {
                logger_1.Logger.error('[StageProgress] 拉取关卡进度失败:', e);
            }
        });
    },
    loadCloudMapConfig(traceId, targetStageId) {
        return __awaiter(this, void 0, void 0, function* () {
            const stageId = targetStageId || this.data.currentStageId;
            try {
                logger_1.Logger.info(`[${traceId}] 发起云端场景 [${stageId}] 配置拉取...`);
                const res = yield (0, request_1.request)({
                    url: `/api/v1/quiz/map-config?stageId=${stageId}`,
                    method: 'GET'
                });
                if (res.code === 200 && res.data) {
                    const { width, height, playerSpawnX, playerSpawnY, obstacles, npcList } = res.data;
                    logger_1.Logger.info(`[${traceId}] 场景 [${stageId}] 配置加载成功: 尺寸 ${width}x${height}`);
                    const spawnX = playerSpawnX !== null && playerSpawnX !== void 0 ? playerSpawnX : 180;
                    const spawnY = playerSpawnY !== null && playerSpawnY !== void 0 ? playerSpawnY : 180;
                    const store = getPrivate(this);
                    if (stageId === 'lobby') {
                        store.lobbyMapWidth = width;
                        store.lobbyMapHeight = height;
                        store.lobbyObstacles = obstacles || [];
                    }
                    this.setData({
                        mapWidth: width,
                        mapHeight: height,
                        playerX: spawnX,
                        playerY: spawnY,
                        playerXRound: Math.round(spawnX),
                        playerYRound: Math.round(spawnY),
                        obstacles: obstacles || [],
                        npcList: npcList || {},
                        currentStageId: stageId
                    });
                    this.updateRenderedNpcList();
                    this.recenterCamera(spawnX, spawnY);
                }
                else {
                    throw new Error(res.message || '返回码非200');
                }
            }
            catch (err) {
                logger_1.Logger.error(`[${traceId}] 场景 [${stageId}] 拉取失败，启用本地容灾降级`, err);
                this.loadLocalMapConfigFallback(stageId);
            }
        });
    },
    /**
     * 仅拉取副本场景的 NPC 列表，不覆盖地图尺寸和玩家坐标
     * 专用于副本间传送：外部已设置好大坐标系，只需刷新 npcList 后渲染
     */
    loadStageNpcList(traceId, targetStageId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info(`[${traceId}] 拉取副本 [${targetStageId}] NPC 列表...`);
                const res = yield (0, request_1.request)({
                    url: `/api/v1/quiz/map-config?stageId=${targetStageId}`,
                    method: 'GET'
                });
                if (res.code === 200 && res.data) {
                    const npcList = res.data.npcList || {};
                    logger_1.Logger.info(`[${traceId}] 副本 [${targetStageId}] NPC 数据加载成功，共 ${Object.keys(npcList).length} 个实体`);
                    // 仅更新 npcList，保留外部已配置的大地图尺寸与玩家坐标
                    this.setData({ npcList }, () => {
                        this.updateRenderedNpcList();
                    });
                }
                else {
                    throw new Error(res.message || '返回码非200');
                }
            }
            catch (err) {
                logger_1.Logger.error(`[${traceId}] 副本 [${targetStageId}] NPC 列表拉取失败，降级空渲染`, err);
                // 拉取失败时降级：直接用空 npcList 渲染（updateRenderedNpcList 会走本地容灾分支）
                this.setData({ npcList: {} }, () => {
                    this.updateRenderedNpcList();
                });
            }
        });
    },
    loadLocalMapConfigFallback(stageId) {
        const store = getPrivate(this);
        if (stageId === 'lobby') {
            const config = npcConfig_1.LOBBY_DEFAULT_CONFIG;
            store.lobbyMapWidth = config.width;
            store.lobbyMapHeight = config.height;
            store.lobbyObstacles = config.obstacles;
            this.setData({
                mapWidth: config.width,
                mapHeight: config.height,
                playerX: config.playerSpawnX,
                playerY: config.playerSpawnY,
                playerXRound: config.playerSpawnX,
                playerYRound: config.playerSpawnY,
                obstacles: config.obstacles,
                npcList: config.npcList,
                currentStageId: stageId
            });
        }
        else if (stageId === 'fun_lobby') {
            const config = npcConfig_1.FUN_LOBBY_DEFAULT_CONFIG;
            this.setData({
                mapWidth: config.width,
                mapHeight: config.height,
                playerX: config.playerSpawnX,
                playerY: config.playerSpawnY,
                playerXRound: config.playerSpawnX,
                playerYRound: config.playerSpawnY,
                obstacles: config.obstacles,
                npcList: config.npcList,
                currentStageId: stageId
            });
        }
        else {
            this.setData({
                obstacles: [],
                npcList: {},
                currentStageId: stageId
            });
        }
        this.updateRenderedNpcList();
        this.recenterCamera(this.data.playerX, this.data.playerY);
    },
    onShow() {
        const TRACE_ID = `T-SHOW-${Date.now()}`;
        logger_1.Logger.info(`[${TRACE_ID}] 进入游戏大厅，刷新角色状态及TabBar`);
        // 1. 释放页面跳转锁
        this.setData({ isTransitioning: false });
        // 3. 载入用户信息、持久化资产简档与历史记录
        this.loadUserProfile(TRACE_ID);
        this.loadUserProfileStats(TRACE_ID);
        this.loadHistoryList(TRACE_ID);
        // 4. 播放小镇背景音乐
        soundManager_1.SoundManager.resumeBgm();
        if (!soundManager_1.SoundManager.currentBgm) {
            soundManager_1.SoundManager.playBgm('town', this.getBgmRateForCurrentStage(false));
        }
    },
    onHide() {
        logger_1.Logger.info('游戏页面隐藏，挂起主物理循环以节省后台电量');
        this.stopGameLoop();
        soundManager_1.SoundManager.pauseBgm();
    },
    onUnload() {
        logger_1.Logger.info('游戏页面销毁，销毁主循环并清空 WeakMap 内存');
        this.stopGameLoop();
        soundManager_1.SoundManager.stopBgm();
        privateStore.delete(this);
    },
    /**
     * 重置摄像机至玩家中心
     */
    recenterCamera(x, y) {
        const { windowWidth, windowHeight, mapWidth, mapHeight } = this.data;
        let cameraX = x + MAP_CONFIG.PLAYER_WIDTH / 2 - windowWidth / 2;
        let cameraY = y + MAP_CONFIG.PLAYER_HEIGHT / 2 - windowHeight / 2;
        if (cameraX < 0)
            cameraX = 0;
        if (cameraX > mapWidth - windowWidth)
            cameraX = mapWidth - windowWidth;
        if (cameraY < 0)
            cameraY = 0;
        if (cameraY > mapHeight - windowHeight)
            cameraY = mapHeight - windowHeight;
        this.setData({ cameraX, cameraY });
    },
    // ==========================================
    // RPG 引擎：虚拟摇杆与碰撞移动核心
    // ==========================================
    onJoystickStart(e) {
        if (this.data.isTransitioning || this.data.showProfileModal || this.data.showNpcDialogue || this.data.showStageSelectorModal)
            return;
        const touch = e.touches[0];
        const store = getPrivate(this);
        const cX = touch.clientX;
        const cY = touch.clientY;
        store.touchId = touch.identifier;
        store.joystickCenterX = cX;
        store.joystickCenterY = cY;
        store.joystickMaxDistance = 50; // 默认物理滑动最大像素半径
        this.setData({
            showJoystick: true,
            joystickX: cX,
            joystickY: cY,
            joystickStickX: 0,
            joystickStickY: 0
        });
        store.vx = 0;
        store.vy = 0;
        this.startGameLoop();
    },
    onJoystickMove(e) {
        const store = getPrivate(this);
        if (store.touchId === null)
            return;
        let touch = null;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === store.touchId) {
                touch = e.touches[i];
                break;
            }
        }
        if (!touch)
            return;
        const dx = touch.clientX - store.joystickCenterX;
        const dy = touch.clientY - store.joystickCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let stickX = dx;
        let stickY = dy;
        const maxDist = store.joystickMaxDistance || 50;
        if (distance > maxDist) {
            stickX = (dx / distance) * maxDist;
            stickY = (dy / distance) * maxDist;
        }
        const dirX = distance > 0 ? dx / distance : 0;
        const dirY = distance > 0 ? dy / distance : 0;
        store.vx = dirX * MAP_CONFIG.PLAYER_SPEED;
        store.vy = dirY * MAP_CONFIG.PLAYER_SPEED;
        let playerDir = this.data.playerDir;
        if (distance > 5) {
            if (Math.abs(dirX) > Math.abs(dirY)) {
                playerDir = dirX > 0 ? 'right' : 'left';
            }
            else {
                playerDir = dirY > 0 ? 'down' : 'up';
            }
        }
        this.setData({
            joystickStickX: stickX,
            joystickStickY: stickY,
            playerDir,
            playerMoving: distance > 5
        });
    },
    onJoystickEnd() {
        const store = getPrivate(this);
        store.touchId = null;
        store.vx = 0;
        store.vy = 0;
        this.setData({
            showJoystick: false,
            joystickStickX: 0,
            joystickStickY: 0,
            playerMoving: false
        });
        this.stopGameLoop();
    },
    isPositionOnRoad(x, y) {
        const { currentStageId, windowWidth, windowHeight, userStageProgress } = this.data;
        if (currentStageId === 'lobby')
            return true;
        const STAGE_ORDERS = {
            'kindergarten_1': 1,
            'kindergarten_2': 2,
            'primary_1': 3,
            'primary_2': 4,
            'primary_3': 5,
            'primary_4': 6,
            'primary_5': 7,
            'primary_6': 8
        };
        const order = STAGE_ORDERS[currentStageId] || 1;
        const currentLevel = (userStageProgress === null || userStageProgress === void 0 ? void 0 : userStageProgress.currentLevel) || 1;
        if (currentLevel > order)
            return true;
        // 检查最终 BOSS 是否已通关
        const route = npcConfig_1.STAGE_ROUTE_CONFIGS[currentStageId];
        if (route) {
            const bossId = route[2];
            const progress = (userStageProgress === null || userStageProgress === void 0 ? void 0 : userStageProgress.progress) || [];
            const isBossPassed = progress.some((p) => p.npcId === bossId && p.passed);
            if (isBossPassed)
                return true;
        }
        const cx = x + MAP_CONFIG.PLAYER_WIDTH / 2;
        const cy = y + MAP_CONFIG.PLAYER_HEIGHT / 2;
        const pointsConfig = {
            spawn: { x: 80, y: 320 },
            npc1: { x: 200, y: 320 },
            npc2: { x: 320, y: 200 },
            boss: { x: 200, y: 80 },
            exit: { x: 80, y: 80 }
        };
        const mapPt = (pt) => {
            return {
                x: (pt.x / 400) * windowWidth,
                y: (pt.y / 400) * windowHeight
            };
        };
        const sp = mapPt(pointsConfig.spawn);
        const snpc1 = mapPt(pointsConfig.npc1);
        const snpc2 = mapPt(pointsConfig.npc2);
        const sboss = mapPt(pointsConfig.boss);
        const sexit = mapPt(pointsConfig.exit);
        const segments = [];
        // 基础常驻路段
        segments.push({ x1: sp.x, y1: sp.y, x2: snpc1.x, y2: snpc1.y });
        segments.push({ x1: sp.x, y1: sp.y, x2: sexit.x, y2: sexit.y });
        // 进度解锁路段
        const progress = (userStageProgress === null || userStageProgress === void 0 ? void 0 : userStageProgress.progress) || [];
        const passedNpcIds = new Set(progress.filter((p) => p.passed).map((p) => p.npcId));
        if (route) {
            if (passedNpcIds.has(route[0])) {
                segments.push({ x1: snpc1.x, y1: snpc1.y, x2: snpc2.x, y2: snpc2.y });
            }
            if (passedNpcIds.has(route[1])) {
                segments.push({ x1: snpc2.x, y1: snpc2.y, x2: sboss.x, y2: sboss.y });
            }
        }
        const ROAD_WIDTH = 50;
        let minD = Infinity;
        for (const seg of segments) {
            const d = getDistanceToSegment(cx, cy, seg.x1, seg.y1, seg.x2, seg.y2);
            if (d < minD) {
                minD = d;
            }
        }
        return minD <= ROAD_WIDTH;
    },
    startGameLoop() {
        const store = getPrivate(this);
        if (store.loopTimer)
            return;
        store.loopTimer = setInterval(() => {
            this.updatePhysics();
        }, MAP_CONFIG.FPS_INTERVAL);
    },
    stopGameLoop() {
        const store = getPrivate(this);
        if (store.loopTimer) {
            clearInterval(store.loopTimer);
            store.loopTimer = null;
        }
    },
    checkMapCollision(x, y) {
        const { renderedNpcList, obstacles } = this.data;
        const playerCX = x + MAP_CONFIG.PLAYER_WIDTH / 2;
        const playerCY = y + MAP_CONFIG.PLAYER_HEIGHT / 2;
        for (const npc of renderedNpcList) {
            const dist = Math.sqrt(Math.pow(playerCX - npc.x, 2) + Math.pow(playerCY - npc.y, 2));
            if (dist < npc.radius + MAP_CONFIG.COLLIDE_RADIUS_ADD) {
                return true;
            }
        }
        for (const obs of obstacles) {
            if (x < obs.x + obs.width &&
                x + MAP_CONFIG.PLAYER_WIDTH > obs.x &&
                y < obs.y + obs.height &&
                y + MAP_CONFIG.PLAYER_HEIGHT > obs.y) {
                return true;
            }
        }
        return false;
    },
    updatePhysics() {
        const store = getPrivate(this);
        if (store.vx === 0 && store.vy === 0)
            return;
        const { playerX, playerY, mapWidth, mapHeight } = this.data;
        let nextX = playerX + store.vx;
        let nextY = playerY + store.vy;
        if (nextX < 0)
            nextX = 0;
        if (nextX > mapWidth - MAP_CONFIG.PLAYER_WIDTH)
            nextX = mapWidth - MAP_CONFIG.PLAYER_WIDTH;
        if (nextY < 0)
            nextY = 0;
        if (nextY > mapHeight - MAP_CONFIG.PLAYER_HEIGHT)
            nextY = mapHeight - MAP_CONFIG.PLAYER_HEIGHT;
        let isCollided = this.checkMapCollision(nextX, nextY);
        if (isCollided) {
            let slideX = playerX + store.vx;
            if (slideX < 0)
                slideX = 0;
            if (slideX > mapWidth - MAP_CONFIG.PLAYER_WIDTH)
                slideX = mapWidth - MAP_CONFIG.PLAYER_WIDTH;
            if (!this.checkMapCollision(slideX, playerY)) {
                nextX = slideX;
                nextY = playerY;
                isCollided = false;
            }
        }
        if (isCollided) {
            let slideY = playerY + store.vy;
            if (slideY < 0)
                slideY = 0;
            if (slideY > mapHeight - MAP_CONFIG.PLAYER_HEIGHT)
                slideY = mapHeight - MAP_CONFIG.PLAYER_HEIGHT;
            if (!this.checkMapCollision(playerX, slideY)) {
                nextX = playerX;
                nextY = slideY;
                isCollided = false;
            }
        }
        if (isCollided) {
            nextX = playerX;
            nextY = playerY;
        }
        if (nextX !== playerX || nextY !== playerY) {
            soundManager_1.SoundManager.play('step');
        }
        this.setData({
            playerX: nextX,
            playerY: nextY,
            playerXRound: Math.round(nextX),
            playerYRound: Math.round(nextY)
        });
        this.recalculateInteraction(nextX, nextY);
    },
    // ==========================================
    // RPG 交互：对话与测评跳转
    // ==========================================
    /**
    /**
     * 点击 A 键触发 NPC 对话
     */
    // File: /Users/zhangjiahao/IdeaProjects/wx-test/wx-client/miniprogram/pages/index/index.ts
    handlePortalInteraction(npcId) {
        if (npcId === 'portal_study' || npcId === 'portal_stone') {
            this.onOpenStageSelector();
            return true;
        }
        if (npcId === 'portal_fun') {
            this.teleportToFunLobby();
            return true;
        }
        if (npcId === 'portal_stone_exit') {
            this.teleportBackToLobby();
            return true;
        }
        if (npcId === 'portal_next_stage') {
            const { currentInteractNpc } = this.data;
            if (currentInteractNpc && currentInteractNpc.nextStageId) {
                this.teleportToNextStage(currentInteractNpc.nextStageId, currentInteractNpc.nextStageName);
            }
            return true;
        }
        return false;
    },
    teleportToNextStage(nextStageId, nextStageName) {
        soundManager_1.SoundManager.play('levelup');
        const { windowWidth, windowHeight } = this.data;
        const mapW = windowWidth * 1.6;
        const mapH = windowHeight * 1.6;
        const targetX = (115 / 400) * mapW;
        const targetY = (320 / 400) * mapH;
        const TRACE_ID = `T-TELEPORT-NEXT-${Date.now()}`;
        logger_1.Logger.info(`[${TRACE_ID}] 玩家通过传送门无缝前往下一关: ${nextStageName}`);
        // 先更新玩家坐标与视口，再从云端拉取新场景完整 NPC 列表
        // 注意：不能在此处调用 updateRenderedNpcList()，因为 this.data.npcList
        //       仍然是上一个场景的数据，按 stageId 过滤后会导致 NPC 为空
        this.setData({
            currentStageId: nextStageId,
            mapWidth: mapW,
            mapHeight: mapH,
            playerX: targetX,
            playerY: targetY,
            playerXRound: Math.round(targetX),
            playerYRound: Math.round(targetY)
        }, () => {
            this.recenterCamera(targetX, targetY);
            // 只拉取 NPC 列表，不覆盖地图尺寸与玩家坐标（避免 loadCloudMapConfig 全量覆盖导致 NPC 消失）
            this.loadStageNpcList(TRACE_ID, nextStageId);
        });
    },
    getBgmRateForCurrentStage(isQuiz = false) {
        const { currentStageId } = this.data;
        if (currentStageId === 'lobby')
            return 1.0;
        if (currentStageId === 'fun_lobby')
            return isQuiz ? 1.1 : 1.15;
        const STAGE_ORDERS = {
            'kindergarten_1': 1, 'kindergarten_2': 2,
            'primary_1': 3, 'primary_2': 4, 'primary_3': 5,
            'primary_4': 6, 'primary_5': 7, 'primary_6': 8
        };
        const order = STAGE_ORDERS[currentStageId] || 1;
        if (isQuiz) {
            if (order <= 2)
                return 1.0;
            if (order <= 5)
                return 0.95;
            return 0.85;
        }
        return 1.1 - (order * 0.03);
    },
    teleportToFunLobby() {
        soundManager_1.SoundManager.play('complete');
        this.setData({
            currentStageId: 'fun_lobby',
            mapWidth: 1200,
            mapHeight: 1200,
            playerX: 600,
            playerY: 600,
            playerXRound: 600,
            playerYRound: 600
        }, () => {
            this.updateRenderedNpcList();
            this.recenterCamera(600, 600);
            logger_1.Logger.info(`[Teleportation] 玩家进入【逍遥测试大厅】`);
        });
    },
    teleportBackToLobby() {
        soundManager_1.SoundManager.play('click');
        const store = getPrivate(this);
        const lobbyW = store.lobbyMapWidth || MAP_CONFIG.WIDTH;
        const lobbyH = store.lobbyMapHeight || MAP_CONFIG.HEIGHT;
        this.setData({
            currentStageId: 'lobby',
            mapWidth: lobbyW,
            mapHeight: lobbyH,
            playerX: 600,
            playerY: 600,
            playerXRound: 600,
            playerYRound: 600
        }, () => {
            this.updateRenderedNpcList();
            this.recenterCamera(600, 600);
            logger_1.Logger.info(`[Teleportation] 玩家从教室副本返回大厅，恢复大厅尺寸: ${lobbyW}x${lobbyH}`);
        });
    },
    checkNpcBlockedByPredecessors(currentInteractNpc) {
        var _a, _b;
        const route = npcConfig_1.STAGE_ROUTE_CONFIGS[currentInteractNpc.stageId];
        if (!route)
            return { isBlocked: false, reason: '' };
        const currentIdx = route.indexOf(currentInteractNpc.id);
        if (currentIdx <= 0)
            return { isBlocked: false, reason: '' };
        const userProgress = ((_a = this.data.userStageProgress) === null || _a === void 0 ? void 0 : _a.progress) || [];
        const passedNpcIds = new Set(userProgress.filter((p) => p.passed).map((p) => p.npcId));
        let firstUnpassedNpcId = '';
        for (let i = 0; i < currentIdx; i++) {
            if (!passedNpcIds.has(route[i])) {
                firstUnpassedNpcId = route[i];
                break;
            }
        }
        if (!firstUnpassedNpcId)
            return { isBlocked: false, reason: '' };
        if (currentIdx === 1) {
            const preNpcName = ((_b = this.data.npcList[firstUnpassedNpcId]) === null || _b === void 0 ? void 0 : _b.name) || '前置老师';
            return { isBlocked: true, reason: `你需要先通过前置考核（${preNpcName}），才能向我发起挑战哦！` };
        }
        if (currentIdx === 2) {
            return { isBlocked: true, reason: `哼，连两位前置老师的考核都没通过，也想挑战本大魔王？快回去完成考核！` };
        }
        return { isBlocked: true, reason: '你需要先完成前置挑战。' };
    },
    calculateCurrentGradeNpcState(npc) {
        var _a;
        const blockCheck = this.checkNpcBlockedByPredecessors(npc);
        if (blockCheck.isBlocked) {
            return { npcStatus: 'locked', dialogue: blockCheck.reason, btnText: '暂未解锁' };
        }
        const npcProgress = (((_a = this.data.userStageProgress) === null || _a === void 0 ? void 0 : _a.progress) || []).find((p) => p.npcId === npc.id);
        if (npcProgress && npcProgress.passed) {
            return {
                npcStatus: 'passed',
                dialogue: `你已经通过了我的这科学期考核！真棒！快去通过这一级其他老师的考核，或者你可以再次挑战温习！`,
                btnText: '再次挑战'
            };
        }
        return { npcStatus: 'todo', dialogue: npc.dialogueText, btnText: '开始挑战' };
    },
    calculateUnfinishedNpcInteraction(npc, userLevel, npcStageOrder) {
        var _a;
        if (npcStageOrder > userLevel) {
            const currentStageName = ((_a = this.data.userStageProgress) === null || _a === void 0 ? void 0 : _a.stageName) || '小班';
            return {
                npcStatus: 'locked',
                dialogue: `这里是${npc.name}负责的考场。你目前在【${currentStageName}】，需要通过前置考核升级后才能来这里挑战哦！`,
                btnText: '暂未解锁'
            };
        }
        if (npcStageOrder < userLevel) {
            return {
                npcStatus: 'passed',
                dialogue: `同学你好！你早就通过了我的考试，升入更高年级啦！想要重新温习一下我的课程题目吗？`,
                btnText: '重新温习'
            };
        }
        return this.calculateCurrentGradeNpcState(npc);
    },
    evaluateNpcDialogueState(npc) {
        var _a;
        const STAGE_ORDERS = {
            'kindergarten_1': 1, 'kindergarten_2': 2,
            'primary_1': 3, 'primary_2': 4, 'primary_3': 5,
            'primary_4': 6, 'primary_5': 7, 'primary_6': 8
        };
        const npcStageOrder = STAGE_ORDERS[npc.stageId] || 1;
        const userLevel = ((_a = this.data.userStageProgress) === null || _a === void 0 ? void 0 : _a.currentLevel) || 1;
        if (userLevel >= 9) {
            return {
                npcStatus: 'passed',
                dialogue: `恭喜你！你已经完成了小学的全部考核，晋升为了传说中的学霸！欢迎重新挑战温习我的课程！`,
                btnText: '再次挑战'
            };
        }
        return this.calculateUnfinishedNpcInteraction(npc, userLevel, npcStageOrder);
    },
    handleNpcInteraction(npc) {
        logger_1.Logger.info(`[Interact] 靠近并与 NPC 交互: ${npc.name}`);
        soundManager_1.SoundManager.play('talk');
        const { npcStatus, dialogue, btnText } = this.evaluateNpcDialogueState(npc);
        this.setData({
            showNpcDialogue: true,
            dialogueText: dialogue,
            dialogueNpcName: npc.name,
            npcInteractStatus: npcStatus,
            npcInteractBtnText: btnText
        });
    },
    onInteract() {
        const { currentInteractNpc, isTransitioning } = this.data;
        if (isTransitioning || !currentInteractNpc)
            return;
        const isPortal = this.handlePortalInteraction(currentInteractNpc.id);
        if (!isPortal) {
            this.handleNpcInteraction(currentInteractNpc);
        }
    },
    /**
     * 确认开始测评
     */
    /**
     * 确认开始测评
     */
    onStartAssessment() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { currentInteractNpc, isTransitioning, submitting, npcInteractStatus } = this.data;
            if (!currentInteractNpc || isTransitioning || submitting)
                return;
            if (npcInteractStatus === 'locked') {
                wx.showToast({ title: '暂未解锁该挑战', icon: 'none' });
                return;
            }
            const TRACE_ID = `T-START-TEST-${Date.now()}`;
            logger_1.Logger.info(`[${TRACE_ID}] 用户在对话中开始评测，NPC: ${currentInteractNpc.name}`);
            this.setData({
                submitting: true,
                showJoystick: false,
                playerMoving: false
            });
            if (currentInteractNpc.stageId === 'fun_lobby') {
                const localQuestions = localQuestions_1.LOCAL_QUIZZES[currentInteractNpc.id];
                if (localQuestions && localQuestions.length > 0) {
                    logger_1.Logger.info(`[StartAssessment] 逍遥大厅本地加载题库, NPC: ${currentInteractNpc.name}`);
                    this.setData({
                        testQuestions: localQuestions,
                        currentQuestionIndex: 0,
                        userAnswers: [],
                        isTesting: true,
                        showTestSummary: false,
                        submitting: false,
                        dialogueText: `第一题：${localQuestions[0].text}`
                    });
                    soundManager_1.SoundManager.playBgm('quiz', this.getBgmRateForCurrentStage(true));
                }
                else {
                    wx.showToast({ title: '本地题库加载异常', icon: 'none' });
                    this.onCloseDialogue();
                }
                return;
            }
            const app = getApp();
            if (app.globalData.isOfflineMode) {
                this.setData({ submitting: false });
                wx.showToast({ title: '知识考核要求在线进行', icon: 'none' });
                this.onCloseDialogue();
                return;
            }
            try {
                const res = yield (0, request_1.request)({
                    url: `/api/v1/quiz/stages/${currentInteractNpc.stageId}/npcs/${currentInteractNpc.id}/questions`,
                    method: 'GET'
                });
                if (res.code === 200 && ((_a = res.data) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                    logger_1.Logger.info(`[${TRACE_ID}] 成功从云端拉取题库数据，数量: ${res.data.length}`);
                    this.setData({
                        testQuestions: res.data,
                        currentQuestionIndex: 0,
                        userAnswers: [],
                        isTesting: true,
                        showTestSummary: false,
                        submitting: false,
                        dialogueText: `第一题：${res.data[0].text}`
                    });
                    soundManager_1.SoundManager.playBgm('quiz', this.getBgmRateForCurrentStage(true));
                }
                else {
                    throw new Error(res.message || '下发题库为空');
                }
            }
            catch (err) {
                logger_1.Logger.error(`[${TRACE_ID}] 从服务器拉取题库失败:`, err);
                this.setData({ submitting: false });
                wx.showToast({ title: '拉取题库失败，请稍后重试', icon: 'none' });
                this.onCloseDialogue();
            }
        });
    },
    /**
     * 点击选项：记录答案并推进
     */
    onSelectOption(e) {
        if (this.data.submitting)
            return;
        const optionId = e.currentTarget.dataset.optionId;
        const { currentQuestionIndex, testQuestions, userAnswers } = this.data;
        const currentQuestion = testQuestions[currentQuestionIndex];
        logger_1.Logger.info(`对话答题: 第 ${currentQuestionIndex + 1} 题, 选中选项: ${optionId}`);
        // 1. 记录答案
        const newAnswers = [...userAnswers];
        newAnswers[currentQuestionIndex] = {
            questionId: currentQuestion.id,
            selectedOptionId: optionId
        };
        this.setData({
            userAnswers: newAnswers
        });
        // 2. 延迟跳转以供玩家视觉反馈
        setTimeout(() => {
            if (currentQuestionIndex < testQuestions.length - 1) {
                const nextIndex = currentQuestionIndex + 1;
                this.setData({
                    currentQuestionIndex: nextIndex,
                    dialogueText: `第${nextIndex + 1}题：${testQuestions[nextIndex].text}`
                });
            }
            else {
                // 最后一题，触发提交
                this.submitDialogueAssessment();
            }
        }, 150);
    },
    /**
     * 提交对话框评测数据
     */
    // File: /Users/zhangjiahao/IdeaProjects/wx-test/wx-client/miniprogram/pages/index/index.ts
    getLocalQuizResultAndSave(npc, answers) {
        const isMbti = npc.id === 'npc_mbti';
        const result = isMbti ? (0, localEvaluator_1.calculateLocalMBTI)(answers) : (0, localEvaluator_1.calculateLocalQuiz)(npc.id, answers);
        logger_1.Logger.info(`[SubmitQuiz] 本地测评分析完毕: ${result.name}`);
        localHistory_1.LocalHistoryService.saveHistory({
            historyId: `local_hist_${Date.now()}`,
            testId: npc.id,
            testTitle: isMbti ? 'MBTI 16型人格自测' : `${npc.name}自测`,
            testType: isMbti ? 'MBTI' : 'QUIZ',
            timestamp: Date.now(),
            resultCode: result.code,
            resultName: result.name,
            rawScores: result.scores || {}
        });
        return result;
    },
    submitLocalAssessment(npc, answers) {
        var _a, _b;
        soundManager_1.SoundManager.play('complete');
        const result = this.getLocalQuizResultAndSave(npc, answers);
        let dialogueFeedback = `测评完成！你获得了【${result.name}】的性格图腾。\n\n【性格解析】：\n${result.description}`;
        if (((_a = result.details) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            dialogueFeedback += `\n\n[核心特质]：\n- ${result.details.join('\n- ')}`;
        }
        if (((_b = result.suggestions) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            dialogueFeedback += `\n\n[专属建议]：\n- ${result.suggestions.join('\n- ')}`;
        }
        const virtualResultData = {
            passed: true,
            percentage: 100,
            score: 100,
            levelUp: false,
            code: result.code,
            name: result.name,
            description: result.description,
            details: result.details || [],
            suggestions: result.suggestions || [],
            dimensions: result.dimensions || []
        };
        this.setData({
            isTesting: false,
            showTestSummary: true,
            submitting: false,
            testResultData: virtualResultData,
            dialogueText: dialogueFeedback
        });
        this.loadLocalHistory(false);
    },
    handleCloudAssessmentSuccess(data) {
        logger_1.Logger.info('[SubmitStage] 提交答题在线校验成功');
        soundManager_1.SoundManager.play('complete');
        const { currentInteractNpc } = this.data;

        // 从后端返回的 score/total 计算正确率
        const percentage = data.total > 0 ? Math.round((data.score / data.total) * 100) : 0;
        const enrichedData = { ...data, percentage };

        if (currentInteractNpc) {
            // 增量设计：将云端测试结果本地持久化，确保同步刷新历史记录
            localHistory_1.LocalHistoryService.saveHistory({
                historyId: data.historyId || `cloud_hist_${Date.now()}`,
                testId: currentInteractNpc.id,
                testTitle: `${currentInteractNpc.name}考核`,
                testType: 'STUDY',
                timestamp: Date.now(),
                resultCode: enrichedData.passed ? 'PASSED' : 'FAILED',
                resultName: enrichedData.passed ? '成绩合格' : '不合格',
                rawScores: data // 把正确率等所有数据保存，用作历史报告回显
            });
            this.loadHistoryList('T-CLOUD-SUBMIT-REFRESH');
        }
        let dialogueFeedback = `考核结束！你的正确率是 ${percentage}%（${data.score}/${data.total}）。`;
        if (enrichedData.passed) {
            dialogueFeedback += `\n\n[通过] 成功通过了本学科测试！`;
            if (enrichedData.levelUp) {
                dialogueFeedback += `\n\n【升学通知】：你已通关当前全部考核，成功升入【${data.nextLevelName}】！你可以从退出传送阵返回大厅，通过传送石碑前往下一关啦！`;
            }
            else {
                dialogueFeedback += `\n本年级还有其他老师的考核在等着你，全部通过即可升学，加油！`;
            }
        }
        else {
            dialogueFeedback += `\n\n很遗憾，正确率未达到合格要求（60%）。继续加油复习，期待你下次来挑战我！`;
        }
        this.setData({
            isTesting: false,
            showTestSummary: true,
            submitting: false,
            testResultData: enrichedData,
            dialogueText: dialogueFeedback
        });
        this.fetchUserStageProgress();
        this.loadUserProfileStats('T-SUBMIT-STAGE');
    },
    submitCloudAssessment(npc, answers) {
        return __awaiter(this, void 0, void 0, function* () {
            this.showCyberModal({
                title: '正在交卷',
                content: '正在将你的答卷上传至小镇学区考试中心...',
                showCancel: false,
                isLoading: true
            });
            try {
                const res = yield (0, request_1.request)({
                    url: `/api/v1/quiz/stages/${npc.stageId}/npcs/${npc.id}/submit`,
                    method: 'POST',
                    data: { answers }
                });
                this.setData({ showCyberModal: false });
                if (res.code === 200) {
                    this.handleCloudAssessmentSuccess(res.data);
                }
                else {
                    throw new Error(res.message);
                }
            }
            catch (err) {
                logger_1.Logger.error('[SubmitStage] 提交发生异常:', err);
                soundManager_1.SoundManager.play('error');
                this.setData({ showCyberModal: false, submitting: false });
                wx.showToast({ title: '提交失败，请检查网络', icon: 'none' });
                this.onCloseDialogue();
            }
        });
    },
    submitDialogueAssessment() {
        return __awaiter(this, void 0, void 0, function* () {
            this.setData({ submitting: true });
            const { currentInteractNpc, userAnswers } = this.data;
            if (!currentInteractNpc)
                return;
            if (currentInteractNpc.stageId === 'fun_lobby') {
                this.submitLocalAssessment(currentInteractNpc, userAnswers);
            }
            else {
                yield this.submitCloudAssessment(currentInteractNpc, userAnswers);
            }
        });
    },
    /**
     * 确认并查看完整心智图腾
     */
    onConfirmResult() {
        const { testResultData } = this.data;
        if (!testResultData)
            return;
        const TRACE_ID = `T-CONFIRM-RESULT-${Date.now()}`;
        logger_1.Logger.info(`[${TRACE_ID}] 确认测评结果并就地弹出分析弹窗`);
        soundManager_1.SoundManager.play('click');
        this.setData({
            testReport: testResultData,
            showResultModal: true
        });
        this.resetDialogueTestState();
    },
    /**
     * 点击背景遮罩防御性拦截
     */
    onOverlayTap() {
        if (this.data.isTesting) {
            return;
        }
        this.onCloseDialogue();
    },
    /**
     * 取消对话气泡
     */
    onCloseDialogue() {
        if (this.data.isTesting && !this.data.showTestSummary) {
            this.showCyberModal({
                title: '放弃本次测试',
                content: '灵魂的拷问正处于中途，确定要中断并放弃本次答题吗？',
                confirmText: '确定放弃',
                cancelText: '继续测试',
                confirm: () => {
                    this.resetDialogueTestState();
                }
            });
        }
        else {
            this.resetDialogueTestState();
        }
    },
    /**
     * 重置对话答题状态
     */
    resetDialogueTestState() {
        this.setData({
            showNpcDialogue: false,
            isTesting: false,
            showTestSummary: false,
            submitting: false,
            testResultData: null
        });
        // 答题结束，切回小镇BGM (速率自适应)
        soundManager_1.SoundManager.playBgm('town', this.getBgmRateForCurrentStage(false));
    },
    /**
     * 关闭大地图心智图腾报告弹窗
     */
    onCloseResultModal() {
        this.setData({
            showResultModal: false,
            testReport: {},
            isSavingPoster: false
        });
    },
    // ==========================================
    // === 海报生成与保存到本地相册 ===
    // ==========================================
    /**
     * 点击「保存海报」- 主入口，负责权限申请与流程编排
     * 防御：重复点击守卫 + 权限拒绝引导 + Canvas 获取失败兜底
     */
    onSavePoster() {
        return __awaiter(this, void 0, void 0, function* () {
            const TRACE_ID = `T-POSTER-${Date.now()}`;
            if (this.data.isSavingPoster) {
                logger_1.Logger.warn(`[${TRACE_ID}] 海报生成中，忽略重复点击`);
                return;
            }
            this.setData({ isSavingPoster: true });
            // 不使用 wx.showLoading，按钮文字已切换为"生成中..."，提供内联反馈
            try {
                // Step 1: 申请相册写入权限
                yield this._requestPhotosAlbumAuth(TRACE_ID);
                // Step 2: 获取离屏 Canvas 节点
                const { canvas, ctx } = yield this._getPosterCanvasNode(TRACE_ID);
                // Step 3: 预下载头像到本地（Canvas drawImage 只支持本地路径）
                const { userProfile } = this.data;
                const localAvatarPath = yield this.downloadAvatar(userProfile.avatarUrl || '');
                const userInfo = {
                    nickname: userProfile.nickname || npcConfig_1.MAP_CONFIG_CONSTANTS.DEFAULT_NICKNAME,
                    avatarPath: localAvatarPath
                };
                // Step 4: 在 Canvas 上绘制海报内容
                yield posterDrawer_1.PosterDrawer.draw(canvas, ctx, this.data.testReport, userInfo, TRACE_ID);
                // Step 5: 导出为临时文件路径
                const tempFilePath = yield this._exportCanvasToFile(canvas, TRACE_ID);
                // Step 5: 保存到本地相册
                yield new Promise((resolve, reject) => {
                    wx.saveImageToPhotosAlbum({
                        filePath: tempFilePath,
                        success: () => {
                            logger_1.Logger.info(`[${TRACE_ID}] 海报已成功保存到相册`);
                            resolve();
                        },
                        fail: (err) => {
                            logger_1.Logger.error(`[${TRACE_ID}] 保存相册失败:`, err);
                            reject(new Error('保存相册失败'));
                        }
                    });
                });
                // 使用风格统一的木质弹窗展示成功提示
                this.showCyberModal({
                    title: '海报已保存',
                    content: '心智图腾海报已成功存入相册，快去分享给好友吧！',
                    showCancel: false,
                    confirmText: '好的'
                });
            }
            catch (err) {
                logger_1.Logger.error(`[${TRACE_ID}] 海报生成失败:`, err);
                if ((err === null || err === void 0 ? void 0 : err.message) === 'AUTH_DENIED') {
                    // 权限被拒：使用木质风弹窗引导用户去设置
                    this.showCyberModal({
                        title: '需要相册权限',
                        content: '请在设置中开启「保存到相册」权限，才能将海报存入您的相册',
                        showCancel: true,
                        confirmText: '去设置',
                        cancelText: '稍后再说',
                        confirm: () => { wx.openSetting({}); }
                    });
                }
                else {
                    // 其他错误：统一木质风提示
                    this.showCyberModal({
                        title: '生成失败',
                        content: (err === null || err === void 0 ? void 0 : err.message) || '海报生成遇到了问题，请稍后重试',
                        showCancel: false,
                        confirmText: '知道了',
                        isDanger: true
                    });
                }
            }
            finally {
                this.setData({ isSavingPoster: false });
            }
        });
    },
    /**
     * [私有] 申请相册写入权限，已授权则直接 resolve
     */
    _requestPhotosAlbumAuth(traceId) {
        return new Promise((resolve, reject) => {
            wx.authorize({
                scope: 'scope.writePhotosAlbum',
                success: () => {
                    logger_1.Logger.info(`[${traceId}] 相册权限已授权`);
                    resolve();
                },
                fail: () => {
                    // 已弹出过权限框被用户拒绝，尝试 getSetting 二次判断
                    wx.getSetting({
                        success: (settingRes) => {
                            if (settingRes.authSetting['scope.writePhotosAlbum']) {
                                resolve();
                            }
                            else {
                                logger_1.Logger.warn(`[${traceId}] 用户拒绝相册权限`);
                                reject(new Error('AUTH_DENIED'));
                            }
                        },
                        fail: () => reject(new Error('AUTH_DENIED'))
                    });
                }
            });
        });
    },
    /**
     * [私有] 通过 SelectorQuery 获取 Canvas 2D 节点
     * 海报宽 375 逻辑px，高 650 逻辑px；scale(dpr) 后坐标均为逻辑px
     */
    _getPosterCanvasNode(traceId) {
        const LOGICAL_W = 375;
        const LOGICAL_H = 650;
        return new Promise((resolve, reject) => {
            const query = wx.createSelectorQuery().in(this);
            query.select('#posterCanvas').fields({ node: true, size: true }, (res) => {
                if (!res || !res.node) {
                    logger_1.Logger.error(`[${traceId}] 无法获取 posterCanvas 节点`);
                    reject(new Error('Canvas 节点获取失败'));
                    return;
                }
                const canvas = res.node;
                const ctx = canvas.getContext('2d');
                const dpr = wx.getWindowInfo().pixelRatio || 2;
                // 物理像素 = 逻辑px * dpr；scale(dpr) 后坐标均为逻辑px
                canvas.width = LOGICAL_W * dpr;
                canvas.height = LOGICAL_H * dpr;
                ctx.scale(dpr, dpr);
                logger_1.Logger.info(`[${traceId}] Canvas 就绪 ${canvas.width}x${canvas.height}px (逻辑 ${LOGICAL_W}x${LOGICAL_H})，dpr=${dpr}`);
                resolve({ canvas, ctx });
            }).exec();
        });
    },
    /**
     * [私有] 导出 Canvas 为临时文件
     */
    _exportCanvasToFile(canvas, traceId) {
        return new Promise((resolve, reject) => {
            wx.canvasToTempFilePath({
                canvas,
                fileType: 'png',
                quality: 1,
                success: (res) => {
                    logger_1.Logger.info(`[${traceId}] Canvas 导出临时文件成功: ${res.tempFilePath}`);
                    resolve(res.tempFilePath);
                },
                fail: (err) => {
                    logger_1.Logger.error(`[${traceId}] Canvas 导出失败:`, err);
                    reject(new Error('图片导出失败'));
                }
            });
        });
    },
    /**
     * [私有] 绘制像素风 RPG 卷轴风格 MBTI 海报
     * 坐标均为逻辑像素 (375 x 650 逻辑px)
     */
    // _drawPosterOnCanvas 已拆分并迁移至 PosterDrawer 类中
    /**
     * 点击地图上的玩家角色或头像，展示个人属性与档案
     */
    onOpenProfile() {
        if (this.data.isTransitioning)
            return;
        logger_1.Logger.info('[Profile] 打开个人属性与档案数据面板');
        this.setData({
            showProfileModal: true
        });
    },
    onCloseProfile() {
        this.setData({
            showProfileModal: false
        });
    },
    // ==========================================
    // 个人中心逻辑（整合迁移自原 mine 页面）
    // ==========================================
    loadUserProfile(traceId) {
        try {
            const cachedProfile = wx.getStorageSync(npcConfig_1.MAP_CONFIG_CONSTANTS.PROFILE_CACHE_KEY);
            const avatarUrl = cachedProfile ? (cachedProfile.avatarUrl || '/static/default_avatar.png') : '/static/default_avatar.png';
            if (cachedProfile) {
                this.setData({
                    userProfile: {
                        nickname: cachedProfile.nickname || npcConfig_1.MAP_CONFIG_CONSTANTS.DEFAULT_NICKNAME,
                        avatarUrl
                    }
                });
                logger_1.Logger.info(`[${traceId}] 成功加载本地缓存的用户头像昵称`);
            }
            // 异步下载并提取头像的像素特征色彩
            this.downloadAvatar(avatarUrl).then((localPath) => {
                this.analyzeAvatarColors(localPath);
            });
        }
        catch (e) {
            logger_1.Logger.error(`[${traceId}] 读取本地用户信息缓存异常:`, e);
        }
    },
    loadUserProfileStats(traceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const app = getApp();
            if (app.globalData.isOfflineMode) {
                return;
            }
            try {
                const res = yield (0, request_1.request)({
                    url: '/api/v1/user/profile',
                    method: 'GET'
                });
                if (res.success && res.data) {
                    const { nickname, avatarUrl } = res.data;
                    this.setData({
                        'userProfile.nickname': nickname || this.data.userProfile.nickname,
                        'userProfile.avatarUrl': avatarUrl || this.data.userProfile.avatarUrl
                    });
                    // 同步更新本地缓存，后续加载无需重复请求
                    wx.setStorageSync(npcConfig_1.MAP_CONFIG_CONSTANTS.PROFILE_CACHE_KEY, {
                        nickname: nickname || this.data.userProfile.nickname,
                        avatarUrl: avatarUrl || this.data.userProfile.avatarUrl
                    });
                    logger_1.Logger.info(`[${traceId}] 已从云端同步用户昵称/头像: ${nickname}`);
                }
            }
            catch (e) {
                logger_1.Logger.error(`[${traceId}] 获取云端用户信息失败，保留本地缓存:`, e);
            }
        });
    },
    onChooseAvatar(e) {
        const { avatarUrl } = e.detail;
        logger_1.Logger.info(`[Profile] 用户授权选择新头像: ${avatarUrl}`);
        if (!avatarUrl)
            return;
        const userProfile = Object.assign(Object.assign({}, this.data.userProfile), { avatarUrl });
        this.setData({ userProfile });
        try {
            wx.setStorageSync(npcConfig_1.MAP_CONFIG_CONSTANTS.PROFILE_CACHE_KEY, userProfile);
            logger_1.Logger.info('[Profile] 头像缓存更新写入成功');
        }
        catch (err) {
            logger_1.Logger.error('[Profile] 头像缓存更新写入异常:', err);
        }
        // 异步下载并重绘新头像的像素形象配色
        this.downloadAvatar(avatarUrl).then((localPath) => {
            this.analyzeAvatarColors(localPath);
        });
    },
    onNicknameTap() {
        logger_1.Logger.info('[Profile] 开启昵称聚焦编辑态');
        this.setData({
            isEditingNickname: true
        }, () => {
            setTimeout(() => {
                this.setData({
                    nicknameFocus: true
                });
            }, 50);
        });
    },
    onNicknameInput(e) {
        const { value } = e.detail;
        const store = getPrivate(this);
        store.tempNickname = value;
    },
    onNicknameBlur(e) {
        this.saveNickname(e.detail.value);
    },
    onNicknameConfirm(e) {
        this.saveNickname(e.detail.value);
    },
    saveNickname(rawNickname) {
        if (!this.data.isEditingNickname)
            return;
        const TRACE_ID = `T-NICK-${Date.now()}`;
        const store = getPrivate(this);
        const nickname = (store.tempNickname || rawNickname || '').trim();
        const finalNickname = nickname.length > 0 ? nickname : npcConfig_1.MAP_CONFIG_CONSTANTS.DEFAULT_NICKNAME;
        logger_1.Logger.info(`[${TRACE_ID}] 昵称极速熔断保存决策，最终决定值: "${finalNickname}"`);
        store.tempNickname = '';
        const userProfile = Object.assign(Object.assign({}, this.data.userProfile), { nickname: finalNickname });
        this.setData({
            userProfile,
            isEditingNickname: false,
            nicknameFocus: false
        });
        try {
            wx.setStorageSync(npcConfig_1.MAP_CONFIG_CONSTANTS.PROFILE_CACHE_KEY, userProfile);
            logger_1.Logger.info(`[${TRACE_ID}] 昵称持久化保存成功`);
        }
        catch (err) {
            logger_1.Logger.error(`[${TRACE_ID}] 昵称持久化写入失败:`, err);
        }
    },
    loadHistoryList(traceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const app = getApp();
            const isOffline = app.globalData.isOfflineMode;
            this.setData({ isOffline });
            if (isOffline) {
                logger_1.Logger.warn(`[${traceId}] 离线单机模式加载本地历史记录并本地算分`);
                this.loadLocalHistory(true);
                return;
            }
            try {
                const res = yield (0, request_1.request)({
                    url: '/api/v1/quiz/test-history',
                    method: 'GET'
                });
                if (res.code === 200) {
                    const cloudList = res.data || [];
                    const localList = localHistory_1.LocalHistoryService.getHistoryList();
                    const mergedMap = new Map();
                    localList.forEach(item => {
                        if (item.historyId)
                            mergedMap.set(item.historyId, item);
                    });
                    cloudList.forEach(item => {
                        if (item.historyId)
                            mergedMap.set(item.historyId, item);
                    });
                    let mergedList = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
                    if (mergedList.length > 50) {
                        mergedList = mergedList.slice(0, 50);
                    }
                    try {
                        wx.setStorageSync('local_test_history', mergedList);
                    }
                    catch (e) {
                        logger_1.Logger.error('同步合并历史记录至 Storage 失败:', e);
                    }
                    const formattedList = mergedList.map(item => (Object.assign(Object.assign({}, item), { formattedTime: this.formatTime(item.timestamp) })));
                    const funHistoryList = formattedList.filter(item => isFunHistoryItem(item));
                    const studyHistoryList = formattedList.filter(item => !isFunHistoryItem(item));
                    this.setData({
                        historyList: formattedList,
                        funHistoryList,
                        studyHistoryList
                    });
                }
                else {
                    throw new Error(res.message);
                }
            }
            catch (err) {
                logger_1.Logger.error(`[${traceId}] 获取网络云端历史失败，降级本地存储并本地算分:`, err);
                this.loadLocalHistory(true);
            }
        });
    },
    loadLocalHistory(shouldCalculateStats = false) {
        const list = localHistory_1.LocalHistoryService.getHistoryList();
        const formattedList = list.map(item => (Object.assign(Object.assign({}, item), { formattedTime: this.formatTime(item.timestamp) })));
        const funHistoryList = formattedList.filter(item => isFunHistoryItem(item));
        const studyHistoryList = formattedList.filter(item => !isFunHistoryItem(item));
        this.setData({
            historyList: formattedList,
            funHistoryList,
            studyHistoryList
        }, () => {
            if (shouldCalculateStats) {
                this.calculateStats(formattedList);
            }
        });
    },
    onSwitchHistoryTab(e) {
        const tab = e.currentTarget.dataset.tab;
        if (tab === this.data.activeHistoryTab)
            return;
        soundManager_1.SoundManager.play('click');
        this.setData({
            activeHistoryTab: tab
        });
    },
    calculateStats(list) {
        const totalCount = list.length;
        // 统计做过的不同试题类型个数
        const uniqueTestIds = new Set(list.map(item => item.testId).filter(Boolean));
        const differentCount = uniqueTestIds.size;
        // 加权 EXP 积分公式：广度 70，深度 30
        const exp = differentCount * 70 + totalCount * 30;
        // 等级台阶：100 EXP 升一级
        const level = Math.floor(exp / 100) + 1;
        const progressPercent = exp % 100;
        // 阶梯村民称号
        let title = '小镇新手';
        if (level === 2)
            title = '心智探索生';
        else if (level === 3)
            title = '资深村民';
        else if (level === 4)
            title = '性格分析家';
        else if (level === 5)
            title = '荣格织梦人';
        else if (level >= 6)
            title = '心智大宗师';
        logger_1.Logger.info(`[LevelSystem] 等级刷新：广度 ${differentCount} 种, 深度 ${totalCount} 次, EXP ${exp}, 等级 LV.${level} (${title}), 进度 ${progressPercent}%`);
        this.setData({
            stats: {
                completedCount: totalCount,
                differentCount,
                exp,
                level,
                title,
                progressPercent
            }
        });
    },
    onViewDetail(e) {
        return __awaiter(this, void 0, void 0, function* () {
            const historyId = e.currentTarget.dataset.id;
            const TRACE_ID = `T-DETAIL-${Date.now()}`;
            logger_1.Logger.info(`[${TRACE_ID}] 查看历史报告, 记录ID: ${historyId}`);
            this.setData({
                showProfileModal: false // 关掉个人属性面板，防止层叠
            });
            // 增量设计：根据历史记录类型动态显示等待加载框文案
            const localList = localHistory_1.LocalHistoryService.getHistoryList();
            const localItem = localList.find(item => item.historyId === historyId);
            const isFun = localItem ? isFunHistoryItem(localItem) : true;
            this.showCyberModal({
                title: isFun ? '召唤人格图腾' : '读取历史报告',
                content: isFun ? '正在从云端找回您的人格画像...' : '正在从云端调取您的测试报告...',
                showCancel: false,
                isLoading: true
            });
            const app = getApp();
            if (app.globalData.isOfflineMode) {
                this.restoreReportLocally(historyId, TRACE_ID);
                return;
            }
            try {
                const res = yield (0, request_1.request)({
                    url: `/api/v1/quiz/test-history/${historyId}`,
                    method: 'GET'
                });
                this.setData({ showCyberModal: false });
                if (res.code === 200) {
                    this.setData({
                        testReport: res.data,
                        showResultModal: true
                    });
                }
                else {
                    throw new Error(res.message);
                }
            }
            catch (err) {
                logger_1.Logger.error(`[${TRACE_ID}] 在线拉取历史报告详情失败，尝试本地缓存降级恢复:`, err);
                this.restoreReportLocally(historyId, TRACE_ID);
            }
        });
    },
    /**
     * 离线降级状态下从本地持久化列表中恢复测评报告
     */
    restoreReportLocally(historyId, traceId) {
        const localList = localHistory_1.LocalHistoryService.getHistoryList();
        const historyItem = localList.find(item => item.historyId === historyId);
        if (!historyItem) {
            this.setData({ showCyberModal: false });
            logger_1.Logger.error(`[${traceId}] 本地未检索到该历史记录 ID: ${historyId}`);
            wx.showToast({ title: '未找到该测评历史记录', icon: 'none' });
            return;
        }
        // 增量设计：若非逍遥自测（即学徒之门历史），直接渲染云端备份的成绩单
        if (!isFunHistoryItem(historyItem)) {
            this.setData({ showCyberModal: false });
            this.setData({
                testReport: historyItem.rawScores,
                showResultModal: true
            });
            return;
        }
        try {
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
            const localResult = (0, localEvaluator_1.calculateLocalMBTI)([]);
            localResult.dimensions = dimensions;
            localResult.code = historyItem.resultCode;
            localResult.name = historyItem.resultName;
            this.setData({ showCyberModal: false });
            this.setData({
                testReport: localResult,
                showResultModal: true
            });
        }
        catch (e) {
            this.setData({ showCyberModal: false });
            logger_1.Logger.error(`[${traceId}] 降级本地还原异常，历史文件可能损坏:`, e);
            wx.showToast({ title: '报告解析损坏', icon: 'none' });
        }
    },
    onDeleteHistory(e) {
        const historyId = e.currentTarget.dataset.id;
        logger_1.Logger.info(`[History] 触发删除历史记录 ID: ${historyId}`);
        this.showCyberModal({
            title: '擦除人格档案',
            content: '确定要擦除该次评估档案吗？删除后在当前设备将无法复原。',
            isDanger: true,
            confirm: () => __awaiter(this, void 0, void 0, function* () {
                this.showCyberModal({
                    title: '清除中',
                    content: '正在抹除云端同步历史记录...',
                    showCancel: false,
                    isDanger: true,
                    isLoading: true
                });
                if (this.data.isOffline) {
                    localHistory_1.LocalHistoryService.deleteHistory(historyId);
                    this.loadLocalHistory();
                    this.setData({ showCyberModal: false });
                    wx.showToast({ title: '抹除成功', icon: 'success' });
                }
                else {
                    try {
                        const delRes = yield (0, request_1.request)({
                            url: `/api/v1/quiz/test-history/${historyId}`,
                            method: 'DELETE'
                        });
                        this.setData({ showCyberModal: false });
                        if (delRes.code === 200) {
                            wx.showToast({ title: '抹除成功', icon: 'success' });
                            this.loadHistoryList(`T-DEL-${Date.now()}`);
                        }
                        else {
                            throw new Error(delRes.message);
                        }
                    }
                    catch (err) {
                        logger_1.Logger.error('[History] 云端抹除失败，降级本地清除:', err);
                        localHistory_1.LocalHistoryService.deleteHistory(historyId);
                        this.loadLocalHistory();
                        this.setData({ showCyberModal: false });
                        wx.showToast({ title: '本地抹除成功', icon: 'none' });
                    }
                }
            })
        });
    },
    // ==========================================
    // 通用赛博弹窗封装方法
    // ==========================================
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
    onCyberModalConfirm() {
        this.setData({ showCyberModal: false });
        const store = getPrivate(this);
        if (store.confirmCallback) {
            store.confirmCallback();
            store.confirmCallback = null;
        }
    },
    onCyberModalCancel() {
        this.setData({ showCyberModal: false });
        const store = getPrivate(this);
        if (store.cancelCallback) {
            store.cancelCallback();
            store.cancelCallback = null;
        }
    },
    preventTouchMove() {
        // 阻止模态穿透
    },
    onToggleMinimapDetail() {
        const traceId = `T-MINIMAP-${Date.now()}`;
        const nextState = !this.data.showMinimapDetail;
        logger_1.Logger.info(`[${traceId}] 用户点击缩略图，切换详细坐标显示状态为: ${nextState}`);
        this.setData({
            showMinimapDetail: nextState
        });
    },
    // ==========================================
    // 音频控制面板
    // ==========================================
    /** 展开/收起音频面板 */
    onToggleSoundPanel() {
        soundManager_1.SoundManager.play('click');
        this.setData({ showSoundPanel: !this.data.showSoundPanel });
    },
    /** 切换背景音乐 */
    onToggleBgm() {
        const next = !this.data.bgmEnabled;
        this.setData({ bgmEnabled: next });
        soundManager_1.SoundManager.setBgmEnabled(next);
        if (next) {
            soundManager_1.SoundManager.playBgm('town');
        }
        // 持久化到本地
        try {
            wx.setStorageSync('sound_bgm_enabled', next);
        }
        catch (_e) { /* 忽略 */ }
        soundManager_1.SoundManager.play('click');
    },
    /** 切换游戏音效 */
    onToggleSfx() {
        const next = !this.data.sfxEnabled;
        this.setData({ sfxEnabled: next });
        soundManager_1.SoundManager.setSfxEnabled(next);
        // 持久化到本地
        try {
            wx.setStorageSync('sound_sfx_enabled', next);
        }
        catch (_e) { /* 忽略 */ }
        // 切换后播放一声反馈（如果刚开启的话）
        if (next)
            soundManager_1.SoundManager.play('click');
    },
    updateRenderedNpcList() {
        var _a, _b;
        const { currentStageId, npcList, windowWidth, windowHeight } = this.data;
        let rendered = [];
        const store = getPrivate(this);
        if (currentStageId === 'lobby') {
            // 大厅：渲染两个功能传送门
            // 「学途之门」——九年义务教育关卡入口，位于地图左侧中部
            // 「逍遥之门」——娱乐休闲区入口，位于地图右侧中部
            rendered = [
                {
                    id: 'portal_study',
                    name: '学途之门',
                    x: 300,
                    y: 540,
                    stageId: 'lobby',
                    npcType: 'portal_study',
                    dialogueText: '踏入【学途之门】，开启九年义务教育的知识副本旅程！',
                    avatarSvg: npcConfig_1.PORTAL_DEFAULT_SVGS.study,
                    radius: 40
                },
                {
                    id: 'portal_fun',
                    name: '逍遥之门',
                    x: 900,
                    y: 540,
                    stageId: 'lobby',
                    npcType: 'portal_fun',
                    dialogueText: '踏入【逍遥之门】，进入轻松愉快的娱乐休闲小天地！',
                    avatarSvg: npcConfig_1.PORTAL_DEFAULT_SVGS.fun,
                    radius: 40
                }
            ];
            this.setData({
                renderedNpcList: rendered,
                roomBricks: [],
                roomWalls: [],
                blockerGates: [],
                obstacles: store.lobbyObstacles || []
            }, () => {
                soundManager_1.SoundManager.playBgm('town', this.getBgmRateForCurrentStage(false));
                this.recalculateInteraction(this.data.playerX, this.data.playerY);
            });
        }
        else if (currentStageId === 'fun_lobby') {
            rendered = [
                {
                    id: 'portal_stone_exit',
                    name: '返回大厅',
                    x: 80,
                    y: 80,
                    stageId: 'fun_lobby',
                    npcType: 'portal_exit',
                    dialogueText: '触摸传送阵，返回鹈鹕镇大厅。',
                    avatarSvg: npcConfig_1.PORTAL_DEFAULT_SVGS.exit,
                    radius: 35
                },
                {
                    id: 'npc_mbti',
                    name: 'MBTI 迈尔斯',
                    x: 350,
                    y: 450,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '欢迎！我是MBTI性格测试导师。你想探索自己的16种人格（如INTJ/ENFP）并获得职业规划建议吗？',
                    avatarSvg: SPRITE_SVGS.npc.mbti,
                    radius: 30
                },
                {
                    id: 'npc_bigfive',
                    name: '大五人格研究员',
                    x: 350,
                    y: 600,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '你好！大五人格测试从开放性、尽责性等5个学术维度量化你的性格，这是科学界最认可的模型哦！',
                    avatarSvg: SPRITE_SVGS.npc.bigfive,
                    radius: 30
                },
                {
                    id: 'npc_enneagram',
                    name: '九型人格隐士',
                    x: 350,
                    y: 750,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '行者，探寻你的动机与恐惧吧。九型人格将指引你洞察内心的根本欲望与避难所。',
                    avatarSvg: SPRITE_SVGS.npc.enneagram,
                    radius: 30
                },
                {
                    id: 'npc_disc',
                    name: 'DISC 顾问 · 特里',
                    x: 550,
                    y: 450,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '哈啰！想快速了解你的职场沟通和支配、影响、稳健、谨慎行为倾向吗？来做DISC自测吧！',
                    avatarSvg: SPRITE_SVGS.npc.disc,
                    radius: 30
                },
                {
                    id: 'npc_holland',
                    name: '霍兰德规划师',
                    x: 550,
                    y: 750,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '专业选择纠结？岗位不匹配？霍兰德职业兴趣测试（RIASEC）将精准勾勒你的职业兴趣偏好！',
                    avatarSvg: SPRITE_SVGS.npc.holland,
                    radius: 30
                },
                {
                    id: 'npc_gallup',
                    name: '优势教练 · 克利夫顿',
                    x: 750,
                    y: 450,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '别再死盯着缺点了！盖洛普优势识别会发掘你的核心天赋主题（执行、思考、关系、影响），把木桶长板发挥到极致！',
                    avatarSvg: SPRITE_SVGS.npc.gallup,
                    radius: 30
                },
                {
                    id: 'npc_belbin',
                    name: '贝尔宾协调官',
                    x: 750,
                    y: 750,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '没有完美的个人，只有完美的团队。Belbin团队角色评估将找出你在项目小组中最匹配的角色！',
                    avatarSvg: SPRITE_SVGS.npc.belbin,
                    radius: 30
                },
                {
                    id: 'npc_color',
                    name: '色彩性格大师',
                    x: 950,
                    y: 450,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '红色的热情，蓝色的理性，黄色的掌控，绿色的和平——你想知道自己最本质的性格色彩是什么吗？',
                    avatarSvg: SPRITE_SVGS.npc.color,
                    radius: 30
                },
                {
                    id: 'npc_harry',
                    name: '分院帽助手',
                    x: 950,
                    y: 600,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '霍格沃茨开学啦！格兰芬多的勇敢，斯莱特林的野心，拉文克劳的聪慧，赫奇帕奇的忠诚，你属于哪个学院？',
                    avatarSvg: SPRITE_SVGS.npc.harry,
                    radius: 30
                },
                {
                    id: 'npc_mmpi',
                    name: 'MMPI 临床专家',
                    x: 950,
                    y: 750,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '你好。MMPI是专业的精神状态多项自测。让我们静下心来，对你的压力、焦虑、低落倾向进行一次心智体检。',
                    avatarSvg: SPRITE_SVGS.npc.mmpi,
                    radius: 30
                },
                {
                    id: 'npc_rorschach',
                    name: '罗夏分析师',
                    x: 600,
                    y: 320,
                    stageId: 'fun_lobby',
                    npcType: 'general',
                    dialogueText: '凝视这些对称的神秘墨迹图形。说出你的第一潜意识直觉，我将为你剖析你内心最隐秘的人格阴影。',
                    avatarSvg: SPRITE_SVGS.npc.rorschach,
                    radius: 30
                }
            ];
            this.setData({
                renderedNpcList: rendered,
                roomBricks: [],
                roomWalls: [],
                blockerGates: [],
                obstacles: []
            }, () => {
                soundManager_1.SoundManager.playBgm('town', this.getBgmRateForCurrentStage(false));
                this.recalculateInteraction(this.data.playerX, this.data.playerY);
            });
        }
        else {
            const stageNpcs = Object.values(npcList || {}).filter((npc) => npc.stageId === currentStageId && npc.id !== 'portal_stone_exit');
            const route = npcConfig_1.STAGE_ROUTE_CONFIGS[currentStageId];
            const progress = ((_a = this.data.userStageProgress) === null || _a === void 0 ? void 0 : _a.progress) || [];
            const passedNpcIds = new Set(progress.filter((p) => p.passed).map((p) => p.npcId));
            // 判定当前关卡 BOSS 是否通关
            const STAGE_ORDERS = {
                'kindergarten_1': 1,
                'kindergarten_2': 2,
                'primary_1': 3,
                'primary_2': 4,
                'primary_3': 5,
                'primary_4': 6,
                'primary_5': 7,
                'primary_6': 8
            };
            const order = STAGE_ORDERS[currentStageId] || 1;
            const currentLevel = ((_b = this.data.userStageProgress) === null || _b === void 0 ? void 0 : _b.currentLevel) || 1;
            const isBossPassed = route ? (passedNpcIds.has(route[2]) || currentLevel > order) : false;
            // 副本大地图尺寸为 1.6 倍视口大小
            const mapW = windowWidth * 1.6;
            const mapH = windowHeight * 1.6;
            const mapPt = (pt) => {
                return {
                    x: (pt.x / 400) * mapW,
                    y: (pt.y / 400) * mapH
                };
            };
            // 1. 如果已通关：清空全部走廊砖墙、通关栅栏，并在 (80, 80) 渲染回大厅的传送阵，玩家可随意移动
            if (isBossPassed) {
                rendered = stageNpcs.map((npc) => {
                    return Object.assign(Object.assign({}, npc), { x: (npc.x / 400) * mapW, y: (npc.y / 400) * mapH });
                });
                // 出现回大厅传送阵，其微缩坐标是 (80, 80)，等比映射到实际大地图
                const exitPt = mapPt({ x: 80, y: 80 });
                rendered.push({
                    id: 'portal_stone_exit',
                    name: '回大厅传送阵',
                    x: exitPt.x,
                    y: exitPt.y,
                    stageId: currentStageId,
                    npcType: 'portal_exit',
                    dialogueText: '触摸传送阵，即可返回鹈鹕镇学堂大厅。',
                    avatarSvg: npcConfig_1.PORTAL_DEFAULT_SVGS.exit,
                    radius: 35
                });
                // 增量设计：若还存在更高级的后续关卡，在 (320, 80) 处渲染无缝前往下一级的传送门
                const currentIdx = STAGE_CONFIGS_META.findIndex(s => s.id === currentStageId);
                if (currentIdx !== -1 && currentIdx < STAGE_CONFIGS_META.length - 1) {
                    const nextStage = STAGE_CONFIGS_META[currentIdx + 1];
                    const nextPt = mapPt({ x: 320, y: 80 });
                    rendered.push({
                        id: 'portal_next_stage',
                        name: `下一关：${nextStage.name}`,
                        x: nextPt.x,
                        y: nextPt.y,
                        stageId: currentStageId,
                        npcType: 'portal_next',
                        dialogueText: `触摸传送阵，即可直接前往【${nextStage.name}】！`,
                        avatarSvg: npcConfig_1.PORTAL_DEFAULT_SVGS.study,
                        radius: 35,
                        nextStageId: nextStage.id,
                        nextStageName: nextStage.name
                    });
                }
                this.setData({
                    renderedNpcList: rendered,
                    roomBricks: [],
                    roomWalls: [],
                    blockerGates: [],
                    obstacles: [] // 彻底移除全部阻碍物，全图开阔自由行走
                }, () => {
                    soundManager_1.SoundManager.playBgm('town', this.getBgmRateForCurrentStage(false));
                    this.recalculateInteraction(this.data.playerX, this.data.playerY);
                });
                return;
            }
            // 2. 未通关：渲染 NPC，不显示任何路径提示或物理限制
            // 渲染大关副本中的 NPC（等比映射大地图坐标）
            rendered = stageNpcs.map((npc) => {
                return Object.assign(Object.assign({}, npc), { x: (npc.x / 400) * mapW, y: (npc.y / 400) * mapH });
            });
            this.setData({
                renderedNpcList: rendered,
                roomBricks: [], // 不显示路径地砖
                roomWalls: [], // 不显示围墙砖块
                blockerGates: [], // 不显示阻断栅栏
                obstacles: [] // 不设置任何物理障碍
            }, () => {
                soundManager_1.SoundManager.playBgm('town', this.getBgmRateForCurrentStage(false));
                this.recalculateInteraction(this.data.playerX, this.data.playerY);
            });
        }
    },
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d} ${hh}:${mm}`;
    },
    downloadAvatar(avatarUrl) {
        return new Promise((resolve) => {
            if (!avatarUrl || avatarUrl.startsWith('/assets') || avatarUrl.startsWith('assets')) {
                resolve('/static/default_avatar.png');
                return;
            }
            if (avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('http://tmp/')) {
                resolve(avatarUrl);
                return;
            }
            logger_1.Logger.info(`[AvatarDownload] 发起网络头像下载: ${avatarUrl}`);
            wx.downloadFile({
                url: avatarUrl,
                success: (res) => {
                    if (res.statusCode === 200) {
                        resolve(res.tempFilePath);
                    }
                    else {
                        resolve('/static/default_avatar.png');
                    }
                },
                fail: (err) => {
                    logger_1.Logger.warn('[AvatarDownload] 头像下载异常，启用默认头像', err);
                    resolve('/static/default_avatar.png');
                }
            });
        });
    },
    // File: /Users/zhangjiahao/IdeaProjects/wx-test/wx-client/miniprogram/pages/index/index.ts
    analyzeAvatarColors(localAvatarPath) {
        const query = wx.createSelectorQuery();
        query.select('#colorCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
            if (!res[0] || !res[0].node) {
                logger_1.Logger.warn('[ColorExtractor] 未找到 colorCanvas 离屏分析画布，跳过颜色重绘');
                return;
            }
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            canvas.width = 8;
            canvas.height = 8;
            const img = canvas.createImage();
            img.src = localAvatarPath;
            img.onload = () => {
                try {
                    ctx.drawImage(img, 0, 0, 8, 8);
                    const imgData = ctx.getImageData(0, 0, 8, 8).data;
                    const extractedColors = avatarColorExtractor_1.AvatarColorExtractor.extract(imgData);
                    logger_1.Logger.info(`[ColorExtractor] 头像像素特征重绘成功`);
                    this.setData({
                        playerSvgs: getDynamicPlayerSvgs(extractedColors)
                    });
                }
                catch (err) {
                    logger_1.Logger.error('[ColorExtractor] 图像色彩处理异常，使用默认配色:', err);
                    this.setData({
                        playerSvgs: getDynamicPlayerSvgs(avatarColorExtractor_1.AvatarColorExtractor.DEFAULT_PLAYER_COLORS)
                    });
                }
            };
            img.onerror = (err) => {
                logger_1.Logger.error('[ColorExtractor] 离屏图像加载失败，降级默认配色:', err);
                this.setData({
                    playerSvgs: getDynamicPlayerSvgs(avatarColorExtractor_1.AvatarColorExtractor.DEFAULT_PLAYER_COLORS)
                });
            };
        });
    },
    // ==========================================
    // 单机 NPC 交互计算服务
    // ==========================================
    recalculateInteraction(nextX, nextY) {
        const { renderedNpcList, windowWidth, windowHeight, mapWidth, mapHeight } = this.data;
        let cameraX = nextX + MAP_CONFIG.PLAYER_WIDTH / 2 - windowWidth / 2;
        let cameraY = nextY + MAP_CONFIG.PLAYER_HEIGHT / 2 - windowHeight / 2;
        if (cameraX < 0)
            cameraX = 0;
        if (cameraX > mapWidth - windowWidth)
            cameraX = mapWidth - windowWidth;
        if (cameraY < 0)
            cameraY = 0;
        if (cameraY > mapHeight - windowHeight)
            cameraY = mapHeight - windowHeight;
        let activeNpcId = '';
        let showInteractBtn = false;
        let currentInteractNpc = null;
        const finalCX = nextX + MAP_CONFIG.PLAYER_WIDTH / 2;
        const finalCY = nextY + MAP_CONFIG.PLAYER_HEIGHT / 2;
        let minDistance = MAP_CONFIG.INTERACT_RADIUS;
        for (const npc of renderedNpcList || []) {
            const dist = Math.sqrt(Math.pow(finalCX - npc.x, 2) + Math.pow(finalCY - npc.y, 2));
            if (dist <= minDistance) {
                minDistance = dist;
                activeNpcId = npc.id;
                showInteractBtn = true;
                currentInteractNpc = npc;
            }
        }
        this.setData({
            playerX: nextX,
            playerY: nextY,
            playerXRound: Math.round(nextX),
            playerYRound: Math.round(nextY),
            cameraX,
            cameraY,
            activeNpcId,
            showInteractBtn,
            currentInteractNpc
        });
    },
    // ==========================================
    // 关卡传送与教室副本状态流转服务
    // ==========================================
    // 已物理删除冗余的 updateRenderedNpcListOld_toBeDeleted
    onOpenStageSelector() {
        var _a;
        soundManager_1.SoundManager.play('select');
        const userLevel = ((_a = this.data.userStageProgress) === null || _a === void 0 ? void 0 : _a.currentLevel) || 1;
        const selectorList = STAGE_CONFIGS_META.map(stage => {
            let status = 'locked';
            let statusText = '未解锁';
            let actionText = '无法进入';
            if (stage.order < userLevel) {
                status = 'completed';
                statusText = '已通关';
                actionText = '进入温习';
            }
            else if (stage.order === userLevel) {
                status = 'current';
                statusText = '待通关';
                actionText = '进入挑战';
            }
            else {
                status = 'locked';
                statusText = '未解锁';
                actionText = '无法进入';
            }
            return {
                stageId: stage.id,
                stageName: stage.name,
                order: stage.order,
                status,
                statusText,
                actionText
            };
        });
        this.setData({
            stageListForSelector: selectorList,
            showStageSelectorModal: true
        });
    },
    onCloseStageSelector() {
        this.setData({
            showStageSelectorModal: false
        });
    },
    onSelectStageToEnter(e) {
        const { stage } = e.currentTarget.dataset;
        if (!stage || stage.status === 'locked')
            return;
        soundManager_1.SoundManager.play('talk');
        const { windowWidth, windowHeight } = this.data;
        const mapW = windowWidth * 1.6;
        const mapH = windowHeight * 1.6;
        // 副本初始降落点：在通道1内部 (115, 320) 而非两通道交叉端点 (80, 320)
        // 避免两条通道的平行围墙在端点处四向围住玩家导致无法移动
        const targetX = (115 / 400) * mapW;
        const targetY = (320 / 400) * mapH;
        const TRACE_ID = `T-ENTER-STAGE-${Date.now()}`;
        logger_1.Logger.info(`[${TRACE_ID}] 玩家进入副本: ${stage.stageName}，目标坐标: (${targetX.toFixed(0)}, ${targetY.toFixed(0)})，地图尺寸: ${mapW}x${mapH}`);
        this.setData({
            currentStageId: stage.stageId,
            showStageSelectorModal: false,
            mapWidth: mapW,
            mapHeight: mapH,
            playerX: targetX,
            playerY: targetY,
            playerXRound: Math.round(targetX),
            playerYRound: Math.round(targetY)
        }, () => {
            this.recenterCamera(targetX, targetY);
            // 只拉取 NPC 列表，不覆盖地图尺寸与玩家坐标（避免 loadCloudMapConfig 全量覆盖导致 NPC 消失）
            this.loadStageNpcList(TRACE_ID, stage.stageId);
        });
    }
});
