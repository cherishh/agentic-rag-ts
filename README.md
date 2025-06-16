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
├── api/
│   ├── server.ts           # API服务器 - Hono REST API
│   └── docs.ts             # API文档 - 交互式文档
├── app.ts                  # 应用程序主类 - 统一封装API
├── main.ts                 # 功能演示
└── server.ts               # API服务器启动入口
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
PORT=3000  # API服务器端口
```

### 2. 安装依赖

```bash
bun install
```

### 3. 启动方式

#### 方式一：API服务器模式（推荐）

```bash
# 启动API服务器
bun run server

# 开发模式（自动重启）
bun run server:watch

# 生产模式
bun run server:prod
```

启动后访问：
- **API文档**: http://localhost:3000
- **健康检查**: http://localhost:3000/health
- **应用状态**: http://localhost:3000/status

#### 方式二：命令行演示模式

```bash
# 运行功能演示
bun run dev

# 开发模式（自动重启）
bun run dev:watch
```

## 📚 SDK式使用

除了 REST API，你还可以直接导入使用：

```typescript
import { app } from './src/app';

// 初始化
await app.initialize();

// 基础查询
const result = await app.query('{查询内容}', 'price_index_statistics', {
  similarityTopK: 5,
  includeSourceNodes: true
});

// Agent查询
const agentResult = await app.agentQuery('{查询内容}并计算{123*456}');

// 流式Agent查询
for await (const chunk of app.agentQueryStream('{查询内容}')) {
  process.stdout.write(chunk);
}

// 跨数据集查询
const crossResults = await app.crossDatasetQuery('{查询内容}', [
  'price_index_statistics', 
  'machine_learning'
]);

// 获取应用状态
const status = await app.getStatus();
```

## 🧪 API测试

提供了简单的测试脚本：

```bash
# 启动API服务器（另一个终端）
bun run server

# 运行API测试
node test-api.js
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

## 📊 支持的数据集

- **机器学习** (`machine_learning`) - 机器学习课程全部视频内容转写，约 39w 字
- **价格指数统计** (`price_index_statistics`) -  国家统计局各类价格指数数据(近 13 个月)，共 5 个 table

## 🛠️ 技术栈

- **LlamaIndex.TS** - RAG框架
- **Qdrant Cloud** - 向量数据库
- **OpenAI** - LLM和嵌入模型
- **TypeScript** - 类型安全
- **Bun** - 运行时和包管理器 


## 坑
不要使用openrouter。openrouter：
- 不支持 embedding model，即无法创建 vector store
- 不支持 tool calling，即使使用 gpt-4o