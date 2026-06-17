
export const CONFIG = {
  getStageNameByLevel(level: number): string {
    if (level === 1) return '幼儿园小班';
    if (level === 2) return '幼儿园大班';
    if (level === 3) return '小学一年级';
    if (level === 4) return '小学二年级';
    if (level === 5) return '小学三年级';
    if (level === 6) return '小学四年级';
    if (level === 7) return '小学五年级';
    if (level === 8) return '小学六年级';
    if (level >= 9) return '通关大博士预备生';
    return '小镇新手';
  },

  DEFAULT_SPAWN: { x: 180, y: 180 },
  EXP_PER_LEVEL: 100,
  PASS_THRESHOLD: 60,

  MAP: {
    LOBBY_WIDTH: 1200,
    LOBBY_HEIGHT: 1200,
    CLASSROOM_WIDTH: 400,
    CLASSROOM_HEIGHT: 400,
  },
};
