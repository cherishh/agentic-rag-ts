import { Settings, SentenceSplitter } from 'llamaindex';
import { OpenAI, OpenAIEmbedding } from '@llamaindex/openai';
import { VectorStoreService } from './services/vectorStore';
import { QueryService } from './services/queryService';
import { AgentService } from './services/agentService';
import { RouterService } from './services/routerService'; // Import RouterService
import { CURRENT_DATASET, DATASET_CONFIGS, OPENAI_CONFIG, EMBEDDING_CONFIG, CHUNKING_CONFIG } from './config';

// Initialize LlamaIndex settings
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

// Create service instances
export const vectorStoreService = new VectorStoreService();
export const queryService = new QueryService(vectorStoreService);
export const routerService = new RouterService(vectorStoreService); // Instantiate RouterService
export const agentService = new AgentService(vectorStoreService, routerService); // Pass routerService to AgentService

// Application class
export class RAGApplication {
  constructor(
    private vectorStoreService: VectorStoreService,
    private queryService: QueryService,
    private agentService: AgentService
  ) {}

  /**
   * Initializes the application
   */
  async initialize() {
    console.log('🚀 Initializing RAG Application...');
    // No longer need to pre-warm a specific index here, Agent initialization handles its needs.
    await this.agentService.initialize(); // This will initialize the Master Agent and its tools, including the RouterEngine
    console.log('✅ Application initialized successfully');
  }

  /**
   * Gets the application status
   */
  async getStatus() {
    try {
      // Check the health of the default dataset's index as a proxy for system health
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
   * Executes a query
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
   * Executes a retrieval
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
   * Agent query - dataset parameter is no longer needed.
   */
  async agentQuery(query: string) {
    return await this.agentService.runQuery(query);
  }

  /**
   * Agent stream query - dataset parameter is no longer needed.
   */
  agentQueryStream(query: string) {
    return this.agentService.runQueryStream(query);
  }

  /**
   * Cross-dataset query
   */
  async crossDatasetQuery(query: string, datasets?: Array<keyof typeof DATASET_CONFIGS>) {
    return await this.vectorStoreService.queryMultipleDatasets(
      query,
      datasets || ['price_index_statistics', 'machine_learning']
    );
  }

  /**
   * Deep diagnosis
   */
  async diagnose(dataset = CURRENT_DATASET) {
    return await this.vectorStoreService.checkHealthDeep(dataset);
  }

  /**
   * Management functions
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
