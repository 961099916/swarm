// ─── 地图配置 ───
export interface MapConfig {
  width: number;
  height: number;
  playerSpawnX: number;
  playerSpawnY: number;
  obstacles: ObstacleItem[];
  npcList: Record<string, NPCItem>;
}

export interface ObstacleItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  activeUntilLevel?: number;
}

export interface NPCItem {
  id: string;
  name: string;
  x: number;
  y: number;
  stageId: string;
  npcType: string;
  dialogueText: string;
  avatarSvg: string;
  radius: number;
}

// ─── 关卡题库 ───
export interface StageQuestion {
  id: number;
  text: string;
  options: { id: string; text: string }[];
  correctId?: string;
  explanation?: string;
}

export interface NPCChallengeConfig {
  npcId: string;
  npcName: string;
  npcType: string;
  subjectName: string;
  requiredScore: number;
  dialogueText: { locked: string; todo: string; passed: string };
  questions: StageQuestion[];
}

export interface StageConfig {
  stageId: string;
  stageName: string;
  stageGroup: string;
  stageOrder: number;
  challenges: NPCChallengeConfig[];
}

// ─── API 请求体 ───
export interface AnswerSubmit {
  questionId: number;
  selectedOptionId: string;
}

export interface CalculateReq {
  testId: string;
  answers: AnswerSubmit[];
}

// ─── Quiz Worker 内部变量 ───
export type QuizVariables = {
  traceId: string;
  userId: string;
};
