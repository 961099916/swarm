"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_QUIZZES = exports.localRorschachQuestions = exports.localMmpiQuestions = exports.localHarryQuestions = exports.localColorQuestions = exports.localBelbinQuestions = exports.localGallupQuestions = exports.localHollandQuestions = exports.localDiscQuestions = exports.localEnneagramQuestions = exports.localBigFiveQuestions = exports.localMbtiQuestions = void 0;
// ==========================================
// 1. 心理学理论类
// ==========================================
// MBTI性格测试
exports.localMbtiQuestions = [
    {
        id: 1,
        text: "在社交聚会上，你通常会：",
        options: [
            { id: "A", text: "主动与许多人交流，包括陌生人", weights: [{ dimension: "E", value: 1 }] },
            { id: "B", text: "只与少数几个熟人保持安静的交谈", weights: [{ dimension: "I", value: 1 }] }
        ]
    },
    {
        id: 2,
        text: "你更容易被以下哪种事物吸引：",
        options: [
            { id: "A", text: "具体的事实、数据以及当下的实际经验", weights: [{ dimension: "S", value: 1 }] },
            { id: "B", text: "抽象的理论、宏观概念以及未来的可能性", weights: [{ dimension: "N", value: 1 }] }
        ]
    },
    {
        id: 3,
        text: "在做关键决策时，你更倾向于依赖：",
        options: [
            { id: "A", text: "客观的逻辑分析与因果关系判定", weights: [{ dimension: "T", value: 1 }] },
            { id: "B", text: "个人的价值观以及对他人的情感共鸣", weights: [{ dimension: "F", value: 1 }] }
        ]
    },
    {
        id: 4,
        text: "你的日程安排和旅行计划通常是：",
        options: [
            { id: "A", text: "提前做好详细的时间规划，讨厌被打乱", weights: [{ dimension: "J", value: 1 }] },
            { id: "B", text: "定个大概方向，行程随遇而安，适应变动", weights: [{ dimension: "P", value: 1 }] }
        ]
    }
];
// 大五人格测试
exports.localBigFiveQuestions = [
    {
        id: 1,
        text: "对于接触新奇的艺术、思想或不寻常的体验，你的态度是：",
        options: [
            { id: "A", text: "非常渴望，我喜欢探索未知和抽象事物", weights: [{ dimension: "O", value: 2 }] }, // Openness (开放性)
            { id: "B", text: "比较保守，更喜欢熟悉和实际的事物", weights: [{ dimension: "O", value: 0 }] }
        ]
    },
    {
        id: 2,
        text: "在完成任务或工作时，你通常表现得：",
        options: [
            { id: "A", text: "高效、严谨，总是提前规划并井井有条", weights: [{ dimension: "C", value: 2 }] }, // Conscientiousness (尽责性)
            { id: "B", text: "比较随性，容易分心，经常依靠临场发挥", weights: [{ dimension: "C", value: 0 }] }
        ]
    },
    {
        id: 3,
        text: "在聚会或集体活动中，你感到：",
        options: [
            { id: "A", text: "精力充沛，乐于成为焦点并主动交友", weights: [{ dimension: "E", value: 2 }] }, // Extraversion (外向性)
            { id: "B", text: "有些疲惫，倾向于待在角落独自休息", weights: [{ dimension: "E", value: 0 }] }
        ]
    },
    {
        id: 4,
        text: "当与他人产生意见分歧时，你通常：",
        options: [
            { id: "A", text: "优先考虑他人的感受，愿意妥协与信任对方", weights: [{ dimension: "A", value: 2 }] }, // Agreeableness (宜人性)
            { id: "B", text: "坚持自我，客观争论，不在意关系是否尴尬", weights: [{ dimension: "A", value: 0 }] }
        ]
    },
    {
        id: 5,
        text: "面对突发压力或挫折时，你更容易：",
        options: [
            { id: "A", text: "情绪敏感波动，感到焦虑、担忧或情绪低落", weights: [{ dimension: "N", value: 2 }] }, // Neuroticism (神经质)
            { id: "B", text: "保持情绪稳定，泰然处之，能够理智应对", weights: [{ dimension: "N", value: 0 }] }
        ]
    }
];
// 九型人格测试
exports.localEnneagramQuestions = [
    {
        id: 1,
        text: "你心中最深层的恐惧和渴望更倾向于：",
        options: [
            { id: "A", text: "害怕犯错，渴望事事完美和正义", weights: [{ dimension: "1", value: 2 }] }, // 1号完美型
            { id: "B", text: "害怕不被爱，渴望通过奉献获得认可", weights: [{ dimension: "2", value: 2 }] }, // 2号助人型
            { id: "C", text: "害怕失败，渴望取得成就并受人瞩目", weights: [{ dimension: "3", value: 2 }] } // 3号成就型
        ]
    },
    {
        id: 2,
        text: "在团队中，你的注意力往往被什么所吸引：",
        options: [
            { id: "A", text: "独特的自我与情感，害怕被大众同化", weights: [{ dimension: "4", value: 2 }] }, // 4号艺术型
            { id: "B", text: "客观知识，倾向于冷静观察而非投入情感", weights: [{ dimension: "5", value: 2 }] }, // 5号理智型
            { id: "C", text: "潜在的危机与规则，需要确定安全与归属", weights: [{ dimension: "6", value: 2 }] } // 6号忠诚型
        ]
    },
    {
        id: 3,
        text: "你最向往的生活状态是：",
        options: [
            { id: "A", text: "快乐与自由，享受精彩多姿的多样体验", weights: [{ dimension: "7", value: 2 }] }, // 7号活跃型
            { id: "B", text: "掌控权与力量，保护弱小，直面冲突挑战", weights: [{ dimension: "8", value: 2 }] }, // 8号领袖型
            { id: "C", text: "和谐与安静，逃避冲突，求得内心安宁", weights: [{ dimension: "9", value: 2 }] } // 9号和平型
        ]
    }
];
// ==========================================
// 2. 职业发展类
// ==========================================
// DISC行为风格测试
exports.localDiscQuestions = [
    {
        id: 1,
        text: "在职场或小组协作中，你最首要的追求是：",
        options: [
            { id: "A", text: "快速得出结论，掌控全局并推进成果", weights: [{ dimension: "D", value: 2 }] }, // Dominance (支配)
            { id: "B", text: "活跃团队氛围，用创意和热情感染周围人", weights: [{ dimension: "I", value: 2 }] } // Influence (影响)
        ]
    },
    {
        id: 2,
        text: "你更偏好哪种工作节奏和氛围：",
        options: [
            { id: "A", text: "稳定、和谐且循序渐进，害怕剧烈冲突", weights: [{ dimension: "S", value: 2 }] }, // Steadiness (稳健)
            { id: "B", text: "严谨、精确且有据可查，关注数据和细节", weights: [{ dimension: "C", value: 2 }] } // Compliance (谨慎)
        ]
    },
    {
        id: 3,
        text: "当接到一项紧急任务时，你的第一本能是：",
        options: [
            { id: "A", text: "直截了当行动，快速克服困难拿到结果", weights: [{ dimension: "D", value: 1 }] },
            { id: "B", text: "先核实数据与要求，确保没有差错再动工", weights: [{ dimension: "C", value: 1 }] }
        ]
    },
    {
        id: 4,
        text: "在人际关系中，你给人的最深印象是：",
        options: [
            { id: "A", text: "幽默风趣、热情开朗的社交能手", weights: [{ dimension: "I", value: 1 }] },
            { id: "B", text: "耐心倾听、温和务实的靠谱后盾", weights: [{ dimension: "S", value: 1 }] }
        ]
    }
];
// 霍兰德职业兴趣测试 (RIASEC)
exports.localHollandQuestions = [
    {
        id: 1,
        text: "在闲暇时间，你更喜欢做哪类事情：",
        options: [
            { id: "A", text: "修理电器、制作木工或做手工劳动", weights: [{ dimension: "R", value: 2 }] }, // Realistic (现实型)
            { id: "B", text: "阅读科普期刊，研究复杂数理逻辑问题", weights: [{ dimension: "I", value: 2 }] } // Investigative (研究型)
        ]
    },
    {
        id: 2,
        text: "当面临自我表达时，你更被什么吸引：",
        options: [
            { id: "A", text: "音乐创作、绘画、写作等艺术性表现", weights: [{ dimension: "A", value: 2 }] }, // Artistic (艺术型)
            { id: "B", text: "参加志愿者，开导倾听有心理困惑的朋友", weights: [{ dimension: "S", value: 2 }] } // Social (社会型)
        ]
    },
    {
        id: 3,
        text: "你在商业与管理中感到最兴奋的是：",
        options: [
            { id: "A", text: "组织商业项目，发表演说，追求利润与影响", weights: [{ dimension: "E", value: 2 }] }, // Enterprising (企业型)
            { id: "B", text: "核算财务、归档数据，享受井然有序的表格", weights: [{ dimension: "C", value: 2 }] } // Conventional (常规型)
        ]
    },
    {
        id: 4,
        text: "如果非要选择一个工作环境，你首选：",
        options: [
            { id: "A", text: "亲自动手操作大型设备或与自然接触的户外", weights: [{ dimension: "R", value: 1 }] },
            { id: "B", text: "能发挥创意思维、不需要过多条条框框的画室", weights: [{ dimension: "A", value: 1 }] }
        ]
    },
    {
        id: 5,
        text: "如果非要挑选一个社交导向的环境，你倾向于：",
        options: [
            { id: "A", text: "帮助他人解决社会保障或进行教学培训的教室", weights: [{ dimension: "S", value: 1 }] },
            { id: "B", text: "能让你主导团队方向并施展说服力的会议室", weights: [{ dimension: "E", value: 1 }] }
        ]
    },
    {
        id: 6,
        text: "如果面对数据和研究的决策：",
        options: [
            { id: "A", text: "独立安静的实验室，探索客观新知", weights: [{ dimension: "I", value: 1 }] },
            { id: "B", text: "标准规范的公司审计科，进行数据校对", weights: [{ dimension: "C", value: 1 }] }
        ]
    }
];
// ==========================================
// 3. 团队管理与商业应用类
// ==========================================
// 盖洛普优势识别器 (CliftonStrengths)
exports.localGallupQuestions = [
    {
        id: 1,
        text: "你最突出的工作天资表现为：",
        options: [
            { id: "A", text: "极其强大的逻辑规划，能在纷繁迷雾中找到最佳路线", weights: [{ dimension: "Strategic", value: 2 }] }, // 战略思维
            { id: "B", text: "使命必达的执行精神，拿到清单后必须立刻完成它", weights: [{ dimension: "Executing", value: 2 }] } // 执行力
        ]
    },
    {
        id: 2,
        text: "在人际合作中，你最显著的天赋是：",
        options: [
            { id: "A", text: "能快速拉近关系，建立深厚的终身挚友信任", weights: [{ dimension: "Relating", value: 2 }] }, // 关系建立
            { id: "B", text: "能鼓动人心，带领团队朝着既定宏伟蓝图进发", weights: [{ dimension: "Influencing", value: 2 }] } // 影响力
        ]
    },
    {
        id: 3,
        text: "对于新想法或战略的评估，你会：",
        options: [
            { id: "A", text: "花时间沉思默想其合理性，注重理论概念", weights: [{ dimension: "Strategic", value: 1 }] },
            { id: "B", text: "快速找伙伴推销和传播，扩大社会动员影响力", weights: [{ dimension: "Influencing", value: 1 }] }
        ]
    },
    {
        id: 4,
        text: "当团队面临重大交付挑战时，你的优势是：",
        options: [
            { id: "A", text: "亲自扎根一线，有条不紊死磕细节完成交付", weights: [{ dimension: "Executing", value: 1 }] },
            { id: "B", text: "调和冲突，做团队润滑剂，确保关系融洽", weights: [{ dimension: "Relating", value: 1 }] }
        ]
    }
];
// Belbin团队角色测试
exports.localBelbinQuestions = [
    {
        id: 1,
        text: "在项目启动初期，你最习惯扮演的角色是：",
        options: [
            { id: "A", text: "倾听各方意见，理顺逻辑分工的「协调者 (CO)」", weights: [{ dimension: "CO", value: 2 }] },
            { id: "B", text: "提出天马行空概念，提供破局思路的「创新者 (PL)」", weights: [{ dimension: "PL", value: 2 }] }
        ]
    },
    {
        id: 2,
        text: "当项目进入到实质性落地攻坚期，你是：",
        options: [
            { id: "A", text: "不畏艰阻、督促大家跟上进度的「推进者 (SH)」", weights: [{ dimension: "SH", value: 2 }] },
            { id: "B", text: "仔细校对，找出最终文稿细节漏洞的「完善者 (ME)」", weights: [{ dimension: "ME", value: 2 }] }
        ]
    },
    {
        id: 3,
        text: "你在团队合作中最讨厌看到的现象是：",
        options: [
            { id: "A", text: "没有创新火花，大家只是照本宣科做事", weights: [{ dimension: "PL", value: 1 }] },
            { id: "B", text: "项目拖拉，磨磨蹭蹭迟迟拿不到实际成果", weights: [{ dimension: "SH", value: 1 }] }
        ]
    },
    {
        id: 4,
        text: "当团队发生分歧，你发挥的优势是：",
        options: [
            { id: "A", text: "主持大局，民主统筹分配资源，实现共赢", weights: [{ dimension: "CO", value: 1 }] },
            { id: "B", text: "理智质疑，寻找漏洞，做团队冷静分析师", weights: [{ dimension: "ME", value: 1 }] }
        ]
    }
];
// ==========================================
// 4. 趣味性与文化衍生类
// ==========================================
// 色彩性格测试 (红黄蓝绿)
exports.localColorQuestions = [
    {
        id: 1,
        text: "你的社交能量流表现为：",
        options: [
            { id: "A", text: "热情洋溢、情感外露，渴望成为瞩目的核心", weights: [{ dimension: "Red", value: 2 }] }, // 红色 (热情)
            { id: "B", text: "理智冷静、深藏不露，喜欢严密论证和沉思", weights: [{ dimension: "Blue", value: 2 }] } // 蓝色 (理性)
        ]
    },
    {
        id: 2,
        text: "你面对冲突或挑战时的第一本能是：",
        options: [
            { id: "A", text: "直接出击、掌控局面，以拿到结果为导向", weights: [{ dimension: "Yellow", value: 2 }] }, // 黄色 (掌控)
            { id: "B", text: "避开锋芒、以和为贵，以建立友善信任为重", weights: [{ dimension: "Green", value: 2 }] } // 绿色 (平和)
        ]
    },
    {
        id: 3,
        text: "描述一件难忘的事情时，你通常：",
        options: [
            { id: "A", text: "绘声绘色地描述当事人丰富饱满的感情起伏", weights: [{ dimension: "Red", value: 1 }] },
            { id: "B", text: "理智精确地用客观时间线和逻辑因果来论证", weights: [{ dimension: "Blue", value: 1 }] }
        ]
    },
    {
        id: 4,
        text: "朋友犯了错，你最可能的反应是：",
        options: [
            { id: "A", text: "严肃指出其错误，帮助对方分析并立刻改正", weights: [{ dimension: "Yellow", value: 1 }] },
            { id: "B", text: "安慰对方，表示能理解其难处，给对方留面子", weights: [{ dimension: "Green", value: 1 }] }
        ]
    }
];
// 哈利·波特分院测试
exports.localHarryQuestions = [
    {
        id: 1,
        text: "当你遇到一条沉睡的凶猛火龙守护着密室入口，你会：",
        options: [
            { id: "A", text: "拔出佩剑，直接正面迎敌，为荣誉而战", weights: [{ dimension: "Gryffindor", value: 2 }] }, // 格兰芬多
            { id: "B", text: "施展隐身术，谋划利用火龙的弱点智取", weights: [{ dimension: "Slytherin", value: 2 }] } // 斯莱特林
        ]
    },
    {
        id: 2,
        text: "你认为什么样的人类品质最难能可贵：",
        options: [
            { id: "A", text: "过人的智慧、敏锐的求知欲与深刻的见解", weights: [{ dimension: "Ravenclaw", value: 2 }] }, // 拉文克劳
            { id: "B", text: "忠诚正直、勤劳务实以及对同伴的不离不弃", weights: [{ dimension: "Hufflepuff", value: 2 }] } // 赫奇帕奇
        ]
    },
    {
        id: 3,
        text: "如果魔镜能展现你心底最大的渴望，你最想看到：",
        options: [
            { id: "A", text: "自己掌握无上权力，受万人敬仰的巅峰模样", weights: [{ dimension: "Slytherin", value: 1 }] },
            { id: "B", text: "自己解答出世界上最难谜题，成为智慧宗师", weights: [{ dimension: "Ravenclaw", value: 1 }] }
        ]
    },
    {
        id: 4,
        text: "当你的同伴被其他学院挑衅，你的本能反应是：",
        options: [
            { id: "A", text: "热血沸腾，立刻挡在前面为正义据理力争", weights: [{ dimension: "Gryffindor", value: 1 }] },
            { id: "B", text: "坚守同伴，安抚情绪，用温暖和包容共渡难关", weights: [{ dimension: "Hufflepuff", value: 1 }] }
        ]
    }
];
// ==========================================
// 5. 临床与深度心理评估
// ==========================================
// MMPI深度自测 (简化版)
exports.localMmpiQuestions = [
    {
        id: 1,
        text: "在大部分时候，你是否感到精力衰竭、对未来失去动力和兴趣：",
        options: [
            { id: "A", text: "经常如此，感到情绪经常处于低落状态", weights: [{ dimension: "Depression", value: 2 }] },
            { id: "B", text: "偶尔或几乎没有，情绪总体稳定阳光", weights: [{ dimension: "Depression", value: 0 }] }
        ]
    },
    {
        id: 2,
        text: "你是否时常会因为小事而感到莫名烦躁、焦虑且心神不宁：",
        options: [
            { id: "A", text: "非常频繁，身体常常感到处于紧绷状态", weights: [{ dimension: "Anxiety", value: 2 }] },
            { id: "B", text: "极少，自我感觉心态比较松弛平和", weights: [{ dimension: "Anxiety", value: 0 }] }
        ]
    },
    {
        id: 3,
        text: "你是否经常怀疑他人在背后议论你、或者对你有恶意企图：",
        options: [
            { id: "A", text: "有过这种强烈的担忧，很难完全信任陌生人", weights: [{ dimension: "Paranoia", value: 2 }] },
            { id: "B", text: "几乎没有，我认为周围的人基本都是友善的", weights: [{ dimension: "Paranoia", value: 0 }] }
        ]
    },
    {
        id: 4,
        text: "你是否时常过分关注自己的躯体健康，经常疑心自己得了重病：",
        options: [
            { id: "A", text: "经常担忧，身体有微小不适就容易心慌意乱", weights: [{ dimension: "Hypochondriasis", value: 2 }] },
            { id: "B", text: "比较粗线条，不过度放大微小的生理反应", weights: [{ dimension: "Hypochondriasis", value: 0 }] }
        ]
    },
    {
        id: 5,
        text: "你的睡眠质量和脑力状态通常表现为：",
        options: [
            { id: "A", text: "经常失眠多梦，思虑过度，白天脑子昏沉", weights: [{ dimension: "Hypochondriasis", value: 1 }, { dimension: "Anxiety", value: 1 }] },
            { id: "B", text: "入睡快，睡眠深沉，醒后精力比较充沛", weights: [{ dimension: "Anxiety", value: 0 }] }
        ]
    }
];
// 罗夏墨迹测验 (3题，配有对称性黑灰、彩色抽象图像)
exports.localRorschachQuestions = [
    {
        id: 1,
        text: "仔细观察以下墨迹图形（双侧对称），你直觉认为它最像什么：",
        inkblotSvg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" width="100%" height="100%"><rect width="48" height="32" fill="%23faf6f0"/><ellipse cx="20" cy="16" rx="8" ry="12" fill="%231a1a1a" opacity="0.8"/><ellipse cx="28" cy="16" rx="8" ry="12" fill="%231a1a1a" opacity="0.8"/><ellipse cx="14" cy="18" rx="6" ry="8" fill="%23333333" opacity="0.85"/><ellipse cx="34" cy="18" rx="6" ry="8" fill="%23333333" opacity="0.85"/><circle cx="10" cy="10" r="2.5" fill="%231a1a1a" opacity="0.5"/><circle cx="38" cy="10" r="2.5" fill="%231a1a1a" opacity="0.5"/><circle cx="8" cy="22" r="1.5" fill="%23991b1b" opacity="0.8"/><circle cx="40" cy="22" r="1.5" fill="%23991b1b" opacity="0.8"/><path d="M22,10 C18,12 18,15 20,16 M26,10 C30,12 30,15 28,16" fill="none" stroke="%23991b1b" stroke-width="1.2" opacity="0.8"/></svg>`,
        options: [
            { id: "A", text: "一只展翅飞翔的黑色巨型蝙蝠或飞蛾", weights: [{ dimension: "Dynamic", value: 2 }] },
            { id: "B", text: "两个对称战立、正在低头行礼的红眼恶魔", weights: [{ dimension: "Analytic", value: 2 }] },
            { id: "C", text: "一块破损的古老石碑，中间有岩浆在流淌", weights: [{ dimension: "Static", value: 2 }] }
        ]
    },
    {
        id: 2,
        text: "观察这幅红黑相间的墨迹图形，你的潜意识第一直觉是：",
        inkblotSvg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" width="100%" height="100%"><rect width="48" height="32" fill="%23faf6f0"/><path d="M24,4 C14,8 10,20 18,28 C21,26 23,24 24,24 C25,24 27,26 30,28 C38,20 34,8 24,4" fill="%23b91c1c" opacity="0.8"/><ellipse cx="18" cy="12" rx="4" ry="7" fill="%231f2937" opacity="0.9"/><ellipse cx="30" cy="12" rx="4" ry="7" fill="%231f2937" opacity="0.9"/><circle cx="24" cy="18" r="4.5" fill="%23111827"/><circle cx="10" cy="8" r="2" fill="%23b91c1c" opacity="0.7"/><circle cx="38" cy="8" r="2" fill="%23b91c1c" opacity="0.7"/></svg>`,
        options: [
            { id: "A", text: "一朵正在猛烈燃烧、不断向外扩张的火焰花", weights: [{ dimension: "Dynamic", value: 2 }] },
            { id: "B", text: "一张长着两只大眼睛、正在咆哮的红色怪兽脸", weights: [{ dimension: "Analytic", value: 2 }] },
            { id: "C", text: "一顶神圣的红宝石皇冠，中间嵌着黑珍珠", weights: [{ dimension: "Static", value: 2 }] }
        ]
    },
    {
        id: 3,
        text: "观察以下抽象对称图形，你首先感知到的是什么：",
        inkblotSvg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" width="100%" height="100%"><rect width="48" height="32" fill="%23faf6f0"/><ellipse cx="24" cy="16" rx="14" ry="4" fill="%230369a1" opacity="0.75"/><ellipse cx="24" cy="16" rx="8" ry="10" fill="%230284c7" opacity="0.8"/><circle cx="24" cy="16" r="3" fill="%23ffffff"/><circle cx="14" cy="16" r="2" fill="%230369a1" opacity="0.9"/><circle cx="34" cy="16" r="2" fill="%230369a1" opacity="0.9"/><path d="M12,12 C16,4 20,8 24,16 C28,8 32,4 36,12" fill="none" stroke="%230284c7" stroke-width="1.5" opacity="0.8"/></svg>`,
        options: [
            { id: "A", text: "一汪平静深邃的蓝色湖水，中间泛着涟漪", weights: [{ dimension: "Static", value: 2 }] },
            { id: "B", text: "一只正在深海深处潜行、散发荧光的发光水母", weights: [{ dimension: "Dynamic", value: 2 }] },
            { id: "C", text: "一架精致的宇宙天平，中间的核心是一颗恒星", weights: [{ dimension: "Analytic", value: 2 }] }
        ]
    }
];
// 汇总本地题库映射表
exports.LOCAL_QUIZZES = {
    'npc_mbti': exports.localMbtiQuestions,
    'npc_bigfive': exports.localBigFiveQuestions,
    'npc_enneagram': exports.localEnneagramQuestions,
    'npc_disc': exports.localDiscQuestions,
    'npc_holland': exports.localHollandQuestions,
    'npc_gallup': exports.localGallupQuestions,
    'npc_belbin': exports.localBelbinQuestions,
    'npc_color': exports.localColorQuestions,
    'npc_harry': exports.localHarryQuestions,
    'npc_mmpi': exports.localMmpiQuestions,
    'npc_rorschach': exports.localRorschachQuestions
};
