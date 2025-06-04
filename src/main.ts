import 'dotenv/config';
import { agent, agentStreamEvent } from '@llamaindex/workflow';
import {
  tool,
  QueryEngineTool,
  Settings,
  VectorStoreIndex,
  storageContextFromDefaults,
  MetadataMode,
  SentenceSplitter,
} from 'llamaindex';
import { OpenAI } from '@llamaindex/openai';
import { z } from 'zod';
import { multiplyNumbers, sumNumbers } from './tools';
import { QdrantVectorStore } from '@llamaindex/qdrant';
import { HuggingFaceEmbedding } from '@llamaindex/huggingface';
import { SimpleDirectoryReader } from '@llamaindex/readers/directory';
import { OpenAIEmbedding } from '@llamaindex/openai';

// global settings
Settings.llm = new OpenAI({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
});

Settings.embedModel = new OpenAIEmbedding({
  model: 'text-embedding-3-small', // 使用较小的模型，支持中文且网络负担更轻
});

Settings.nodeParser = new SentenceSplitter({
  chunkSize: 1024, // 每个块的大小（字符数）
  chunkOverlap: 200, // 块之间的重叠字符数
  separator: '\n\n', // 主要分割符
  paragraphSeparator: '\n', // 段落分割符
});

// console.log('📄 文档分块设置:');
// console.log('- 块大小: 1024 字符');
// console.log('- 重叠大小: 200 字符');

const DATASET_CONFIGS = {
  machine_learning: {
    collectionName: 'machine_learning_documents',
    dataPath: './data/machine_learning_transcript',
    description: '机器学习课程内容',
  },
  price_index_statistics: {
    collectionName: 'price_index_statistics',
    dataPath: './data/price_index_statistics_utf8',
    description: '价格指数统计',
  },
} as const;

const CURRENT_DATASET = 'price_index_statistics';
const currentConfig = DATASET_CONFIGS[CURRENT_DATASET];

// init Qdrant Cloud vector store
const vectorStore = new QdrantVectorStore({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  collectionName: currentConfig.collectionName,
});

console.log(`🎯 当前数据集: ${currentConfig.description}`);
console.log(`📁 Collection: ${currentConfig.collectionName}`);
console.log(`📂 数据路径: ${currentConfig.dataPath}`);

// Collection 管理器 - 处理多个数据集
class CollectionManager {
  private vectorStores: Map<string, QdrantVectorStore> = new Map();
  private indices: Map<string, VectorStoreIndex> = new Map();

  // 创建指定数据集的向量存储
  private createVectorStore(dataset: keyof typeof DATASET_CONFIGS): QdrantVectorStore {
    const config = DATASET_CONFIGS[dataset];
    return new QdrantVectorStore({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: config.collectionName,
    });
  }

  // 获取或创建指定数据集的索引
  async getOrCreateIndex(dataset: keyof typeof DATASET_CONFIGS): Promise<VectorStoreIndex> {
    if (this.indices.has(dataset)) {
      return this.indices.get(dataset)!;
    }

    const config = DATASET_CONFIGS[dataset];
    const vectorStore = this.createVectorStore(dataset);
    this.vectorStores.set(dataset, vectorStore);

    console.log(`\n🔄 初始化数据集: ${config.description}`);
    console.log(`📁 Collection: ${config.collectionName}`);

    try {
      // 尝试从现有向量存储加载
      const index = await VectorStoreIndex.fromVectorStore(vectorStore);

      // 验证索引可用性
      const testEngine = index.asQueryEngine();
      await testEngine.query({ query: 'test' });

      console.log(`✅ 成功加载现有索引: ${config.description}`);
      this.indices.set(dataset, index);
      return index;
    } catch (error) {
      console.log(`⚠️  创建新索引: ${config.description}`);
      const index = await this.createNewIndexForDataset(dataset);
      this.indices.set(dataset, index);
      return index;
    }
  }

  // 为指定数据集创建新索引
  private async createNewIndexForDataset(dataset: keyof typeof DATASET_CONFIGS): Promise<VectorStoreIndex> {
    const config = DATASET_CONFIGS[dataset];
    const vectorStore = this.vectorStores.get(dataset)!;

    console.log(`📚 加载数据集: ${config.description}...`);

    // 加载数据
    const reader = new SimpleDirectoryReader();
    const documents = await reader.loadData(config.dataPath);
    console.log(`✅ 成功加载 ${documents.length} 个文档`);

    // 创建存储上下文
    const storageContext = await storageContextFromDefaults({
      vectorStore: vectorStore,
    });

    console.log('🔄 创建向量索引中...');

    // 创建索引
    const index = await VectorStoreIndex.fromDocuments(documents, {
      storageContext: storageContext,
    });

    console.log(`✅ 索引创建完成: ${config.description}`);
    return index;
  }

  // 跨数据集查询
  async queryMultipleDatasets(
    query: string,
    datasets: (keyof typeof DATASET_CONFIGS)[] = ['price_index_statistics', 'machine_learning']
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

  // 列出所有可用的数据集
  listDatasets() {
    console.log('\n📋 可用数据集:');
    Object.entries(DATASET_CONFIGS).forEach(([key, config]) => {
      console.log(`  - ${key}: ${config.description} (${config.collectionName})`);
    });
  }

  // 获取数据集统计信息
  async getDatasetStats(dataset: keyof typeof DATASET_CONFIGS) {
    try {
      // 验证index是否存在
      const index = await this.getOrCreateIndex(dataset);
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
}

// 创建全局集合管理器
const collectionManager = new CollectionManager();

// 删除collection
async function deleteCollection(collectionName: string): Promise<boolean> {
  try {
    const vectorStore = new QdrantVectorStore({
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY!,
      collectionName,
    });

    // 尝试删除collection
    await (vectorStore as any).client().deleteCollection(collectionName);
    console.log(`🗑️  成功删除collection: ${collectionName}`);
    return true;
  } catch (error: any) {
    console.log(`ℹ️  Collection ${collectionName} 不存在或删除失败:`, error.message);
    return false;
  }
}

// 创建新索引
async function createNewIndex(): Promise<VectorStoreIndex> {
  console.log('📚 开始加载文档...');

  // 确保删除现有collection（避免向量维度冲突）
  await deleteCollection(currentConfig.collectionName);

  const reader = new SimpleDirectoryReader();
  const documents = await reader.loadData({
    directoryPath: currentConfig.dataPath,
  });
  console.log(`✅ 成功加载 ${documents.length} 个文档`);

  // 创建向量存储
  const vectorStore = new QdrantVectorStore({
    url: process.env.QDRANT_URL!,
    apiKey: process.env.QDRANT_API_KEY!,
    collectionName: currentConfig.collectionName,
  });

  // 创建存储上下文
  const storageContext = await storageContextFromDefaults({
    vectorStore,
  });

  console.log('🔄 创建向量索引中...');
  const index = await VectorStoreIndex.fromDocuments(documents, {
    storageContext,
  });

  console.log('✅ 索引创建完成并已存储到 Qdrant Cloud');
  return index;
}

// 从 Qdrant Cloud 加载现有索引
async function loadExistingIndex(): Promise<VectorStoreIndex> {
  console.log('🔄 从 Qdrant Cloud 加载索引...');

  const index = VectorStoreIndex.fromVectorStore(vectorStore);
  console.log('✅ 成功从 Qdrant Cloud 加载索引');
  return index;
}

// 创建或加载索引
async function createOrLoadIndex(forceRebuild = false): Promise<VectorStoreIndex> {
  if (forceRebuild) {
    console.log('🔄 强制重建索引...');
    return await createNewIndex();
  }

  try {
    // 尝试从现有向量存储加载索引
    const index = await loadExistingIndex();

    // 简单测试查询来验证索引是否可用
    const testEngine = index.asQueryEngine();
    await testEngine.query({ query: 'test' });

    console.log('✅ 成功验证现有索引');
    return index;
  } catch (error: any) {
    console.log('⚠️  未找到现有索引或索引不可用，创建新索引...');
    // console.log('错误详情:', error.message);
    return await createNewIndex();
  }
}

// 测试查询引擎
async function testQueryEngine(index: VectorStoreIndex, dataset: keyof typeof DATASET_CONFIGS) {
  console.log('\n🔍 测试查询引擎功能...');

  // 创建基础查询引擎
  const queryEngine = index.asQueryEngine({
    retriever: index.asRetriever({
      similarityTopK: 5, // 返回最相似的5个文档块
    }),
  });

  let testQueries: string[] = [];

  if (dataset === 'price_index_statistics') {
    testQueries = ['最近一个月城市居民消费价格指数', '过去一年里，中药居民消费价格指数增长了还是下降了'];
  } else {
    testQueries = ['什么是逻辑回归的损失函数？', '机器学习中的过拟合是什么？'];
  }

  for (const query of testQueries) {
    try {
      console.log(`\n❓ 查询: ${query}`);
      const response = await queryEngine.query({ query });
      console.log(`💡 回答: ${response.toString()}`);

      // 显示相关源文档
      if (response.sourceNodes && response.sourceNodes.length > 0) {
        console.log(`📄 相关文档片段 (${response.sourceNodes.length} 个):`);
        response.sourceNodes.forEach((node, i) => {
          // 使用正确的方法获取节点内容
          const nodeText = node.node.getContent(MetadataMode.NONE);
          console.log(`   ${i + 1}. 相似度: ${node.score?.toFixed(3)} - ${nodeText.substring(0, 100)}...`);
        });
      }
    } catch (error: any) {
      console.error(`❌ 查询失败: ${error.message}`);
    }
  }
}

// 添加新文档到现有索引
async function addDocumentsToIndex(index: VectorStoreIndex, newDocumentPaths: string[]) {
  console.log('\n📝 添加新文档到索引...');

  for (const docPath of newDocumentPaths) {
    try {
      const reader = new SimpleDirectoryReader();
      const newDocuments = await reader.loadData(docPath);

      // 将新文档插入到现有索引
      await index.insertNodes(newDocuments);
      console.log(`✅ 成功添加文档: ${docPath}`);
    } catch (error: any) {
      console.error(`❌ 添加文档失败 ${docPath}: ${error.message}`);
    }
  }
}

// 初始化索引
let index: VectorStoreIndex;
try {
  index = await createOrLoadIndex();
  // 测试查询功能
  await testQueryEngine(index, CURRENT_DATASET);
} catch (error) {
  console.error('❌ 索引初始化失败:', error);
  process.exit(1);
}

// tools
const queryToolForML = index.queryTool({
  metadata: {
    name: 'machine_learning_class_transcript_tool',
    description: `This tool can answer detailed questions about the machine learning class transcript.`,
  },
  options: { similarityTopK: 10 },
});

const queryToolForPI = index.queryTool({
  metadata: {
    name: 'price_index_statistics_tool',
    description: `This tool can answer detailed questions about the price index statistics.`,
  },
  options: { similarityTopK: 10 },
});

const addTool = tool({
  name: 'sumNumbers',
  description: 'Use this function to sum two numbers',
  parameters: z.object({
    a: z.number({
      description: 'First number to sum',
    }),
    b: z.number({
      description: 'Second number to sum',
    }),
  }),
  execute: sumNumbers,
});

const multiplyTool = tool({
  name: 'multiply',
  description: 'Use this function to multiply two numbers',
  parameters: z.object({
    a: z.number({ description: 'First number to multiply' }),
    b: z.number({ description: 'Second number to multiply' }),
  }),
  execute: multiplyNumbers,
});

// 主函数
async function main() {
  console.log('\n🚀 启动 AI Agent...');

  const tools = [addTool, multiplyTool, queryToolForML, queryToolForPI];
  const myAgent = agent({ tools });

  // 运行 agent 查询
  console.log('\n🚀 开始处理查询...');
  const events = myAgent.runStream('最近一个月PPI是多少? 另外计算123*456');

  for await (const event of events) {
    if (agentStreamEvent.include(event)) {
      process.stdout.write(event.data.delta);
    } else {
      // console.log('\n📊 工作流事件:', JSON.stringify(event, null, 2));
    }
  }

  console.log('\n\n✅ Agent 查询完成!');
}

// 高级索引功能, 检索相关节点
async function withRetrivedNodes(dataset: keyof typeof DATASET_CONFIGS) {
  console.log('\n🎯 演示高级索引功能...');

  try {
    // 1. 演示直接查询功能
    console.log('\n1️⃣ 直接查询演示:');
    const queryEngine = index.asQueryEngine({
      retriever: index.asRetriever({
        similarityTopK: 5,
      }),
    });

    let directQuery;
    if (dataset === 'price_index_statistics') {
      directQuery = '最近一个月PPI是多少';
    } else {
      directQuery = '机器学习中的梯度下降是什么？';
    }

    console.log(`查询: ${directQuery}`);
    const response = await queryEngine.query({ query: directQuery });
    console.log(`回答: ${response.toString()}`);

    // 2. 演示检索器功能
    console.log('\n2️⃣ 检索器演示:');
    const retriever = index.asRetriever({
      similarityTopK: 5,
    });

    const retrievedNodes = await retriever.retrieve(directQuery);
    console.log(`\n检索到 ${retrievedNodes.length} 个相关节点:`);

    retrievedNodes.forEach((node, idx) => {
      console.log(`\n节点 ${idx + 1}:`);
      console.log(`- 相似度分数: ${node.score?.toFixed(4)}`);
      const nodeText = node.node.getContent(MetadataMode.NONE);
      console.log(`- 内容预览: ${nodeText.substring(0, 200)}...`);
    });

    // 3. 演示索引统计信息
    console.log('\n3️⃣ 索引信息:');
    console.log(`向量存储类型: Qdrant Cloud`);
    console.log(`Qdrant URL: ${process.env.QDRANT_URL}`);
    console.log(`集合名称: ${currentConfig.collectionName}`);
  } catch (error: any) {
    console.error('❌ 高级功能演示失败:', error.message);
  }
}

// 调试
async function debugRetrievalIssues() {
  console.log('\n🔍 调试检索问题...');

  try {
    const retriever = index.asRetriever({ similarityTopK: 5 });

    // 测试不同的查询词汇
    let testQueries: string[];
    if (CURRENT_DATASET === 'price_index_statistics') {
      testQueries = ['价格指数', '消费价格', 'PPI', '居民消费'];
    } else {
      testQueries = ['机器学习', '梯度下降', '神经网络', '逻辑回归'];
    }

    for (const query of testQueries) {
      console.log(`\n🔎 测试查询: "${query}"`);
      const retrievedNodes = await retriever.retrieve({ query });
      console.log(`检索到 ${retrievedNodes.length} 个相关文档片段:`);

      if (retrievedNodes.length > 0) {
        retrievedNodes.slice(0, 3).forEach((node, i) => {
          const content = node.node.getContent(MetadataMode.NONE);
          console.log(`  ${i + 1}. 相似度: ${node.score?.toFixed(3)}`);
          console.log(`     内容: ${content.substring(0, 100)}...`);
        });
      } else {
        console.log('  ❌ 没有找到相关内容');
      }
    }
  } catch (error: any) {
    console.error('❌ 调试失败:', error.message);
  }
}

// 管理索引的工具函数
const indexManager = {
  // 获取索引信息
  async getIndexInfo() {
    return {
      vectorStoreType: 'Qdrant Cloud',
      qdrantUrl: process.env.QDRANT_URL,
      collectionName: currentConfig.collectionName,
      embedModel: 'text-embedding-3-small',
      llmModel: 'gpt-4o-mini',
    };
  },

  // 重新构建索引
  async rebuildIndex() {
    console.log('🔄 重新构建索引...');
    try {
      // 重新创建索引
      const newIndex = await createNewIndex();
      console.log('✅ 索引重建完成');
      return newIndex;
    } catch (error: any) {
      console.error('❌ 重建索引失败:', error.message);
      throw error;
    }
  },

  // 检查索引健康状态
  async checkHealth() {
    try {
      // 测试向量存储连接
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
  },

  // 添加单个文档到索引
  async addDocument(text: string, metadata: Record<string, any> = {}) {
    try {
      const { Document } = await import('llamaindex');
      const doc = new Document({ text, metadata });
      await index.insertNodes([doc]);
      console.log('✅ 文档已添加到 Qdrant Cloud 索引');
      return true;
    } catch (error: any) {
      console.error('❌ 添加文档失败:', error.message);
      return false;
    }
  },
};

// 运行主程序
async function runApplication() {
  try {
    // 显示可用数据集
    collectionManager.listDatasets();

    // 运行主 agent 功能
    await main();

    // 演示高级功能
    await withRetrivedNodes(CURRENT_DATASET);

    // 添加调试功能
    // await debugRetrievalIssues();

    // 演示多数据集管理
    // await demonstrateMultiCollectionFeatures();

    // 显示索引管理选项
    console.log('\n📚 索引管理功能已导出，您可以使用:');
    console.log('- indexManager.getIndexInfo() - 获取索引信息');
    console.log('- indexManager.rebuildIndex() - 重建索引');
    console.log('- indexManager.checkHealth() - 检查索引健康状态');
    console.log('- indexManager.addDocument(text, metadata) - 添加文档');
    console.log('- collectionManager.queryMultipleDatasets(query, datasets) - 跨数据集查询');

    // 显示健康状态
    const health = await indexManager.checkHealth();
    console.log('\n🏥 系统健康状态:', health);
  } catch (error: any) {
    console.error('❌ 应用程序运行失败:', error.message);
  }
}

// 导出功能
export {
  createOrLoadIndex,
  createNewIndex,
  testQueryEngine,
  addDocumentsToIndex,
  withRetrivedNodes,
  // debugRetrievalIssues,
  indexManager,
  collectionManager,
  index,
  DATASET_CONFIGS,
  CURRENT_DATASET,
};

runApplication().catch(console.error);
