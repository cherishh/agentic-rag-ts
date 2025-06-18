import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { serve } from '@hono/node-server';
import { app } from '../app';
import { DATASET_CONFIGS } from '../config';
import type { DatasetKey } from '../services/vectorStore';
import { setupDocs } from './docs';

// 创建 Hono 应用
const api = new Hono();

// 中间件
api.use('*', cors());
api.use('*', logger());
api.use('*', prettyJSON());

// 设置API文档
setupDocs(api);

// 错误处理中间件
api.onError((err, c) => {
  console.error('API错误:', err);
  return c.json(
    {
      error: '服务器内部错误',
      message: err.message,
      timestamp: new Date().toISOString(),
    },
    500
  );
});

// 健康检查
api.get('/health', c => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Agentic RAG API',
  });
});

// 获取应用程序状态
api.get('/status', async c => {
  try {
    const status = await app.getStatus();
    return c.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: '获取状态失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

api.get('/diagnose', async c => {
  try {
    const result = await app.diagnose();
    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: '诊断失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// 获取数据集列表
api.get('/datasets', c => {
  const datasets = Object.entries(DATASET_CONFIGS).map(([key, config]) => ({
    id: key,
    name: config.description,
    collectionName: config.collectionName,
    dataPath: config.dataPath,
  }));

  return c.json({
    success: true,
    data: {
      datasets,
      total: datasets.length,
    },
    timestamp: new Date().toISOString(),
  });
});

// 基础查询
api.post('/query', async c => {
  try {
    const body = await c.req.json();
    const { query, dataset = 'price_index_statistics', options = {} } = body;

    if (!query) {
      return c.json(
        {
          success: false,
          error: '缺少必需参数',
          message: 'query 参数是必需的',
          timestamp: new Date().toISOString(),
        },
        400
      );
    }

    const result = await app.query(query, dataset as DatasetKey, {
      similarityTopK: options.similarityTopK || 5,
      includeSourceNodes: options.includeSourceNodes !== false,
    });

    return c.json({
      success: true,
      data: result,
      meta: {
        dataset,
        query,
        options,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: '查询失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// 文档检索（不生成回答）
api.post('/retrieve', async c => {
  try {
    const body = await c.req.json();
    const { query, dataset = 'price_index_statistics', options = {} } = body;

    if (!query) {
      return c.json(
        {
          success: false,
          error: '缺少必需参数',
          message: 'query 参数是必需的',
          timestamp: new Date().toISOString(),
        },
        400
      );
    }

    const result = await app.retrieve(query, dataset as DatasetKey, options);

    return c.json({
      success: true,
      data: result,
      meta: {
        dataset,
        query,
        options,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: '检索失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// Agent查询
api.post('/agent', async c => {
  try {
    const body = await c.req.json();
    const { query, dataset = 'price_index_statistics' } = body;

    if (!query) {
      return c.json(
        {
          success: false,
          error: '缺少必需参数',
          message: 'query 参数是必需的',
          timestamp: new Date().toISOString(),
        },
        400
      );
    }

    const result = await app.agentQuery(query, dataset as DatasetKey);

    return c.json({
      success: true,
      data: {
        query,
        response: result,
      },
      meta: {
        dataset,
        type: 'agent',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: 'Agent查询失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// 流式Agent查询
api.post('/agent/stream', async c => {
  try {
    const body = await c.req.json();
    const { query, dataset = 'price_index_statistics' } = body;

    if (!query) {
      return c.json(
        {
          success: false,
          error: '缺少必需参数',
          message: 'query 参数是必需的',
        },
        400
      );
    }

    // 创建可读流
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送开始消息
          const startMessage = `data: ${JSON.stringify({ type: 'start', message: '开始生成回答...' })}\n\n`;
          controller.enqueue(new TextEncoder().encode(startMessage));

          // 获取 Agent 流并处理
          const agentStream = app.agentQueryStream(query, dataset as DatasetKey);
          for await (const chunk of agentStream) {
            const chunkMessage = `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
            controller.enqueue(new TextEncoder().encode(chunkMessage));
          }

          // 发送结束消息
          const endMessage = `data: ${JSON.stringify({ type: 'end', message: '生成完成' })}\n\n`;
          controller.enqueue(new TextEncoder().encode(endMessage));

          controller.close();
        } catch (error: any) {
          const errorMessage = `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorMessage));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: '流式查询失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// 跨数据集查询
api.post('/cross-query', async c => {
  try {
    const body = await c.req.json();
    const { query, datasets } = body;

    if (!query) {
      return c.json(
        {
          success: false,
          error: '缺少必需参数',
          message: 'query 参数是必需的',
          timestamp: new Date().toISOString(),
        },
        400
      );
    }

    const result = await app.crossDatasetQuery(query, datasets);

    return c.json({
      success: true,
      data: result,
      meta: {
        query,
        datasets: datasets || ['price_index_statistics', 'machine_learning'],
        type: 'cross-dataset',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: '跨数据集查询失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// 重建索引
api.post('/rebuild', async c => {
  try {
    const body = await c.req.json();
    const { dataset = 'price_index_statistics' } = body;

    await app.rebuildIndex(dataset as DatasetKey);

    return c.json({
      success: true,
      data: {
        message: `数据集 ${dataset} 的索引重建完成`,
        dataset,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: '重建索引失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// 删除collection
api.delete('/collection', async c => {
  try {
    const body = await c.req.json();
    const { dataset = 'price_index_statistics' } = body;

    const result = await app.deleteCollection(dataset as DatasetKey);

    return c.json({
      success: true,
      data: {
        message: `数据集 ${dataset} 的collection删除${result ? '成功' : '失败'}`,
        dataset,
        deleted: result,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: '删除collection失败',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// 404处理
api.notFound(c => {
  return c.json(
    {
      success: false,
      error: '端点不存在',
      message: `路径 ${c.req.path} 不存在`,
      timestamp: new Date().toISOString(),
    },
    404
  );
});

export { api };

// 启动服务器函数
export async function startServer(port: number = 3000) {
  try {
    // 初始化应用程序
    console.log('🔄 正在初始化RAG应用程序...');
    await app.initialize();
    console.log('✅ RAG应用程序初始化完成');

    // 启动HTTP服务器
    console.log(`🚀 启动API服务器，端口: ${port}`);
    console.log(`📍 API文档: http://localhost:${port}`);
    console.log(`🏥 健康检查: http://localhost:${port}/health`);
    console.log(`📊 应用状态: http://localhost:${port}/status`);

    serve({
      fetch: api.fetch,
      port,
    });

    console.log('✅ 服务器启动成功！');
  } catch (error: any) {
    console.error('❌ 服务器启动失败:', error.message);
    process.exit(1);
  }
}
