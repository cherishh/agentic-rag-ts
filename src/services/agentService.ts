import { agent, agentStreamEvent } from '@llamaindex/workflow';
import { tool, QueryEngineTool } from 'llamaindex';
import { z } from 'zod';
import { VectorStoreService } from './vectorStore';
import { weatherService } from './weatherService';
import type { DatasetKey } from './vectorStore';

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
  constructor(private vectorStoreService: VectorStoreService) {}

  /**
   * 创建工具集
   */
  private async createTools(dataset: DatasetKey) {
    const index = await this.vectorStoreService.getOrCreateIndex(dataset);

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
   * 运行Agent查询
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
   * 运行Agent查询（流式输出）
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
