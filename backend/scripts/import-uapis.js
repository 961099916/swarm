// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/scripts/import-uapis.js

const fs = require('fs');
const path = require('path');

// 指向保存了 openapi.json 内容的临时本地文件
const openApiFilePath = '/Users/zhangjiahao/.gemini/antigravity-ide/brain/fda9c023-baf3-4b11-81c9-0f2191dbe823/.system_generated/steps/646/content.md';

function run() {
  if (!fs.existsSync(openApiFilePath)) {
    console.error(`未找到 API 文档文件: ${openApiFilePath}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(openApiFilePath, 'utf8');
  const lines = rawContent.split('\n');
  const jsonLine = lines.find(line => line.trim().startsWith('{"openapi"'));
  
  if (!jsonLine) {
    console.error("未能从 API 文档内容中定位到标准的 OpenAPI JSON！");
    process.exit(1);
  }

  let openapi;
  try {
    openapi = JSON.parse(jsonLine);
  } catch (e) {
    console.error("解析 OpenAPI JSON 失败:", e.message);
    process.exit(1);
  }

  const sqlStatements = [];
  const baseUrl = "https://uapis.cn"; // D1 路由已经带有 /api/v1，或者可以直接设为 https://uapis.cn
  // 注意，OpenAPI 中的 paths 如 "/api/v1/convert/json"，包含 /api/v1 路径，所以 baseUrl 设为 "https://uapis.cn" 即可！
  
  let toolCount = 0;

  for (const [apiPath, pathItem] of Object.entries(openapi.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (method !== 'get' && method !== 'post') continue;

      const operationId = operation.operationId;
      if (!operationId) continue;

      // 工具名：将破折号转为下划线，作为工具注册表的 key
      const toolName = operationId.replace(/-/g, '_');

      // 汇总描述
      const summary = operation.summary || "";
      const details = operation.description || "";
      const fullDescription = `${summary}${details ? ' - ' + details : ''}`;
      // 清理单引号防 SQL 语法错误，截断防数据库过长
      const safeDescription = fullDescription.replace(/'/g, "''").slice(0, 1000);

      const paramsList = [];

      // 1. 解析 path 和 query 参数
      if (operation.parameters) {
        for (const param of operation.parameters) {
          if (param.in === 'query' || param.in === 'path') {
            let pType = 'string';
            if (param.schema && param.schema.type) {
              pType = param.schema.type === 'integer' ? 'number' : param.schema.type;
            }
            paramsList.push({
              name: param.name,
              type: pType,
              required: !!param.required,
              description: (param.description || "").replace(/'/g, "''").slice(0, 200)
            });
          }
        }
      }

      // 2. 解析 requestBody 参数（针对 POST 接口）
      let bodyTemplate = null;
      if (method === 'post' && operation.requestBody) {
        const contentObj = operation.requestBody.content;
        if (contentObj && contentObj['application/json'] && contentObj['application/json'].schema) {
          const schema = contentObj['application/json'].schema;
          if (schema.properties) {
            const bodyObj = {};
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
              bodyObj[propName] = `{{${propName}}}`;

              let pType = 'string';
              if (propSchema.type) {
                pType = propSchema.type === 'integer' ? 'number' : propSchema.type;
              }
              const isRequired = Array.isArray(schema.required) && schema.required.includes(propName);
              paramsList.push({
                name: propName,
                type: pType,
                required: isRequired,
                description: (propSchema.description || "").replace(/'/g, "''").slice(0, 200)
              });
            }
            bodyTemplate = JSON.stringify(bodyObj);
          }
        }
      }

      // 3. 构建规范 params_schema 字符串
      const paramsSchemaStr = JSON.stringify(paramsList).replace(/'/g, "''");

      // 4. 拼装 API 代理 Endpoint URL
      let endpoint = baseUrl + apiPath;
      // 路径参数替换如 {id} => {{id}}
      endpoint = endpoint.replace(/{([^}]+)}/g, '{{$1}}');

      if (method === 'get') {
        const queryParams = [];
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if (param.in === 'query') {
              queryParams.push(`${param.name}={{${param.name}}}`);
            }
          }
        }
        if (queryParams.length > 0) {
          endpoint += '?' + queryParams.join('&');
        }
      }

      const safeBodyTemplate = bodyTemplate ? `'${bodyTemplate.replace(/'/g, "''")}'` : 'NULL';

      const sql = `INSERT OR REPLACE INTO tools (name, description, category, endpoint, method, headers, body_template, script, params_schema, enabled) VALUES ('${toolName}', '${safeDescription}', 'general', '${endpoint}', '${method.toUpperCase()}', '{}', ${safeBodyTemplate}, NULL, '${paramsSchemaStr}', 1);`;
      sqlStatements.push(sql);
      toolCount++;
    }
  }

  // 写入生成的 seed SQL 文件中
  const outputSqlPath = path.join(__dirname, 'uapis-seed.sql');
  fs.writeFileSync(outputSqlPath, sqlStatements.join('\n'), 'utf8');
  console.log(`[INFO] 成功解析 ${toolCount} 个 API 并生成批量 SQL 至: ${outputSqlPath}`);
}

run();
