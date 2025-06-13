import { QdrantVectorStore } from '@llamaindex/qdrant';
import { VectorStoreIndex, storageContextFromDefaults } from 'llamaindex';
import { SimpleDirectoryReader } from '@llamaindex/readers/directory';
import { DATASET_CONFIGS, QDRANT_CONFIG } from '../config';

export type DatasetKey = keyof typeof DATASET_CONFIGS;

export class VectorStoreService {
  private vectorStores: Map<string, QdrantVectorStore> = new Map();
  private indices: Map<string, VectorStoreIndex> = new Map();

  /**
   * 创建向量存储实例
   */
  private createVectorStore(dataset: DatasetKey): QdrantVectorStore {
    const config = DATASET_CONFIGS[dataset];
    return new QdrantVectorStore({
      url: QDRANT_CONFIG.url,
      apiKey: QDRANT_CONFIG.apiKey,
      collectionName: config.collectionName,
    });
  }

  /**
   * 获取或创建索引
   */
  async getOrCreateIndex(dataset: DatasetKey): Promise<VectorStoreIndex> {
    if (this.indices.has(dataset)) {
      return this.indices.get(dataset)!;
    }

    const config = DATASET_CONFIGS[dataset];
    const vectorStore = this.createVectorStore(dataset);
    this.vectorStores.set(dataset, vectorStore);

    console.log(`🔄 初始化数据集: ${config.description}`);

    try {
      // 尝试加载现有索引
      const index = await VectorStoreIndex.fromVectorStore(vectorStore);

      // 验证索引可用性
      const testEngine = index.asQueryEngine();
      await testEngine.query({ query: 'test' });

      console.log(`✅ 成功加载现有索引: ${config.description}`);
      this.indices.set(dataset, index);
      return index;
    } catch (error) {
      console.log(`⚠️  创建新索引: ${config.description}`);
      const index = await this.createNewIndex(dataset);
      this.indices.set(dataset, index);
      return index;
    }
  }

  /**
   * 创建新索引
   */
  async createNewIndex(dataset: DatasetKey): Promise<VectorStoreIndex> {
    try {
      const config = DATASET_CONFIGS[dataset];
      const vectorStore = this.vectorStores.get(dataset) || this.createVectorStore(dataset);

      console.log(`📚 加载数据集: ${config.description}...`);

      // 删除现有collection（避免向量维度冲突）
      await this.deleteCollection(config.collectionName);

      // 加载文档
      const reader = new SimpleDirectoryReader();
      const documents = await reader.loadData({
        directoryPath: config.dataPath,
      });
      console.log(`✅ 成功加载 ${documents.length} 个文档`);

      // 创建存储上下文
      const storageContext = await storageContextFromDefaults({
        vectorStore,
      });

      console.log('🔄 创建向量索引中...');
      const index = await VectorStoreIndex.fromDocuments(documents, {
        storageContext,
      });

      console.log(`✅ 索引创建完成: ${config.description}`);
      return index;
    } catch (error) {
      console.error('❌ 索引创建失败:', error);
      throw error;
    }
  }

  /**
   * 删除collection
   */
  async deleteCollection(collectionName: string): Promise<boolean> {
    try {
      const vectorStore = new QdrantVectorStore({
        url: QDRANT_CONFIG.url,
        apiKey: QDRANT_CONFIG.apiKey,
        collectionName,
      });

      await (vectorStore as any).client().deleteCollection(collectionName);
      console.log(`🗑️  成功删除collection: ${collectionName}`);
      return true;
    } catch (error: any) {
      console.log(`ℹ️  Collection ${collectionName} 不存在或删除失败:`, error.message);
      return false;
    }
  }

  /**
   * 检查索引健康状态
   */
  async checkHealth(dataset: DatasetKey): Promise<{
    vectorStoreConnected: boolean;
    qdrantCloudConnected: boolean;
    status: string;
    error?: string;
  }> {
    try {
      const index = await this.getOrCreateIndex(dataset);
      const testQuery = index.asQueryEngine();
      await testQuery.query({ query: 'test' });

      return {
        vectorStoreConnected: true,
        qdrantCloudConnected: true,
        status: 'healthy',
      };
    } catch (error: any) {
      return {
        vectorStoreConnected: false,
        qdrantCloudConnected: false,
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * 获取数据集统计信息
   */
  async getDatasetStats(dataset: DatasetKey) {
    try {
      await this.getOrCreateIndex(dataset);
      const config = DATASET_CONFIGS[dataset];

      return {
        dataset: config.description,
        collectionName: config.collectionName,
        dataPath: config.dataPath,
        status: 'active',
      };
    } catch (error: any) {
      return {
        dataset: DATASET_CONFIGS[dataset].description,
        collectionName: DATASET_CONFIGS[dataset].collectionName,
        status: 'error',
        error: error.message,
      };
    }
  }

  /**
   * 跨数据集查询
   */
  async queryMultipleDatasets(
    query: string,
    datasets: DatasetKey[] = ['price_index_statistics', 'machine_learning']
  ): Promise<Array<{ dataset: string; response: string }>> {
    const results = [];

    for (const dataset of datasets) {
      try {
        const index = await this.getOrCreateIndex(dataset);
        const queryEngine = index.asQueryEngine({
          retriever: index.asRetriever({ similarityTopK: 3 }),
        });

        const response = await queryEngine.query({ query });
        results.push({
          dataset: DATASET_CONFIGS[dataset].description,
          response: response.toString(),
        });
      } catch (error: any) {
        console.error(`❌ 查询数据集 ${dataset} 失败:`, error.message);
      }
    }

    return results;
  }
}
