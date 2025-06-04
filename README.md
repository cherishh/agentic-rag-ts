# Agentic RAG

基于LlamaIndex.TS + Qdrant Cloud(Vector DB) + OpenAI的RAG（检索增强生成）应用程序，支持多数据集、混合 AI Agent功能（rag 之外的问题可路由到不同的 tool）。

## 🏗️ 代码结构

```
src/
├── config.ts              # 配置文件 - 集中管理
├── services/
│   ├── vectorStore.ts      # 向量存储服务 - Qdrant related
│   ├── queryService.ts     # 查询服务 - 基础RAG查询功能
│   └── agentService.ts     # Agent服务 - Agentic查询
├── app.ts                  # 应用程序主类 - 统一封装API
└── main.ts                 # 功能演示
```

## 🚀 快速开始

### 1. 环境变量配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
OPENAI_API_KEY=your_openai_api_key
QDRANT_URL=your_qdrant_cloud_url
QDRANT_API_KEY=your_qdrant_api_key
```

### 2. 安装依赖

```bash
bun install
```

### 3. 运行演示

```bash
bun src/main.ts
```

## 📚 API使用

### 基础导入

```typescript
import { app } from './src/app';
```

### 核心功能

```typescript
// 1. 初始化应用
await app.initialize();

// 2. 基础查询
const result = await app.query('查询内容', 'price_index_statistics', {
  similarityTopK: 5,
  includeSourceNodes: true
});

// 3. 文档检索（不生成回答）
const retrieval = await app.retrieve('查询内容', 'price_index_statistics');

// 4. AI Agent查询（支持工具调用）
const agentResult = await app.agentQuery('查询内容并计算123*456');

// 5. 流式Agent查询
for await (const chunk of app.agentQueryStream('查询内容')) {
  process.stdout.write(chunk);
}

// 6. 跨数据集查询
const crossResults = await app.crossDatasetQuery('查询内容', [
  'price_index_statistics', 
  'machine_learning'
]);

// 7. 获取应用状态
const status = await app.getStatus();

// 8. 管理功能
await app.rebuildIndex('price_index_statistics');
await app.deleteCollection('price_index_statistics');
```

## 🔧 配置管理

### 数据集配置

在 `src/config.ts` 中管理数据集：

```typescript
export const DATASET_CONFIGS = {
  machine_learning: {
    collectionName: 'machine_learning_documents',
    dataPath: './data/machine_learning_transcript',
    description: '机器学习课程内容',
  },
  price_index_statistics: {
    collectionName: 'price_index_statistics',
    dataPath: './data/price_index_statistics_utf8',
    description: '价格指数统计',
  },
};
```

### 模型配置

```typescript
export const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',                    // LLM模型
  embedModel: 'text-embedding-3-small', // 嵌入模型（不要使用 huggingface，hf不支持中文）
  temperature: 0,
};
```

## 🌐 API化准备

当前代码结构已为API化做好准备，可以轻松集成到Hono框架：

```typescript
// 示例：Hono路由集成
import { Hono } from 'hono';
import { app } from './src/app';

const api = new Hono();

// 查询接口
api.post('/query', async (c) => {
  const { query, dataset, options } = await c.req.json();
  const result = await app.query(query, dataset, options);
  return c.json(result);
});

// Agent接口
api.post('/agent', async (c) => {
  const { query, dataset } = await c.req.json();
  const result = await app.agentQuery(query, dataset);
  return c.json({ response: result });
});

// 状态接口
api.get('/status', async (c) => {
  const status = await app.getStatus();
  return c.json(status);
});
```

## 📊 支持的数据集

- **机器学习** (`machine_learning`) - 机器学习课程全部视频内容转写，约 39w 字
- **价格指数统计** (`price_index_statistics`) -  国家统计局各类价格指数数据(近 13 个月)，共 5 个 table

## 🛠️ 技术栈

- **LlamaIndex.TS** - RAG框架
- **Qdrant Cloud** - 向量数据库
- **OpenAI** - LLM和嵌入模型
- **TypeScript** - 类型安全
- **Bun** - 运行时和包管理器





