/**
 * knowledgeAPI — 知识库领域 API 抽象层 (BFF)
 *
 * 封装所有知识库相关的 API 调用，前端页面不直接拼接 URL。
 * 领域方法命名遵循 Ubiquitous Language（通用语言）。
 *
 * @module utils/knowledgeAPI
 * @typedef {Object} KnowledgeBase
 * @property {string} id
 * @property {string} name
 * @property {string|undefined} description
 * @property {boolean} isPublic
 * @property {number} documentCount
 * @property {string} createdAt
 * @typedef {Object} Document
 * @property {string} id
 * @property {string} kbId
 * @property {string} title
 * @property {string} sourceType
 * @property {string} status
 * @property {number} chunkCount
 * @property {string} createdAt
 * @typedef {Object} SearchResult
 * @property {string} chunkId
 * @property {string} documentTitle
 * @property {string} content
 * @property {number} score
 */

const { request } = require("./request");

/** 获取知识库列表 */
async function listKnowledgeBases(page = 1, pageSize = 20, search = "") {
  const res = await request({ url: `/api/v1/kb/list?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}` });
  return res.data || { list: [], total: 0 };
}

/** 创建知识库 */
async function createKnowledgeBase(name, description) {
  const res = await request({ url: "/api/v1/kb/create", method: "POST", data: { name, description } });
  return res.data;
}

/** 获取知识库详情 */
async function getKnowledgeBase(kbId) {
  const res = await request({ url: `/api/v1/kb/get?kbId=${kbId}` });
  return res.data;
}

/** 删除知识库 */
async function deleteKnowledgeBase(kbId) {
  await request({ url: `/api/v1/kb/delete?kbId=${kbId}`, method: "DELETE" });
}

/** 添加文档（URL 抓取） */
async function addDocumentByUrl(kbId, url, title) {
  const res = await request({ url: "/api/v1/kb/document/url", method: "POST", data: { kbId, url, title } });
  return res.data;
}

/** 添加文档（手动录入） */
async function addDocumentManual(kbId, title, content) {
  const res = await request({ url: "/api/v1/kb/document/manual", method: "POST", data: { kbId, title, content } });
  return res.data;
}

/** 获取文档列表 */
async function listDocuments(kbId) {
  const res = await request({ url: `/api/v1/kb/document/list?kbId=${kbId}` });
  return res.data || [];
}

/** 删除文档 */
async function deleteDocument(docId) {
  await request({ url: `/api/v1/kb/document/delete?docId=${docId}`, method: "DELETE" });
}

/** 搜索知识库 */
async function searchKnowledge(kbId, query, topK = 5, minScore = 0.3) {
  const res = await request({ url: "/api/v1/kb/search", method: "POST", data: { kbId, query, topK, minScore } });
  return res.data?.results || [];
}

module.exports = {
  listKnowledgeBases,
  createKnowledgeBase,
  getKnowledgeBase,
  deleteKnowledgeBase,
  addDocumentByUrl,
  addDocumentManual,
  listDocuments,
  deleteDocument,
  searchKnowledge,
};
