import { Settings, SentenceSplitter } from 'llamaindex';
import { OpenAI, OpenAIEmbedding } from '@llamaindex/openai';
import { VectorStoreService } from './services/vectorStore';
import { QueryService } from './services/queryService';
import { AgentService } from './services/agentService';
import { CURRENT_DATASET, DATASET_CONFIGS, OPENAI_CONFIG, EMBEDDING_CONFIG, CHUNKING_CONFIG } from './config';

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
    await this.vectorStoreService.getOrCreateIndex(CURRENT_DATASET);
    console.log('✅ 应用程序初始化完成');
  }

  /**
   * 获取应用程序状态
   */
  async getStatus() {
    const health = await this.vectorStoreService.checkHealth(CURRENT_DATASET);
    const stats = await this.vectorStoreService.getDatasetStats(CURRENT_DATASET);

    return {
      status: 'running',
      currentDataset: CURRENT_DATASET,
      health,
      stats,
      availableDatasets: Object.keys(DATASET_CONFIGS),
    };
  }

  /**
   * 执行查询
   */
  async query(
    query: string,
    dataset = CURRENT_DATASET,
    options: {
      similarityTopK?: number;
      includeSourceNodes?: boolean;
    } = {
      similarityTopK: 5,
      includeSourceNodes: true,
    }
  ) {
    return await this.queryService.query(query, dataset, options);
  }

  /**
   * 执行检索
   */
  async retrieve(
    query: string,
    dataset = CURRENT_DATASET,
    options?: {
      similarityTopK?: number;
    }
  ) {
    return await this.queryService.retrieve(query, dataset, options);
  }

  /**
   * Agent查询
   */
  async agentQuery(query: string, dataset = CURRENT_DATASET) {
    return await this.agentService.runQuery(query, dataset);
  }

  /**
   * Agent流式查询
   */
  agentQueryStream(query: string, dataset = CURRENT_DATASET) {
    return this.agentService.runQueryStream(query, dataset);
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
