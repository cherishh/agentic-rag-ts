# 完整的 Agentic RAG 系统架构梳理

## 🏗️ 系统架构概览

### 分层架构设计
```
┌─────────────────────────────────────────────────────────────┐
│                        API 层                               │
│  • REST API 端点 (/intelligent-query, /query, /agent)      │
│  • 请求验证和响应格式化                                      │
│  • 错误处理和日志记录                                        │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                   应用层 (RAGApplication)                    │
│  • 统一的入口点和服务协调                                    │
│  • 智能查询和传统查询接口                                    │
│  • 兼容性处理                                               │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                 服务层 (AgentService)                       │
│  • 智能查询入口 (runIntelligentQuery)                       │
│  • 传统查询兼容 (runQuery)                                  │
│  • 流式查询处理                                             │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│               智能路由层 (Master Agent)                      │
│  • 查询意图分析 (direct_tool vs knowledge_query)           │
│  • 直接工具调用 (数学、天气)                                 │
│  • 知识库查询路由                                           │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                路由引擎 (Router Engine)                      │
│  • 关键词匹配 (置信度 > 0.6)                               │
│  • LLM智能分类 (置信度 ≤ 0.6)                              │
│  • 数据集选择和查询执行                                      │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│            数据访问层 (VectorStoreService)                   │
│  • Qdrant 向量数据库连接                                    │
│  • 索引管理和查询执行                                        │
│  • 健康检查和诊断                                           │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 核心组件详解

### 1. Master Agent (智能决策者)
- **文件位置**: `src/services/masterAgent.ts`
- **职责**: 顶层查询意图分析和路由决策
- **功能**: 
  - 区分直接工具调用 vs 知识库查询
  - 处理数学计算、天气查询等直接工具
  - 将知识库查询转发给 Router Engine

### 2. Router Engine (智能路由引擎)
- **文件位置**: `src/services/routerEngine.ts`
- **职责**: 数据集选择和查询执行
- **决策流程**:
  1. 关键词匹配 (置信度 > 0.6 → 直接使用)
  2. LLM智能分类 (置信度 ≤ 0.6 → LLM判断)
  3. 容错处理 (LLM异常 → 默认数据集)

### 3. LLM Classifier (LLM分类器)
- **文件位置**: `src/services/llmClassifier.ts`
- **职责**: 处理关键词匹配无法解决的复杂查询
- **工作方式**: 提供查询和数据集描述给LLM，获取分类结果
- **输出**: 推荐数据集 + 置信度 + 推理过程

## 📋 具体例子：全链路处理演示

### 例子: "应该以什么原则划分 dev set 和 test set"

#### 1. API 层接收请求
```http
POST /intelligent-query
Content-Type: application/json
{
  "query": "应该以什么原则划分 dev set 和 test set"
}
```

#### 2. 应用层处理
```typescript
// src/app.ts:111
async intelligentQuery(query: string) {
  return await this.agentService.runIntelligentQuery(query);
}
```

#### 3. 服务层调用
```typescript
// src/services/agentService.ts:37
async runIntelligentQuery(query: string): Promise<MasterAgentResponse> {
  return await this.masterAgent.processQuery(query);
}
```

#### 4. Master Agent 分析
```typescript
// src/services/masterAgent.ts:33
async processQuery(query: string): Promise<MasterAgentResponse> {
  // 1. 分析查询意图
  const analysis = await this.analyzeQueryIntent(query);
  // 结果: {
  //   queryType: 'knowledge_query',
  //   confidence: 0.5,
  //   reasoning: '无法明确识别查询类型，默认作为知识库查询处理'
  // }
  
  // 2. 知识库查询路由
  const routingResult = await this.routerEngine.routeQuery(query, analysis.domain);
}
```

#### 5. Router Engine 路由决策
```typescript
// src/services/routerEngine.ts:58
private async selectBestDataset(query: string): Promise<DatasetSelection> {
  // 1. 关键词匹配
  const mlScore = this.calculateKeywordScore(lowerQuery, mlKeywords);
  const priceScore = this.calculateKeywordScore(lowerQuery, priceIndexKeywords);
  
  // mlScore: 0.35 (匹配 "dev set", "test set")
  // priceScore: 0.0
  // bestScore: 0.35
  
  // 2. 置信度判断 (0.35 ≤ 0.6)
  if (bestScore > 0.6) {
    // 跳过 - 置信度不够
  }
  
  // 3. LLM智能分类
  const llmResult = await this.llmClassifier.classify(query);
  // 结果: {
  //   dataset: 'machine_learning',
  //   confidence: 0.9,
  //   reasoning: '查询涉及dev set和test set的划分原则，属于机器学习领域'
  // }
}
```

#### 6. LLM分类器处理
```typescript
// src/services/llmClassifier.ts:35
async classify(query: string): Promise<LLMClassificationResult> {
  const prompt = `
  请分析以下查询并选择最合适的数据集：
  
  查询: "应该以什么原则划分 dev set 和 test set"
  
  可用数据集:
  1. machine_learning: 机器学习课程内容...
  2. price_index_statistics: 价格指数统计数据...
  `;
  
  const response = await Settings.llm.complete({ prompt });
  // LLM返回: {"dataset": "machine_learning", "confidence": 0.9, "reasoning": "..."}
}
```

#### 7. 数据访问层查询
```typescript
// src/services/routerEngine.ts:185
private async executeQuery(query: string, dataset: DatasetKey): Promise<string> {
  const index = await this.vectorStoreService.getIndex('machine_learning');
  const queryEngine = index.asQueryEngine({
    retriever: index.asRetriever({ similarityTopK: 5 }),
  });
  
  const response = await queryEngine.query({ query });
  return response.toString();
}
```

#### 8. 最终响应
```json
{
  "success": true,
  "data": {
    "query": "应该以什么原则划分 dev set 和 test set",
    "response": "在划分 dev set 和 test set 时，应该遵循以下原则...",
    "analysis": {
      "queryType": "knowledge_query",
      "confidence": 0.5,
      "reasoning": "无法明确识别查询类型，默认作为知识库查询处理"
    },
    "selectedDataset": "机器学习课程内容",
    "routingReason": "LLM智能分类: 查询涉及dev set和test set的划分原则，属于机器学习领域"
  },
  "meta": {
    "type": "intelligent",
    "routing": {
      "queryType": "knowledge_query",
      "confidence": 0.5,
      "reasoning": "无法明确识别查询类型，默认作为知识库查询处理"
    }
  }
}
```

## 🎯 关键特性

1. **智能路由**: 自动选择最佳数据集，无需用户指定
2. **分层决策**: 关键词匹配 → LLM分类 → 容错处理
3. **高性能**: 高置信度查询快速返回
4. **容错机制**: 多层次的错误处理和回退策略
5. **可扩展性**: 新增数据集只需更新配置和LLM描述

## 💡 改进成果

### 解决的问题
- ✅ 修复了意图识别不准确的问题
- ✅ 扩展了关键词库，包含 "dev set", "test set" 等专业术语
- ✅ 实现了LLM智能分类作为关键词匹配的补充
- ✅ 简化了决策流程，提高了系统稳定性

### 测试结果
- ✅ "应该以什么原则划分 dev set 和 test set" → 机器学习数据集 (LLM分类)
- ✅ "什么是梯度下降？" → 机器学习数据集 (关键词匹配)
- ✅ "最近一个月PPI是多少？" → 价格指数数据集 (关键词匹配)
- ✅ "如何评估一个AI模型的性能？" → 机器学习数据集 (关键词匹配)

## 🔄 决策流程图

```
用户查询
    ↓
Master Agent 意图分析
    ↓
直接工具调用? → 是 → 数学/天气工具 → 返回结果
    ↓ 否
Router Engine 路由
    ↓
关键词匹配 → 置信度 > 0.6? → 是 → 选择数据集
    ↓ 否
LLM智能分类 → 成功? → 是 → 选择数据集
    ↓ 否
默认数据集 (容错)
    ↓
执行查询 → 返回结果
```

这就是改进后的完整 Agentic RAG 系统架构！