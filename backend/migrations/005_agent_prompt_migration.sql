-- File: /Users/zhangjiahao/IdeaProjects/swarm/backend/migrations/005_agent_prompt_migration.sql

-- 1. 将现有所有智能体的 system_prompt 字段的数据，作为第一版增量数据注入到 prompts 表中
INSERT OR IGNORE INTO prompts (key, version, content, description, is_active, created_at)
SELECT 
  'agent:' || id || ':system_prompt' AS key, 
  1 AS version, 
  system_prompt AS content, 
  '智能体 [' || name || '] 系统提示词' AS description, 
  1 AS is_active,
  (strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS created_at
FROM agents;

-- 2. 将 agents 表里的 system_prompt 改写成对应的 prompts 表中的 key 键引用
UPDATE agents
SET system_prompt = 'agent:' || id || ':system_prompt';
