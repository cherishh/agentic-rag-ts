import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { serve } from '@hono/node-server';
import { app } from '../app';
import { DATASET_CONFIGS } from '../config';
import type { DatasetKey } from '../services/vectorStore';
import { setupDocs } from './docs';

// 响应辅助函数
function successResponse(data: any, meta?: any) {
  return {
    success: true,
    data,
    ...(meta && { meta }),
    timestamp: new Date().toISOString(),
  };
}

function errorResponse(message: string, error?: string, statusCode: number = 500) {
  return {
    success: false,
    error: message,
    ...(error && { message: error }),
    timestamp: new Date().toISOString(),
  };
}

function validateParams(body: any, required: string[]): string | null {
  for (const param of required) {
    if (!body[param]) {
      return `${param} 参数是必需的`;
    }
  }
  return null;
}

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
  return c.json(errorResponse('服务器内部错误', err.message), 500);
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
    return c.json(successResponse(status));
  } catch (error: any) {
    return c.json(errorResponse('获取状态失败', error.message), 500);
  }
});

api.get('/diagnose', async c => {
  try {
    const result = await app.diagnose();
    return c.json(successResponse(result));
  } catch (error: any) {
    return c.json(errorResponse('诊断失败', error.message), 500);
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

  return c.json(
    successResponse({
      datasets,
      total: datasets.length,
    })
  );
});

// 智能查询 - 专门的智能路由接口
api.post('/intelligent-query', async c => {
  try {
    const body = await c.req.json();
    const validation = validateParams(body, ['query']);

    if (validation) {
      return c.json(errorResponse('缺少必需参数', validation), 400);
    }

    const result = await app.intelligentQuery(body.query);

    return c.json(
      successResponse(
        {
          query: result.query,
          response: result.response,
          analysis: result.analysis,
          selectedDataset: result.selectedDataset,
          routingReason: result.routingReason,
          decomposition: result.decomposition,
          subResults: result.subResults,
          executionSummary: result.executionSummary,
        },
        {
          type: 'intelligent',
          routing: {
            queryType: result.analysis.queryType,
            confidence: result.analysis.confidence,
            reasoning: result.analysis.reasoning,
          },
          performance: {
            totalSubQueries: result.executionSummary.totalSubQueries,
            successfulQueries: result.executionSummary.successfulQueries,
            failedQueries: result.executionSummary.failedQueries,
            totalExecutionTime: result.executionSummary.totalExecutionTime,
          },
        }
      )
    );
  } catch (error: any) {
    return c.json(errorResponse('智能查询失败', error.message), 500);
  }
});

// 流式智能查询
api.post('/intelligent-query/stream', async c => {
  try {
    const body = await c.req.json();
    const validation = validateParams(body, ['query']);

    if (validation) {
      return c.json(errorResponse('缺少必需参数', validation), 400);
    }

    // 创建可读流
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送开始消息
          const startMessage = `data: ${JSON.stringify({
            type: 'start',
            message: '开始生成回答...',
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(startMessage));

          // 获取智能查询流并处理
          const intelligentStream = app.intelligentQueryStream(body.query);
          for await (const chunk of intelligentStream) {
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
    return c.json(errorResponse('流式智能查询失败', error.message), 500);
  }
});

// 跨数据集查询
api.post('/cross-query', async c => {
  try {
    const body = await c.req.json();
    const validation = validateParams(body, ['query']);

    if (validation) {
      return c.json(errorResponse('缺少必需参数', validation), 400);
    }

    const result = await app.crossDatasetQuery(body.query, body.datasets);

    return c.json(
      successResponse(result, {
        query: body.query,
        datasets: body.datasets || ['price_index_statistics', 'machine_learning'],
        type: 'cross-dataset',
      })
    );
  } catch (error: any) {
    return c.json(errorResponse('跨数据集查询失败', error.message), 500);
  }
});

// 重建索引
api.post('/rebuild', async c => {
  try {
    const body = await c.req.json();
    const dataset = body.dataset || 'price_index_statistics';

    await app.rebuildIndex(dataset as DatasetKey);

    return c.json(
      successResponse({
        message: `数据集 ${dataset} 的索引重建完成`,
        dataset,
      })
    );
  } catch (error: any) {
    return c.json(errorResponse('重建索引失败', error.message), 500);
  }
});

// 删除collection
api.delete('/collection', async c => {
  try {
    const body = await c.req.json();
    const dataset = body.dataset || 'price_index_statistics';

    const result = await app.deleteCollection(dataset as DatasetKey);

    return c.json(
      successResponse({
        message: `数据集 ${dataset} 的collection删除${result ? '成功' : '失败'}`,
        dataset,
        deleted: result,
      })
    );
  } catch (error: any) {
    return c.json(errorResponse('删除collection失败', error.message), 500);
  }
});

// 404处理
api.notFound(c => {
  return c.json(errorResponse('端点不存在', `路径 ${c.req.path} 不存在`), 404);
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
