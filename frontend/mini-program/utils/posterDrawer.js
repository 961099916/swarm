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
exports.PosterDrawer = void 0;
const logger_1 = require("./logger");
// === Canvas 调色板 (与游戏像素风完全一致) ===
const C = {
    bg: '#f5e3ca',
    dark: '#3d2511',
    mid: '#854c30',
    border: '#57371d',
    panel: '#dfb180',
    panelDark: '#c49a5e',
    sectionBg: '#ead5b0',
    dimL: '#e0a96d',
    dimR: '#4b66ad',
    dimLHi: '#f0c080',
    dimRHi: '#7b8fcc',
    white: '#fffef8',
    header: '#3d2511'
};
const DIM_LABELS = {
    'E': '外倾 E', 'I': '内倾 I', 'S': '感觉 S', 'N': '直觉 N',
    'T': '思考 T', 'F': '情感 F', 'J': '判断 J', 'P': '知觉 P'
};
const W = 375;
const H = 650;
const PAD = 20;
/**
 * 像素风 MBTI 报告海报 Canvas 分步生成构建器
 */
class PosterDrawer {
    /**
     * 外部主调用绘制入口 (分步骤构建)
     */
    static draw(canvas, ctx, report, userInfo, traceId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info(`[${traceId}] PosterDrawer 开始绘制海报布局`);
            // Step 1: 填充背景与交叉 L 型四角框
            this.drawBordersAndBackground(ctx);
            // Step 2: 绘制顶部黑框标题栏
            this.drawTitleBar(ctx);
            // Step 3: 绘制头像与昵称
            yield this.drawAvatarAndNickname(canvas, ctx, userInfo, traceId);
            // Step 4: 绘制性格字母得分大卡片
            this.drawScoreCard(ctx, report);
            // Step 5: 绘制心智维度对比占比条
            this.drawDimensions(ctx, report);
            // Step 6: 绘制核心特质 (前3条)
            this.drawDetails(ctx, report);
            // Step 7: 绘制成长建议 (前2条)
            this.drawSuggestions(ctx, report);
            // Step 8: 绘制底部落款与注定行
            this.drawFooter(ctx, report);
            logger_1.Logger.info(`[${traceId}] PosterDrawer 全图层渲染完毕`);
        });
    }
    /**
     * 1. 绘制背景与像素风双层边框及四角 L 装点
     */
    static drawBordersAndBackground(ctx) {
        // 填充大底色
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, W, H);
        // 绘制粗边缘线与细内边缘线
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 5;
        ctx.strokeRect(2.5, 2.5, W - 5, H - 5);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(8, 8, W - 16, H - 16);
        // 绘制四角 L 像素条
        this.drawCorner(ctx, 14, 14, 1, 1);
        this.drawCorner(ctx, W - 14, 14, -1, 1);
        this.drawCorner(ctx, 14, H - 14, 1, -1);
        this.drawCorner(ctx, W - 14, H - 14, -1, -1);
    }
    /**
     * 2. 绘制顶部黑色标题背景与副标题文字
     */
    static drawTitleBar(ctx) {
        ctx.fillStyle = C.header;
        ctx.fillRect(0, 0, W, 58);
        ctx.fillStyle = C.mid;
        ctx.fillRect(0, 55, W, 2);
        ctx.fillStyle = C.panelDark;
        ctx.fillRect(0, 57, W, 1);
        this.drawDiamond(ctx, PAD + 14, 29, 5, C.mid);
        this.drawDiamond(ctx, W - PAD - 14, 29, 5, C.mid);
        ctx.fillStyle = C.white;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('心 智 图 腾 小 镇', W / 2, 22);
        ctx.font = '9px sans-serif';
        ctx.fillStyle = C.panel;
        ctx.fillText('MIND  TOTEM  TOWN  ·  PERSONALITY  REPORT', W / 2, 42);
    }
    /**
     * 3. 异步裁剪绘制用户圆形头像与昵称
     */
    static drawAvatarAndNickname(canvas, ctx, userInfo, traceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const AVATAR_R = 18;
            const AVATAR_CX = W - PAD - AVATAR_R - 4;
            const AVATAR_CY = 29;
            try {
                const img = canvas.createImage();
                yield new Promise((resolve) => {
                    img.onload = () => {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(img, AVATAR_CX - AVATAR_R, AVATAR_CY - AVATAR_R, AVATAR_R * 2, AVATAR_R * 2);
                        ctx.restore();
                        ctx.strokeStyle = C.mid;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R, 0, Math.PI * 2);
                        ctx.stroke();
                        resolve();
                    };
                    img.onerror = () => resolve();
                    img.src = userInfo.avatarPath;
                });
            }
            catch (e) {
                logger_1.Logger.warn(`[${traceId}] 海报头像绘制异常跳过`, e);
            }
            ctx.fillStyle = C.white;
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'right';
            const nameStr = (userInfo.nickname || '').slice(0, 10);
            ctx.fillText(nameStr, AVATAR_CX - AVATAR_R - 6, AVATAR_CY + 4);
        });
    }
    /**
     * 4. 绘制 MBTI 卡片背景、字母及性格描述
     */
    static drawScoreCard(ctx, report) {
        const curY = 68;
        const CARD_W = W - PAD * 2;
        const CARD_H = 128;
        this.drawPixelRect(ctx, PAD, curY, CARD_W, CARD_H, C.panel, C.border, 3);
        ctx.strokeStyle = C.mid;
        ctx.lineWidth = 1;
        ctx.strokeRect(PAD + 7, curY + 7, CARD_W - 14, CARD_H - 14);
        this.drawCardCorners(ctx, PAD, curY, CARD_W, CARD_H);
        ctx.font = 'bold 54px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.border;
        ctx.fillText(report.code || '----', W / 2 + 2, curY + 66);
        ctx.fillStyle = C.dark;
        ctx.fillText(report.code || '----', W / 2, curY + 64);
        ctx.fillStyle = C.mid;
        ctx.fillRect(W / 2 - 50, curY + 71, 100, 1.5);
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`「 ${report.name || '未知人格'} 」`, W / 2, curY + 89);
        ctx.fillRect(W / 2 - 50, curY + 94, 100, 1.5);
        ctx.font = '9.5px sans-serif';
        ctx.fillStyle = C.dark;
        ctx.textAlign = 'left';
        const text = (report.description || '').trim().slice(0, 72);
        this.wrapText(ctx, text, PAD + 14, curY + 112, CARD_W - 28, 14, 2);
    }
    /**
     * 5. 绘制心智各维度占比条看板
     */
    static drawDimensions(ctx, report) {
        let curY = 206;
        this.drawSectionBar(ctx, curY, '◆  心智维度占比  ◆');
        curY += 26;
        const LABEL_W = 38;
        const BAR_W = W - PAD * 2 - LABEL_W * 2 - 6;
        const BAR_X = PAD + LABEL_W + 3;
        const BAR_H = 13;
        for (const dim of (report.dimensions || []).slice(0, 4)) {
            curY += 5;
            this.drawSingleDimension(ctx, dim, BAR_X, curY, BAR_W, BAR_H);
            curY += BAR_H;
        }
    }
    /**
     * 5.1 绘制单个维度的水平对比滑条
     */
    static drawSingleDimension(ctx, dim, x, y, w, h) {
        const pct = Math.max(0, Math.min(100, dim.percentage || 50)) / 100;
        const isLeft = dim.selected === dim.left;
        const isRight = dim.selected === dim.right;
        ctx.fillStyle = isLeft ? C.dark : C.mid;
        ctx.font = isLeft ? 'bold 9px sans-serif' : '9px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(DIM_LABELS[dim.left] || dim.left, x - 4, y + h - 2);
        this.drawPixelRect(ctx, x, y, w, h, C.sectionBg, C.border, 1.5);
        const lFill = (1 - pct) * (w - 2);
        if (lFill > 0.5) {
            ctx.fillStyle = C.dimL;
            ctx.fillRect(x + 1, y + 1, lFill, h - 2);
            ctx.fillStyle = C.dimLHi;
            ctx.fillRect(x + 1, y + 1, lFill, 2);
        }
        const rFill = pct * (w - 2);
        if (rFill > 0.5) {
            const rx = x + lFill + 1;
            ctx.fillStyle = C.dimR;
            ctx.fillRect(rx, y + 1, rFill, h - 2);
            ctx.fillStyle = C.dimRHi;
            ctx.fillRect(rx, y + 1, rFill, 2);
        }
        ctx.fillStyle = C.bg;
        ctx.fillRect(x + w / 2 - 1, y, 2, h);
        this.drawDiamond(ctx, x + w / 2, y + h / 2, 2.5, C.border);
        ctx.fillStyle = isRight ? C.dark : C.mid;
        ctx.font = isRight ? 'bold 9px sans-serif' : '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(DIM_LABELS[dim.right] || dim.right, x + w + 4, y + h - 2);
    }
    /**
     * 6. 绘制核心性格特质栏目 (前3条)
     */
    static drawDetails(ctx, report) {
        let curY = 302;
        this.drawSectionBar(ctx, curY, '◆  核心特质  ◆');
        curY += 26;
        for (const detail of (report.details || []).slice(0, 3)) {
            const rowW = W - PAD * 2;
            this.drawPixelRect(ctx, PAD, curY, rowW, 26, C.panel, C.border, 1.5);
            ctx.fillStyle = C.border;
            ctx.fillRect(PAD, curY, 4, 26);
            ctx.fillStyle = C.panelDark;
            ctx.fillRect(PAD + 4, curY, 4, 26);
            this.drawDiamond(ctx, PAD + 12, curY + 13, 3, C.dark);
            ctx.fillStyle = C.dark;
            ctx.font = '9.5px sans-serif';
            ctx.textAlign = 'left';
            const str = (detail || '').slice(0, 30) + (((detail === null || detail === void 0 ? void 0 : detail.length) || 0) > 30 ? '...' : '');
            ctx.fillText(str, PAD + 20, curY + 17);
            curY += 30;
        }
    }
    /**
     * 7. 绘制成长行动建议 (前2条)
     */
    static drawSuggestions(ctx, report) {
        let curY = 432;
        this.drawDotLine(ctx, curY, C.mid);
        curY += 20;
        this.drawSectionBar(ctx, curY, '◆  成长建议  ◆');
        curY += 26;
        for (const sug of (report.suggestions || []).slice(0, 2)) {
            const rowW = W - PAD * 2;
            this.drawPixelRect(ctx, PAD, curY, rowW, 34, C.sectionBg, C.border, 1.5);
            ctx.fillStyle = C.dimR;
            ctx.fillRect(PAD, curY, 4, 34);
            ctx.fillStyle = '#6a80c0';
            ctx.fillRect(PAD + 4, curY, 3, 34);
            this.drawDiamond(ctx, PAD + 13, curY + 17, 3, C.dimR);
            ctx.fillStyle = C.dark;
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'left';
            const cleanSug = (sug || '').trim();
            const l1 = cleanSug.slice(0, 26);
            const l2 = cleanSug.length > 26 ? cleanSug.slice(26, 50) + (cleanSug.length > 50 ? '...' : '') : '';
            if (l2) {
                ctx.fillText(l1, PAD + 22, curY + 13);
                ctx.fillText(l2, PAD + 22, curY + 26);
            }
            else {
                ctx.fillText(l1, PAD + 22, curY + 20);
            }
            curY += 38;
        }
    }
    /**
     * 8. 绘制底部落款与免责行
     */
    static drawFooter(ctx, report) {
        let curY = 560;
        this.drawDotLine(ctx, curY, C.mid);
        ctx.fillStyle = C.mid;
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('—  仅供娱乐参考，请理性察视  —', W / 2, curY + 12);
        const footerY = H - 42;
        ctx.fillStyle = C.header;
        ctx.fillRect(0, footerY, W, 42);
        ctx.fillStyle = C.mid;
        ctx.fillRect(0, footerY, W, 2);
        ctx.fillStyle = C.panelDark;
        ctx.fillRect(0, footerY + 2, W, 1);
        this.drawDiamond(ctx, PAD + 14, footerY + 21, 5, C.mid);
        this.drawDiamond(ctx, W - PAD - 14, footerY + 21, 5, C.mid);
        ctx.fillStyle = C.white;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('心智图腾小镇  Mind Totem Town', W / 2, footerY + 17);
        ctx.font = '8px sans-serif';
        ctx.fillStyle = C.panel;
        ctx.fillText(`注定于 ${new Date().getFullYear()} 年  ·  ${report.code || ''}  ${report.name || ''}`, W / 2, footerY + 32);
    }
    /**
     * === 像素风小图形绘制工具函数 (微型，均在40行内) ===
     */
    static drawCorner(ctx, x, y, dx, dy) {
        ctx.fillStyle = C.border;
        ctx.fillRect(x, y, dx * 14, 3);
        ctx.fillRect(x, y, 3, dy * 14);
        ctx.fillStyle = C.mid;
        ctx.fillRect(x + dx * 3, y + dy * 3, dx * 6, 1);
        ctx.fillRect(x + dx * 3, y + dy * 3, 1, dy * 6);
    }
    static drawDiamond(ctx, cx, cy, r, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
    }
    static drawPixelRect(ctx, x, y, w, h, fillColor, strokeColor, lw = 2) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, w, h);
        if (strokeColor) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lw;
            ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
        }
    }
    static drawDotLine(ctx, y, color) {
        ctx.fillStyle = color;
        for (let x = PAD + 4; x < W - PAD; x += 7) {
            ctx.fillRect(x, y, 3, 2);
        }
    }
    static drawSectionBar(ctx, y, label) {
        const bw = W - PAD * 2;
        this.drawPixelRect(ctx, PAD, y, bw, 20, C.panelDark, C.border, 2);
        ctx.fillStyle = C.panel;
        ctx.fillRect(PAD + 2, y + 2, bw - 4, 16);
        ctx.fillStyle = C.panelDark;
        ctx.fillRect(PAD + 4, y + 4, bw - 8, 12);
        this.drawDiamond(ctx, PAD + 12, y + 10, 4, C.border);
        this.drawDiamond(ctx, PAD + bw - 12, y + 10, 4, C.border);
        ctx.fillStyle = C.dark;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, W / 2, y + 13);
    }
    static drawCardCorners(ctx, x, y, w, h) {
        const ci = 7;
        ctx.fillStyle = C.border;
        ctx.fillRect(x + ci, y + ci, 8, 2);
        ctx.fillRect(x + ci, y + ci, 2, 8);
        ctx.fillRect(x + w - ci - 8, y + ci, 8, 2);
        ctx.fillRect(x + w - ci - 2, y + ci, 2, 8);
        ctx.fillRect(x + ci, y + h - ci - 2, 8, 2);
        ctx.fillRect(x + ci, y + h - ci - 8, 2, 8);
        ctx.fillRect(x + w - ci - 8, y + h - ci - 2, 8, 2);
        ctx.fillRect(x + w - ci - 2, y + h - ci - 8, 2, 8);
    }
    static wrapText(ctx, text, x, y, maxW, lineH, maxLines = 99) {
        const chars = text.split('');
        let line = '';
        let curY = y;
        let lines = 0;
        for (const ch of chars) {
            if (lines >= maxLines)
                break;
            const test = line + ch;
            if (ctx.measureText(test).width > maxW && line.length > 0) {
                ctx.fillText(line, x, curY);
                line = ch;
                curY += lineH;
                lines++;
            }
            else {
                line = test;
            }
        }
        if (line && lines < maxLines) {
            ctx.fillText(line, x, curY);
            curY += lineH;
        }
        return curY;
    }
}
exports.PosterDrawer = PosterDrawer;
exports.default = PosterDrawer;
