
// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/tools.ts

import { ToolRegistry } from "./tools/registry";

export type { ToolContext, WorkflowTool } from "./tools/types";
export { ToolRegistry } from "./tools/registry";

export async function ensureDbToolsLoaded(db: any): Promise<void> {
  await ToolRegistry.loadAllFromDb(db);
}

