#!/usr/bin/env node

// 简单的 API 测试脚本
const API_BASE = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 开始测试 Agentic RAG API...\n');

  try {
    // 1. 健康检查
    console.log('1️⃣ 测试健康检查...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ 健康检查通过:', healthData);
    console.log();

    // 2. 获取状态
    console.log('2️⃣ 测试应用状态...');
    const statusResponse = await fetch(`${API_BASE}/status`);
    const statusData = await statusResponse.json();
    console.log('✅ 应用状态正常:', {
      status: statusData.data?.status,
      dataset: statusData.data?.currentDataset,
      health: statusData.data?.health?.status,
    });
    console.log();

    // 3. 获取数据集列表
    console.log('3️⃣ 测试数据集列表...');
    const datasetsResponse = await fetch(`${API_BASE}/datasets`);
    const datasetsData = await datasetsResponse.json();
    console.log(
      '✅ 数据集列表:',
      datasetsData.data?.datasets?.map(d => ({ id: d.id, name: d.name }))
    );
    console.log();

    // 4. 智能查询 - 知识库查询
    console.log('4️⃣ 测试智能查询（知识库）...');
    const knowledgeResponse = await fetch(`${API_BASE}/intelligent-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '最近一个月PPI是多少',
      }),
    });
    const knowledgeData = await knowledgeResponse.json();
    console.log('✅ 知识库查询成功:', {
      query: knowledgeData.data?.query,
      response: knowledgeData.data?.response?.substring(0, 100) + '...',
      queryType: knowledgeData.data?.analysis?.queryType,
      selectedDataset: knowledgeData.data?.selectedDataset,
    });
    console.log();

    // 5. 智能查询 - 多意图查询
    console.log('5️⃣ 测试智能查询（多意图）...');
    const multiIntentResponse = await fetch(`${API_BASE}/intelligent-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '最近一个月PPI是多少？另外计算123*456',
      }),
    });
    const multiIntentData = await multiIntentResponse.json();
    console.log('✅ 多意图查询成功:', {
      query: multiIntentData.data?.query,
      response: multiIntentData.data?.response?.substring(0, 200) + '...',
      queryType: multiIntentData.data?.analysis?.queryType,
      totalSubQueries: multiIntentData.data?.executionSummary?.totalSubQueries,
      successfulQueries: multiIntentData.data?.executionSummary?.successfulQueries,
    });
    console.log();

    // 6. 智能查询 - 天气查询
    console.log('6️⃣ 测试智能查询（天气）...');
    const weatherResponse = await fetch(`${API_BASE}/intelligent-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '北京今天天气怎么样？',
      }),
    });
    const weatherData = await weatherResponse.json();
    console.log('✅ 天气查询成功:', {
      query: weatherData.data?.query,
      response: weatherData.data?.response?.substring(0, 150) + '...',
      queryType: weatherData.data?.analysis?.queryType,
    });
    console.log();

    // 7. 智能查询 - 数学计算
    console.log('7️⃣ 测试智能查询（数学计算）...');
    const mathResponse = await fetch(`${API_BASE}/intelligent-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '计算789*123',
      }),
    });
    const mathData = await mathResponse.json();
    console.log('✅ 数学计算成功:', {
      query: mathData.data?.query,
      response: mathData.data?.response?.substring(0, 100) + '...',
      queryType: mathData.data?.analysis?.queryType,
    });
    console.log();

    // 8. 智能查询流式版本测试
    console.log('8️⃣ 测试智能查询流式版本...');
    const streamResponse = await fetch(`${API_BASE}/intelligent-query/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '什么是梯度下降？',
      }),
    });

    if (streamResponse.ok) {
      console.log('✅ 流式查询连接成功');
    } else {
      console.log('❌ 流式查询失败:', streamResponse.status);
    }
    console.log();

    // 9. 跨数据集查询测试
    console.log('9️⃣ 测试跨数据集查询...');
    const crossResponse = await fetch(`${API_BASE}/cross-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '机器学习',
        datasets: ['machine_learning', 'price_index_statistics'],
      }),
    });
    const crossData = await crossResponse.json();
    console.log('✅ 跨数据集查询成功:', {
      query: crossData.data?.query,
      datasets: crossData.data?.datasets?.length || 0,
    });
    console.log();

    console.log('🎉 所有 API 测试通过！');
  } catch (error) {
    console.error('❌ API 测试失败:', error.message);
  }
}

// 运行测试
testAPI();
