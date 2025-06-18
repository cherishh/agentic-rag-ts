import { VectorStoreIndex, MetadataMode } from 'llamaindex';
import { RETRIEVAL_CONFIG } from '../config';
import { VectorStoreService } from './vectorStore';
import type { DatasetKey } from './vectorStore';

export interface QueryResult {
  query: string;
  response: string;
  sourceNodes?: Array<{
    score: number;
    content: string;
  }>;
}

export interface RetrievalResult {
  query: string;
  nodes: Array<{
    score: number;
    content: string;
  }>;
}

export class QueryService {
  constructor(private vectorStoreService: VectorStoreService) {}

  /**
   * 执行查询
   */
  async query(
    query: string,
    dataset: DatasetKey,
    options?: {
      similarityTopK?: number;
      includeSourceNodes?: boolean;
    }
  ): Promise<QueryResult> {
    const index = await this.vectorStoreService.getIndex(dataset);
    const queryEngine = index.asQueryEngine({
      retriever: index.asRetriever({
        similarityTopK: options?.similarityTopK || RETRIEVAL_CONFIG.similarityTopK,
      }),
    });

    const response = await queryEngine.query({ query });

    const result: QueryResult = {
      query,
      response: response.toString(),
    };

    if (options?.includeSourceNodes && response.sourceNodes) {
      result.sourceNodes = response.sourceNodes.map(node => ({
        score: node.score || 0,
        content: node.node.getContent(MetadataMode.NONE),
      }));
    }

    return result;
  }

  /**
   * 执行检索（只返回相关文档，不生成回答）
   */
  async retrieve(
    query: string,
    dataset: DatasetKey,
    options?: {
      similarityTopK?: number;
    }
  ): Promise<RetrievalResult> {
    const index = await this.vectorStoreService.getIndex(dataset);
    const retriever = index.asRetriever({
      similarityTopK: options?.similarityTopK || RETRIEVAL_CONFIG.similarityTopK,
    });

    const retrievedNodes = await retriever.retrieve(query);

    return {
      query,
      nodes: retrievedNodes.map(node => ({
        score: node.score || 0,
        content: node.node.getContent(MetadataMode.NONE),
      })),
    };
  }

  /**
   * 批量查询多个数据集
   */
  async queryMultipleDatasets(
    query: string,
    datasets: DatasetKey[]
  ): Promise<Array<{ dataset: string; result: QueryResult }>> {
    const results = [];

    for (const dataset of datasets) {
      try {
        const result = await this.query(query, dataset);
        results.push({
          dataset,
          result,
        });
      } catch (error: any) {
        console.error(`❌ 查询数据集 ${dataset} 失败:`, error.message);
      }
    }

    return results;
  }

  /**
   * 测试查询功能
   */
  async testQuery(dataset: DatasetKey): Promise<QueryResult[]> {
    const testQueries =
      dataset === 'price_index_statistics'
        ? ['最近一个月城市居民消费价格指数', '过去一年里，中药居民消费价格指数增长了还是下降了']
        : ['什么是逻辑回归的损失函数？', '机器学习中的过拟合是什么？'];

    const results = [];
    for (const query of testQueries) {
      try {
        const result = await this.query(query, dataset, { includeSourceNodes: true });
        results.push(result);
      } catch (error: any) {
        console.error(`❌ 测试查询失败: ${error.message}`);
      }
    }

    return results;
  }
}
