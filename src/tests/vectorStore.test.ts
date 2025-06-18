import { VectorStoreService } from '../services/vectorStore';
import { DATASET_CONFIGS, QDRANT_CONFIG, EMBEDDING_CONFIG, OPENAI_CONFIG, CURRENT_DATASET } from '../config';

// 初始化 LlamaIndex Settings（这是关键！）
import { Settings } from 'llamaindex';
import { OpenAI, OpenAIEmbedding } from '@llamaindex/openai';

// 设置 LLM 和 嵌入模型
Settings.llm = new OpenAI({
  model: OPENAI_CONFIG.model,
  apiKey: OPENAI_CONFIG.apiKey,
  baseURL: OPENAI_CONFIG.baseUrl,
});

Settings.embedModel = new OpenAIEmbedding({
  model: EMBEDDING_CONFIG.model,
  apiKey: EMBEDDING_CONFIG.apiKey,
  additionalSessionOptions: {
    baseURL: EMBEDDING_CONFIG.baseUrl,
  },
});

console.log('✅ LlamaIndex Settings 初始化完成');

// 创建一个测试实例
const vectorStoreService = new VectorStoreService();

async function testCheckCollectionExists() {
  console.log('\n🧪 测试 checkCollectionExists 方法...');

  const datasets = Object.keys(DATASET_CONFIGS) as Array<keyof typeof DATASET_CONFIGS>;

  for (const dataset of datasets) {
    const config = DATASET_CONFIGS[dataset];
    console.log(`\n📋 测试数据集: ${config.description}`);
    console.log(`Collection名称: ${config.collectionName}`);

    try {
      const exists = await vectorStoreService.checkCollectionExists(config.collectionName);
      console.log(`✅ Collection存在状态: ${exists}`);

      if (exists) {
        console.log(`✅ Collection ${config.collectionName} 确实存在`);
      } else {
        console.log(`❌ Collection ${config.collectionName} 不存在`);
      }
    } catch (error) {
      console.error(`❌ 检查Collection失败:`, error);
    }
  }
}

async function testGetIndex() {
  console.log('\n🧪 测试 getIndex 方法...');

  const dataset = CURRENT_DATASET; // 使用默认数据集
  const config = DATASET_CONFIGS[dataset];

  console.log(`\n📋 测试数据集: ${config.description}`);
  console.log(`Collection名称: ${config.collectionName}`);
  console.log(`数据路径: ${config.dataPath}`);

  try {
    console.log('\n🔄 开始调用 getIndex...');
    const index = await vectorStoreService.getIndex(dataset);
    console.log('✅ getIndex 成功完成');

    // 测试索引是否可用
    console.log('\n🔍 测试索引查询功能...');
    const queryEngine = index.asQueryEngine();
    const response = await queryEngine.query({ query: 'test query' });
    console.log('✅ 索引查询测试成功');
    console.log(`响应: ${response.toString().substring(0, 100)}...`);
  } catch (error) {
    console.error('❌ getIndex 失败:', error);

    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }
}

async function testQdrantConnection() {
  console.log('\n🧪 测试 Qdrant 连接...');

  console.log('Qdrant 配置:');
  console.log(`URL: ${QDRANT_CONFIG.url}`);
  console.log(`API Key: ${QDRANT_CONFIG.apiKey ? '已设置' : '未设置'}`);

  // 测试基本连接
  try {
    const { QdrantVectorStore } = await import('@llamaindex/qdrant');

    const vectorStore = new QdrantVectorStore({
      url: QDRANT_CONFIG.url,
      apiKey: QDRANT_CONFIG.apiKey,
      collectionName: 'test_connection',
    });

    const client = (vectorStore as any).client();

    // 尝试获取集群信息
    console.log('\n🔍 尝试获取 Qdrant 集群信息...');
    const clusterInfo = await client.getClusterInfo();
    console.log('✅ Qdrant 连接成功');
    console.log('集群信息:', JSON.stringify(clusterInfo, null, 2));

    // 列出所有 collections
    console.log('\n📋 获取所有 Collections...');
    const collections = await client.getCollections();
    console.log('✅ Collections 列表获取成功');
    console.log('现有 Collections:', collections);
  } catch (error) {
    console.error('❌ Qdrant 连接失败:', error);
  }
}

async function runAllTests() {
  console.log('🚀 开始 VectorStore 单元测试...');
  console.log('='.repeat(50));

  try {
    await testQdrantConnection();
    await testCheckCollectionExists();
    await testGetIndex();
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 测试完成');
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { testCheckCollectionExists, testGetIndex, testQdrantConnection, runAllTests };
