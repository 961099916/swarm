export interface QuizUserRow {
  user_id: string;
  exp: number;
  level: number;
  different_count: number;
  completed_count: number;
  updated_at: string | null;
  created_at: string;
}

export interface TestHistoryRow {
  id: string;
  user_id: string;
  test_id: string;
  test_title: string;
  test_type: string;
  result_code: string;
  result_name: string;
  raw_scores: string;
  created_at: string;
}

export interface UserStageProgressRow {
  user_id: string;
  stage_id: string;
  npc_id: string;
  score: number;
  total: number;
  passed: number;
  updated_at: string;
}
