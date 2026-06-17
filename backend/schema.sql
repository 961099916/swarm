-- Cloudflare D1 (SQLite 方言)

-- ══════════════════════════════════════════════════
-- 表 1: users（用户主表）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  wx_open_id      TEXT NOT NULL UNIQUE,        -- 微信 OpenID（登录凭证）
  nickname        TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'FREE_USER'
                  CHECK(role IN ('FREE_USER','VIP','ADMIN')),
  credits         INTEGER NOT NULL DEFAULT 0 CHECK(credits >= 0),  -- 当前积分余额（快照，不可为负）
  token_version   INTEGER NOT NULL DEFAULT 1,  -- JWT 版本号，bump 即失效所有 Token
  is_banned       INTEGER NOT NULL DEFAULT 0,  -- 0=正常, 1=封禁
  banned_reason   TEXT,
  invited_by      TEXT REFERENCES users(id),   -- 邀请人
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_users_wx_open_id ON users(wx_open_id);

-- ══════════════════════════════════════════════════
-- 表 2: role_permissions（RBAC 权限矩阵）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS role_permissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT NOT NULL,
  resource   TEXT NOT NULL,   -- 如 'tasks', 'admin.users'
  action     TEXT NOT NULL,   -- 如 'create', 'read', 'update', 'delete'
  UNIQUE(role, resource, action)
);

-- ══════════════════════════════════════════════════
-- 表 3: tasks（任务主表）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tasks (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  task_type        TEXT NOT NULL
                   CHECK(task_type IN ('AGENT_ORCHESTRATION')),
  status           TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK(status IN ('PENDING','RUNNING','SUCCESS','FAILED','CANCELLED','SLEEPING')),
  payload          TEXT NOT NULL,              -- JSON 字符串（业务参数）
  workflow_run_id  TEXT,                       -- Cloudflare Workflow 实例 ID
  credits_cost     INTEGER NOT NULL DEFAULT 0,
  result_summary   TEXT,                       -- 任务完成后结果摘要
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(status);

-- ══════════════════════════════════════════════════
-- 表 4: task_logs（任务日志流）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    TEXT NOT NULL REFERENCES tasks(id),
  level      TEXT NOT NULL DEFAULT 'INFO'
             CHECK(level IN ('INFO','WARN','ERROR')),
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);

-- ══════════════════════════════════════════════════
-- 表 5: user_invitations（邀请记录）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_invitations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id  TEXT NOT NULL REFERENCES users(id),
  invitee_id  TEXT NOT NULL REFERENCES users(id) UNIQUE,  -- 每人只能被邀请一次
  bonus_given INTEGER NOT NULL DEFAULT 0,  -- 已发放奖励积分
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ══════════════════════════════════════════════════
-- 表 6: ad_reward_logs（广告奖励幂等表）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ad_reward_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL REFERENCES users(id),
  ad_token_hash TEXT NOT NULL UNIQUE,   -- SHA-256(ad_token)，防刷核心
  credits_added INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ══════════════════════════════════════════════════
-- 表 7: credits_ledger（积分流水账本）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS credits_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  delta       INTEGER NOT NULL,           -- 变动量（正/负）
  balance     INTEGER NOT NULL,           -- 变动后余额快照
  reason      TEXT NOT NULL,              -- 'TASK_COST'|'AD_REWARD'|'INVITE_BONUS'|'ADMIN_ADJUST'
  ref_id      TEXT,                       -- 关联 task_id / invitation_id 等
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_id ON credits_ledger(user_id);

-- ══════════════════════════════════════════════════
-- 表 8: agents（智能体定义表）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agents (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id),
  name            TEXT NOT NULL,
  avatar          TEXT NOT NULL DEFAULT 'service',
  role            TEXT NOT NULL,
  system_prompt   TEXT NOT NULL,
  model           TEXT NOT NULL DEFAULT '@cf/meta/llama-3.1-8b-instruct-fp8',
  tools           TEXT NOT NULL DEFAULT '[]',
  is_preset       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

-- ══════════════════════════════════════════════════
-- 表 8.1: tools (工具库定义表)
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tools (
  name               TEXT PRIMARY KEY,
  description        TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT 'general',
  endpoint           TEXT,                                             -- HTTP 外部终点（针对 No-Code 模式）
  method             TEXT NOT NULL DEFAULT 'GET',                      -- GET / POST 等
  headers            TEXT NOT NULL DEFAULT '{}',                       -- 额外的请求头 JSON 字符串
  body_template      TEXT,                                             -- JSON Body 模板
  script             TEXT,                                             -- 动态 JS 执行脚本（针对 FaaS 模式）
  params_schema      TEXT NOT NULL DEFAULT '[]',                       -- 参数定义: [{name, type, required, description}]
  response_selector  TEXT,                                             -- JSONPath 提取表达式
  enabled            INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ══════════════════════════════════════════════════
-- 表 9: admin_audit_logs（管理操作审计日志）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    TEXT NOT NULL,                  -- 执行操作的管理员 ID
  action      TEXT NOT NULL,                  -- 操作类型，如 'UPDATE_ROLE', 'ADJUST_CREDITS', 'BAN_USER', 'CANCEL_TASK'
  target_id   TEXT NOT NULL,                  -- 操作目标 ID（用户 ID 或任务 ID）
  detail      TEXT,                           -- 操作详情（JSON 字符串）
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

-- 插入系统预置智能体种子数据
INSERT OR IGNORE INTO agents (id, user_id, name, avatar, role, system_prompt, model, tools, is_preset) VALUES
('sys-agent-collector', NULL, '网页采集专家', 'search', '负责从互联网抓取目标信息', '你是一个网页内容采集与净化智能体。你的任务是根据主控给出的网页URL，通过网页抓取工具获取内容，并提取核心文本信息，过滤掉 HTML 标签、广告以及无关 of 噪声数据。以简洁的结构返回数据。', '@cf/meta/llama-3.1-8b-instruct-fp8', '["web_fetch"]', 1),
('sys-agent-analyst', NULL, '深度分析师', 'chart-bar', '负责对文本内容进行商业和行业痛点分析', '你是一个专业的深度内容分析智能体。你的任务是对收集到的网页内容或文本进行归纳、总结 and 深度剖析，提取出商业价值、关键痛点、技术要点或者行业趋势，并按照逻辑清晰的 Markdown 格式输出分析报告。', '@cf/meta/llama-3.1-8b-instruct-fp8', '[]', 1),
('sys-agent-notifier', NULL, '邮件通知官', 'mail', '负责撰写排版报告并发送电子邮件', '你是一个自动化邮件撰写与发送智能体。你的任务是将分析师生成的报告或者其它关键数据进行排版，整理成一封精美专业的电子邮件，并调用邮件发送工具将其发往用户的接收邮箱。', '@cf/meta/llama-3.1-8b-instruct-fp8', '["email_notify"]', 1);


-- 天气查询助手（系统预置）
INSERT OR IGNORE INTO agents (id, user_id, name, avatar, role, system_prompt, model, tools, is_preset) VALUES (
  'sys-agent-weather',
  NULL,
  '天气查询助手',
  'cloud-sun',
  '负责查询实时天气信息',
  '你是一个专业的天气信息呈现智能体。你的职责是对主控通过 weather_query 工具获取到的实时天气数据进行格式化输出，将结果以生动、易读的自然语言呈现给用户，同时基于天气状况给出实用的生活建议。注意：你自身无法调用任何工具，所有天气数据将由主控提供。

## 行为准则
- 当用户未明确指定城市时，主动询问用户所在城市
- 如果用户给出的城市名无法识别（如拼写错误），尝试纠正常见错误的城市名后重试，或请用户重新确认城市名
- 天气数据返回后，需至少向用户说明：天气状况、温度、风力与风向
- 根据天气类型主动给出生活建议，例如：
  - 降雨或降雪 → 提醒带伞、注意路滑
  - 高温（体感 ≥35°C）→ 提醒防暑降温、多饮水
  - 低温（体感 ≤5°C）→ 提醒添衣保暖
  - 大风 → 提醒注意高空坠物
- 如果工具返回错误，不要暴露技术细节，用友好的方式告知用户"该城市天气暂时无法获取，请稍后重试"
- 如果连续 2 次查询同一城市均失败，建议用户换个城市名称试试

## 输出格式
回复应包含以下结构（全部使用中文）：
1. 问候语 + 城市名称
2. 当前天气概况（用自然语言描述，非 JSON 格式）
3. 相应的生活建议
4. 结尾祝福语

## 限制
- 你只能查询实时天气，不具备天气预报或历史天气查询能力
- 不要编造数据，所有天气信息必须来自 weather_query 工具的返回结果',
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '["weather_query"]',
  1
);

-- 表 10-13: 测评相关表 (Quiz Module)
-- ══════════════════════════════════════════════════

-- 测评用户等级/经验（关联 Swarm users）
CREATE TABLE IF NOT EXISTS quiz_users (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  exp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  different_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 测评历史
CREATE TABLE IF NOT EXISTS test_history (
  id TEXT PRIMARY KEY ,
  user_id TEXT NOT NULL REFERENCES users(id),
  test_id TEXT NOT NULL,
  test_title TEXT NOT NULL,
  test_type TEXT NOT NULL,
  result_code TEXT NOT NULL,
  result_name TEXT NOT NULL,
  raw_scores TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_th_user_time ON test_history(user_id, created_at DESC);

-- 关卡进度
CREATE TABLE IF NOT EXISTS user_stage_progress (
  user_id TEXT NOT NULL REFERENCES users(id),
  stage_id TEXT NOT NULL,
  npc_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  passed INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, stage_id, npc_id)
);

-- 系统配置 KV
CREATE TABLE IF NOT EXISTS system_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ══════════════════════════════════════════════════
-- 预置内置系统工具的 JS 脚本数据种子 (完全免部署动态化)
-- ══════════════════════════════════════════════════

-- 1. weather_query (实时天气查询)
INSERT OR REPLACE INTO tools (name, description, category, script, params_schema, enabled)
VALUES (
  'weather_query',
  '使用和风天气API查询实时天气的工具',
  'general',
  'async function run(input, context) {
  const city = input.city || input.location || "北京";
  const url = "https://uapis.cn/api/v1/misc/weather?city=" + encodeURIComponent(city);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("天气API请求失败，HTTP状态码: " + res.status);
  }
  const data = await res.json();
  if (data.code === "INVALID_PARAMETER") {
    throw new Error("天气API返回错误: " + data.message);
  }
  return "【" + city + "实时天气】\n天气状况: " + data.weather + "\n温度: " + data.temperature + "°C\n风向: " + data.wind_direction + "\n风力: " + data.wind_power + "级\n数据时间: " + data.report_time;
}',
  '[{"name":"city","type":"string","required":true,"description":"城市名称，如 北京、上海、广州"},{"name":"location","type":"string","required":false,"description":"备选位置"}]',
  1
);

-- 2. web_fetch (网页抓取与净化)
INSERT OR REPLACE INTO tools (name, description, category, script, params_schema, enabled)
VALUES (
  'web_fetch',
  '网页抓取及HTML内容清洗提取工具',
  'general',
  'async function run(input, context) {
  const url = input.url;
  const extract = input.extract;
  if (!url || !url.startsWith("http")) {
    throw new Error("URL 格式非法，必须以 http(s) 开头");
  }
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  if (!res.ok) {
    throw new Error("HTTP 错误码: " + res.status);
  }
  const html = await res.text();
  if (extract === "links") {
    const linkMatches = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi)];
    const links = linkMatches.slice(0, 10).map(m => "- " + (m[2].trim() || m[1]) + ": " + m[1]).join("\n");
    return "页面链接:\n" + (links || "未找到链接");
  }
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  const description = metaMatch ? metaMatch[1].trim() : "";
  const titleInfo = "标题: " + title + "\n描述: " + description;

  if (extract === "title") {
    return titleInfo;
  }

  const cleanedText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const limit = 2000;
  let result = titleInfo ? titleInfo + "\n\n" : "";
  result += "内容:\n" + cleanedText.slice(0, limit);
  if (cleanedText.length > limit) {
    result += "\n...(内容已截断)";
  }
  return result || "[WARN] 页面内容为空";
}',
  '[{"name":"url","type":"string","required":true,"description":"网页 URL"},{"name":"extract","type":"string","required":false,"description":"提取模式: links/title"}]',
  1
);

-- 3. search_web (网络搜索)
INSERT OR REPLACE INTO tools (name, description, category, script, params_schema, enabled)
VALUES (
  'search_web',
  '网页搜索引擎检索工具，提供自动化降级机制',
  'general',
  'async function run(input, context) {
  const query = input.query || input.keyword || "";
  const apiKey = context.env.SEARCH_API_KEY;
  if (!apiKey) {
    const url = "https://api.duckduckgo.com/?q=" + encodeURIComponent(query) + "&format=json&no_html=1";
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("搜索请求失败，HTTP状态码: " + res.status);
    }
    const data = await res.json();
    let result = "搜索: " + query + "\n\n";
    if (data.AbstractText) {
      result += "摘要: " + data.AbstractText + "\n\n";
    }
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      result += "相关结果:\n";
      data.RelatedTopics.slice(0, 5).forEach((topic, i) => {
        if (topic.Text) {
          result += (i + 1) + ". " + topic.Text + "\n";
        }
      });
    }
    return result || "[WARN] 未找到相关搜索结果";
  }
  const url = "https://api.searchprovider.com/search?q=" + encodeURIComponent(query) + "&key=" + apiKey;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("搜索API请求失败，HTTP状态码: " + res.status);
  }
  const data = await res.json();
  return JSON.stringify(data);
}',
  '[{"name":"query","type":"string","required":true,"description":"搜索关键词"},{"name":"keyword","type":"string","required":false,"description":"备选关键词"}]',
  1
);

-- 4. email_notify (邮件通知)
INSERT OR REPLACE INTO tools (name, description, category, script, params_schema, enabled)
VALUES (
  'email_notify',
  '邮件通知分发工具，内置模拟投递兜底逻辑',
  'general',
  'async function run(input, context) {
  const to = input.to || context.env.EMAIL_TO || "user@example.com";
  const subject = input.subject || "智能体协作进度简报";
  const content = input.content || (typeof input === "string" ? input : JSON.stringify(input));
  const apiKey = context.env.EMAIL_API_KEY;
  const from = context.env.EMAIL_FROM || "agent@swarm.app";
  if (!apiKey) {
    return "[SIMULATED] 邮件已模拟发送至 " + to + "\\n主题: " + subject + "\\n内容长度: " + content.length + "字符\\n注意: 这是模拟发送，实际未发送邮件。请配置 EMAIL_API_KEY 以启用真实邮件发送。";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: from,
      to: [to],
      subject: subject,
      html: content
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error("邮件发送失败: " + errorText);
  }
  const data = await res.json();
  return "邮件发送成功\\n收件人: " + to + "\\n主题: " + subject + "\\n邮件ID: " + (data.id || "N/A");
}',
  '[{"name":"to","type":"string","required":false,"description":"收件人邮箱"},{"name":"subject","type":"string","required":false,"description":"主题"},{"name":"content","type":"string","required":true,"description":"邮件正文"}]',
  1
);

-- 5. llm_refinement (AI 格式精炼)
INSERT OR REPLACE INTO tools (name, description, category, script, params_schema, enabled)
VALUES (
  'llm_refinement',
  '基于LLM对输入文本进行指定格式精炼优化的工具',
  'general',
  'async function run(input, context) {
  const ai = context.env.AI;
  if (!ai) {
    throw new Error("AI 模型能力不可用");
  }
  const prompt = input.prompt || "优化文本";
  const text = input.text || "";
  const model = "@cf/meta/llama-3.1-8b-instruct-fp8";
  const res = await ai.run(model, {
    messages: [
      { role: "system", content: "你是一个内容精炼工具。根据以下用户指令对输入文本进行优化和格式调整。指令: " + prompt },
      { role: "user", content: text }
    ]
  });
  return res.response || "未生成任何重构文本";
}',
  '[{"name":"prompt","type":"string","required":false,"description":"精炼指令"},{"name":"text","type":"string","required":true,"description":"文本"}]',
  1
);

-- 6. llm_chat (通用 AI 对话)
INSERT OR REPLACE INTO tools (name, description, category, script, params_schema, enabled)
VALUES (
  'llm_chat',
  '基础AI对话交互工具',
  'general',
  'async function run(input, context) {
  const ai = context.env.AI;
  if (!ai) {
    throw new Error("AI模型不可用");
  }
  const message = input.message;
  const systemPrompt = input.system || "你是一个有帮助的AI助手。";
  const model = "@cf/meta/llama-3.1-8b-instruct-fp8";
  const res = await ai.run(model, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]
  });
  return res.response || "[ERROR] AI未返回响应";
}',
  '[{"name":"message","type":"string","required":true,"description":"对话内容"},{"name":"system","type":"string","required":false,"description":"系统提示词"}]',
  1
);
