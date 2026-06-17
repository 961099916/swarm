
import { users, tasks, ApiResponse, AdminStatsRes } from "@swarm/shared";
import { drizzle } from "drizzle-orm/d1";
import { count, eq, gte } from "drizzle-orm";

export async function handleAdminStats(db: D1Database, traceId: string): Promise<Response> {
  try {
    // 针对东八区（UTC+8）北京时间做本地零点对齐，防止 UTC 导致的凌晨时段统计偏差
    const timezoneOffsetMs = 8 * 60 * 60 * 1000;
    const localTime = new Date(Date.now() + timezoneOffsetMs);
    const todayStr = localTime.toISOString().substring(0, 10) + "T00:00:00Z";
    const drizzleDb = drizzle(db);
    
    const [totalUsersRes, runningTasksRes, totalTasksRes, todayNewTasksRes] = await drizzleDb.batch([
      drizzleDb.select({ count: count() }).from(users),
      drizzleDb.select({ count: count() }).from(tasks).where(eq(tasks.status, "RUNNING")),
      drizzleDb.select({ count: count() }).from(tasks),
      drizzleDb.select({ count: count() }).from(tasks).where(gte(tasks.createdAt, todayStr))
    ]);

    const stats: AdminStatsRes = {
      totalUsers: totalUsersRes[0].count,
      runningTasks: runningTasksRes[0].count,
      totalTasks: totalTasksRes[0].count,
      todayNewTasks: todayNewTasksRes[0].count
    };

    return new Response(JSON.stringify({ success: true, data: stats, traceId } as ApiResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 获取管理员面板数据失败: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: "系统查询统计看板数据异常", traceId } as ApiResponse),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
