import { QdrantVectorStore } from '@llamaindex/qdrant';
import { VectorStoreIndex, storageContextFromDefaults } from 'llamaindex';
import { SimpleDirectoryReader } from '@llamaindex/readers/directory';
import { DATASET_CONFIGS, QDRANT_CONFIG } from '../config';

export type DatasetKey = keyof typeof DATASET_CONFIGS;

export class VectorStoreService {
  /**
   * 创建向量存储实例 - 轻量级连接，无需缓存
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
   * 直接获取索引 - 利用云端持久化，无需本地缓存
   */
  async getIndex(dataset: DatasetKey): Promise<VectorStoreIndex> {
    const config = DATASET_CONFIGS[dataset];

    console.log(`🔄 连接到云端索引: ${config.description}`);

    // 首先尝试连接，带重试机制
    const index = await this.connectToIndexWithRetry(dataset);
    if (index) {
      console.log(`✅ 成功连接到云端索引: ${config.description}`);
      return index;
    }

    // 重试后仍然失败，检查是否需要创建
    console.log(`⚠️  重试后仍无法连接，检查是否需要创建: ${config.description}`);

    const collectionExists = await this.checkCollectionExists(config.collectionName);

    if (!collectionExists) {
      console.log(`📚 Collection 不存在，创建新索引: ${config.description}`);
      return await this.createNewIndex(dataset);
    } else {
      console.log(`🔄 Collection 存在但重试后仍连接失败，重建索引: ${config.description}`);
      return await this.createNewIndex(dataset, true);
    }
  }

  /**
   * 带重试机制的连接尝试
   */
  private async connectToIndexWithRetry(dataset: DatasetKey, maxRetries: number = 3): Promise<VectorStoreIndex | null> {
    const config = DATASET_CONFIGS[dataset];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 尝试连接到索引 (第 ${attempt}/${maxRetries} 次): ${config.description}`);

        const vectorStore = this.createVectorStore(dataset);
        const index = await VectorStoreIndex.fromVectorStore(vectorStore);

        console.log(`✅ 第 ${attempt} 次连接成功: ${config.description}`);
        return index;
      } catch (error) {
        console.log(`❌ 第 ${attempt} 次连接失败: ${error instanceof Error ? error.message : error}`);

        if (attempt < maxRetries) {
          const waitTime = 1000 * attempt; // 递增等待时间: 1s, 2s, 3s
          console.log(`⏳ 等待 ${waitTime}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    console.log(`❌ 经过 ${maxRetries} 次重试后仍无法连接`);
    return null;
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
      const vectorStore = this.createVectorStore(dataset);

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
   * 检查索引健康状态 - 轻量级检查，不执行查询
   */
  async checkHealth(dataset: DatasetKey): Promise<{
    vectorStoreConnected: boolean;
    qdrantCloudConnected: boolean;
    status: string;
    error?: string;
  }> {
    try {
      // 只检查连接，不执行实际查询
      await this.getIndex(dataset);

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
   * 深度健康检查 - 包含实际查询测试（用于诊断）
   */
  async checkHealthDeep(dataset: DatasetKey): Promise<{
    vectorStoreConnected: boolean;
    qdrantCloudConnected: boolean;
    queryTestPassed: boolean;
    status: string;
    error?: string;
  }> {
    try {
      console.log('🏥 执行深度健康检查...');
      const index = await this.getIndex(dataset);

      console.log('🧪 执行测试查询...');
      const testQuery = index.asQueryEngine();
      await testQuery.query({ query: 'test' });
      console.log('✅ 测试查询成功');

      return {
        vectorStoreConnected: true,
        qdrantCloudConnected: true,
        queryTestPassed: true,
        status: 'healthy',
      };
    } catch (error: any) {
      console.log('❌ 深度健康检查失败:', error.message);
      return {
        vectorStoreConnected: false,
        qdrantCloudConnected: false,
        queryTestPassed: false,
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
      await this.getIndex(dataset);
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
    const index = await this.getIndex(dataset);

    // 强制重建
    const newIndex = await this.createNewIndex(dataset, true);
    return newIndex;
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
        const index = await this.getIndex(dataset);
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
