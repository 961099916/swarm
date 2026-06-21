"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarColorExtractor = void 0;
/**
 * 微信头像像素配色特征分析器 (8x8 像素降噪提取)
 */
class AvatarColorExtractor {
    /**
     * 从 8x8 的 ImageData 像素缓冲中提取核心配色盘
     */
    static extract(imgData) {
        if (!imgData || imgData.length < 256) {
            return Object.assign({}, this.DEFAULT_PLAYER_COLORS);
        }
        const getPixelColor = (x, y) => {
            const idx = (y * 8 + x) * 4;
            return {
                r: imgData[idx],
                g: imgData[idx + 1],
                b: imgData[idx + 2]
            };
        };
        const rgbToHex = (r, g, b) => {
            const toHex = (c) => {
                const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
                return hex.padStart(2, '0');
            };
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        };
        const getAverageColor = (points) => {
            let rSum = 0, gSum = 0, bSum = 0;
            points.forEach(p => {
                const c = getPixelColor(p.x, p.y);
                rSum += c.r;
                gSum += c.g;
                bSum += c.b;
            });
            const len = points.length;
            return rgbToHex(rSum / len, gSum / len, bSum / len);
        };
        // 1. 帽子/头发采样 (顶部 2 行采样，对齐 8x8 格栅位置)
        const hatColor = getAverageColor([{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 0 }, { x: 4, y: 0 }]);
        // 2. 皮肤采样 (中部采样)
        const skinColorRaw = getAverageColor([{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 4 }]);
        // 3. 衣服采样 (下部衣领区)
        const clothColor = getAverageColor([{ x: 3, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 6 }, { x: 4, y: 6 }]);
        // 4. 裤子采样 (脚踝以上底区)
        const pantsColor = getAverageColor([{ x: 3, y: 7 }, { x: 4, y: 7 }]);
        // === 防死灰防穿帮亮度与对比度兜底计算 ===
        const cSkin = getPixelColor(3, 3);
        const cHat = getPixelColor(3, 1);
        // 皮肤与发色欧氏距离，防止皮肤和发色穿帮混在一起
        const distSkinHat = Math.sqrt(Math.pow(cSkin.r - cHat.r, 2) +
            Math.pow(cSkin.g - cHat.g, 2) +
            Math.pow(cSkin.b - cHat.b, 2));
        // 心理学感知亮度公式 (W3C 标准)
        const brightness = (cSkin.r * 299 + cSkin.g * 587 + cSkin.b * 114) / 1000;
        let finalSkin = skinColorRaw;
        if (distSkinHat < 40 || brightness < 45 || brightness > 225) {
            // 偏色过重、过暗过亮或与发色重叠时，兜底采用经典星露谷温暖皮色
            finalSkin = this.DEFAULT_PLAYER_COLORS.skin;
        }
        return {
            hat: hatColor,
            skin: finalSkin,
            cloth: clothColor,
            pants: pantsColor
        };
    }
}
exports.AvatarColorExtractor = AvatarColorExtractor;
// 默认星露谷村民配色 (草帽黄、暖色皮、绿衣、蓝牛仔裤)
AvatarColorExtractor.DEFAULT_PLAYER_COLORS = {
    hat: '#d4a373',
    skin: '#ffddc0',
    cloth: '#5c8e32',
    pants: '#4b66ad'
};
exports.default = AvatarColorExtractor;
