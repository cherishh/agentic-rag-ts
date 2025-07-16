import { VectorStoreService } from './vectorStore';
import { QueryDecomposer } from './queryDecomposer';
import { SubAgentExecutor } from './subAgentExecutor';
import { ResultAggregator } from './resultAggregator';
import type { QueryDecompositionResult } from './queryDecomposer';
import type { SubQueryResult } from './subAgentExecutor';
import type { AggregatedResult } from './resultAggregator';

export interface MasterAgentResponse {
  query: string;
  response: string;
  decomposition: QueryDecompositionResult;
  subResults: SubQueryResult[];
  aggregation: AggregatedResult;
  executionSummary: AggregatedResult['executionSummary'];
  // 保持向后兼容
  analysis: {
    queryType: 'multi_intent' | 'single_intent';
    confidence: number;
    reasoning: string;
  };
  selectedDataset?: string;
  routingReason?: string;
}

export class MasterAgent {
  private queryDecomposer: QueryDecomposer;
  private subAgentExecutor: SubAgentExecutor;
  private resultAggregator: ResultAggregator;

  constructor(vectorStoreService: VectorStoreService) {
    this.queryDecomposer = new QueryDecomposer();
    this.subAgentExecutor = new SubAgentExecutor(vectorStoreService);
    this.resultAggregator = new ResultAggregator();
  }

  /**
   * 处理查询的主入口
   */
  async processQuery(query: string): Promise<MasterAgentResponse> {
    try {
      // 1. 分解查询
      console.log('🔍 开始分解查询:', query);
      const decomposition = await this.queryDecomposer.decomposeQuery(query);
      console.log('📋 查询分解结果:', decomposition);

      // 2. 执行子查询
      console.log('⚡ 开始执行子查询...');
      const subResults = await this.subAgentExecutor.executeSubQueries(decomposition.subQueries);
      console.log('✅ 子查询执行完成:', subResults);

      // 3. 聚合结果
      console.log('🔄 开始聚合结果...');
      const aggregation = await this.resultAggregator.aggregateResults(query, subResults);
      console.log('🎯 结果聚合完成:', aggregation);

      // 4. 构造向后兼容的分析结果
      const analysis = {
        queryType: decomposition.hasMultipleIntents ? ('multi_intent' as const) : ('single_intent' as const),
        confidence: this.calculateOverallConfidence(decomposition.subQueries),
        reasoning: decomposition.reasoning,
      };

      // 5. 提取选中的数据集信息（用于向后兼容）
      const knowledgeQueries = subResults.filter(r => r.type === 'knowledge_query' && r.success);
      const selectedDataset = knowledgeQueries.length > 0 ? '智能路由选择' : undefined;
      const routingReason = knowledgeQueries.length > 0 ? '通过查询分解和智能路由选择' : undefined;

      return {
        query,
        response: aggregation.finalResponse,
        decomposition,
        subResults,
        aggregation,
        executionSummary: aggregation.executionSummary,
        analysis,
        selectedDataset,
        routingReason,
      };
    } catch (error) {
      console.error('❌ MasterAgent处理查询失败:', error);

      // 错误处理：返回错误信息
      const errorResponse = `❌ 查询处理失败: ${error instanceof Error ? error.message : '未知错误'}`;

      return {
        query,
        response: errorResponse,
        decomposition: {
          originalQuery: query,
          subQueries: [],
          hasMultipleIntents: false,
          reasoning: '查询处理失败',
        },
        subResults: [],
        aggregation: {
          originalQuery: query,
          finalResponse: errorResponse,
          subResults: [],
          aggregationReasoning: '查询处理失败',
          executionSummary: {
            totalSubQueries: 0,
            successfulQueries: 0,
            failedQueries: 0,
            totalExecutionTime: 0,
          },
        },
        executionSummary: {
          totalSubQueries: 0,
          successfulQueries: 0,
          failedQueries: 0,
          totalExecutionTime: 0,
        },
        analysis: {
          queryType: 'single_intent',
          confidence: 0,
          reasoning: '查询处理失败',
        },
        selectedDataset: undefined,
        routingReason: undefined,
      };
    }
  }

  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(subQueries: any[]): number {
    if (subQueries.length === 0) return 0;

    const totalConfidence = subQueries.reduce((sum, sq) => sum + sq.confidence, 0);
    return totalConfidence / subQueries.length;
  }
}
