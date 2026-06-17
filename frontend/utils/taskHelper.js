/**
 * 任务状态处理工具函数
 * 消除 task/index.js 和 task/detail.js 之间的重复代码
 */

/**
 * 任务状态映射表
 * 集中管理状态标签和显示符号，避免多个页面重复 switch
 */
const STATUS_MAP = {
  PENDING:   { label: "排队中",   dot: "○" },
  RUNNING:   { label: "运行中",   dot: "●" },
  SUCCESS:   { label: "成功",     dot: "✓" },
  FAILED:    { label: "失败",     dot: "✕" },
  CANCELLED: { label: "已取消",   dot: "—" },
  SLEEPING:  { label: "已暂停",   dot: "" },
};

/**
 * 获取任务状态标签
 * @param {string} status - 任务状态（大写英文）
 * @returns {string} 中文状态标签
 */
function getStatusLabel(status) {
  return STATUS_MAP[status]?.label || status || "未知";
}

/**
 * 获取任务状态显示符号
 * @param {string} status - 任务状态
 * @returns {string} 显示符号
 */
function getStatusDot(status) {
  return STATUS_MAP[status]?.dot || "○";
}

/**
 * 获取状态 CSS 类名（小写）
 * @param {string} status - 任务状态
 * @returns {string} CSS class 名称
 */
function getStatusClass(status) {
  return (status || "pending").toLowerCase();
}

/**
 * 处理单个任务项，补充展示属性
 * @param {object} task - 原始任务数据
 * @returns {object} 扩展展示属性的任务对象
 */
function processTaskItem(task) {
  const displayName =
    task.payload && task.payload.workflowName
      ? task.payload.workflowName
      : "协同编排";

  const status = task.status || "PENDING";

  return {
    ...task,
    displayName,
    formattedTime: formatTaskTime(task.created_at),
    statusClass: getStatusClass(status),
    statusLabel: getStatusLabel(status),
    statusDot: getStatusDot(status),
  };
}

/**
 * 格式化 ISO 时间戳为短格式 (MM-DD HH:mm)
 * @param {string} isoStr - ISO 时间字符串
 * @returns {string} 格式化后的时间
 */
function formatTaskTime(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${min}`;
  } catch (_e) {
    return isoStr;
  }
}

/**
 * 格式化 ISO 时间戳为时分秒 (HH:mm:ss)
 * @param {string} isoStr - ISO 时间字符串
 * @returns {string} 格式化后的时间
 */
function formatTimeHms(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const hour = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const sec = String(d.getSeconds()).padStart(2, "0");
    return `${hour}:${min}:${sec}`;
  } catch (_e) {
    return isoStr;
  }
}

module.exports = {
  processTaskItem,
  getStatusLabel,
  getStatusDot,
  getStatusClass,
  formatTaskTime,
  formatTimeHms,
  STATUS_MAP,
};
