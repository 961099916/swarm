
import type { StageConfig, NPCChallengeConfig, StageQuestion } from "../types";

/**
 * 8个子年级关卡、16位NPC导师以及各自的题目题库配置
 */
export const STAGE_CONFIGS: Record<string, StageConfig> = {
  // ==================== 1. 幼儿园小班 ====================
  'kindergarten_1': {
    stageId: 'kindergarten_1',
    stageName: '幼儿园小班',
    stageGroup: 'kindergarten',
    stageOrder: 1,
    challenges: [
      {
        npcId: 'npc_kg1_math',
        npcName: '小班算术导师 小红老师',
        npcType: 'math',
        subjectName: '数学',
        requiredScore: 60,
        dialogueText: {
          locked: '小朋友，小班的大门还没对你敞开哦，快去完成前面的任务吧！',
          todo: '小朋友你好呀！我是小红老师，来跟我比比数字、数数红花，通关就能得到红花奖励哦！',
          passed: '你真是个数数小天才！我的数学考核你已经高分通过啦，真棒！'
        },
        questions: [
          {
            id: 101,
            text: '数一数这里有几朵花：🌸🌸🌸',
            options: [
              { id: 'A', text: '3朵' },
              { id: 'B', text: '4朵' },
              { id: 'C', text: '5朵' }
            ],
            correctId: 'A',
            explanation: '我们可以一个一个数：一、二、三，一共有 3 朵小红花。'
          },
          {
            id: 102,
            text: '比 3 大且比 5 小的数字是几？',
            options: [
              { id: 'A', text: '2' },
              { id: 'B', text: '4' },
              { id: 'C', text: '6' }
            ],
            correctId: 'B',
            explanation: '在 1 到 10 的数字顺序中，3 后面是 4，4 后面是 5。所以 4 比 3 大且比 5 小。'
          },
          {
            id: 103,
            text: '哪一个是圆圆的、像太阳一样的形状？',
            options: [
              { id: 'A', text: '三角形' },
              { id: 'B', text: '圆形' },
              { id: 'C', text: '正方形' }
            ],
            correctId: 'B',
            explanation: '圆形是圆溜溜没有角的，像天上的太阳和皮球一样。'
          }
        ]
      },
      {
        npcId: 'npc_kg1_chinese',
        npcName: '小班语言导师 小蓝老师',
        npcType: 'language',
        subjectName: '语文',
        requiredScore: 60,
        dialogueText: {
          locked: '嘘——小蓝老师正在备课呢，等小班解锁了再来找我哦。',
          todo: '你好呀小朋友！我是小蓝老师。我们来认识拼音和儿歌，看看你的语文棒不棒！',
          passed: '真好听！你的拼音和儿歌读得太准了，恭喜你通过小蓝老师的语言课！'
        },
        questions: [
          {
            id: 104,
            text: '拼音字母中的第一个声母是哪个？',
            options: [
              { id: 'A', text: 'o' },
              { id: 'B', text: 'a' },
              { id: 'C', text: 'b' }
            ],
            correctId: 'C',
            explanation: 'a 和 o 属于单韵母，声母表的第一个声母是 b（播）。'
          },
          {
            id: 105,
            text: '在“人口”这个词语里，“人”字是由几笔写成的？',
            options: [
              { id: 'A', text: '一笔' },
              { id: 'B', text: '两笔' },
              { id: 'C', text: '三笔' }
            ],
            correctId: 'B',
            explanation: '“人”字由一撇、一捺两笔写成。'
          },
          {
            id: 106,
            text: '儿歌《小星星》：“一闪一闪亮晶晶，满天都是___”',
            options: [
              { id: 'A', text: '小月亮' },
              { id: 'B', text: '小红花' },
              { id: 'C', text: '小星星' }
            ],
            correctId: 'C',
            explanation: '经典儿歌歌词为：“一闪一闪亮晶晶，满天都是小星星”。'
          }
        ]
      },
      {
        npcId: 'npc_kg1_boss',
        npcName: '小班期末考官 大魔王',
        npcType: 'general',
        subjectName: '综合大考',
        requiredScore: 60,
        dialogueText: {
          locked: '大考官正在批改试卷，请先完成小班的数学和语言课挑战！',
          todo: '我是小班期末考官大魔王。这里有算术、图形和拼音的综合考核，准备好接受挑战了吗？',
          passed: '真棒！你通过了小班 the 综合大考，已经具备升入大班的实力啦！'
        },
        questions: [
          {
            id: 110,
            text: '数一数这里有几个气球：🎈🎈🎈🎈',
            options: [
              { id: 'A', text: '3个' },
              { id: 'B', text: '4个' },
              { id: 'C', text: '5个' }
            ],
            correctId: 'B',
            explanation: '我们可以一个一个数：一、二、三、四，一共有 4 个气球。'
          },
          {
            id: 111,
            text: '拼音单韵母共有 6 个，下面哪一个是单韵母？',
            options: [
              { id: 'A', text: 'm' },
              { id: 'B', text: 'u' },
              { id: 'C', text: 'g' }
            ],
            correctId: 'B',
            explanation: '单韵母包括：a、o、e、i、u、ü，所以 u 是单韵母，m 和 g 是声母。'
          },
          {
            id: 112,
            text: '下面哪一个是正方形的特征？',
            options: [
              { id: 'A', text: '有四个直角' },
              { id: 'B', text: '圆圆的' },
              { id: 'C', text: '只有三个角' }
            ],
            correctId: 'A',
            explanation: '正方形有四个直角和四条相等的边。圆圆的是圆形，只有三个角的是三角形。'
          }
        ]
      }
    ]
  },

  // ==================== 2. 幼儿园大班 ====================
  'kindergarten_2': {
    stageId: 'kindergarten_2',
    stageName: '幼儿园大班',
    stageGroup: 'kindergarten',
    stageOrder: 2,
    challenges: [
      {
        npcId: 'npc_kg2_math',
        npcName: '大班算术导师 小橙老师',
        npcType: 'math',
        subjectName: '数学',
        requiredScore: 60,
        dialogueText: {
          locked: '大班的数学课可难啦！你要先通过小班的全部考核才能进来哦。',
          todo: '哈哈，欢迎来到大班！我是小橙老师。我们这次要算10以内的加减法，准备好了吗？',
          passed: '10以内的计算完全难不倒你，小橙老师给你点赞！'
        },
        questions: [
          {
            id: 201,
            text: '小明手上有 5 个苹果，分给小红 2 个，小明还剩几个？',
            options: [
              { id: 'A', text: '2个' },
              { id: 'B', text: '3个' },
              { id: 'C', text: '4个' }
            ],
            correctId: 'B',
            explanation: '用减法计算：5 - 2 = 3 个。'
          },
          {
            id: 202,
            text: '3 加上 4 等于多少？',
            options: [
              { id: 'A', text: '6' },
              { id: 'B', text: '7' },
              { id: 'C', text: '8' }
            ],
            correctId: 'B',
            explanation: '计算加法：3 + 4 = 7。'
          },
          {
            id: 203,
            text: '哪一个物体是“球体”，可以往任意方向滚动？',
            options: [
              { id: 'A', text: '魔方' },
              { id: 'B', text: '乒乓球' },
              { id: 'C', text: '铅笔盒' }
            ],
            correctId: 'B',
            explanation: '乒乓球是圆溜溜的球体，魔方是正方体，铅笔盒通常是长方体。'
          },
          {
            id: 204,
            text: '树上有 8 只小鸟，飞走了 3 只，树上还有几只？',
            options: [
              { id: 'A', text: '4只' },
              { id: 'B', text: '5只' },
              { id: 'C', text: '6只' }
            ],
            correctId: 'B',
            explanation: '使用减法：8 - 3 = 5 只。'
          }
        ]
      },
      {
        npcId: 'npc_kg2_logic',
        npcName: '大班语言导师 小绿老师',
        npcType: 'language',
        subjectName: '语文',
        requiredScore: 60,
        dialogueText: {
          locked: '我是小绿老师，大班汉字乐园目前还是锁定的哟，请先升学！',
          todo: '小朋友，大班的小绿老师带你认识更多汉字和古诗，一起来挑战吧！',
          passed: '古诗背得太棒了！看来你已经做好进入小学的准备了，小绿老师为你感到骄傲！'
        },
        questions: [
          {
            id: 205,
            text: '“山”这个字的拼音是：',
            options: [
              { id: 'A', text: 'sān' },
              { id: 'B', text: 'shān' },
              { id: 'C', text: 'shāng' }
            ],
            correctId: 'B',
            explanation: '“山”是翘舌音，读音为 shān。'
          },
          {
            id: 206,
            text: '《静夜思》的第一句是：“床前明___光”',
            options: [
              { id: 'A', text: '月' },
              { id: 'B', text: '阳' },
              { id: 'C', text: '星' }
            ],
            correctId: 'A',
            explanation: '唐代诗人李白所写的《静夜思》开头为：“床前明月光，疑是地上霜”。'
          },
          {
            id: 207,
            text: '生字“口”的第二笔是什么？',
            options: [
              { id: 'A', text: '横折' },
              { id: 'B', text: '竖' },
              { id: 'C', text: '横' }
            ],
            correctId: 'A',
            explanation: '“口”字的笔顺为：第一笔竖，第二笔横折，第三笔横。'
          },
          {
            id: 208,
            text: '下列哪一个是“水”字的象形文字特征？',
            options: [
              { id: 'A', text: '像一团燃烧的火' },
              { id: 'B', text: '像弯曲流动的波纹' },
              { id: 'C', text: '像一棵生长的树木' }
            ],
            correctId: 'B',
            explanation: '甲骨文中的“水”字模仿了水流波纹的形状。'
          }
        ]
      },
      {
        npcId: 'npc_kg2_boss',
        npcName: '大班毕业考官 大魔王',
        npcType: 'general',
        subjectName: '综合大考',
        requiredScore: 60,
        dialogueText: {
          locked: '毕业大考需要你先完成大班的数学和语言挑战，快去准备吧！',
          todo: '恭喜你来到大班毕业大考！我是毕业考官大魔王。通过这次大考，你就可以正式毕业升入小学啦！',
          passed: '恭喜你！顺利通过大班毕业考核，你现在是一名合格的小学一年级新生啦！'
        },
        questions: [
          {
            id: 210,
            text: '小明有 6 支铅笔，用掉了 3 支，妈妈又送给他 4 支，他现在有几支？',
            options: [
              { id: 'A', text: '6支' },
              { id: 'B', text: '7支' },
              { id: 'C', text: '8支' }
            ],
            correctId: 'B',
            explanation: '先做减法再做加法：6 - 3 = 3 支，3 + 4 = 7 支。'
          },
          {
            id: 211,
            text: '拼音“xióng”（熊）的介母是哪一个字母？',
            options: [
              { id: 'A', text: 'x' },
              { id: 'B', text: 'i' },
              { id: 'C', text: 'o' }
            ],
            correctId: 'B',
            explanation: '“xióng”的声母是 x，韵母是 iong，介母是 i。'
          },
          {
            id: 212,
            text: '古诗《悯农》中，“汗滴禾下___”的横线上应该填什么字？',
            options: [
              { id: 'A', text: '土' },
              { id: 'B', text: '田' },
              { id: 'C', text: '地' }
            ],
            correctId: 'A',
            explanation: '经典唐诗《悯农》原文：“锄禾日当午，汗滴禾下土”。'
          }
        ]
      }
    ]
  },

  // ==================== 3. 小学一年级 ====================
  'primary_1': {
    stageId: 'primary_1',
    stageName: '小学一年级',
    stageGroup: 'primary',
    stageOrder: 3,
    challenges: [
      {
        npcId: 'npc_p1_chinese',
        npcName: '一年级语文老师 张老师',
        npcType: 'language',
        subjectName: '语文',
        requiredScore: 60,
        dialogueText: {
          locked: '同学你好，我是张老师。一年级的语文课需要你通过幼儿园考核才能参与。',
          todo: '欢迎步入小学阶段！我是语文张老师。我们来测试一年级的基础字词拼音与课文。',
          passed: '底子很扎实！一年级语文考核通过，希望你保持对国学的热爱！'
        },
        questions: [
          {
            id: 301,
            text: '“睡觉”的“觉”字在这里的正确读音是：',
            options: [
              { id: 'A', text: 'jiào' },
              { id: 'B', text: 'jué' },
              { id: 'C', text: 'jiǎo' }
            ],
            correctId: 'A',
            explanation: '“觉”是多音字，在“睡觉”中读 jiào，在“觉得/觉醒”中读 jué。'
          },
          {
            id: 302,
            text: '下列汉字的读音中，哪一个是整体认读音节？',
            options: [
              { id: 'A', text: '衣 (yī)' },
              { id: 'B', text: '八 (bā)' },
              { id: 'C', text: '马 (mǎ)' }
            ],
            correctId: 'A',
            explanation: 'yī 是整体认读音节，不需要声母和韵母相拼，直接读出。'
          },
          {
            id: 303,
            text: '下面哪一组汉字全都是“左右结构”的？',
            options: [
              { id: 'A', text: '朋、明' },
              { id: 'B', text: '花、草' },
              { id: 'C', text: '国、同' }
            ],
            correctId: 'A',
            explanation: '“朋”、“明”都是左右结构。“花”、“草”是上下结构，“国”是全包围，“同”是半包围。'
          },
          {
            id: 304,
            text: '“大”的反义词是：',
            options: [
              { id: 'A', text: '高' },
              { id: 'B', text: '小' },
              { id: 'C', text: '多' }
            ],
            correctId: 'B',
            explanation: '“大”和“小”是一对经典的反义词。'
          },
          {
            id: 305,
            text: '古诗《悯农》：“谁知盘中餐，粒粒皆___”',
            options: [
              { id: 'A', text: '辛苦' },
              { id: 'B', text: '甜美' },
              { id: 'C', text: '粮食' }
            ],
            correctId: 'A',
            explanation: '李绅《悯农》后两句为：“谁知盘中餐，粒粒皆辛苦”，教育我们珍惜粮食。'
          }
        ]
      },
      {
        npcId: 'npc_p1_math',
        npcName: '一年级数学老师 李老师',
        npcType: 'math',
        subjectName: '数学',
        requiredScore: 60,
        dialogueText: {
          locked: '我是李老师，一年级数学办公室需要出示一年级入学通知书（通关大班）才能进入。',
          todo: '同学你好，我是数学李老师。来测一测 20 以内的进退位加减法和简单应用题吧！',
          passed: '脑瓜子转得真快！恭喜你通过了一年级数学考核，加法减法运用得很熟练嘛！'
        },
        questions: [
          {
            id: 306,
            text: '9 + 6 等于多少？',
            options: [
              { id: 'A', text: '14' },
              { id: 'B', text: '15' },
              { id: 'C', text: '16' }
            ],
            correctId: 'B',
            explanation: '凑十法：9 + 1 = 10，10 + 5 = 15。'
          },
          {
            id: 307,
            text: '15 减去 8 等于多少？',
            options: [
              { id: 'A', text: '6' },
              { id: 'B', text: '7' },
              { id: 'C', text: '8' }
            ],
            correctId: 'B',
            explanation: '破十法：10 - 8 = 2，2 + 5 = 7。'
          },
          {
            id: 308,
            text: '小红排队，从前面数她是第 4 个，从后面数她是第 3 个，这一队一共有多少人？',
            options: [
              { id: 'A', text: '6人' },
              { id: 'B', text: '7人' },
              { id: 'C', text: '8人' }
            ],
            correctId: 'A',
            explanation: '小红被重复数了两次，算式为：4 + 3 - 1 = 6人。'
          },
          {
            id: 309,
            text: '一个星期有几天？',
            options: [
              { id: 'A', text: '5天' },
              { id: 'B', text: '6天' },
              { id: 'C', text: '7天' }
            ],
            correctId: 'C',
            explanation: '一星期包括周一至周日共 7 天。'
          },
          {
            id: 310,
            text: '钟面上，分针指向 12，时针指向 6，这时候是几点钟？',
            options: [
              { id: 'A', text: '12点整' },
              { id: 'B', text: '6点半' },
              { id: 'C', text: '6点整' }
            ],
            correctId: 'C',
            explanation: '分针在12代表是整点，时针对准几就是几点整，此时为 6 点整。'
          }
        ]
      },
      {
        npcId: 'npc_p1_boss',
        npcName: '一年级期末考官 大魔王',
        npcType: 'general',
        subjectName: '综合大考',
        requiredScore: 60,
        dialogueText: {
          locked: '一年级期末考官大魔王正在准备试卷，请先完成一年级语文和数学的挑战！',
          todo: '我是期末考官大魔王。一年级的终极挑战是语文和数学的综合大考，快来试试吧！',
          passed: '非常好！你顺利通过了一年级的所有考核，可以升入二年级啦！'
        },
        questions: [
          {
            id: 320,
            text: '算式 18 - 9 等于多少？',
            options: [
              { id: 'A', text: '8' },
              { id: 'B', text: '9' },
              { id: 'C', text: '10' }
            ],
            correctId: 'B',
            explanation: '我们可以使用破十法：10 - 9 = 1，1 + 8 = 9。'
          },
          {
            id: 321,
            text: '下列拼音字母中，属于整体认读音节的是哪一个？',
            options: [
              { id: 'A', text: 'wu' },
              { id: 'B', text: 'sh' },
              { id: 'C', text: 'eng' }
            ],
            correctId: 'A',
            explanation: 'wu 是整体认读音节，不需要拼读。sh 是声母，eng 是后鼻韵母。'
          },
          {
            id: 322,
            text: '下列汉字中，哪一个是上下结构？',
            options: [
              { id: 'A', text: '林' },
              { id: 'B', text: '国' },
              { id: 'C', text: '花' }
            ],
            correctId: 'C',
            explanation: '“花”字是草字头（艹），为上下结构。“林”是左右结构，“国”是全包围结构。'
          }
        ]
      }
    ]
  },

  // ==================== 4. 小学二年级 ====================
  'primary_2': {
    stageId: 'primary_2',
    stageName: '小学二年级',
    stageGroup: 'primary',
    stageOrder: 4,
    challenges: [
      {
        npcId: 'npc_p2_science',
        npcName: '二年级语文老师 王老师',
        npcType: 'language',
        subjectName: '语文',
        requiredScore: 60,
        dialogueText: {
          locked: '你好，我是二年级语文王老师。要来我的考场，需要先完成一年级的学业哦。',
          todo: '你好，我是二年级语文王老师。我们来测试一下成语积累、词性理解和经典古诗！',
          passed: '满腹经纶！二年级语文王老师给你判定为优秀！'
        },
        questions: [
          {
            id: 401,
            text: '下列词语中，哪一个是“高兴”的近义词？',
            options: [
              { id: 'A', text: '难过' },
              { id: 'B', text: '快乐' },
              { id: 'C', text: '生气' }
            ],
            correctId: 'B',
            explanation: '“高兴”与“快乐”都表达喜悦的心情，互为近义词。'
          },
          {
            id: 402,
            text: '下列标点符号中，表示疑问语气的句子末尾应该用什么？',
            options: [
              { id: 'A', text: '句号。' },
              { id: 'B', text: '问号？' },
              { id: 'C', text: '感叹号！' }
            ],
            correctId: 'B',
            explanation: '疑问句表达疑问，句末应该使用问号（？）。'
          },
          {
            id: 403,
            text: '“春风吹绿了大地”中，“绿”字在这句话里表示的意思是：',
            options: [
              { id: 'A', text: '绿色的颜色' },
              { id: 'B', text: '变成绿色' },
              { id: 'C', text: '翠绿的青草' }
            ],
            correctId: 'B',
            explanation: '“绿”在这里用作动词，意思是“使……变成绿色”。'
          },
          {
            id: 404,
            text: '成语“初出茅庐”中的“茅庐”指的是什么？',
            options: [
              { id: 'A', text: '简陋的草房' },
              { id: 'B', text: '华丽的瓦房' },
              { id: 'C', text: '高耸的楼阁' }
            ],
            correctId: 'A',
            explanation: '茅庐指的是用茅草盖成的简陋草房。这里典出诸葛亮出山。'
          },
          {
            id: 405,
            text: '李白《赠汪伦》：“桃花潭水深千尺，不及汪伦送我___”',
            options: [
              { id: 'A', text: '情' },
              { id: 'B', text: '意' },
              { id: 'C', text: '歌' }
            ],
            correctId: 'A',
            explanation: '古诗原文：“桃花潭水深千尺，不及汪伦送我情”。'
          }
        ]
      },
      {
        npcId: 'npc_p2_math',
        npcName: '二年级数学老师 赵老师',
        npcType: 'math',
        subjectName: '数学',
        requiredScore: 60,
        dialogueText: {
          locked: '小同学，我是二年级数学赵老师。请先到一年级完成数学考核再来吧。',
          todo: '同学你好！我是数学赵老师。二年级要考察乘法口诀表和长度单位咯，加油！',
          passed: '乘除口诀烂熟于心，二年级的数学测验你已经完美通过啦！'
        },
        questions: [
          {
            id: 406,
            text: '乘法口诀“六八”的下一句是：',
            options: [
              { id: 'A', text: '五十六' },
              { id: 'B', text: '四十八' },
              { id: 'C', text: '六十四' }
            ],
            correctId: 'B',
            explanation: '九九乘法口诀：“六八四十八”。'
          },
          {
            id: 407,
            text: '32 除以 4 等于多少？',
            options: [
              { id: 'A', text: '6' },
              { id: 'B', text: '7' },
              { id: 'C', text: '8' }
            ],
            correctId: 'C',
            explanation: '利用乘法口诀“四八三十二”，可得 32 ÷ 4 = 8。'
          },
          {
            id: 408,
            text: '一米等于多少厘米？',
            options: [
              { id: 'A', text: '10厘米' },
              { id: 'B', text: '100厘米' },
              { id: 'C', text: '1000厘米' }
            ],
            correctId: 'B',
            explanation: '长度单位换算：1 米 = 10 分米 = 100 厘米。'
          },
          {
            id: 409,
            text: '钝角比直角大还是小？',
            options: [
              { id: 'A', text: '大' },
              { id: 'B', text: '小' },
              { id: 'C', text: '一样大' }
            ],
            correctId: 'A',
            explanation: '直角是 90 度，钝角大于 90 度且小于 180 度，所以钝角比直角大。'
          },
          {
            id: 410,
            text: '小明有 3 套奥特曼卡片，每套有 8 张，他一共有多少张卡片？',
            options: [
              { id: 'A', text: '11张' },
              { id: 'B', text: '24张' },
              { id: 'C', text: '28张' }
            ],
            correctId: 'B',
            explanation: '利用乘法计算：3 × 8 = 24 张。'
          }
        ]
      },
      {
        npcId: 'npc_p2_boss',
        npcName: '二年级期末考官 大魔王',
        npcType: 'general',
        subjectName: '综合大考',
        requiredScore: 60,
        dialogueText: {
          locked: '我是二年级大考官，你需要先通过本年级的语文和数学考核才能挑战我。',
          todo: '哈哈，我是期末考官大魔王！二年级综合大考不仅有乘法口诀，还有汉字和成语哦！',
          passed: '恭喜！你成功通过了二年级综合大考，赵老师和王老师都为你感到高兴！'
        },
        questions: [
          {
            id: 420,
            text: '算式 7 × 8 的得数是多少？',
            options: [
              { id: 'A', text: '48' },
              { id: 'B', text: '54' },
              { id: 'C', text: '56' }
            ],
            correctId: 'C',
            explanation: '根据乘法九九口诀：“七八五十六”，所以 7 × 8 = 56。'
          },
          {
            id: 421,
            text: '下面哪一个是表示赞美或感叹语气的句子末尾要使用的标点符号？',
            options: [
              { id: 'A', text: '感叹号！' },
              { id: 'B', text: '问号？' },
              { id: 'C', text: '逗号，' }
            ],
            correctId: 'A',
            explanation: '表示强烈的感情、赞美或感叹语气时，句末要用感叹号（！）。'
          },
          {
            id: 422,
            text: '成语“守株待兔”中的“株”字指的是什么？',
            options: [
              { id: 'A', text: '小兔子' },
              { id: 'B', text: '树桩' },
              { id: 'C', text: '农夫' }
            ],
            correctId: 'B',
            explanation: '“守株待兔”出自《韩非子》，其中的“株”指的是树桩。'
          }
        ]
      }
    ]
  },

  // ==================== 5. 小学三年级 ====================
  'primary_3': {
    stageId: 'primary_3',
    stageName: '小学三年级',
    stageGroup: 'primary',
    stageOrder: 5,
    challenges: [
      {
        npcId: 'npc_p3_math',
        npcName: '三年级数学老师 孙老师',
        npcType: 'math',
        subjectName: '数学',
        requiredScore: 60,
        dialogueText: {
          locked: '我是三年级数学孙老师。想学习两位数乘法？先去通过二年级考试吧！',
          todo: '你好，我是三年级数学孙老师。我们要考察两位数乘除法、周长和分数初步哦。',
          passed: '非常好！分数和周长计算都掌握得很透彻，孙老师祝贺你顺利结业！'
        },
        questions: [
          {
            id: 501,
            text: '25 乘以 4 等于多少？',
            options: [
              { id: 'A', text: '80' },
              { id: 'B', text: '100' },
              { id: 'C', text: '120' }
            ],
            correctId: 'B',
            explanation: '两位数乘法：25 × 4 = 100。这也是非常常用的速算常识。'
          },
          {
            id: 502,
            text: '正方形的边长是 5 厘米，它的周长是多少厘米？',
            options: [
              { id: 'A', text: '20厘米' },
              { id: 'B', text: '25厘米' },
              { id: 'C', text: '15厘米' }
            ],
            correctId: 'A',
            explanation: '正方形的周长公式：周长 = 边长 × 4。所以为 5 × 4 = 20 厘米。'
          },
          {
            id: 503,
            text: '把一个西瓜平均切成 8 份，小明吃了其中的 3 份，小明吃这个西瓜的几分之几？',
            options: [
              { id: 'A', text: '1/8' },
              { id: 'B', text: '3/8' },
              { id: 'C', text: '5/8' }
            ],
            correctId: 'B',
            explanation: '整体被平分成 8 份，取其中的 3 份，用分数表示就是八分之三（3/8）。'
          },
          {
            id: 504,
            text: '平年（非闰年）的一年有多少天？',
            options: [
              { id: 'A', text: '365天' },
              { id: 'B', text: '366天' },
              { id: 'C', text: '360天' }
            ],
            correctId: 'A',
            explanation: '平年 365 天（2月为28天），闰年 366 天（2月为29天）。'
          },
          {
            id: 505,
            text: '0 乘以任何一个数，结果都等于多少？',
            options: [
              { id: 'A', text: '那个数' },
              { id: 'B', text: '0' },
              { id: 'C', text: '1' }
            ],
            correctId: 'B',
            explanation: '乘法基本性质：0 乘任何数都得 0。'
          }
        ]
      },
      {
        npcId: 'npc_p3_english',
        npcName: '三年级英语老师 Miss White',
        npcType: 'english',
        subjectName: '英语',
        requiredScore: 60,
        dialogueText: {
          locked: 'Hello! 我是 Miss White。三年级起新增了英语学科，请先打好低年级基础再来哦。',
          todo: 'Welcome! 我是英语老师 Miss White。三年级我们学习26个字母和基础的对话，来试试吧！',
          passed: 'Excellent! 你的英语发音和日常问候太流畅了，Miss White 祝贺你通关！'
        },
        questions: [
          {
            id: 506,
            text: '英语字母表中的第 5 个字母是哪一个？',
            options: [
              { id: 'A', text: 'D' },
              { id: 'B', text: 'E' },
              { id: 'C', text: 'F' }
            ],
            correctId: 'B',
            explanation: '英文字母顺序：A, B, C, D, E。第 5 个是 E。'
          },
          {
            id: 507,
            text: '当早上遇到老师时，应该怎么用英语打招呼？',
            options: [
              { id: 'A', text: 'Good afternoon!' },
              { id: 'B', text: 'Good morning!' },
              { id: 'C', text: 'Good night!' }
            ],
            correctId: 'B',
            explanation: 'Good morning 表示早上好；Good afternoon 表示下午好；Good night 表示晚安。'
          },
          {
            id: 508,
            text: '当别人对你说 “How are you?” 时，常用的礼貌回答是：',
            options: [
              { id: 'A', text: 'Thank you.' },
              { id: 'B', text: "I'm fine, thank you." },
              { id: 'C', text: 'Hello!' }
            ],
            correctId: 'B',
            explanation: '“How are you?” 意为“你好吗？”，回答“I’m fine, thank you.”表示“我很好，谢谢你”。'
          },
          {
            id: 509,
            text: '英语单词 “apple” 的中文意思是什么？',
            options: [
              { id: 'A', text: '香蕉' },
              { id: 'B', text: '苹果' },
              { id: 'C', text: '桔子' }
            ],
            correctId: 'B',
            explanation: 'apple 指的是苹果，香蕉是 banana，桔子是 orange。'
          },
          {
            id: 510,
            text: '在英语中，对已婚女性老师的常用尊称是：',
            options: [
              { id: 'A', text: 'Mr.' },
              { id: 'B', text: 'Mrs.' },
              { id: 'C', text: 'Miss' }
            ],
            correctId: 'B',
            explanation: 'Mr. 尊称男性；Mrs. 尊称已婚女性；Miss 尊称未婚女性。'
          }
        ]
      },
      {
        npcId: 'npc_p3_boss',
        npcName: '三年级期末考官 大魔王',
        npcType: 'general',
        subjectName: '综合大考',
        requiredScore: 60,
        dialogueText: {
          locked: '三年级的期末综合大考还没解锁呢，请先完成数学和英语考核。',
          todo: '我是三年级期末考官大魔王！本次考核综合了周长计算、分数基础和日常英语，准备好了吗？',
          passed: '太棒了！顺利通过三年级期末综合大考，你已经成功迈过了小学中年级的第一道大关！'
        },
        questions: [
          {
            id: 520,
            text: '一辆自行车有 2 个轮子，12 辆这样的自行车一共有多少个轮子？',
            options: [
              { id: 'A', text: '22个' },
              { id: 'B', text: '24个' },
              { id: 'C', text: '26个' }
            ],
            correctId: 'B',
            explanation: '使用两位数乘一位数计算：12 × 2 = 24 个。'
          },
          {
            id: 521,
            text: '一个长方形长 6 厘米，宽 4 厘米，它的周长是多少厘米？',
            options: [
              { id: 'A', text: '10厘米' },
              { id: 'B', text: '20厘米' },
              { id: 'C', text: '24厘米' }
            ],
            correctId: 'B',
            explanation: '长方形的周长公式为 (长 + 宽) × 2，即 (6 + 4) × 2 = 20 厘米。'
          },
          {
            id: 522,
            text: '英语单词 “banana” 指的是哪种水果？',
            options: [
              { id: 'A', text: '苹果' },
              { id: 'B', text: '香蕉' },
              { id: 'C', text: '桃子' }
            ],
            correctId: 'B',
            explanation: 'banana 的中文意思是香蕉。苹果是 apple，桃子是 peach。'
          }
        ]
      }
    ]
  },

  // ==================== 6. 小学四年级 ====================
  'primary_4': {
    stageId: 'primary_4',
    stageName: '小学四年级',
    stageGroup: 'primary',
    stageOrder: 6,
    challenges: [
      {
        npcId: 'npc_p4_geo',
        npcName: '四年级语文老师 周老师',
        npcType: 'language',
        subjectName: '语文',
        requiredScore: 60,
        dialogueText: {
          locked: '你好，我是四年级语文周老师。你需要先通过三年级的所有测验才能来我这里。',
          todo: '你好，我是周老师。四年级的语文课开始涉及成语典故、关联词用法了，来做个测试吧！',
          passed: '出口成章！四年级语文考核通过，你的文字功底大有进步！'
        },
        questions: [
          {
            id: 601,
            text: '下列成语中，哪一个比喻“虚张声势，实际上没有真才实学”？',
            options: [
              { id: 'A', text: '滥竽充数' },
              { id: 'B', text: '画蛇添足' },
              { id: 'C', text: '亡羊补牢' }
            ],
            correctId: 'A',
            explanation: '滥竽充数比喻没有真才实学的人混在行家里充数，或者以次充好。'
          },
          {
            id: 602,
            text: '“即使下雨，我们也坚持跑步”中，“即使……也……”表示什么逻辑关系的关联词？',
            options: [
              { id: 'A', text: '因果关系' },
              { id: 'B', text: '假设关系' },
              { id: 'C', text: '转折关系' }
            ],
            correctId: 'B',
            explanation: '“即使……也……”表达假设让步关系，属于假设复句。'
          },
          {
            id: 603,
            text: '下列词语中，字形完全正确的一组是：',
            options: [
              { id: 'A', text: '振耳欲聋' },
              { id: 'B', text: '震耳欲聋' },
              { id: 'C', text: '震耳欲陇' }
            ],
            correctId: 'B',
            explanation: '“震”指震动，如雷震耳。“震耳欲聋”形容声音极大，快要把耳朵震聋了。'
          },
          {
            id: 604,
            text: '王维古诗《鹿柴》中“返景入深林，复照青苔上”的“景”字读音通什么？',
            options: [
              { id: 'A', text: 'jǐng' },
              { id: 'B', text: 'yǐng' },
              { id: 'C', text: 'jǐn' }
            ],
            correctId: 'B',
            explanation: '“返景”的“景”通“影”，指日光照射的影子，读作 yǐng。'
          },
          {
            id: 605,
            text: '“精卫填海”这个著名的中国上古神话出自哪部古代名著？',
            options: [
              { id: 'A', text: '《山海经》' },
              { id: 'B', text: '《淮南子》' },
              { id: 'C', text: '《西游记》' }
            ],
            correctId: 'A',
            explanation: '“精卫填海”的故事记载在《山海经·北山经》中，精卫是炎帝之女女娃死后所化。'
          }
        ]
      },
      {
        npcId: 'npc_p4_english',
        npcName: '四年级英语老师 Mr. Black',
        npcType: 'english',
        subjectName: '英语',
        requiredScore: 60,
        dialogueText: {
          locked: 'Hi! 我是四年级英语 Black 老师。请先在三年级拿到英语合格证再来哦。',
          todo: 'Hi there! 我是 Mr. Black。四年级我们将测验简单时态、名词复数和常用代词。',
          passed: 'Wonderful job! 四年级英语测试通过，你的时态和名词复数掌握得很好！'
        },
        questions: [
          {
            id: 606,
            text: '下列动词的第三人称单数形式中，哪一个是错误的？',
            options: [
              { id: 'A', text: 'plays' },
              { id: 'B', text: 'goes' },
              { id: 'C', text: 'haves' }
            ],
            correctId: 'C',
            explanation: 'have 的第三人称单数形式是特殊变化的 has，而不是 haves。'
          },
          {
            id: 607,
            text: '选择合适的代词填空：“This is my sister. ___ is a doctor.”',
            options: [
              { id: 'A', text: 'He' },
              { id: 'B', text: 'She' },
              { id: 'C', text: 'It' }
            ],
            correctId: 'B',
            explanation: 'sister（姐姐/妹妹）是女性，人称代词主格应该使用 She。'
          },
          {
            id: 608,
            text: '名词“toy”（玩具）的复数形式正确拼写是：',
            options: [
              { id: 'A', text: 'toyes' },
              { id: 'B', text: 'toys' },
              { id: 'C', text: 'toies' }
            ],
            correctId: 'B',
            explanation: '以元音字母 + y 结尾的名词直接在词尾加 s，如 toys, boys。'
          },
          {
            id: 609,
            text: '英语句子 “What time is it?” 用来提问什么？',
            options: [
              { id: 'A', text: '物品的价格' },
              { id: 'B', text: '当下的时间' },
              { id: 'C', text: '目标的地点' }
            ],
            correctId: 'B',
            explanation: 'What time is it? 的意思是“现在几点了？”，用来询问时间。'
          },
          {
            id: 610,
            text: '英语单词 “Wednesday” 指的是星期几？',
            options: [
              { id: 'A', text: '星期二' },
              { id: 'B', text: '星期三' },
              { id: 'C', text: '星期四' }
            ],
            correctId: 'B',
            explanation: 'Monday周一，Tuesday周二，Wednesday周三，Thursday周四。'
          }
        ]
      },
      {
        npcId: 'npc_p4_boss',
        npcName: '四年级期末考官 大魔王',
        npcType: 'general',
        subjectName: '综合大考',
        requiredScore: 60,
        dialogueText: {
          locked: '大魔王考官的考场暂时关闭，请先完成四年级的所有单科挑战。',
          todo: '我是四年级期末考官大魔王。本次综合大考试题包含成语寓意、关联词理解和英语时态变化，来挑战吧！',
          passed: '名不虚传！四年级大考难不倒你，恭喜你顺利通过期末综合大考！'
        },
        questions: [
          {
            id: 620,
            text: '成语“画蛇添足”告诉我们的主要道理是：',
            options: [
              { id: 'A', text: '做事情要精益求精' },
              { id: 'B', text: '做了多余的事反而有害无益' },
              { id: 'C', text: '画画要有丰富的想象力' }
            ],
            correctId: 'B',
            explanation: '“画蛇添足”原意为画好了蛇又给它画上脚。比喻做了多余而不恰当的事，反而把事情弄糟了。'
          },
          {
            id: 621,
            text: '选择合适的关联词填空：“___明天下雨，我们___要在室内上体育课。”',
            options: [
              { id: 'A', text: '虽然...但是...' },
              { id: 'B', text: '如果...就...' },
              { id: 'C', text: '因为...所以...' }
            ],
            correctId: 'B',
            explanation: '这句话前后是假设关系，表示假设发生了某种情况会产生相应的结果，所以用“如果……就……”。'
          },
          {
            id: 622,
            text: '在英语中，动词 “study”（学习）的第三人称单数形式是：',
            options: [
              { id: 'A', text: 'studys' },
              { id: 'B', text: 'studies' },
              { id: 'C', text: 'studying' }
            ],
            correctId: 'B',
            explanation: '动词以“辅音字母 + y”结尾时，第三人称单数形式需要把 y 改为 i 再加 es，即 studies。'
          }
        ]
      }
    ]
  },

  // ==================== 7. 小学五年级 ====================
  'primary_5': {
    stageId: 'primary_5',
    stageName: '小学五年级',
    stageGroup: 'primary',
    stageOrder: 7,
    challenges: [
      {
        npcId: 'npc_p5_math',
        npcName: '五年级数学老师 钱老师',
        npcType: 'math',
        subjectName: '数学',
        requiredScore: 60,
        dialogueText: {
          locked: '同学，我是五年级数学钱老师。高年级数学需要扎实的低年级功底，请先通过四年级考核。',
          todo: '你好，我是钱老师。五年级我们要测验代数方程、三角形面积以及分数加减法。',
          passed: '解方程有理有据，五年级数学大关顺利通过，非常出色！'
        },
        questions: [
          {
            id: 701,
            text: '简易方程 2x + 5 = 15 的解是：',
            options: [
              { id: 'A', text: 'x = 5' },
              { id: 'B', text: 'x = 10' },
              { id: 'C', text: 'x = 7.5' }
            ],
            correctId: 'A',
            explanation: '移项得 2x = 10，两边同除以 2 得 x = 5。'
          },
          {
            id: 702,
            text: '一个直角三角形的底是 6 厘米，高是 4 厘米，它的面积是多少平方厘米？',
            options: [
              { id: 'A', text: '24' },
              { id: 'B', text: '12' },
              { id: 'C', text: '18' }
            ],
            correctId: 'B',
            explanation: '三角形面积公式：底 × 高 ÷ 2，即 6 × 4 ÷ 2 = 12 平方厘米。'
          },
          {
            id: 703,
            text: '小数乘法：0.25 乘以 0.4 等于多少？',
            options: [
              { id: 'A', text: '0.1' },
              { id: 'B', text: '1' },
              { id: 'C', text: '0.01' }
            ],
            correctId: 'A',
            explanation: '25 × 4 = 100，移动三位小数点得到 0.1。'
          },
          {
            id: 704,
            text: '关于倍数与因数，一个正整数最小的倍数是：',
            options: [
              { id: 'A', text: '1' },
              { id: 'B', text: '它本身' },
              { id: 'C', text: '没有最小倍数' }
            ],
            correctId: 'B',
            explanation: '一个数的倍数有无数个，其中最小的一个是它本身。'
          },
          {
            id: 705,
            text: '把 3 米长的绳子平均分成 4 段，每段占全长的几分之几？',
            options: [
              { id: 'A', text: '1/4' },
              { id: 'B', text: '3/4' },
              { id: 'C', text: '1/3' }
            ],
            correctId: 'A',
            explanation: '求分率：把全长看作单位“1”，平均分成 4 份，每段占整体的 1/4（而非每段长度 3/4 米）。'
          }
        ]
      },
      {
        npcId: 'npc_p5_nature',
        npcName: '五年级语文老师 孙老师',
        npcType: 'language',
        subjectName: '语文',
        requiredScore: 60,
        dialogueText: {
          locked: '你好，我是五年级语文孙老师。高年级语文阅读训练需循序渐进，请先通关四年级。',
          todo: '同学你好，我是孙老师。我们来测试小学必背古诗名句、句型变换以及修辞手法。',
          passed: '笔耕不辍，孙老师祝贺你在五年级语文考核中取得了优异的成绩！'
        },
        questions: [
          {
            id: 706,
            text: '张继《枫桥夜泊》：“月落乌啼霜满天，江枫渔火对___”',
            options: [
              { id: 'A', text: '愁眠' },
              { id: 'B', text: '孤船' },
              { id: 'C', text: '寒山' }
            ],
            correctId: 'A',
            explanation: '古诗原文：“月落乌啼霜满天，江枫渔火对愁眠”。'
          },
          {
            id: 707,
            text: '将句子“他被老师表扬了”改为“把”字句，正确的是：',
            options: [
              { id: 'A', text: '老师把他表扬了' },
              { id: 'B', text: '他把老师表扬了' },
              { id: 'C', text: '老师被他表扬了' }
            ],
            correctId: 'A',
            explanation: '被动句改把字句，主语和主动者位置对换：主动者“老师” + 把 + 承受者“他” + 动作“表扬了”。'
          },
          {
            id: 708,
            text: '诗句“白发三千丈，缘愁似个长”运用了什么修辞手法？',
            options: [
              { id: 'A', text: '拟人' },
              { id: 'B', text: '比喻' },
              { id: 'C', text: '夸张' }
            ],
            correctId: 'C',
            explanation: '三千丈极度放大了白发的长度，是文学中典型的夸张手法。'
          },
          {
            id: 709,
            text: '下列词语中，哪一个可以用来形容“心里十分担心或害怕”？',
            options: [
              { id: 'A', text: '忐忑不安' },
              { id: 'B', text: '怡然自得' },
              { id: 'C', text: '意气风发' }
            ],
            correctId: 'A',
            explanation: '忐忑不安形容心神不宁，胆怯担心。怡然自得形容高兴满足。'
          },
          {
            id: 710,
            text: '我国近代杰出的文学家、思想家鲁迅先生的原名是：',
            options: [
              { id: 'A', text: '周树人' },
              { id: 'B', text: '周作人' },
              { id: 'C', text: '周建人' }
            ],
            correctId: 'A',
            explanation: '鲁迅是笔名，其原名是周树人。周作人和周建人是他的弟弟。'
          }
        ]
      },
      {
        npcId: 'npc_p5_boss',
        npcName: '五年级期末考官 大魔王',
        npcType: 'general',
        subjectName: '综合大考',
        requiredScore: 60,
        dialogueText: {
          locked: '五年级毕业前夕的终极期末大考，需要你先通关数学和语文单科挑战！',
          todo: '我是五年级期末考官大魔王。这里有方程求解、修辞手法辨析和古诗词常识的综合测试，加油吧！',
          passed: '非常卓越！你顺利攻克了五年级的综合大考，离小学毕业只剩一步之遥啦！'
        },
        questions: [
          {
            id: 720,
            text: '解方程 3x - 6 = 12，那么 x 的值是：',
            options: [
              { id: 'A', text: '5' },
              { id: 'B', text: '6' },
              { id: 'C', text: '4' }
            ],
            correctId: 'B',
            explanation: '方程两边同时加 6 得 3x = 18，然后两边同除以 3 得 x = 6。'
          },
          {
            id: 721,
            text: '下列句子中，没有使用拟人修辞手法的一项是：',
            options: [
              { id: 'A', text: '太阳公公露出了红红的笑脸' },
              { id: 'B', text: '窗外的小鸟在枝头快乐地歌唱' },
              { id: 'C', text: '弯弯的月亮像一条小船' }
            ],
            correctId: 'C',
            explanation: 'A项和B项赋予了太阳和小鸟以人的动作 and 神态，是拟人；C项将月亮比作小船，使用的是比喻修辞手法。'
          },
          {
            id: 722,
            text: '唐代诗人张继的名诗《枫桥夜泊》中的“寒山寺”位于现在的哪个城市？',
            options: [
              { id: 'A', text: '杭州' },
              { id: 'B', text: '苏州' },
              { id: 'C', text: '南京' }
            ],
            correctId: 'B',
            explanation: '“姑苏城外寒山寺，夜半钟声到客船”，姑苏是苏州的古称，所以寒山寺位于苏州。'
          }
        ]
      }
    ]
  },

  // ==================== 8. 小学六年级 ====================
  'primary_6': {
    stageId: 'primary_6',
    stageName: '小学六年级',
    stageGroup: 'primary',
    stageOrder: 8,
    challenges: [
      {
        npcId: 'npc_p6_math',
        npcName: '六年级数学老师 吴老师',
        npcType: 'math',
        subjectName: '数学',
        requiredScore: 60,
        dialogueText: {
          locked: '你好，我是毕业班数学吴老师。只有通过了五年级全部考核的同学才能来我这里挑战毕业考哦。',
          todo: '同学，这是你小学阶段的数学终极毕业考核！涉及圆面积、比例和复杂的百分数应用题。加油！',
          passed: '令人瞩目！你已经完美通过了小学的全部数学课程，毕业考优秀！'
        },
        questions: [
          {
            id: 801,
            text: '圆的半径是 3 厘米，它的面积是多少平方厘米？（$\pi$ 取 3.14）',
            options: [
              { id: 'A', text: '9.42' },
              { id: 'B', text: '28.26' },
              { id: 'C', text: '18.84' }
            ],
            correctId: 'B',
            explanation: '圆面积公式为 $S = \pi \times r^2 = 3.14 \times 3^2 = 3.14 \times 9 = 28.26$ 平方厘米。'
          },
          {
            id: 802,
            text: '一件衣服原价 200 元，现在商场打八折出售，现价是多少元？',
            options: [
              { id: 'A', text: '160元' },
              { id: 'B', text: '180元' },
              { id: 'C', text: '120元' }
            ],
            correctId: 'A',
            explanation: '打八折即按原价的 80% 出售：200 × 0.8 = 160元。'
          },
          {
            id: 803,
            text: '如果 A : B = 3 : 4，那么当比例的前项 A = 9 时，后项 B 等于多少？',
            options: [
              { id: 'A', text: '12' },
              { id: 'B', text: '16' },
              { id: 'C', text: '8' }
            ],
            correctId: 'A',
            explanation: '前项从 3 扩大 3 倍变成 9，后项也要扩大 3 倍，4 × 3 = 12。'
          },
          {
            id: 804,
            text: '六年级（1）班有男生 25 人，女生 20 人，女生人数占全班总人数的几分之几？',
            options: [
              { id: 'A', text: '4/5' },
              { id: 'B', text: '4/9' },
              { id: 'C', text: '5/9' }
            ],
            correctId: 'B',
            explanation: '全班人数 = 25 + 20 = 45 人。女生占比为 20 ÷ 45 = 20/45，约分后为 4/9。'
          },
          {
            id: 805,
            text: '一个圆柱的底面半径是 2 厘米，高是 5 厘米，它的侧面积是多少平方厘米？（$\pi$ 取 3.14）',
            options: [
              { id: 'A', text: '62.8' },
              { id: 'B', text: '31.4' },
              { id: 'C', text: '20' }
            ],
            correctId: 'A',
            explanation: '圆柱侧面积公式：$S_{侧} = 2 \times \pi \times r \times h = 2 \times 3.14 \times 2 \times 5 = 62.8$ 平方厘米。'
          }
        ]
      },
      {
        npcId: 'npc_p6_composite',
        npcName: '六年级语文老师 郑老师',
        npcType: 'language',
        subjectName: '语文',
        requiredScore: 60,
        dialogueText: {
          locked: '你好，我是六年级语文郑老师。请先完成五年级的学习内容再来挑战毕业考吧！',
          todo: '同学，欢迎接受小学六年级语文毕业考核。涵盖文言文常识、四大名著及修辞，准备好了吗？',
          passed: '学富五车！你成功通过了六年级语文毕业考，恭喜你完成小学阶段的所有学业！'
        },
        questions: [
          {
            id: 806,
            text: '文言文《两小儿辩日》中，一儿曰：“日初出大如车盖，及日中则如盘盂”，该小儿判断的依据是：',
            options: [
              { id: 'A', text: '身体的凉热触觉' },
              { id: 'B', text: '眼睛所见的大小视觉' },
              { id: 'C', text: '环境的安静听觉' }
            ],
            correctId: 'B',
            explanation: '该小儿是通过看太阳初升时大如车盖，中午时小如盘子（视觉大小）来判断太阳远近的。'
          },
          {
            id: 807,
            text: '古典名著故事“草船借箭”中，诸葛亮主要利用了谁的“生性多疑”性格特点完成借箭？',
            options: [
              { id: 'A', text: '周瑜' },
              { id: 'B', text: '曹操' },
              { id: 'C', text: '鲁肃' }
            ],
            correctId: 'B',
            explanation: '诸葛亮算定江面大雾时，曹操因生性多疑不敢轻易出兵，只会放箭防守。'
          },
          {
            id: 808,
            text: '下列著名成语中，哪一个“不是”出自三国时期的故事？',
            options: [
              { id: 'A', text: '三顾茅庐' },
              { id: 'B', text: '负荆请罪' },
              { id: 'C', text: '万事俱备，只欠东风' }
            ],
            correctId: 'B',
            explanation: '“负荆请罪”出自《史记·廉颇蔺相如列传》，属于战国时期的故事。'
          },
          {
            id: 809,
            text: '下面哪一部文学作品“不属于”中国古典四大名著？',
            options: [
              { id: 'A', text: '《聊斋志异》' },
              { id: 'B', text: '《西游记》' },
              { id: 'C', text: '《红楼梦》' }
            ],
            correctId: 'A',
            explanation: '中国四大名著包括《红楼梦》《西游记》《水浒传》《三国演义》。《聊斋志异》是清代短篇小说集。'
          },
          {
            id: 810,
            text: '苏轼《水调歌头》中名句“但愿人长久，千里共婵娟”的“婵娟”指的是什么？',
            options: [
              { id: 'A', text: '容貌美丽的女子' },
              { id: 'B', text: '明亮的月亮' },
              { id: 'C', text: '真挚的兄弟友情' }
            ],
            correctId: 'B',
            explanation: '这里的“婵娟”指月亮，全句意为希望远隔千里的亲人能够共同欣赏同一轮明月，寄托思念之情。'
          }
        ]
      },
      {
        npcId: 'npc_p6_boss',
        npcName: '六年级毕业考官 大魔王',
        npcType: 'general',
        subjectName: '综合大考',
        requiredScore: 60,
        dialogueText: {
          locked: '这是小学阶段最庄严的毕业总考场！请先通过六年级数学和语文单科考试！',
          todo: '我是六年级毕业大考官。通过这门综合大考，你将正式完成小学阶段的全部学业，拿到毕业证书！',
          passed: '热烈祝贺！你以优异的成绩通过了小学毕业综合大考，祝你在未来的中学学习中再创辉煌！'
        },
        questions: [
          {
            id: 820,
            text: '如果一个圆的直径是 4 厘米，那么它的周长是多少厘米？（$\\pi$ 取 3.14）',
            options: [
              { id: 'A', text: '12.56' },
              { id: 'B', text: '6.28' },
              { id: 'C', text: '25.12' }
            ],
            correctId: 'A',
            explanation: '圆的周长公式为 C = \\pi \\times d，所以周长为 3.14 \\times 4 = 12.56 厘米。'
          },
          {
            id: 821,
            text: '文言文《两小儿辩日》中，另一个小儿判断太阳远近的依据是：',
            options: [
              { id: 'A', text: '日初出大如车盖，及日中则如盘盂（视觉大小）' },
              { id: 'B', text: '日初出沧沧凉凉，及其日中如探汤（触觉凉热）' },
              { id: 'C', text: '太阳在天空中运行的轨迹' }
            ],
            correctId: 'B',
            explanation: '另一个小儿认为太阳刚出来时清凉（沧沧凉凉），中午像把手伸进热水里一样热（如探汤），以此触觉判断太阳远近。'
          },
          {
            id: 822,
            text: '在古典神魔小说《西游记》中，唐僧是在哪里收孙悟空为徒弟的？',
            options: [
              { id: 'A', text: '流沙河' },
              { id: 'B', text: '高老庄' },
              { id: 'C', text: '五行山' }
            ],
            correctId: 'C',
            explanation: '孙悟空因大闹天宫被如来佛祖压在五行山（两界山）下五百年，后被唐僧救出并拜其为师。流沙河是收沙僧的地方，高老庄是收猪八戒的地方。'
          }
        ]
      }
    ]
  }
};
