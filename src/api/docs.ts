import type { Hono } from 'hono';

// API文档路由
export function setupDocs(api: Hono) {
  // API文档首页
  api.get('/', c => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Agentic RAG API 文档</title>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1, h2 { color: #333; }
        h1 { border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4CAF50; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; margin-right: 10px; }
        .get { background: #28a745; }
        .post { background: #007bff; }
        .delete { background: #dc3545; }
        .path { font-family: monospace; background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .description { margin: 10px 0; color: #666; }
        .example { background: #e8f5e9; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .response { background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin-left: 10px; }
        .ready { background: #d4edda; color: #155724; }
      </style>
    </head>
    <body>
      <h1>🤖 Agentic RAG API 文档</h1>
      <p class="description">
        基于 LlamaIndex.TS + Qdrant Cloud + OpenAI 的智能检索增强生成API服务。
        支持多数据集管理、基础RAG查询、Agentic查询等功能。
      </p>
      
      <div class="endpoint">
        <strong>🏥 服务状态检查</strong> <span class="status-badge ready">就绪</span>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/health</span>
        <div class="description">健康检查，验证服务是否正常运行</div>
        <div class="response">
          <strong>响应示例:</strong>
          <pre>{"status": "ok", "timestamp": "2024-01-01T00:00:00.000Z", "service": "Agentic RAG API"}</pre>
        </div>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/status</span>
        <div class="description">获取应用程序详细状态信息</div>
        <div class="response">
          <strong>响应示例:</strong>
          <pre>{"success": true, "data": {"status": "running", "currentDataset": "price_index_statistics", "health": {...}}}</pre>
        </div>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/datasets</span>
        <div class="description">获取所有可用数据集列表</div>
        <div class="response">
          <strong>响应示例:</strong>
          <pre>{"success": true, "data": {"datasets": [{"id": "price_index_statistics", "name": "价格指数统计"}], "total": 2}}</pre>
        </div>
      </div>

      <div class="endpoint">
        <strong>🔍 查询功能</strong> <span class="status-badge ready">就绪</span>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/query</span>
        <div class="description">基础RAG查询，返回生成的回答和相关文档</div>
        <div class="example">
          <strong>请求示例:</strong>
          <pre>curl -X POST http://localhost:3000/query \\
  -H "Content-Type: application/json" \\
  -d '{"query": "最近一个月PPI是多少", "dataset": "price_index_statistics", "options": {"similarityTopK": 5}}'</pre>
        </div>
        <div class="response">
          <strong>响应示例:</strong>
          <pre>{"success": true, "data": {"query": "最近一个月PPI是多少", "response": "根据提供的数据...", "sourceNodes": [...]}}</pre>
        </div>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/retrieve</span>
        <div class="description">文档检索，只返回相关文档片段，不生成回答</div>
        <div class="example">
          <strong>请求示例:</strong>
          <pre>curl -X POST http://localhost:3000/retrieve \\
  -H "Content-Type: application/json" \\
  -d '{"query": "机器学习", "dataset": "machine_learning"}'</pre>
        </div>
      </div>

      <div class="endpoint">
        <strong>🤖 Agentic 功能</strong> <span class="status-badge ready">就绪</span>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/agent</span>
        <div class="description">Agentic查询，支持工具调用（数学计算、天气查询、RAG查询等）</div>
        <div class="example">
          <strong>请求示例:</strong>
          <pre>curl -X POST http://localhost:3000/agent \\
  -H "Content-Type: application/json" \\
  -d '{"query": "最近一个月PPI是多少？另外计算123*456", "dataset": "price_index_statistics"}'</pre>
        </div>
        <div class="response">
          <strong>响应示例:</strong>
          <pre>{"success": true, "data": {"query": "...", "response": "最近一个月PPI是97.3。123乘以456等于56088。"}}</pre>
        </div>
        <div class="example">
          <strong>天气查询示例:</strong>
          <pre>curl -X POST http://localhost:3000/agent \\
  -H "Content-Type: application/json" \\
  -d '{"query": "北京今天天气怎么样？", "dataset": "price_index_statistics"}'</pre>
        </div>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/agent/stream</span>
        <div class="description">流式Agentic查询，实时返回生成内容（Server-Sent Events）</div>
        <div class="example">
          <strong>请求示例:</strong>
          <pre>curl -X POST http://localhost:3000/agent/stream \\
  -H "Content-Type: application/json" \\
  -d '{"query": "解释机器学习的基本概念", "dataset": "machine_learning"}'</pre>
        </div>
        <div class="response">
          <strong>SSE响应格式:</strong>
          <pre>data: {"type":"start","message":"开始生成回答..."}
data: {"type":"chunk","content":"机器学习是..."}
data: {"type":"end","message":"生成完成"}</pre>
        </div>
      </div>

      <div class="endpoint">
        <strong>🔄 高级功能</strong> <span class="status-badge ready">就绪</span>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/cross-query</span>
        <div class="description">跨数据集查询，同时查询多个数据集</div>
        <div class="example">
          <strong>请求示例:</strong>
          <pre>curl -X POST http://localhost:3000/cross-query \\
  -H "Content-Type: application/json" \\
  -d '{"query": "价格指数", "datasets": ["price_index_statistics", "machine_learning"]}'</pre>
        </div>
      </div>

      <div class="endpoint">
        <strong>🛠️ 可用工具列表</strong>
        <ul>
          <li><strong>数学计算</strong> - 支持加法和乘法运算（sumNumbers, multiply）</li>
          <li><strong>天气查询</strong> - 获取指定城市的实时天气信息（getWeather），使用WeatherAPI.com数据源</li>
          <li><strong>数据查询</strong> - 从知识库中检索相关信息回答问题</li>
        </ul>
        <div class="example">
          <strong>组合查询示例:</strong>
          <pre>"今天上海天气如何？另外最近的PPI数据是多少？再帮我计算88*99"</pre>
        </div>
        <div class="example">
          <strong>注意事项:</strong>
          <pre>天气查询需要在环境变量中配置 WEATHER_API_KEY（WeatherAPI.com）</pre>
        </div>
      </div>

      <div class="endpoint">
        <strong>🛠️ 管理功能</strong> <span class="status-badge ready">就绪</span>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/rebuild</span>
        <div class="description">重建指定数据集的向量索引</div>
        <div class="example">
          <strong>请求示例:</strong>
          <pre>curl -X POST http://localhost:3000/rebuild \\
  -H "Content-Type: application/json" \\
  -d '{"dataset": "price_index_statistics"}'</pre>
        </div>
      </div>

      <div class="endpoint">
        <span class="method delete">DELETE</span>
        <span class="path">/collection</span>
        <div class="description">删除指定数据集的collection</div>
        <div class="example">
          <strong>请求示例:</strong>
          <pre>curl -X DELETE http://localhost:3000/collection \\
  -H "Content-Type: application/json" \\
  -d '{"dataset": "price_index_statistics"}'</pre>
        </div>
      </div>

      <div class="endpoint">
        <strong>📊 支持的数据集</strong>
        <ul>
          <li><strong>price_index_statistics</strong> - 价格指数统计（国家统计局数据，近13个月）</li>
          <li><strong>machine_learning</strong> - 机器学习课程内容（视频转写，约39万字）</li>
        </ul>
      </div>

      <div class="endpoint">
        <strong>⚡ 性能说明</strong>
        <ul>
          <li>基础查询响应时间：~2-5秒</li>
          <li>Agentic查询响应时间：~5-15秒（取决于工具调用复杂度）</li>
          <li>流式查询：实时响应，首字节时间 <1秒</li>
          <li>并发支持：可处理多个并发请求</li>
        </ul>
      </div>

      <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
        <p>Agentic RAG API - 基于 LlamaIndex.TS + Qdrant Cloud + OpenAI</p>
        <p>API Version: 1.0.0 | Framework: Hono + Bun</p>
      </footer>
    </body>
    </html>
    `;

    return c.html(html);
  });
}
