import { app } from './app';
import { CURRENT_DATASET } from './config';

/**
 * 演示应用程序功能
 */
async function demonstrateFeatures() {
  console.log(
    '\n🎯 这个demo展示该应用的基本能力。包括 index 健康检查、自动连接/创建 index、智能查询路由、多工具调用。\n其他能力还包括：\n' +
      '- 重建索引\n' +
      '- 跨数据集查询\n' +
      '- 流式智能查询输出\n' +
      '- 多数据集管理(配置方式)\n' +
      '- 数据集统计信息\n' +
      '- index集删除\n' +
      '- 天气查询工具 🆕\n' +
      '- 数学计算工具 🆕\n' +
      '- 自动查询路由 🆕\n'
  );

  try {
    // 1. 应用状态
    console.log('\n1️⃣ 应用程序状态:');
    const status = await app.getStatus();
    console.log('状态:', status.status);
    console.log('当前数据集:', status.currentDataset);
    console.log('健康状态:', status.health.status);

    // 2. 单一意图查询演示
    console.log('\n2️⃣ 单一意图查询演示:');
    const singleQuery = CURRENT_DATASET === 'price_index_statistics' ? '最近一个月PPI是多少' : '什么是梯度下降';

    const singleResult = await app.intelligentQuery(singleQuery);
    console.log(`查询: ${singleResult.query}`);
    console.log(`回答: ${singleResult.response}`);
    console.log(`查询类型: ${singleResult.analysis.queryType}`);
    console.log(`子查询数量: ${singleResult.executionSummary.totalSubQueries}`);

    // 3. 多意图复合查询演示
    console.log('\n3️⃣ 多意图复合查询演示:');
    const multiQuery = '最近一个月PPI是多少? 另外计算123*456，再告诉我北京今天的天气';

    const multiResult = await app.intelligentQuery(multiQuery);
    console.log(`复合查询: ${multiQuery}`);
    console.log(`最终回答: ${multiResult.response}`);
    console.log(`\n📊 执行统计:`);
    console.log(`- 查询类型: ${multiResult.analysis.queryType}`);
    console.log(`- 总子查询数: ${multiResult.executionSummary.totalSubQueries}`);
    console.log(`- 成功查询数: ${multiResult.executionSummary.successfulQueries}`);
    console.log(`- 失败查询数: ${multiResult.executionSummary.failedQueries}`);
    console.log(`- 总执行时间: ${multiResult.executionSummary.totalExecutionTime}ms`);

    console.log(`\n🔍 子查询分解:`);
    multiResult.decomposition.subQueries.forEach((sq, index) => {
      console.log(`${index + 1}. [${sq.type}] ${sq.query} (置信度: ${sq.confidence})`);
    });

    console.log(`\n🎯 各子查询结果:`);
    multiResult.subResults.forEach((sr, index) => {
      const status = sr.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} [${sr.type}] ${sr.query}`);
      console.log(`   回答: ${sr.response.substring(0, 100)}...`);
      console.log(`   执行时间: ${sr.executionTime}ms`);
    });
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
    console.log('- app.intelligentQuery(query) - 智能查询');
    console.log('- app.intelligentQueryStream(query) - 流式智能查询');
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
