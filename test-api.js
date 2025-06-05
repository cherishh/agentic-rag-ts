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

    // 4. 基础查询
    console.log('4️⃣ 测试基础查询...');
    const queryResponse = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '最近一个月PPI是多少',
        dataset: 'price_index_statistics',
        options: { similarityTopK: 3, includeSourceNodes: false },
      }),
    });
    const queryData = await queryResponse.json();
    console.log('✅ 基础查询成功:', {
      query: queryData.data?.query,
      response: queryData.data?.response?.substring(0, 100) + '...',
      sourceNodes: queryData.data?.sourceNodes?.length || 0,
    });
    console.log();

    // 5. Agent查询
    console.log('5️⃣ 测试 Agent 查询...');
    const agentResponse = await fetch(`${API_BASE}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '最近一个月PPI是多少？另外计算123*456',
        dataset: 'price_index_statistics',
      }),
    });
    const agentData = await agentResponse.json();
    console.log('✅ Agent查询成功:', {
      query: agentData.data?.query,
      response: agentData.data?.response?.substring(0, 200) + '...',
    });
    console.log();

    // 5.5. 天气工具测试
    console.log('5️⃣.5️⃣ 测试天气查询工具...');
    const weatherResponse = await fetch(`${API_BASE}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '北京今天天气怎么样？',
        dataset: 'price_index_statistics',
      }),
    });
    const weatherData = await weatherResponse.json();
    console.log('✅ 天气查询成功:', {
      query: weatherData.data?.query,
      response: weatherData.data?.response?.substring(0, 150) + '...',
    });
    console.log();

    // 6. 检索测试
    console.log('6️⃣ 测试文档检索...');
    const retrieveResponse = await fetch(`${API_BASE}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'PPI数据',
        dataset: 'price_index_statistics',
        options: { similarityTopK: 2 },
      }),
    });
    const retrieveData = await retrieveResponse.json();
    console.log('✅ 文档检索成功:', {
      query: retrieveData.data?.query,
      nodes: retrieveData.data?.nodes?.length || 0,
    });
    console.log();

    console.log('🎉 所有 API 测试通过！');
  } catch (error) {
    console.error('❌ API 测试失败:', error.message);
  }
}

// 运行测试
testAPI();
