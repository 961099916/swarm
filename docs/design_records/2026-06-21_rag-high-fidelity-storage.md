<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/docs/design_records/2026-06-21_rag-high-fidelity-storage.md -->
# 架构决策记录 (ADR) - 基于大厂标准的多格式 RAG 高保真存储与分层展示重构方案

- **状态**: 批准执行 (Approved)
- **日期**: 2026-06-21
- **作者**: Antigravity

## 1. 上下文与问题描述
在原有的 RAG 流程中，文档处理流水线（`doc-consumer`）采取了“剥离一切格式”的做法：在抓取网页或处理文档时，直接剔除所有 HTML 结构和物理换行符并写入数据库中。这造成了严重的“展示层失真”，导致用户在微信小程序端查阅知识库文档详情时，只能看见一整行未分段的大字块。

此外，随着后续本地文档（PDF、Word）的上传接入，直接将所有的排版打碎成 Chunks 展现会破坏文档原本的图表和排版，无法满足用户对于原始高保真文档预览的溯源需求。

## 2. 决策与设计方案
我们决定参考微软 Azure OpenAI Search、字节跳动 Coze、阿里百炼等大厂的工业级 RAG 架构设计，构建**非对称式 RAG 分级存储与检索展示体系**，实现展示层（保真原件）与向量检索层（干净文本）在物理上的彻底解耦。

### 2.1 冷热双轨存储 (Ingestion & Storage)
1. **本地上传文档 (FILE_UPLOAD)**：
   - 原始文件原件（PDF、Docx、Txt）上传冷存储在 **Cloudflare R2** 桶中，数据库记录唯一标识键 `file_key`。
2. **网页抓取文档 (WEB_SCRAPE)**：
   - 后端抓取到网页后，将其清洗并转化为保留了标题、列表、图片和代码块的**高保真 Markdown 格式**写入 `raw_content` 列中，实现最大化还原。

### 2.2 展示流与检索流解耦 (Dual-track Processing)
1. **展示流 (Render Track)**：
   - 网页/手动录入类型：前端（小程序端）详情抽屉直接读取 `raw_content` 的高保真 Markdown，使用 `mp-html` 解析渲染。
   - PDF/Word 原件：小程序详情抽屉新增「查阅原件」按钮，点击时后端向 R2 生成一个有时效性的 **Presigned URL**。小程序调用微信内置的 `wx.downloadFile` 与 `wx.openDocument` 接口，唤起手机系统原生的 Office / PDF 阅读器实现 100% 格式无损的保真预览。
2. **检索流 (Vector Track)**：
   - 后台消费端 `doc-consumer` 在进行 Chunking 和 Embedding 前，调用 **纯净化解析器** 临时剔除 `rawContent` 中所有的 HTML/Markdown 格式元素，确保向量化纯文字的正确性。此纯净文本仅用于语义检索，绝对不污染和替代用于渲染的原始格式数据。

## 3. 核心契约设计
- `documents` 表新增与升级属性：
  - `raw_content` (`text("raw_content")`): 网页或手动录入的原始高保真 Markdown/HTML。
  - `file_key` (`text("file_key")`): 冷存在 R2 桶中的对象键。
  - `source_url` (`text("source_url")`): 网页链接或 R2 临时授权链接。

- 接口设计：
  - `GET /api/v1/kb/document/preview?docId=xxx` 获取文档的 R2 临时签名预览链接。

## 4. 执行计划 (Todo List)
1. 数据库升级：在 `documents` 表中新增 `file_key` 字段。
2. 后端重构：
   - 重构 `backend/workers/doc-consumer/src/index.ts` 的网页抓取逻辑，使用 `html-to-markdown` 级别清洗算法，保留其排版格式。
   - 改造 `doc-consumer` 里的 Embedding 生成段：切割前调用纯净化正则剥离 HTML/Markdown 噪声标签，确保 Chunk 质量。
3. 前端重构：
   - 改造小程序文档管理详情页 [detail/index.js](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/mini-program/packageKnowledge/detail/index.js) 中的 `showDocDetail`：若是本地上传的实体文档，拉取后端预签 URL，通过 `wx.openDocument` 触发系统级预览。
   - 改造详情页 WXML，在详情抽屉里为实体文档渲染 **「查看 PDF/Office 原件」** 按钮。
