import { Settings, SentenceSplitter } from 'llamaindex';
import { OpenAI, OpenAIEmbedding } from '@llamaindex/openai';
import { VectorStoreService } from './services/vectorStore';
import { QueryService } from './services/queryService';
import { AgentService } from './services/agentService';
import { CURRENT_DATASET, DATASET_CONFIGS, OPENAI_CONFIG, EMBEDDING_CONFIG, CHUNKING_CONFIG } from './config';
import type { DatasetKey } from './services/vectorStore';

// 初始化LlamaIndex设置
Settings.llm = new OpenAI({
  model: OPENAI_CONFIG.model,
  apiKey: OPENAI_CONFIG.apiKey,
  temperature: OPENAI_CONFIG.temperature,
  baseURL: OPENAI_CONFIG.baseUrl,
});

Settings.embedModel = new OpenAIEmbedding({
  model: EMBEDDING_CONFIG.model,
  apiKey: EMBEDDING_CONFIG.apiKey,
  baseURL: EMBEDDING_CONFIG.baseUrl,
});

Settings.nodeParser = new SentenceSplitter({
  chunkSize: CHUNKING_CONFIG.chunkSize,
  chunkOverlap: CHUNKING_CONFIG.chunkOverlap,
  separator: CHUNKING_CONFIG.separator,
  paragraphSeparator: CHUNKING_CONFIG.paragraphSeparator,
});

// 创建服务实例
export const vectorStoreService = new VectorStoreService();
export const queryService = new QueryService(vectorStoreService);
export const agentService = new AgentService(vectorStoreService);

// 应用程序类
export class RAGApplication {
  constructor(
    private vectorStoreService: VectorStoreService,
    private queryService: QueryService,
    private agentService: AgentService
  ) {}

  /**
   * 初始化应用程序
   */
  async initialize() {
    console.log('🚀 初始化RAG应用程序...');
    console.log(`🎯 当前数据集: ${DATASET_CONFIGS[CURRENT_DATASET].description}`);

    // 预热索引
    await this.vectorStoreService.getIndex(CURRENT_DATASET);
    console.log('✅ 应用程序初始化完成');
  }

  /**
   * 获取应用程序状态 - 优化版本，避免重复连接
   */
  async getStatus() {
    try {
      // 只连接一次索引，用于两个检查
      await this.vectorStoreService.getIndex(CURRENT_DATASET);

      const health = {
        vectorStoreConnected: true,
        qdrantCloudConnected: true,
        status: 'healthy',
      };

      const stats = {
        dataset: DATASET_CONFIGS[CURRENT_DATASET].description,
        collectionName: DATASET_CONFIGS[CURRENT_DATASET].collectionName,
        dataPath: DATASET_CONFIGS[CURRENT_DATASET].dataPath,
        status: 'active',
      };

      return {
        status: 'running',
        currentDataset: CURRENT_DATASET,
        health,
        stats,
        availableDatasets: Object.keys(DATASET_CONFIGS),
      };
    } catch (error: any) {
      const health = {
        vectorStoreConnected: false,
        qdrantCloudConnected: false,
        status: 'unhealthy',
        error: error.message,
      };

      const stats = {
        dataset: DATASET_CONFIGS[CURRENT_DATASET].description,
        collectionName: DATASET_CONFIGS[CURRENT_DATASET].collectionName,
        status: 'error',
        error: error.message,
      };

      return {
        status: 'error',
        currentDataset: CURRENT_DATASET,
        health,
        stats,
        availableDatasets: Object.keys(DATASET_CONFIGS),
      };
    }
  }

  /**
   * 智能查询 - 使用Master Agent自动路由
   */
  async intelligentQuery(query: string) {
    return await this.agentService.runIntelligentQuery(query);
  }

  /**
   * 智能查询（流式输出）- 使用Master Agent自动路由
   */
  intelligentQueryStream(query: string) {
    return this.agentService.runIntelligentQueryStream(query);
  }

  /**
   * 执行查询 - 新版本使用智能路由，保持兼容性
   */
  async query(
    query: string,
    dataset?: DatasetKey,
    options: {
      similarityTopK?: number;
      includeSourceNodes?: boolean;
    } = {
      similarityTopK: 5,
      includeSourceNodes: true,
    }
  ) {
    if (dataset) {
      // 如果指定了数据集，使用传统方式
      return await this.queryService.query(query, dataset, options);
    } else {
      // 否则使用智能路由
      const intelligentResult = await this.intelligentQuery(query);
      return {
        query: intelligentResult.query,
        response: intelligentResult.response,
        // 转换为兼容格式
        sourceNodes: [], // 暂时为空，后续可以改进
        meta: {
          selectedDataset: intelligentResult.selectedDataset,
          routingReason: intelligentResult.routingReason,
          analysis: intelligentResult.analysis,
        },
      };
    }
  }

  /**
   * 执行检索 - 新版本使用智能路由，保持兼容性
   */
  async retrieve(
    query: string,
    dataset?: DatasetKey,
    options?: {
      similarityTopK?: number;
    }
  ) {
    if (dataset) {
      // 如果指定了数据集，使用传统方式
      return await this.queryService.retrieve(query, dataset, options);
    } else {
      // 否则使用智能路由选择数据集
      const intelligentResult = await this.intelligentQuery(query);
      // 然后用选定的数据集进行检索
      const selectedDataset = intelligentResult.analysis.domain as DatasetKey || 'price_index_statistics';
      return await this.queryService.retrieve(query, selectedDataset, options);
    }
  }

  /**
   * Agent查询 - 新版本使用智能路由，保持兼容性
   */
  async agentQuery(query: string, dataset?: DatasetKey) {
    if (dataset) {
      // 如果指定了数据集，使用传统方式
      return await this.agentService.runQuery(query, dataset);
    } else {
      // 否则使用智能路由
      const result = await this.intelligentQuery(query);
      return result.response;
    }
  }

  /**
   * Agent流式查询 - 新版本使用智能路由，保持兼容性
   */
  agentQueryStream(query: string, dataset?: DatasetKey) {
    if (dataset) {
      // 如果指定了数据集，使用传统方式
      return this.agentService.runQueryStream(query, dataset);
    } else {
      // 否则使用智能路由
      return this.intelligentQueryStream(query);
    }
  }

  /**
   * 跨数据集查询
   */
  async crossDatasetQuery(query: string, datasets?: Array<keyof typeof DATASET_CONFIGS>) {
    return await this.vectorStoreService.queryMultipleDatasets(
      query,
      datasets || ['price_index_statistics', 'machine_learning']
    );
  }

  /**
   * 深度诊断 - 包含实际查询测试（较慢，用于故障排查）
   */
  async diagnose(dataset = CURRENT_DATASET) {
    return await this.vectorStoreService.checkHealthDeep(dataset);
  }

  /**
   * 管理功能
   */
  async rebuildIndex(dataset = CURRENT_DATASET) {
    return await this.vectorStoreService.createNewIndex(dataset);
  }

  async deleteCollection(dataset = CURRENT_DATASET) {
    const config = DATASET_CONFIGS[dataset];
    return await this.vectorStoreService.deleteCollection(config.collectionName);
  }
}

export const app = new RAGApplication(vectorStoreService, queryService, agentService);
