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
      console.log(`🔄 尝试从 VectorStore 加载现有索引: ${config.description}`);
      const index = await VectorStoreIndex.fromVectorStore(vectorStore);
      console.log(`✅ VectorStoreIndex.fromVectorStore 成功`);

      // 验证索引可用性
      console.log(`🔍 验证索引可用性...`);
      const testEngine = index.asQueryEngine();
      const testResult = await testEngine.query({ query: 'test' });
      console.log(`✅ 索引查询测试成功，响应长度: ${testResult.toString().length}`);

      console.log(`✅ 成功加载现有索引: ${config.description}`);
      this.indices.set(dataset, index);
      return index;
    } catch (error) {
      console.log(`⚠️  现有索引不可用，检查是否需要创建新索引: ${config.description}`);
      console.log(`错误详情: ${error instanceof Error ? error.message : error}`);

      // 检查collection是否存在
      const collectionExists = await this.checkCollectionExists(config.collectionName);

      if (collectionExists) {
        console.log(`ℹ️  Collection ${config.collectionName} 已存在，但索引加载失败，可能是配置问题`);
        // 如果collection存在但加载失败，可能是嵌入模型变化等问题，此时才重建
        console.log(`🔄 重建索引: ${config.description}`);
        const index = await this.createNewIndex(dataset, true);
        this.indices.set(dataset, index);
        return index;
      } else {
        console.log(`📚 Collection 不存在，创建新索引: ${config.description}`);
        const index = await this.createNewIndex(dataset, false);
        this.indices.set(dataset, index);
        return index;
      }
    }
  }

  /**
   * 检查collection是否存在
   */
  async checkCollectionExists(collectionName: string): Promise<boolean> {
    try {
      const vectorStore = new QdrantVectorStore({
        url: QDRANT_CONFIG.url,
        apiKey: QDRANT_CONFIG.apiKey,
        collectionName,
      });

      const client = (vectorStore as any).client();

      // 方法1: 尝试获取collection信息
      try {
        const collectionInfo = await client.getCollectionInfo(collectionName);
        console.log(`🔍 Collection ${collectionName} 信息:`, JSON.stringify(collectionInfo, null, 2));
        return true;
      } catch (infoError: any) {
        console.log(`ℹ️  getCollectionInfo 失败: ${infoError.message}`);

        // 方法2: 列出所有collections进行检查
        try {
          const collections = await client.getCollections();
          console.log(`📋 所有 Collections:`, collections);

          // 检查 collections 的结构
          if (collections && collections.collections) {
            const exists = collections.collections.some(
              (col: any) => col.name === collectionName || col === collectionName
            );
            console.log(`🔍 通过列表检查 Collection ${collectionName} 存在状态: ${exists}`);
            return exists;
          }

          return false;
        } catch (listError: any) {
          console.log(`ℹ️  getCollections 也失败: ${listError.message}`);
          return false;
        }
      }
    } catch (error: any) {
      console.error(`❌ checkCollectionExists 彻底失败:`, error.message);
      return false;
    }
  }

  /**
   * 创建新索引
   */
  async createNewIndex(dataset: DatasetKey, forceRecreate: boolean = false): Promise<VectorStoreIndex> {
    try {
      const config = DATASET_CONFIGS[dataset];
      const vectorStore = this.vectorStores.get(dataset) || this.createVectorStore(dataset);

      console.log(`📚 加载数据集: ${config.description}...`);

      // 只有在强制重建时才删除现有collection
      if (forceRecreate) {
        console.log('🗑️  强制重建，删除现有collection...');
        await this.deleteCollection(config.collectionName);
      }

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
   * 强制重建索引（用于管理功能）
   */
  async rebuildIndex(dataset: DatasetKey): Promise<VectorStoreIndex> {
    const config = DATASET_CONFIGS[dataset];
    console.log(`🔄 强制重建索引: ${config.description}`);

    // 清除内存缓存
    this.indices.delete(dataset);
    this.vectorStores.delete(dataset);

    // 强制重建
    const index = await this.createNewIndex(dataset, true);
    this.indices.set(dataset, index);
    return index;
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
