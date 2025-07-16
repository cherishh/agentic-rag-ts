import { agent, agentStreamEvent } from '@llamaindex/workflow';
import { tool, QueryEngineTool } from 'llamaindex';
import { z } from 'zod';
import { VectorStoreService } from './vectorStore';
import { weatherService } from './weatherService';
import { MasterAgent } from './masterAgent';
import type { DatasetKey } from './vectorStore';
import type { MasterAgentResponse } from './masterAgent';

// 工具函数 - 符合LlamaIndex工具参数结构
export const sumNumbers = ({ a, b }: { a: number; b: number }): number => a + b;
export const multiplyNumbers = ({ a, b }: { a: number; b: number }): number => a * b;

// 天气查询工具函数
export const getWeatherInfo = async ({ city }: { city: string }): Promise<string> => {
  try {
    const weather = await weatherService.getWeather(city);
    return weatherService.formatWeatherInfo(weather);
  } catch (error) {
    if (error instanceof Error) {
      return `❌ 天气查询失败：${error.message}`;
    }
    return `❌ 天气查询失败：未知错误`;
  }
};

export class AgentService {
  private masterAgent: MasterAgent;

  constructor(private vectorStoreService: VectorStoreService) {
    this.masterAgent = new MasterAgent(vectorStoreService);
  }

  /**
   * 智能Agent查询 - 使用Master Agent进行路由
   */
  async runIntelligentQuery(query: string): Promise<MasterAgentResponse> {
    return await this.masterAgent.processQuery(query);
  }

  /**
   * 智能Agent查询（流式输出）
   */
  async *runIntelligentQueryStream(query: string): AsyncGenerator<string, MasterAgentResponse, unknown> {
    // 对于流式输出，我们需要特殊处理
    // 先分析查询类型，然后决定如何处理
    const analysis = await (this.masterAgent as any).analyzeQueryIntent(query);
    
    if (analysis.queryType === 'direct_tool') {
      // 直接工具调用，一次性返回结果
      const result = await this.masterAgent.processQuery(query);
      yield result.response;
      return result;
    } else {
      // 知识库查询，使用流式处理
      const routerEngine = (this.masterAgent as any).routerEngine;
      const selection = await routerEngine.selectBestDataset(query);
      
      // 创建流式查询
      const index = await this.vectorStoreService.getIndex(selection.dataset);
      const queryEngine = index.asQueryEngine({
        retriever: index.asRetriever({ similarityTopK: 5 }),
      });

      // 这里简化处理，实际LlamaIndex可能不直接支持流式QueryEngine
      // 我们模拟流式输出
      const response = await queryEngine.query({ query });
      const responseText = response.toString();
      
      // 分块输出
      const chunks = responseText.match(/.{1,50}/g) || [responseText];
      for (const chunk of chunks) {
        yield chunk;
        await new Promise(resolve => setTimeout(resolve, 50)); // 模拟流式延迟
      }

      return {
        query,
        response: responseText,
        analysis,
        selectedDataset: selection.dataset,
        routingReason: selection.reasoning,
      };
    }
  }

  /**
   * 创建工具集 - 保留原有方法用于兼容性
   */
  private async createTools(dataset: DatasetKey) {
    const index = await this.vectorStoreService.getIndex(dataset);

    // 数学工具
    const addTool = tool({
      name: 'sumNumbers',
      description: 'Use this function to sum two numbers',
      parameters: z.object({
        a: z.number({ description: 'First number to sum' }),
        b: z.number({ description: 'Second number to sum' }),
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

    // 天气查询工具
    const weatherTool = tool({
      name: 'getWeather',
      description:
        'Get current weather information for a specific city. Use this when users ask about weather conditions.',
      parameters: z.object({
        city: z.string({ description: 'The name of the city to get weather for (in English)' }),
      }),
      execute: getWeatherInfo,
    });

    // 查询工具
    const queryTool = index.queryTool({
      metadata: {
        name: `${dataset}_query_tool`,
        description: `This tool can answer detailed questions about the ${dataset} dataset.`,
      },
      options: { similarityTopK: 10 },
    });

    return [addTool, multiplyTool, weatherTool, queryTool];
  }

  /**
   * 运行Agent查询 - 保留原有方法用于兼容性
   */
  async runQuery(query: string, dataset: DatasetKey): Promise<string> {
    const tools = await this.createTools(dataset);
    const myAgent = agent({ tools });

    let result = '';
    const events = myAgent.runStream(query);

    for await (const event of events) {
      if (agentStreamEvent.include(event)) {
        result += event.data.delta;
      }
    }

    return result;
  }

  /**
   * 运行Agent查询（流式输出）- 保留原有方法用于兼容性
   */
  async *runQueryStream(query: string, dataset: DatasetKey): AsyncGenerator<string, void, unknown> {
    const tools = await this.createTools(dataset);
    const myAgent = agent({ tools });

    const events = myAgent.runStream(query);

    for await (const event of events) {
      if (agentStreamEvent.include(event)) {
        yield event.data.delta;
      }
    }
  }
}
