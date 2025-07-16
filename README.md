# Agentic RAG 智能检索增强生成系统

基于多Agent架构的智能RAG系统，支持复杂查询分解、多工具协作和智能路由。采用 LlamaIndex.TS + Qdrant Cloud + OpenAI 技术栈，提供自然语言查询、数学计算、天气查询等多种能力。

## 🌟 核心特性

### 🤖 多Agent协作架构
- **查询分解**：自动识别复合查询中的多种意图
- **并行执行**：多个子查询并行处理，提高响应速度
- **智能聚合**：LLM驱动的结果整合，生成连贯回答

### 🎯 智能路由系统
- **自动数据集选择**：基于查询内容智能选择最合适的数据集
- **多级决策**：关键词匹配 → LLM分类 → 默认策略
- **高性能优化**：高置信度查询快速返回

### 🛠️ 多工具集成
- **知识库查询**：从向量数据库检索相关信息
- **数学计算**：支持加法、乘法等数学运算
- **天气查询**：实时天气信息获取
- **可扩展设计**：易于添加新的工具类型

### 📊 支持的数据集
- **机器学习课程**：约39万字的机器学习视频转写内容
- **价格指数统计**：国家统计局13个月的价格指数数据

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        API 层                               │
│              Hono REST API + 交互式文档                     │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                     应用层                                  │
│               RAGApplication 统一入口                        │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                   多Agent协作层                             │
│  QueryDecomposer → SubAgentExecutor → ResultAggregator     │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                   智能路由层                                │
│             RouterEngine + LLMClassifier                   │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                  数据访问层                                 │
│            VectorStoreService + Qdrant Cloud               │
└─────────────────────────────────────────────────────────────┘
```

## 📁 项目结构

```
src/
├── config.ts                   # 配置管理
├── app.ts                      # 应用程序主入口
├── index.ts                    # 服务器启动入口
├── services/
│   ├── masterAgent.ts          # 主控Agent，协调整个处理流程
│   ├── queryDecomposer.ts      # 查询分解器
│   ├── subAgentExecutor.ts     # 子Agent执行器
│   ├── resultAggregator.ts     # 结果聚合器
│   ├── routerEngine.ts         # 智能路由引擎
│   ├── llmClassifier.ts        # LLM分类器
│   ├── vectorStore.ts          # 向量存储服务
│   ├── queryService.ts         # 基础查询服务
│   ├── agentService.ts         # Agent服务
│   ├── weatherService.ts       # 天气服务
│   └── logger.ts               # 日志系统
├── api/
│   ├── server.ts               # API服务器
│   └── docs.ts                 # API文档
└── tests/
    └── vectorStore.test.ts     # 测试文件
```

## 🚀 快速开始

### 1. 环境配置

```bash
# 创建环境变量文件
cp .env.example .env

# 编辑环境变量
OPENAI_API_KEY=your_openai_api_key
QDRANT_URL=your_qdrant_cloud_url
QDRANT_API_KEY=your_qdrant_api_key
WEATHER_API_KEY=your_weather_api_key  # 可选
PORT=3000
```

### 2. 安装依赖

```bash
bun install
```

### 3. 启动服务

```bash
# 启动API服务器
bun run server

# 开发模式（自动重启）
bun run server:watch

# 生产模式
bun run server:prod
```

服务启动后访问：
- **API文档**: http://localhost:3000
- **健康检查**: http://localhost:3000/health
- **应用状态**: http://localhost:3000/status

## 📚 使用方式

### REST API 调用

```bash
# 单一意图查询
curl -X POST http://localhost:3000/intelligent-query \
  -H "Content-Type: application/json" \
  -d '{"query": "什么是梯度下降？"}'

# 多意图复合查询
curl -X POST http://localhost:3000/intelligent-query \
  -H "Content-Type: application/json" \
  -d '{"query": "最近一个月PPI是多少？另外计算123*456，再查询北京天气"}'

# 流式查询
curl -X POST http://localhost:3000/intelligent-query/stream \
  -H "Content-Type: application/json" \
  -d '{"query": "解释一下机器学习中的过拟合"}' \
  --no-buffer
```

### SDK 直接调用

```typescript
import { app } from './src/app';

// 初始化应用
await app.initialize();

// 智能查询
const result = await app.intelligentQuery('什么是梯度下降？');
console.log(result.response);

// 流式查询
for await (const chunk of app.intelligentQueryStream('解释机器学习概念')) {
  process.stdout.write(chunk);
}

// 跨数据集查询
const crossResult = await app.crossDatasetQuery('相关查询', [
  'machine_learning', 
  'price_index_statistics'
]);
```

## 🔧 配置说明

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
  model: 'gpt-4o',
  temperature: 0,
  baseUrl: 'https://api.openai.com/v1',
};
```

## 🎯 查询示例

### 单一意图查询
```json
{
  "query": "什么是梯度下降？",
  "response": "梯度下降是一种优化算法...",
  "analysis": {
    "queryType": "single_intent",
    "confidence": 0.9
  }
}
```

### 多意图复合查询
```json
{
  "query": "最近一个月PPI是多少？另外计算123*456，再查询北京天气",
  "response": "关于最近一个月的PPI数据...",
  "decomposition": {
    "hasMultipleIntents": true,
    "subQueries": [
      {"type": "knowledge_query", "query": "最近一个月PPI是多少？"},
      {"type": "math_calculation", "query": "计算123*456"},
      {"type": "weather_query", "query": "查询北京天气"}
    ]
  },
  "executionSummary": {
    "totalSubQueries": 3,
    "successfulQueries": 3,
    "failedQueries": 0,
    "totalExecutionTime": 2500
  }
}
```

## 🧪 测试

```bash
# 运行向量存储测试
bun run test:vectorstore

# 运行API测试
bun run test:api
```

## 📈 性能特点

- **响应时间**：单一查询 2-5秒，复合查询 5-15秒
- **并发支持**：支持多个并发请求
- **流式响应**：实时输出，首字节时间 <1秒
- **智能缓存**：提高重复查询响应速度

## 🛠️ 技术栈

- **运行时**：Bun (JavaScript运行时和包管理器)
- **语言**：TypeScript (类型安全)
- **RAG框架**：LlamaIndex.TS
- **向量数据库**：Qdrant Cloud
- **LLM服务**：OpenAI GPT-4o
- **嵌入模型**：OpenAI text-embedding-3-small
- **API框架**：Hono (轻量级Web框架)
- **外部API**：WeatherAPI (天气服务)

## 🔍 API 接口

### 核心接口
- `POST /intelligent-query` - 智能查询
- `POST /intelligent-query/stream` - 流式智能查询
- `POST /cross-query` - 跨数据集查询

### 管理接口
- `GET /health` - 健康检查
- `GET /status` - 应用状态
- `GET /datasets` - 数据集列表
- `POST /rebuild` - 重建索引
- `DELETE /collection` - 删除数据集

## 🎁 功能亮点

- **🧠 智能分解**：自动识别复合查询中的多种意图
- **⚡ 并行处理**：多个子查询同时执行，提高效率
- **🎯 精准路由**：智能选择最合适的数据集
- **🔄 流式响应**：实时输出，提升用户体验
- **🛡️ 错误处理**：完善的错误处理和降级机制
- **📊 执行统计**：详细的性能和执行统计信息

## 📝 开发说明

### 添加新的数据集
1. 在 `src/config.ts` 中添加数据集配置
2. 在 `src/services/llmClassifier.ts` 中添加描述
3. 重建索引即可使用

### 添加新的工具类型
1. 在 `src/services/subAgentExecutor.ts` 中添加执行逻辑
2. 在 `src/services/queryDecomposer.ts` 中添加类型识别
3. 更新相关TypeScript类型定义

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 坑
不要使用openrouter。openrouter：
- 不支持 embedding model，即无法创建 vector store
- 不支持 tool calling，即使使用 gpt-4o