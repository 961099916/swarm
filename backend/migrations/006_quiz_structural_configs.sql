-- 1. 测评年级关卡主表
CREATE TABLE IF NOT EXISTS quiz_stages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stage_group TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  updated_at TEXT
);

-- 2. NPC 导师挑战配置表
CREATE TABLE IF NOT EXISTS quiz_npcs (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL,
  name TEXT NOT NULL,
  npc_type TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  required_score INTEGER NOT NULL,
  dialogue_locked TEXT NOT NULL,
  dialogue_todo TEXT NOT NULL,
  dialogue_passed TEXT NOT NULL,
  updated_at TEXT
);

-- 3. NPC 旗下题库表
CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY,
  npc_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_id TEXT NOT NULL,
  explanation TEXT,
  updated_at TEXT
);
