import { app } from './app';
import { CURRENT_DATASET } from './config';

/**
 * 演示应用程序功能
 */
async function demonstrateFeatures() {
  console.log(
    '\n🎯 这个demo展示该应用的基本能力。包括 index 健康检查、自动连接/创建 index、基础RAG查询、Agentic RAG查询。\n其他能力还包括：\n' +
      '- 重建索引\n' +
      '- 跨数据集查询\n' +
      '- 流式Agentic RAG输出\n' +
      '- 多数据集管理(配置方式)\n' +
      '- 数据集统计信息\n' +
      '- index集删除\n' +
      '- 天气查询工具 🆕\n'
  );

  try {
    // 1. 应用状态
    console.log('\n1️⃣ 应用程序状态:');
    const status = await app.getStatus();
    console.log('状态:', status.status);
    console.log('当前数据集:', status.currentDataset);
    console.log('健康状态:', status.health.status);

    // 2. 基础查询
    console.log('\n2️⃣ 基础查询演示:');
    const query = CURRENT_DATASET === 'price_index_statistics' ? '最近一个月PPI是多少' : '什么是梯度下降';

    const queryResult = await app.query(query, CURRENT_DATASET, {
      includeSourceNodes: true,
    });
    console.log(`查询: ${queryResult.query}`);
    console.log(`回答: ${queryResult.response}`);
    console.log(`相关文档数量: ${queryResult.sourceNodes?.length || 0}`);
    console.log(`相关文档：${JSON.stringify(queryResult.sourceNodes, null, 2)}`);

    // 3. Agent查询（包含多工具演示）
    console.log('\n3️⃣ Agentic 查询演示（多工具组合）:');
    const agentQuery =
      CURRENT_DATASET === 'price_index_statistics'
        ? '最近一个月PPI是多少? 另外计算123*456，再告诉我北京今天的天气'
        : '什么是机器学习中的过拟合? 另外计算10*20，再查询上海的天气情况';

    const agentResult = await app.agentQuery(agentQuery);
    console.log(`Agent查询: ${agentQuery}`);
    console.log(`Agent回答: ${agentResult}`);
  } catch (error: any) {
    console.error('❌ 演示失败:', error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    await app.initialize();
    await demonstrateFeatures();

    console.log('\n✅ 演示完成!');
    console.log('\n📚 可用API功能:');
    console.log('- app.query(query, dataset?, options?) - 基础查询');
    console.log('- app.retrieve(query, dataset?, options?) - 检索文档');
    console.log('- app.agentQuery(query, dataset?) - Agent查询');
    console.log('- app.agentQueryStream(query, dataset?) - 流式Agent查询');
    console.log('- app.crossDatasetQuery(query, datasets?) - 跨数据集查询');
    console.log('- app.rebuildIndex(dataset?) - 重建索引');
    console.log('- app.getStatus() - 获取应用状态');
  } catch (error: any) {
    console.error('❌ 应用程序运行失败:', error.message);
  }
}

// 导出应用实例和主要功能
export { app } from './app';
export * from './services/vectorStore';
export * from './services/queryService';
export * from './services/agentService';
export * from './config';

// 如果直接运行此文件，执行演示
if (import.meta.main) {
  main().catch(console.error);
}
