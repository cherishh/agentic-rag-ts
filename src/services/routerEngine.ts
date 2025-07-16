import { VectorStoreService } from './vectorStore';
import { DATASET_CONFIGS } from '../config';
import { LLMClassifier } from './llmClassifier';
import { Logger } from './logger';
import type { DatasetKey } from './vectorStore';

export interface DatasetSelection {
  dataset: DatasetKey;
  confidence: number;
  reasoning: string;
}

export interface RouterResponse {
  response: string;
  selectedDataset: string;
  routingReason: string;
  confidence: number;
}

export class RouterEngine {
  private llmClassifier: LLMClassifier;

  constructor(private vectorStoreService: VectorStoreService) {
    this.llmClassifier = new LLMClassifier();
  }

  /**
   * 路由知识库查询到最合适的数据集
   * 注意：在新的多Agent架构中，RouterEngine只负责数据集选择，
   * 查询类型判断已经由QueryDecomposer完成
   */
  async routeQuery(query: string, suggestedDataset?: string): Promise<RouterResponse> {
    let selection: DatasetSelection;

    // 1. 如果有建议的数据集，优先使用
    if (suggestedDataset && suggestedDataset in DATASET_CONFIGS) {
      selection = {
        dataset: suggestedDataset as DatasetKey,
        confidence: 0.9,
        reasoning: `使用建议的数据集: ${suggestedDataset}`,
      };
    } else {
      // 2. 否则使用LLM进行智能数据集选择
      selection = await this.selectDatasetWithLLM(query);
    }

    // 3. 执行查询
    const response = await this.executeQuery(query, selection.dataset);

    return {
      response,
      selectedDataset: DATASET_CONFIGS[selection.dataset].description,
      routingReason: selection.reasoning,
      confidence: selection.confidence,
    };
  }

  /**
   * 使用LLM进行智能数据集选择
   * 移除了关键词匹配，直接使用LLM判断，更加准确
   */
  private async selectDatasetWithLLM(query: string): Promise<DatasetSelection> {
    try {
      Logger.info('RouterEngine', '使用LLM进行数据集选择', query);
      const llmResult = await this.llmClassifier.classify(query);

      return {
        dataset: llmResult.dataset,
        confidence: llmResult.confidence,
        reasoning: `LLM智能分类: ${llmResult.reasoning}`,
      };
    } catch (error) {
      Logger.error('RouterEngine', 'LLM分类失败，使用默认数据集', error);

      // 容错：LLM不可用时使用默认数据集
      return {
        dataset: 'price_index_statistics',
        confidence: 0.4,
        reasoning: `LLM服务异常，使用默认数据集: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 执行查询
   */
  private async executeQuery(query: string, dataset: DatasetKey): Promise<string> {
    try {
      Logger.debug('RouterEngine', `开始查询数据集: ${dataset}`, query);

      const index = await this.vectorStoreService.getIndex(dataset);
      const queryEngine = index.asQueryEngine({
        retriever: index.asRetriever({
          similarityTopK: 5,
        }),
      });

      const response = await queryEngine.query({ query });
      const result = response.toString();

      Logger.success('RouterEngine', `查询完成: ${dataset}`, `响应长度: ${result.length}`);
      return result;
    } catch (error) {
      Logger.error('RouterEngine', `查询数据集失败: ${dataset}`, error);

      if (error instanceof Error) {
        return `❌ 查询失败：${error.message}`;
      }
      return `❌ 查询失败：未知错误`;
    }
  }

  /**
   * 跨数据集查询
   */
  async crossDatasetQuery(query: string, datasets?: DatasetKey[]): Promise<RouterResponse[]> {
    const targetDatasets = datasets || (['machine_learning', 'price_index_statistics'] as DatasetKey[]);
    const results: RouterResponse[] = [];

    Logger.info('RouterEngine', `开始跨数据集查询，目标数据集: ${targetDatasets.join(', ')}`);

    for (const dataset of targetDatasets) {
      try {
        const response = await this.executeQuery(query, dataset);
        results.push({
          response,
          selectedDataset: DATASET_CONFIGS[dataset].description,
          routingReason: `跨数据集查询 - ${dataset}`,
          confidence: 0.8,
        });
      } catch (error) {
        Logger.error('RouterEngine', `跨数据集查询失败: ${dataset}`, error);
      }
    }

    Logger.success('RouterEngine', `跨数据集查询完成`, `成功: ${results.length}/${targetDatasets.length}`);
    return results;
  }
}
