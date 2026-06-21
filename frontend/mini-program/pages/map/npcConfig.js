"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAGE_ORDERS = exports.STAGE_ROUTE_CONFIGS = exports.FUN_TEST_IDS = exports.MAP_CONFIG_CONSTANTS = exports.FUN_LOBBY_DEFAULT_CONFIG = exports.LOBBY_DEFAULT_CONFIG = exports.PORTAL_DEFAULT_SVGS = exports.NPC_SPRITE_SVGS = void 0;
// === 纯正像素风 (Pixel Art) SVG 精灵图定义 ===
exports.NPC_SPRITE_SVGS = {
    mbti: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="100%" height="100%"><g fill="none"><path d="M16,2 L6,14 L26,14 Z" fill="%234b3d7a"/><rect x="4" y="14" width="24" height="2" fill="%23e2a85c"/><rect x="10" y="16" width="12" height="6" fill="%23ffddc0"/><rect x="8" y="18" width="16" height="4" fill="%23ffffff"/><rect x="8" y="22" width="16" height="14" fill="%234b3d7a"/><rect x="10" y="36" width="12" height="8" fill="%233d2511"/><rect x="12" y="26" width="8" height="6" fill="%23e2a85c"/><rect x="14" y="28" width="4" height="2" fill="%233d2511"/></g></svg>`,
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
};
exports.PORTAL_DEFAULT_SVGS = {
    study: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="100%" height="100%"><defs><radialGradient id="bhCoreS" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23000000"/><stop offset="60%" stop-color="%23000d1a"/><stop offset="100%" stop-color="%23001433"/></radialGradient><radialGradient id="bhGlowS" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%2338bdf8" stop-opacity="0.9"/><stop offset="50%" stop-color="%230ea5e9" stop-opacity="0.4"/><stop offset="100%" stop-color="%230ea5e9" stop-opacity="0"/></radialGradient></defs><rect x="4" y="40" width="40" height="22" rx="2" fill="%230d1a2e" stroke="%2338bdf8" stroke-width="1.5" opacity="0.9"/><rect x="12" y="45" width="24" height="12" rx="1" fill="%23020d1a"/><text x="24" y="55" text-anchor="middle" font-size="7" fill="%2338bdf8" font-family="serif" opacity="0.9">学途之门</text><line x1="24" y1="6" x2="24" y2="15" stroke="%23e0f2fe" stroke-width="2" opacity="0.85" stroke-linecap="round"/><line x1="24" y1="41" x2="24" y2="40" stroke="%2338bdf8" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/><circle cx="24" cy="5" r="1.5" fill="%23bae6fd" opacity="0.9"/><circle cx="24" cy="28" r="18" fill="url(%23bhGlowS)" opacity="0.6"/><circle cx="24" cy="28" r="8" fill="url(%23bhCoreS)"/><g><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%230ea5e9" stroke-width="2.0" stroke-linecap="round" opacity="0.7"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%230ea5e9" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(45 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%230ea5e9" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(90 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%230ea5e9" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(135 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%230ea5e9" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(180 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%230ea5e9" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(225 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%230ea5e9" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(270 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%230ea5e9" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(315 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%2338bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(15 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%2338bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(60 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%2338bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(105 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%2338bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(150 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%2338bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(195 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%2338bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(240 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%2338bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(285 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%2338bdf8" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(330 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23e0f2fe" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(30 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23e0f2fe" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(75 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23e0f2fe" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(120 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23e0f2fe" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(165 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23e0f2fe" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(210 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23e0f2fe" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(255 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23e0f2fe" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(300 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23e0f2fe" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(345 24 28)"/><animateTransform attributeName="transform" type="rotate" from="0 24 28" to="360 24 28" dur="4s" repeatCount="indefinite"/></g><circle cx="24" cy="28" r="4.5" fill="%23000000"/></svg>`,
    fun: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="100%" height="100%"><defs><radialGradient id="bhCoreF" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23000000"/><stop offset="60%" stop-color="%230d0011"/><stop offset="100%" stop-color="%231a0030"/></radialGradient><radialGradient id="bhGlowF" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23f472b6" stop-opacity="0.9"/><stop offset="50%" stop-color="%23db2777" stop-opacity="0.4"/><stop offset="100%" stop-color="%23db2777" stop-opacity="0"/></radialGradient></defs><rect x="4" y="40" width="40" height="22" rx="2" fill="%231a0d2e" stroke="%23f472b6" stroke-width="1.5" opacity="0.9"/><rect x="12" y="45" width="24" height="12" rx="1" fill="%230a0015"/><text x="24" y="55" text-anchor="middle" font-size="7" fill="%23f472b6" font-family="serif" opacity="0.9">逍遥之门</text><line x1="24" y1="6" x2="24" y2="15" stroke="%23fce7f3" stroke-width="2" opacity="0.85" stroke-linecap="round"/><line x1="24" y1="41" x2="24" y2="40" stroke="%23f472b6" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/><circle cx="24" cy="5" r="1.5" fill="%23fbcfe8" opacity="0.9"/><circle cx="24" cy="28" r="18" fill="url(%23bhGlowF)" opacity="0.6"/><circle cx="24" cy="28" r="8" fill="url(%23bhCoreF)"/><g><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%23db2777" stroke-width="2.0" stroke-linecap="round" opacity="0.7"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%23db2777" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(45 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%23db2777" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(90 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%23db2777" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(135 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%23db2777" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(180 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%23db2777" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(225 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%23db2777" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(270 24 28)"/><path d="M24,11 C30,13 33,20 30,25 C27,28 25,28 24,28" fill="none" stroke="%23db2777" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(315 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%23f472b6" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(15 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%23f472b6" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(60 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%23f472b6" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(105 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%23f472b6" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(150 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%23f472b6" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(195 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%23f472b6" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(240 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%23f472b6" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(285 24 28)"/><path d="M24,9 C32,11 36,21 31,27 C27,30 25,29 24,28" fill="none" stroke="%23f472b6" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(330 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23fce7f3" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(30 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23fce7f3" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(75 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23fce7f3" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(120 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23fce7f3" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(165 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23fce7f3" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(210 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23fce7f3" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(255 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23fce7f3" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(300 24 28)"/><path d="M24,10 C31,12 35,20 31,26 C27,29 25,29 24,28" fill="none" stroke="%23fce7f3" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(345 24 28)"/><animateTransform attributeName="transform" type="rotate" from="0 24 28" to="360 24 28" dur="4s" repeatCount="indefinite"/></g><circle cx="24" cy="28" r="4.5" fill="%23000000"/></svg>`,
    exit: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%"><defs><radialGradient id="bhCoreEx" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23000000"/><stop offset="60%" stop-color="%23001a08"/><stop offset="100%" stop-color="%23003318"/></radialGradient><radialGradient id="bhGlowEx" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%2310b981" stop-opacity="0.9"/><stop offset="50%" stop-color="%2306d6a0" stop-opacity="0.4"/><stop offset="100%" stop-color="%2306d6a0" stop-opacity="0"/></radialGradient></defs><circle cx="24" cy="24" r="18" fill="url(%23bhGlowEx)" opacity="0.6"/><circle cx="24" cy="24" r="8" fill="url(%23bhCoreEx)"/><g><path d="M24,7 C30,9 33,16 30,21 C27,24 25,24 24,24" fill="none" stroke="%23059669" stroke-width="2.0" stroke-linecap="round" opacity="0.7"/><path d="M24,7 C30,9 33,16 30,21 C27,24 25,24 24,24" fill="none" stroke="%23059669" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(45 24 24)"/><path d="M24,7 C30,9 33,16 30,21 C27,24 25,24 24,24" fill="none" stroke="%23059669" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(90 24 24)"/><path d="M24,7 C30,9 33,16 30,21 C27,24 25,24 24,24" fill="none" stroke="%23059669" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(135 24 24)"/><path d="M24,7 C30,9 33,16 30,21 C27,24 25,24 24,24" fill="none" stroke="%23059669" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(180 24 24)"/><path d="M24,7 C30,9 33,16 30,21 C27,24 25,24 24,24" fill="none" stroke="%23059669" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(225 24 24)"/><path d="M24,7 C30,9 33,16 30,21 C27,24 25,24 24,24" fill="none" stroke="%23059669" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(270 24 24)"/><path d="M24,7 C30,9 33,16 30,21 C27,24 25,24 24,24" fill="none" stroke="%23059669" stroke-width="2.0" stroke-linecap="round" opacity="0.7" transform="rotate(315 24 24)"/><path d="M24,5 C32,7 36,17 31,23 C27,26 25,25 24,24" fill="none" stroke="%2310b981" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(15 24 24)"/><path d="M24,5 C32,7 36,17 31,23 C27,26 25,25 24,24" fill="none" stroke="%2310b981" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(60 24 24)"/><path d="M24,5 C32,7 36,17 31,23 C27,26 25,25 24,24" fill="none" stroke="%2310b981" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(105 24 24)"/><path d="M24,5 C32,7 36,17 31,23 C27,26 25,25 24,24" fill="none" stroke="%2310b981" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(150 24 24)"/><path d="M24,5 C32,7 36,17 31,23 C27,26 25,25 24,24" fill="none" stroke="%2310b981" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(195 24 24)"/><path d="M24,5 C32,7 36,17 31,23 C27,26 25,25 24,24" fill="none" stroke="%2310b981" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(240 24 24)"/><path d="M24,5 C32,7 36,17 31,23 C27,26 25,25 24,24" fill="none" stroke="%2310b981" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(285 24 24)"/><path d="M24,5 C32,7 36,17 31,23 C27,26 25,25 24,24" fill="none" stroke="%2310b981" stroke-width="1.5" stroke-linecap="round" opacity="0.85" transform="rotate(330 24 24)"/><path d="M24,6 C31,8 35,16 31,22 C27,25 25,25 24,24" fill="none" stroke="%23a7f3d0" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(30 24 24)"/><path d="M24,6 C31,8 35,16 31,22 C27,25 25,25 24,24" fill="none" stroke="%23a7f3d0" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(75 24 24)"/><path d="M24,6 C31,8 35,16 31,22 C27,25 25,25 24,24" fill="none" stroke="%23a7f3d0" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(120 24 24)"/><path d="M24,6 C31,8 35,16 31,22 C27,25 25,25 24,24" fill="none" stroke="%23a7f3d0" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(165 24 24)"/><path d="M24,6 C31,8 35,16 31,22 C27,25 25,25 24,24" fill="none" stroke="%23a7f3d0" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(210 24 24)"/><path d="M24,6 C31,8 35,16 31,22 C27,25 25,25 24,24" fill="none" stroke="%23a7f3d0" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(255 24 24)"/><path d="M24,6 C31,8 35,16 31,22 C27,25 25,25 24,24" fill="none" stroke="%23a7f3d0" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(300 24 24)"/><path d="M24,6 C31,8 35,16 31,22 C27,25 25,25 24,24" fill="none" stroke="%23a7f3d0" stroke-width="1.0" stroke-linecap="round" opacity="0.95" transform="rotate(345 24 24)"/><animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="4s" repeatCount="indefinite"/></g><circle cx="24" cy="24" r="4.5" fill="%23000000"/></svg>`
};
// === 本地容灾离线兜底大地图配置 ===
exports.LOBBY_DEFAULT_CONFIG = {
    width: 1200,
    height: 1200,
    playerSpawnX: 180,
    playerSpawnY: 180,
    obstacles: [
        { id: 'pond', x: 750, y: 450, width: 120, height: 120 },
        { id: 'wood_stump', x: 100, y: 400, width: 80, height: 80 }
    ],
    npcList: {
        'portal_study': {
            id: 'portal_study',
            name: '学途之门',
            x: 300,
            y: 540,
            stageId: 'lobby',
            npcType: 'portal_study',
            dialogueText: '踏入【学途之门】，开启九年义务教育的知识副本旅程！',
            avatarSvg: exports.PORTAL_DEFAULT_SVGS.study,
            radius: 40
        },
        'portal_fun': {
            id: 'portal_fun',
            name: '逍遥之门',
            x: 900,
            y: 540,
            stageId: 'lobby',
            npcType: 'portal_fun',
            dialogueText: '踏入【逍遥之门】，进入轻松愉快的娱乐休闲小天地！',
            avatarSvg: exports.PORTAL_DEFAULT_SVGS.fun,
            radius: 40
        }
    }
};
exports.FUN_LOBBY_DEFAULT_CONFIG = {
    width: 1200,
    height: 1200,
    playerSpawnX: 600,
    playerSpawnY: 600,
    obstacles: [],
    npcList: {
        'portal_stone_exit': {
            id: 'portal_stone_exit',
            name: '返回大厅',
            x: 80,
            y: 80,
            stageId: 'fun_lobby',
            npcType: 'portal_exit',
            dialogueText: '触摸传送阵，返回鹈鹕镇大厅。',
            avatarSvg: exports.PORTAL_DEFAULT_SVGS.exit,
            radius: 35
        },
        'npc_mbti': {
            id: 'npc_mbti',
            name: 'MBTI 迈尔斯',
            x: 350,
            y: 450,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '欢迎！我是MBTI性格测试导师。你想探索自己的16种人格（如INTJ/ENFP）并获得职业规划建议吗？',
            avatarSvg: exports.NPC_SPRITE_SVGS.mbti,
            radius: 30
        },
        'npc_bigfive': {
            id: 'npc_bigfive',
            name: '大五人格研究员',
            x: 350,
            y: 600,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '你好！大五人格测试从开放性、尽责性等5个学术维度量化你的性格，这是科学界最认可的模型哦！',
            avatarSvg: exports.NPC_SPRITE_SVGS.bigfive,
            radius: 30
        },
        'npc_enneagram': {
            id: 'npc_enneagram',
            name: '九型人格隐士',
            x: 350,
            y: 750,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '行者，探寻你的动机与恐惧吧。九型人格将指引你洞察内心的根本欲望与避难所。',
            avatarSvg: exports.NPC_SPRITE_SVGS.enneagram,
            radius: 30
        },
        'npc_disc': {
            id: 'npc_disc',
            name: 'DISC 顾问 · 特里',
            x: 550,
            y: 450,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '哈啰！想快速了解你的职场沟通和支配、影响、稳健、谨慎行为倾向吗？来做DISC自测吧！',
            avatarSvg: exports.NPC_SPRITE_SVGS.disc,
            radius: 30
        },
        'npc_holland': {
            id: 'npc_holland',
            name: '霍兰德规划师',
            x: 550,
            y: 750,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '专业选择纠结？岗位不匹配？霍兰德职业兴趣测试（RIASEC）将精准勾勒你的职业兴趣偏好！',
            avatarSvg: exports.NPC_SPRITE_SVGS.holland,
            radius: 30
        },
        'npc_gallup': {
            id: 'npc_gallup',
            name: '优势教练 · 克利夫顿',
            x: 750,
            y: 450,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '别再死盯着缺点了！盖洛普优势识别会发掘你的核心天赋主题（执行、思考、关系、影响），把木桶长板发挥到极致！',
            avatarSvg: exports.NPC_SPRITE_SVGS.gallup,
            radius: 30
        },
        'npc_belbin': {
            id: 'npc_belbin',
            name: '贝尔宾协调官',
            x: 750,
            y: 750,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '没有完美的个人，只有完美的团队。Belbin团队角色评估将找出你在项目小组中最匹配的角色！',
            avatarSvg: exports.NPC_SPRITE_SVGS.belbin,
            radius: 30
        },
        'npc_color': {
            id: 'npc_color',
            name: '色彩性格大师',
            x: 950,
            y: 450,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '红色的热情，蓝色的理性，黄色的掌控，绿色的和平——你想知道自己最本质的性格色彩是什么吗？',
            avatarSvg: exports.NPC_SPRITE_SVGS.color,
            radius: 30
        },
        'npc_harry': {
            id: 'npc_harry',
            name: '分院帽助手',
            x: 950,
            y: 600,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '霍格沃茨开学啦！格兰芬多的勇敢，斯莱特林的野心，拉文克劳的聪慧，赫奇帕奇的忠诚，你属于哪个学院？',
            avatarSvg: exports.NPC_SPRITE_SVGS.harry,
            radius: 30
        },
        'npc_mmpi': {
            id: 'npc_mmpi',
            name: 'MMPI 临床专家',
            x: 950,
            y: 750,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '你好。MMPI是专业的精神状态多项自测。让我们静下心来，对你的压力、焦虑、低落倾向进行一次心智体检。',
            avatarSvg: exports.NPC_SPRITE_SVGS.mmpi,
            radius: 30
        },
        'npc_rorschach': {
            id: 'npc_rorschach',
            name: '罗夏分析师',
            x: 600,
            y: 320,
            stageId: 'fun_lobby',
            npcType: 'general',
            dialogueText: '凝视这些对称的神秘墨迹图形。说出你的第一潜意识直觉，我将为你剖析你内心最隐秘的人格阴影。',
            avatarSvg: exports.NPC_SPRITE_SVGS.rorschach,
            radius: 30
        }
    }
};
// === 关卡与常规配置 ===
exports.MAP_CONFIG_CONSTANTS = {
    DEFAULT_NICKNAME: '性格评估探索家',
    PROFILE_CACHE_KEY: 'local_user_profile'
};
exports.FUN_TEST_IDS = new Set([
    'npc_mbti', 'npc_bigfive', 'npc_enneagram', 'npc_disc', 'npc_holland',
    'npc_gallup', 'npc_belbin', 'npc_color', 'npc_harry', 'npc_mmpi', 'npc_rorschach'
]);
// 副本解锁及BOSS关路径链
exports.STAGE_ROUTE_CONFIGS = {
    'kindergarten_1': ['npc_kg1_math', 'npc_kg1_lang', 'npc_kg1_boss'],
    'kindergarten_2': ['npc_kg2_math', 'npc_kg2_lang', 'npc_kg2_boss'],
    'primary_1': ['npc_p1_chinese', 'npc_p1_math', 'npc_p1_boss'],
    'primary_2': ['npc_p2_chinese', 'npc_p2_math', 'npc_p2_boss'],
    'primary_3': ['npc_p3_math', 'npc_p3_english', 'npc_p3_boss'],
    'primary_4': ['npc_p4_chinese', 'npc_p4_english', 'npc_p4_boss'],
    'primary_5': ['npc_p5_math', 'npc_p5_chinese', 'npc_p5_boss'],
    'primary_6': ['npc_p6_math', 'npc_p6_chinese', 'npc_p6_boss']
};
// 关卡年级序号映射表
exports.STAGE_ORDERS = {
    'kindergarten_1': 1,
    'kindergarten_2': 2,
    'primary_1': 3,
    'primary_2': 4,
    'primary_3': 5,
    'primary_4': 6,
    'primary_5': 7,
    'primary_6': 8
};
