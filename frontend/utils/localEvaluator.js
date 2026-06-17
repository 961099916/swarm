"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateLocalQuiz = calculateLocalQuiz;
exports.calculateLocalMBTI = calculateLocalMBTI;
const localQuestions_1 = require("./localQuestions");
// 离线 MBTI 结果定义
const mbtiResults = {
    INTJ: { name: "建筑师", description: "富有想象力和战略性的思想家，一切皆在计划之中。", details: ["理智冷静，善于透过现象看本质", "独立自主，有极强的主动学习与探索精神"], suggestions: ["适合从事需要系统规划、深度分析或研发的岗位。"] },
    INTP: { name: "逻辑学家", description: "具有创造力的发明家，对知识有着止不住的渴望。", details: ["热爱思辨，对各种理论与底层逻辑情有独钟", "思维跳跃，喜欢寻找不寻常的问题解决方案"], suggestions: ["适合从事研发、算法设计、纯学术研究或系统分析工作。"] },
    ENTJ: { name: "指挥官", description: "大胆、富有想象力且意志强大的领袖，总能找到或创造解决办法。", details: ["天生的领导者，做事雷厉风行、果断利落", "极强的逻辑理性，习惯以最高效的链条达成目标"], suggestions: ["适合从事企业高管、项目经理、战略合伙人等领导岗位。"] },
    ENTP: { name: "辩论家", description: "聪明、好奇心强的思想家，无法抗拒智力挑战。", details: ["脑洞大开，思维敏捷，擅长从多个角度看待问题", "适应力极强，能迅速抓住新事物的核心逻辑"], suggestions: ["适合创意策划、产品经理、创业顾问等岗位。"] },
    INFJ: { name: "提倡者", description: "安静而神秘，同时又是鼓舞人心且不屈不挠的理想主义者。", details: ["直觉敏锐，天生能深刻洞察他人的情绪与动机", "外冷内热，深层情感极其丰富，非常注重精神链接"], suggestions: ["适合心理咨询师、作家、教育学者、艺术总监等。"] },
    INFP: { name: "调停者", description: "诗意、善良且热心助人的人，总是渴望为正义事业出一份力。", details: ["温柔敏感，对人性的善意抱有纯粹的理想主义渴望", "崇尚自由，注重内心世界的和谐，讨厌冲突"], suggestions: ["适合自由撰稿人、插画师、内容运营、创意设计等岗位。"] },
    ENFJ: { name: "主人公", description: "富有魅力和鼓舞人心的领导者，能让听众听得如痴如醉。", details: ["热情洋溢，具有天然的感召力，是社交场合的润滑剂", "组织协调能力出色，擅长凝聚团队力量达成共识"], suggestions: ["适合人力资源管理、公共关系、教师等与人打交道的岗位。"] },
    ENFP: { name: "竞选者", description: "热情、有创意且爱社交的自由灵魂，总能找到微笑的理由。", details: ["乐观开朗，充满活力，总能带给身边人无尽的快乐", "思维发散，兴趣广泛，讨厌单调枯燥的重复性劳动"], suggestions: ["适合市场公关、创意文案、广告策划或自由职业。"] },
    ISTJ: { name: "物流师", description: "实际且注重事实的人，他们的可靠性不容怀疑。", details: ["高度务实，逻辑严密，具有出众的责任心与执行力", "尊重规则和传统，做事精细、稳定可靠"], suggestions: ["适合财务审计、数据库管理、项目落地执行等岗位。"] },
    ISFJ: { name: "守卫者", description: "非常贴心和独特的保护者，随时准备保护他们爱的人。", details: ["体贴入微，工作任劳任怨，是团队里最坚实的后盾", "注重细节与实际服务，用真挚的关怀守护周围的关系"], suggestions: ["适合行政支持、客服管理、护理人员、运营保障等岗位。"] },
    ESTJ: { name: "总经理", description: "出色的管理者，在管理事物或人方面无可挑剔。", details: ["极为守序，擅长制定流程、执行纪律和组织大型活动", "说话直截了当，用结果说话，讨厌低效与混乱"], suggestions: ["适合运营总监、警务管理、财务总监等管理岗位。"] },
    ESFJ: { name: "执政官", description: "极有同情心、爱交往且受欢迎的人，总是热心提供帮助。", details: ["充满亲和力，社交触觉敏锐，致力于维护集体的和谐稳定", "非常约守有条理，喜欢有条不紊、充满秩序的工作环境"], suggestions: ["适合公关销售、社群运营、行政主管、教师等岗位。"] },
    ISTP: { name: "鉴赏家", description: "大胆且实际的开拓者，擅长使用各种工具。", details: ["动手能力极强，理性独立，对机械、电子等工具敏感", "冷静从容，在危机时刻能够保持敏锐的直觉和清醒头脑"], suggestions: ["适合工程师、精密仪器研发、机械设计师等岗位。"] },
    ISFP: { name: "探险家", description: "灵活有魅力的艺术家，随时准备探索和体验新事物。", details: ["温和内敛，具有极高的审美感悟力和对大自然的热爱", "活在当下，讨厌受到教条和条条框框的束缚，渴望自由"], suggestions: ["适合美术设计师、摄影师、手工艺家等。"] },
    ESTP: { name: "企业家", description: "聪明、精力充沛且非常有同理心的人，真正享受生活在边缘。", details: ["极具行动力，观察力敏锐，能够瞬间发现周围环境的变化", "风趣幽默，擅长现场即兴沟通，在谈判或销售中极具魅力"], suggestions: ["适合销售精英、危机公关、创业者、商务拓展等岗位。"] },
    ESFP: { name: "表演者", description: "自发的、精力充沛和热情的表演者，生活在他们周围绝不无聊。", details: ["人来疯，充满舞台感，是聚光灯的焦点与氛围制造者", "活泼开朗，擅长享受生活中的感官之美"], suggestions: ["适合演艺策划、社群接待、文旅顾问、客户公关等。"] }
};
/**
 * 累加选项得分公共辅助函数
 */
function tallyScores(npcId, answers) {
    const scores = {};
    const questions = localQuestions_1.LOCAL_QUIZZES[npcId] || [];
    answers.forEach(ans => {
        const question = questions.find(q => Number(q.id) === Number(ans.questionId));
        const option = question === null || question === void 0 ? void 0 : question.options.find((o) => String(o.id) === String(ans.selectedOptionId));
        if (option === null || option === void 0 ? void 0 : option.weights) {
            option.weights.forEach((w) => {
                scores[w.dimension] = (scores[w.dimension] || 0) + w.value;
            });
        }
    });
    return scores;
}
/**
 * 通用本地测试评估打分引擎
 */
function calculateLocalQuiz(npcId, answers) {
    const scores = tallyScores(npcId, answers);
    switch (npcId) {
        case 'npc_mbti': {
            const getPct = (left, right) => {
                const lScore = scores[left] || 0;
                const rScore = scores[right] || 0;
                return lScore >= rScore ? left : right;
            };
            const code = [getPct('E', 'I'), getPct('S', 'N'), getPct('T', 'F'), getPct('J', 'P')].join('');
            const profile = mbtiResults[code] || { name: '探索家', description: '独特的灵魂，对未来充满期待。', details: [], suggestions: [] };
            return { code, name: `${code} · ${profile.name}`, description: profile.description, details: profile.details, suggestions: profile.suggestions, scores };
        }
        case 'npc_bigfive': {
            // 找出得分最高的维度
            const dimensions = { O: '开放性', C: '尽责性', E: '外向性', A: '宜人性', N: '神经质' };
            let maxDim = 'O';
            let maxScore = -1;
            Object.keys(dimensions).forEach(dim => {
                const score = scores[dim] || 0;
                if (score > maxScore) {
                    maxScore = score;
                    maxDim = dim;
                }
            });
            const reports = {
                O: { name: "高开放性探索者", desc: "充满强烈的好奇心、想象力与艺术感知，倾向于打破常规。", details: ["乐于接触新思想，思维跳跃活跃", "对未知领域有强烈求知欲，注重精神探索"], suggestions: ["适合从事创意策划、艺术设计、前沿科学研究等工作。"] },
                C: { name: "高尽责性自律者", desc: "具有强大的自律、高效计划与完美交付能力，为人高度可靠。", details: ["做事严谨规范，极其注重流程与细节", "时间观念极强，追求完美交付和契约精神"], suggestions: ["适合项目经理、财务审计、系统架构设计等精密行业。"] },
                E: { name: "高外向性社交达人", desc: "从人际交往与热闹群体中获取源源不断能量的社交中心。", details: ["善于表达自我，主动建立人际网络", "情感丰沛，具有卓越的感染力与现场气场"], suggestions: ["建议尝试销售管理、公共关系、活动策划及自媒体运营。"] },
                A: { name: "高宜人性调停者", desc: "极具同理心与利他情怀，习惯站在他人立场上解决矛盾。", details: ["温和包容，注重团队和谐，是完美的倾听者", "乐于付出与妥协，深受同伴信任"], suggestions: ["适合教育咨询、人力资源、调解专家、心理咨询等岗位。"] },
                N: { name: "高情绪敏感体质", desc: "对外部环境及内心起伏有极高的感应灵敏度，共情力极其充沛。", details: ["能够捕捉到他人忽略的微小情绪波动", "在艺术创作或深度理解人性上具有天然优势"], suggestions: ["建议多练习正念冥想，可从事创意写作、艺术设计或独立顾问。"] }
            };
            const result = reports[maxDim];
            return { code: maxDim, name: result.name, description: result.desc, details: result.details, suggestions: result.suggestions, scores };
        }
        case 'npc_enneagram': {
            const enneagramNames = {
                "1": "1号 完美主义者", "2": "2号 给予者/助人型", "3": "3号 实干者/成就型",
                "4": "4号 艺术型/浪漫者", "5": "5号 理智型/观察者", "6": "6号 忠诚型/怀疑论者",
                "7": "7号 活跃型/享乐者", "8": "8号 领袖型/挑战者", "9": "9号 和平型/调停者"
            };
            let bestType = '9';
            let maxVal = -1;
            Object.keys(enneagramNames).forEach(k => {
                const val = scores[k] || 0;
                if (val > maxVal) {
                    maxVal = val;
                    bestType = k;
                }
            });
            const descMap = {
                "1": { desc: "追求完美与秩序，自我要求极高，注重道德与正确性。", details: ["做人正直，讲原则，追求事事合理", "害怕犯错，时常处于自省和批判状态"], suggestions: ["试着接纳不完美，学会对自己和周围的人宽容。"] },
                "2": { desc: "通过帮助和奉献他人来获取自我价值认同与关怀。", details: ["极具亲和力，时刻关注他人的需要", "容易忽视自身的真实欲望，害怕被排斥"], suggestions: ["学会在付出前设立边界，学会向他人表达自己的需要。"] },
                "3": { desc: "高效实干，以结果和成就为核心导向，渴望出人头地。", details: ["执行力爆表，目标明确，擅长自我包装", "容易陷入盲目竞争，忽略内心的情感"], suggestions: ["偶尔停下来，问问自己到底真正热爱什么，而非别人期待什么。"] },
                "4": { desc: "拥有极其独特的情感世界，追求本真，害怕平庸。", details: ["审美敏感，具有非凡的艺术感悟力", "情绪起伏大，容易陷入顾影自怜"], suggestions: ["将情绪情感转化为创造性输出，避免过度沉溺自我。"] },
                "5": { desc: "用知识和观察来防御外部世界，追求理智的清晰与独立。", details: ["分析力极强，喜欢沉浸在独立钻研中", "容易游离于群体之外，情感显得冷漠"], suggestions: ["尝试从“观察者”走向“参与者”，与周围人建立情感连接。"] },
                "6": { desc: "警惕性高，关注潜在危机，需要确定团队的安全与忠诚。", details: ["忠诚可靠，非常有危机意识与做计划兜底", "容易产生焦虑和自我怀疑"], suggestions: ["相信自己的直觉，用积极的眼光去看待未来的变动。"] },
                "7": { desc: "探索快乐与新奇体验的享乐主义，脑洞大，害怕受限制。", details: ["开朗幽默，兴趣极其多元广泛", "容易三分钟热度，逃避深层痛苦与承诺"], suggestions: ["学会聚焦，在同一个领域深度钻研，直面必要的单调与枯燥。"] },
                "8": { desc: "意志坚定，直面挑战与冲突，渴望掌握力量和主导权。", details: ["天生具有领袖风骨，保护弱者，爱憎分明", "性格偏强势，容易给他人造成压迫感"], suggestions: ["学会在适当时候展现温柔和脆弱，这才是真正的强者力量。"] },
                "9": { desc: "渴望内心的平静与和谐，逃避冲突，是天然的调停专家。", details: ["温和宽容，极易相处，注重集体的安定", "容易妥协自我，做事容易拖延或消极应对"], suggestions: ["勇敢表达自己的不同意见，直面冲突是成长的开始。"] }
            };
            const meta = descMap[bestType];
            return { code: bestType, name: enneagramNames[bestType], description: meta.desc, details: meta.details, suggestions: meta.suggestions, scores };
        }
        case 'npc_disc': {
            const discNames = { D: "支配型 (D)", I: "影响型 (I)", S: "稳健型 (S)", C: "谨慎型 (C)" };
            let maxK = 'D';
            let maxVal = -1;
            Object.keys(discNames).forEach(k => {
                const val = scores[k] || 0;
                if (val > maxVal) {
                    maxVal = val;
                    maxK = k;
                }
            });
            const meta = {
                D: { desc: "雷厉风行、直截了当的开拓者。以结果为驱动，直面挑战。", details: ["做事果断，独立且自信心强大", "好胜心强，在危机中能够快速主导大局"], suggestions: ["倾听团队中慢节奏的意见，做事多一些同理心和耐心。"] },
                I: { desc: "热情洋溢、风趣幽默的倡导者。善于用梦想和魅力凝聚人心。", details: ["极其擅长社交沟通，善于调动和活跃氛围", "创意无限，思想开阔外露"], suggestions: ["注重执行细节的落地，警惕虎头蛇尾与粗心大意。"] },
                S: { desc: "沉稳务实、温和体贴的守护者。是团队最可靠的协作后盾。", details: ["善于倾听，极具耐心，注重团队稳定与和谐", "不喜欢突如其来的变动，做事脚踏实地"], suggestions: ["勇敢直面必要的冲突，不要害怕并尝试去适应突发的剧烈变革。"] },
                C: { desc: "冷静客观、用数据说话的分析家。极其关注规则、精度与科学性。", details: ["逻辑严密，追求零失误和高品质标准", "做事严谨规范，尊重流程"], suggestions: ["尝试接受在信息不全时的敏捷决策，降低完美的苛刻要求。"] }
            };
            const res = meta[maxK];
            return { code: maxK, name: discNames[maxK], description: res.desc, details: res.details, suggestions: res.suggestions, scores };
        }
        case 'npc_holland': {
            // 霍兰德职业兴趣，找前两个最高分
            const riasecNames = { R: '现实型', I: '研究型', A: '艺术型', S: '社会型', E: '企业型', C: '常规型' };
            const sorted = Object.keys(riasecNames).sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
            const code = sorted.slice(0, 2).join(''); // 如 'IA'
            const primaryType = sorted[0];
            const detailMap = {
                R: { desc: "偏好亲自动手的具体工作，喜欢与机器、工具打交道。", details: ["务实坚韧，操作能力强", "喜欢具体的操作任务而非虚无的理论抽象"], suggestions: ["适合工程技术、精密制造、农业研究或野外作业岗位。"] },
                I: { desc: "渴望探寻世界底层真理的探索家，逻辑缜密，享受解谜。", details: ["热衷科学钻研、深度分析和独立思考", "不喜欢繁文缛节，思维极度理性"], suggestions: ["适合研发科学家、算法工程师、医学研究、独立分析师。"] },
                A: { desc: "崇尚感性与直觉的自由创作者，对审美有异于常人的灵敏度。", details: ["情感饱满丰富，充满艺术激情", "追求自我表达，讨厌重复单调的工作"], suggestions: ["适合艺术设计、创意策划、新媒体导演、自由撰稿人。"] },
                S: { desc: "以人为本的利他关怀者，热心于教学、心理咨询和帮助他人。", details: ["极具亲和力，同理心强，乐于为他人成长提供能量", "重视社会福祉和关系和谐"], suggestions: ["适合教师、心理咨询师、医生、社群运营专家。"] },
                E: { desc: "具有战略野心的商业领袖，擅长说服他人，追求成就与影响。", details: ["自信果敢，敢于冒险，对商业机会非常敏锐", "沟通影响力出众，擅长组织与动员"], suggestions: ["适合创业伙伴、商务拓展(BD)、企业经理、公关专家。"] },
                C: { desc: "精准严密的数据保管人，在规律和秩序中感到高度安全舒适。", details: ["一丝不苟，对数字、文字档案整理有超强耐心", "极强的规范执行力"], suggestions: ["适合财务分析、数据库管理员、质量检测、行政管理。"] }
            };
            const result = detailMap[primaryType];
            const combiName = `${riasecNames[sorted[0]]} + ${riasecNames[sorted[1]]}`;
            return {
                code,
                name: `霍兰德型: ${code} (${combiName})`,
                description: result.desc,
                details: result.details,
                suggestions: [`职业匹配推荐: 契合含有 ${riasecNames[sorted[0]]} 与 ${riasecNames[sorted[1]]} 交叉属性的复合型岗位。`],
                scores
            };
        }
        case 'npc_gallup': {
            const gallupNames = { Strategic: "战略思维型", Executing: "高效执行型", Relating: "关系建立型", Influencing: "社会影响型" };
            let maxK = 'Strategic';
            let maxVal = -1;
            Object.keys(gallupNames).forEach(k => {
                const val = scores[k] || 0;
                if (val > maxVal) {
                    maxVal = val;
                    maxK = k;
                }
            });
            const meta = {
                Strategic: { desc: "能在纷乱的信息海洋中瞬间理清因果，找到最佳突破路径。", details: ["具有前瞻的宏观概念力，善于作路线规划", "对底层原理和未来趋势感应灵敏"], suggestions: ["做团队的“总设计师”，主导发展路径和逻辑决策。"] },
                Executing: { desc: "拥有无与伦比的行动激情，注重任务落地和彻底的执行收尾。", details: ["高度讲究效率，喜欢列清单并逐一消灭它们", "责任心极强，绝不容许项目烂尾"], suggestions: ["做团队的“推进发动机”，把复杂的规划方案转化为高品质成果。"] },
                Relating: { desc: "天然的团队凝聚润滑剂，能与同伴建立深厚而稳固的长期默契。", details: ["极强的共情与包容力，注重团队关系的相互关怀", "做人务实谦逊，让人感到高度可靠"], suggestions: ["做团队的“文化纽带”，维系团队在重压下的士气与和谐度。"] },
                Influencing: { desc: "拥有出类拔萃的号召力，善于输出主张并动员群体力量前进。", details: ["能量外露热情，极具说服力和现场鼓舞力", "善于将想法推销给他人"], suggestions: ["做团队的“首席公关”或“动员领袖”，在对外拓展中打开局面。"] }
            };
            const res = meta[maxK];
            return { code: maxK, name: gallupNames[maxK], description: res.desc, details: res.details, suggestions: res.suggestions, scores };
        }
        case 'npc_belbin': {
            const belbinNames = { CO: "协调者 (Coordinator)", PL: "创新者 (Plant)", SH: "推进者 (Shaper)", ME: "完善者 (Monitor Evaluator)" };
            let maxK = 'CO';
            let maxVal = -1;
            Object.keys(belbinNames).forEach(k => {
                const val = scores[k] || 0;
                if (val > maxVal) {
                    maxVal = val;
                    maxK = k;
                }
            });
            const meta = {
                CO: { desc: "主持大局，统筹并调配团队资源的民主核心领袖。", details: ["善于发现同伴的优点并分派任务", "心态沉稳，能够凝聚大家的智慧走向统一目标"], suggestions: ["适合担任项目经理、组长或部门核心协调者。"] },
                PL: { desc: "特立独行、脑洞大开，能在复杂瓶颈中提供破局灵感的怪才。", details: ["想象力惊人，思维极度跳跃不设防", "擅长解决疑难杂症，但偶尔忽略繁琐规则"], suggestions: ["担任团队的创意总监或架构突破先锋，避免陷入枯燥的行政琐事。"] },
                SH: { desc: "不畏重压、勇往直前的火车头。渴望克服障碍并拿到结果。", details: ["极其渴望挑战，斗志昂扬", "督促团队在重压下保持快节奏，容忍不了松懈"], suggestions: ["适合扮演执行攻坚队长或需要迅速见成效的破局项目主导人。"] },
                ME: { desc: "理智冷静、一丝不苟的漏洞排查官与科学评估员。", details: ["具有卓越的批判性思维，极少受情感偏见左右", "能敏锐查出方案中致命的逻辑缺陷"], suggestions: ["担任项目质量终审员、安全架构师或战略风险评估官。"] }
            };
            const res = meta[maxK];
            return { code: maxK, name: belbinNames[maxK], description: res.desc, details: res.details, suggestions: res.suggestions, scores };
        }
        case 'npc_color': {
            const colorNames = { Red: "红色性格 (热情派)", Blue: "蓝色性格 (理性派)", Yellow: "黄色性格 (掌控派)", Green: "绿色性格 (和平派)" };
            let maxK = 'Red';
            let maxVal = -1;
            Object.keys(colorNames).forEach(k => {
                const val = scores[k] || 0;
                if (val > maxVal) {
                    maxVal = val;
                    maxK = k;
                }
            });
            const meta = {
                Red: { desc: "热情洋溢、情感充沛的自由灵魂。注重体验和人际联结。", details: ["性格活泼开朗，感召力出众，渴望表达", "容易被情感左右，讨厌沉闷无聊的规则"], suggestions: ["建议发挥表达优势，可从事内容运营、公关策划或团队破冰。"] },
                Blue: { desc: "深思熟虑、注重逻辑与深层精神内核的思想家。", details: ["说话讲究因果依据，做事极其有条理和原则性", "外冷内热，对人对事高度忠诚可靠"], suggestions: ["适合从事独立科研、数据分析、代码架构设计或文字工作。"] },
                Yellow: { desc: "自信果敢、结果导向的实干派。直面阻碍，掌控力强。", details: ["行动极其迅速，敢说敢干，追求成效", "自律且要强，天生的变革者"], suggestions: ["可主导大型项目落地推进，建议多听取团队中绿色性格的缓冲意见。"] },
                Green: { desc: "温和低调、不争不抢的和平使者。注重氛围的舒适与安宁。", details: ["极其善于倾听，待人接物极为包容友善", "不喜欢剧烈的变动和正面的尖锐冲突"], suggestions: ["适合扮演客服协调、团队行政支持、社群联结者等温暖角色。"] }
            };
            const res = meta[maxK];
            return { code: maxK, name: colorNames[maxK], description: res.desc, details: res.details, suggestions: res.suggestions, scores };
        }
        case 'npc_harry': {
            const houses = { Gryffindor: "格兰芬多 (Lion)", Slytherin: "斯莱特林 (Snake)", Ravenclaw: "拉文克劳 (Eagle)", Hufflepuff: "赫奇帕奇 (Badger)" };
            let maxK = 'Gryffindor';
            let maxVal = -1;
            Object.keys(houses).forEach(k => {
                const val = scores[k] || 0;
                if (val > maxVal) {
                    maxVal = val;
                    maxK = k;
                }
            });
            const meta = {
                Gryffindor: { desc: "“你也许属于格兰芬多，那里有埋藏在心底的勇敢。他们的胆识、气魄和豪爽，使格兰芬多出类拔萃。”", details: ["热血坚韧，面对不公或挑衅敢于挺身而出", "极具冒险和探索精神，喜欢做先锋"], suggestions: ["格兰芬多训条：勇气不只是为了对抗敌人，有时更是为了向朋友说不。"] },
                Slytherin: { desc: "“也许你会在斯莱特林建立伟业，那些狡黠的同伴会不择手段达成目标。他们渴望权力，注重精英法则。”", details: ["野心勃勃，深谋远虑，极其看重自我成长和目标达成", "非常忠于少数受其认可的同伴"], suggestions: ["斯莱特林训条：野心与审慎同行，权力当与责任对齐。"] },
                Ravenclaw: { desc: "“如果你头脑聪明，或许会进拉文克劳。那些睿智而博学的人，总会在那里遇到同道。”", details: ["求知欲爆表，极度渴望探索世界真理和解谜", "思维独立深邃，崇尚个性和见识"], suggestions: ["拉文克劳训条：过人的聪明才智是人类最大的财富。"] },
                Hufflepuff: { desc: "“你也许属于赫奇帕奇，那里的人正直忠诚。哈奇帕奇们耐心克己，不畏艰辛，极其注重平等。”", details: ["极其忠诚靠谱，任劳任怨，是集体的磐石", "做人务实正直，具有伟大的包容力与同理心"], suggestions: ["赫奇帕奇训条：最坚韧的石头往往不显山露水。默默守护同伴是伟大的超能力。"] }
            };
            const res = meta[maxK];
            return { code: maxK, name: houses[maxK], description: res.desc, details: res.details, suggestions: res.suggestions, scores };
        }
        case 'npc_mmpi': {
            const dimensions = { Depression: '抑郁低落', Anxiety: '焦虑紧绷', Paranoia: '敏感怀疑', Hypochondriasis: '躯体关注' };
            let highDims = [];
            Object.keys(dimensions).forEach(k => {
                if ((scores[k] || 0) >= 2) {
                    highDims.push(dimensions[k]);
                }
            });
            if (highDims.length > 0) {
                return {
                    code: 'Sensitive',
                    name: "情绪敏感波动状态",
                    description: "本次自测提示你近期在部分情绪维度上处于相对饱满/敏感的状态。",
                    details: [`检测到近期有些偏高状态的维度: ${highDims.join('、')}`, "这可能是由于学业或生活压力造成的轻度紧绷反应"],
                    suggestions: ["建议合理作息，尝试正念冥想以释放大脑疲劳。", "如果持续感到困扰，建议找亲友或专业心理老师聊聊放松一下。"],
                    scores
                };
            }
            else {
                return {
                    code: 'Stable',
                    name: "心智状态稳定健康",
                    description: "恭喜！本次筛查显示你的各项情绪维度指标均处于非常健康的稳定值范围。",
                    details: ["情绪总体阳光稳定，适应力良好", "日常心态较好，对外部压力有出色的自我代谢调节力"],
                    suggestions: ["继续保持良好作息，多与阳光的朋友交往。", "在生活中保持运动或发展个人兴趣爱好以维持这一健康状态！"],
                    scores
                };
            }
        }
        case 'npc_rorschach': {
            const types = { Dynamic: "发散创造型 (Dynamic)", Analytic: "细节理智型 (Analytic)", Static: "沉稳秩序型 (Static)" };
            let maxK = 'Dynamic';
            let maxVal = -1;
            Object.keys(types).forEach(k => {
                const val = scores[k] || 0;
                if (val > maxVal) {
                    maxVal = val;
                    maxK = k;
                }
            });
            const meta = {
                Dynamic: { desc: "你的潜意识思维极其活跃、发散，容易被运动的能量、花叶及有机生命形态所吸引。", details: ["脑洞大开，擅长在模糊和抽象的意象中发现生命的动感", "天生具有极高的创造力和艺术发散本能"], suggestions: ["建议经常写写随笔、画画、听听音乐，你的创意和灵性是强大的财富！"] },
                Analytic: { desc: "你拥有一双善于发现微小局部的细节理智眼光，倾向于寻找对称的恶魔脸、大眼睛等细节轮廓。", details: ["逻辑极其冷静细腻，善于做特征提取", "擅长从事侦查、代码 Debug、微观校准等精细活"], suggestions: ["可以尝试从事数据科学、精密制造、或者科学技术研发岗位。"] },
                Static: { desc: "你偏向于宏观、稳定的几何或物体意象（如石碑、天平、皇冠），重视内心的平静与确定感。", details: ["做事追求底座的安稳可靠，讲规矩，有韧性", "情绪稳定性极高，不容易受突发刺激所动摇"], suggestions: ["适合需要做战略定力、资产管理、或者复杂系统架构支持的岗位。"] }
            };
            const res = meta[maxK];
            return { code: maxK, name: types[maxK], description: res.desc, details: res.details, suggestions: res.suggestions, scores };
        }
        default:
            return { code: 'UNKNOWN', name: '探索家', description: '独立的灵魂，对未来充满期待。', details: [], suggestions: [] };
    }
}
/**
 * 历史遗留兼容接口：计算本地 MBTI 结果（含维度详情对照）
 */
function calculateLocalMBTI(answers) {
    const scores = tallyScores('npc_mbti', answers);
    const getPct = (left, right) => {
        const lScore = scores[left] || 0;
        const rScore = scores[right] || 0;
        return lScore >= rScore ? left : right;
    };
    const code = [getPct('E', 'I'), getPct('S', 'N'), getPct('T', 'F'), getPct('J', 'P')].join('');
    const profile = mbtiResults[code] || { name: '探索家', description: '独特的灵魂，对未来充满期待。', details: [], suggestions: [] };
    const calculateSingle = (left, right) => {
        const lVal = scores[left] || 0;
        const rVal = scores[right] || 0;
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
    return {
        code,
        name: `${code} · ${profile.name}`,
        description: profile.description,
        details: profile.details,
        suggestions: profile.suggestions,
        dimensions,
        scores
    };
}
