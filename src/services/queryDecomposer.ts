import { Settings } from 'llamaindex';

export interface SubQuery {
  id: string;
  query: string;
  type: 'knowledge_query' | 'math_calculation' | 'weather_query';
  priority: number; // 执行优先级
  confidence: number;
  reasoning: string;
}

export interface QueryDecompositionResult {
  originalQuery: string;
  subQueries: SubQuery[];
  hasMultipleIntents: boolean;
  reasoning: string;
}

// LLM响应中的子查询结构
interface ParsedSubQuery {
  id?: string;
  query?: string;
  type?: 'knowledge_query' | 'math_calculation' | 'weather_query';
  priority?: number;
  confidence?: number;
  reasoning?: string;
}

export class QueryDecomposer {
  /**
   * 分解复合查询为多个子查询
   */
  async decomposeQuery(query: string): Promise<QueryDecompositionResult> {
    const prompt = this.buildDecompositionPrompt(query);

    try {
      const response = await Settings.llm.complete({
        prompt,
      });

      const result = this.parseDecompositionResult(response.text, query);
      return result;
    } catch (error) {
      console.error('查询分解失败:', error);

      // 降级处理：作为单一查询处理
      return {
        originalQuery: query,
        subQueries: [
          {
            id: 'fallback-1',
            query: query,
            type: 'knowledge_query',
            priority: 1,
            confidence: 0.5,
            reasoning: '查询分解失败，作为单一知识查询处理',
          },
        ],
        hasMultipleIntents: false,
        reasoning: '查询分解服务异常，使用降级处理',
      };
    }
  }

  /**
   * 构建查询分解提示词
   */
  private buildDecompositionPrompt(query: string): string {
    return `你是一个智能查询分解系统。请分析用户的查询，并将其分解为多个子查询（如果需要）。

用户查询: "${query}"

请分析查询是否包含多个不同类型的问题，如果是，请将其分解为子查询。

支持的查询类型：
1. knowledge_query - 知识库查询（如：价格指数、机器学习概念等）
2. math_calculation - 数学计算（如：加法、乘法等）
3. weather_query - 天气查询（如：某城市的天气情况）

分解原则：
- 如果查询只包含一种类型，返回单个子查询
- 如果查询包含多种类型，分解为多个子查询
- 保持每个子查询的独立性和完整性
- 设置合理的优先级（1-10，数字越小优先级越高）

请返回JSON格式的结果：
{
  "hasMultipleIntents": boolean,
  "subQueries": [
    {
      "id": "unique-id",
      "query": "具体的子查询内容",
      "type": "knowledge_query|math_calculation|weather_query",
      "priority": 1-10,
      "confidence": 0.0-1.0,
      "reasoning": "选择此类型的原因"
    }
  ],
  "reasoning": "分解决策的整体说明"
}

示例：
查询: "最近一个月PPI是多少？另外计算123*456，再查询北京天气"
应该分解为：
- 子查询1：PPI查询（knowledge_query）
- 子查询2：数学计算（math_calculation）
- 子查询3：天气查询（weather_query）

请只返回JSON格式的结果，不要包含其他内容：`;
  }

  /**
   * 解析查询分解结果
   */
  private parseDecompositionResult(response: string, originalQuery: string): QueryDecompositionResult {
    try {
      // 清理响应文本，提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM响应中未找到有效的JSON格式');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 验证必需字段
      if (parsed.hasMultipleIntents === undefined || !parsed.subQueries || !Array.isArray(parsed.subQueries)) {
        throw new Error('LLM响应缺少必需字段');
      }

      // 为每个子查询添加唯一ID（如果没有的话）
      const subQueries: SubQuery[] = parsed.subQueries.map((sq: ParsedSubQuery, index: number) => ({
        id: sq.id || `sub-${Date.now()}-${index}`,
        query: sq.query || originalQuery,
        type: sq.type || 'knowledge_query',
        priority: sq.priority || index + 1,
        confidence: Math.max(0, Math.min(1, sq.confidence || 0.8)),
        reasoning: sq.reasoning || `子查询${index + 1}`,
      }));

      // 按优先级排序
      subQueries.sort((a, b) => a.priority - b.priority);

      return {
        originalQuery,
        subQueries,
        hasMultipleIntents: parsed.hasMultipleIntents,
        reasoning: parsed.reasoning || '查询分解完成',
      };
    } catch (error) {
      console.error('解析查询分解结果失败:', error);
      console.error('原始响应:', response);

      // 返回降级结果
      return {
        originalQuery,
        subQueries: [
          {
            id: 'fallback-1',
            query: originalQuery,
            type: 'knowledge_query',
            priority: 1,
            confidence: 0.5,
            reasoning: '分解失败，作为单一查询处理',
          },
        ],
        hasMultipleIntents: false,
        reasoning: `查询分解解析失败，使用降级处理: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 验证子查询类型是否有效
   */
  private isValidQueryType(type: string): type is SubQuery['type'] {
    return ['knowledge_query', 'math_calculation', 'weather_query'].includes(type);
  }
}
