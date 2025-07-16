# 代码清理变更日志

## 清理概览
移除了冗余的 `/query` 和 `/agent` 接口，统一使用 `/intelligent-query` 接口进行智能查询。

## 删除的接口
- `POST /query` - 基础RAG查询接口
- `POST /agent` - Agent查询接口  
- `POST /agent/stream` - 流式Agent查询接口
- `POST /retrieve` - 文档检索接口

## 新增的接口
- `POST /intelligent-query/stream` - 流式智能查询接口

## 保留的接口
- `POST /intelligent-query` - 智能查询接口（核心接口）
- `POST /cross-query` - 跨数据集查询接口
- `GET /health` - 健康检查接口
- `GET /status` - 应用状态接口
- `GET /datasets` - 数据集列表接口
- `POST /rebuild` - 重建索引接口
- `DELETE /collection` - 删除数据集接口

## 删除的应用方法
- `app.query()` - 基础查询方法
- `app.agentQuery()` - Agent查询方法
- `app.agentQueryStream()` - 流式Agent查询方法
- `app.retrieve()` - 文档检索方法

## 保留的应用方法
- `app.intelligentQuery()` - 智能查询方法
- `app.intelligentQueryStream()` - 流式智能查询方法
- `app.crossDatasetQuery()` - 跨数据集查询方法
- `app.initialize()` - 初始化方法
- `app.getStatus()` - 获取状态方法
- `app.rebuildIndex()` - 重建索引方法
- `app.deleteCollection()` - 删除数据集方法

## 文件修改列表
- `src/api/server.ts` - 删除冗余接口，添加流式智能查询接口
- `src/app.ts` - 删除冗余方法，保留核心智能查询方法
- `src/api/docs.ts` - 更新API文档，删除已移除接口的说明
- `src/main.ts` - 更新示例代码，使用新的智能查询接口
- `README.md` - 更新SDK使用示例

## 修复的问题
- 修复了 TypeScript 类型错误
- 修复了 LLM 分类器的参数问题
- 修复了 Master Agent 中的类型安全问题

## 架构简化效果
1. **接口统一**: 所有查询统一使用 `/intelligent-query` 接口
2. **减少复杂性**: 移除了功能重复的接口
3. **智能路由**: 所有查询自动进行智能路由，无需手动指定数据集
4. **保持功能**: 工具调用、流式输出等功能完全保留
5. **类型安全**: 修复了所有 TypeScript 类型问题

## 向后兼容性
⚠️ **破坏性变更**: 此次清理删除了现有的API接口，需要客户端代码更新。

## 迁移指南
```javascript
// 旧代码
const result = await app.query('查询内容', 'dataset', options);
const agentResult = await app.agentQuery('查询内容', 'dataset');

// 新代码
const result = await app.intelligentQuery('查询内容');
const agentResult = await app.intelligentQuery('查询内容');
```

## 清理完成时间
2025-07-16

## 验证状态
✅ 构建通过
✅ 类型检查通过  
✅ 服务器启动正常
✅ 智能查询接口测试通过 