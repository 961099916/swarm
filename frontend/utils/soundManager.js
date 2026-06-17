"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoundManager = void 0;
/** 音效资源路径映射 */
const SOUND_MAP = {
    step: '/static/sounds/step.wav',
    talk: '/static/sounds/talk.wav',
    click: '/static/sounds/click.wav',
    select: '/static/sounds/select.wav',
    complete: '/static/sounds/complete.wav',
    levelup: '/static/sounds/levelup.wav',
    error: '/static/sounds/error.wav'
};
/** BGM资源路径映射 */
const BGM_MAP = {
    town: '/static/sounds/bgm_town.wav',
    quiz: '/static/sounds/bgm_quiz.wav'
};
/** 各音效的节流间隔(ms) */
const THROTTLE_MS = {
    step: 280,
    click: 150,
    select: 200
};
/** BGM默认音量 */
const BGM_VOLUME = 0.35;
class _SoundManager {
    constructor() {
        // ---- 全局开关 ----
        this._sfxEnabled = true;
        this._bgmEnabled = true;
        // ---- SFX 状态 ----
        this._lastPlayTime = {};
        // ---- BGM 状态 ----
        this._bgmAudio = null;
        this._currentBgm = null;
    }
    // ============ 开关控制 ============
    /** 音效总开关 */
    setSfxEnabled(enabled) {
        this._sfxEnabled = enabled;
    }
    /** 背景音乐总开关 */
    setBgmEnabled(enabled) {
        this._bgmEnabled = enabled;
        if (!enabled) {
            this.stopBgm();
        }
    }
    get sfxEnabled() { return this._sfxEnabled; }
    get bgmEnabled() { return this._bgmEnabled; }
    // ============ SFX 播放 ============
    /**
     * 播放指定音效（即发即忘，自动销毁）
     */
    play(name) {
        if (!this._sfxEnabled)
            return;
        // 节流控制
        const throttle = THROTTLE_MS[name] || 0;
        if (throttle > 0) {
            const now = Date.now();
            const last = this._lastPlayTime[name] || 0;
            if (now - last < throttle)
                return;
            this._lastPlayTime[name] = now;
        }
        const src = SOUND_MAP[name];
        if (!src)
            return;
        try {
            const audio = wx.createInnerAudioContext();
            audio.src = src;
            audio.volume = name === 'step' ? 0.3 : 0.6;
            audio.onEnded(() => audio.destroy());
            audio.onError(() => audio.destroy());
            audio.play();
        }
        catch (_e) {
            // 静默降级
        }
    }
    // ============ BGM 播放 ============
    // File: /Users/zhangjiahao/IdeaProjects/wx-test/wx-client/miniprogram/utils/soundManager.ts
    /**
     * 播放背景音乐（自动循环）
     * 如果当前已在播放同一首，则动态调整其播放速率 (rate) 从而不打断音乐
     * 如果在播放另一首，则切换
     */
    playBgm(name, rate = 1.0) {
        if (!this._bgmEnabled)
            return;
        // 同一首正在播放，如果是播放速率改变，直接更新速率并返回
        if (this._currentBgm === name && this._bgmAudio) {
            try {
                this._bgmAudio.playbackRate = rate;
            }
            catch (_e) {
                // 忽略
            }
            return;
        }
        // 切换：先停旧的
        this.stopBgm();
        const src = BGM_MAP[name];
        if (!src)
            return;
        try {
            const audio = wx.createInnerAudioContext();
            audio.src = src;
            audio.loop = true;
            audio.volume = BGM_VOLUME;
            audio.playbackRate = rate;
            audio.onError((err) => {
                console.warn(`[SoundManager] BGM播放失败 ${name}:`, (err === null || err === void 0 ? void 0 : err.errMsg) || err);
            });
            audio.play();
            this._bgmAudio = audio;
            this._currentBgm = name;
        }
        catch (_e) {
            // 静默降级
        }
    }
    /**
     * 停止当前背景音乐
     */
    stopBgm() {
        if (this._bgmAudio) {
            try {
                this._bgmAudio.stop();
                this._bgmAudio.destroy();
            }
            catch (_e) {
                // 忽略
            }
            this._bgmAudio = null;
            this._currentBgm = null;
        }
    }
    /**
     * 暂停背景音乐（页面切后台时调用）
     */
    pauseBgm() {
        if (this._bgmAudio) {
            try {
                this._bgmAudio.pause();
            }
            catch (_e) {
                // 忽略
            }
        }
    }
    /**
     * 恢复背景音乐（页面恢复前台时调用）
     */
    resumeBgm() {
        if (!this._bgmEnabled)
            return;
        if (this._bgmAudio) {
            try {
                this._bgmAudio.play();
            }
            catch (_e) {
                // 忽略
            }
        }
    }
    /** 获取当前正在播放的BGM名称 */
    get currentBgm() {
        return this._currentBgm;
    }
}
/** 全局单例 */
exports.SoundManager = new _SoundManager();
