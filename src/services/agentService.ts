import { agent, agentStreamEvent } from '@llamaindex/workflow';
import { tool, Tool, RouterQueryEngine } from 'llamaindex';
import { z } from 'zod';
import { VectorStoreService } from './vectorStore';
import { weatherService } from './weatherService';
import { RouterService } from './routerService';
import type { DatasetKey } from './vectorStore';

// Tool functions - matching the LlamaIndex tool parameter structure
export const sumNumbers = ({ a, b }: { a: number; b: number }): number => a + b;
export const multiplyNumbers = ({ a, b }: { a: number; b: number }): number => a * b;

// Weather query tool function
export const getWeatherInfo = async ({ city }: { city: string }): Promise<string> => {
  try {
    const weather = await weatherService.getWeather(city);
    return weatherService.formatWeatherInfo(weather);
  } catch (error) {
    if (error instanceof Error) {
      return `❌ Weather query failed: ${error.message}`;
    }
    return `❌ Weather query failed: Unknown error`;
  }
};

/**
 * This service now acts as the "Master Agent".
 * It has access to simple tools (calculator, weather) and a specialized
 * "knowledgeBaseTool" which is powered by a RouterEngine.
 * It decides whether to use a simple tool or delegate the query to the RouterEngine.
 */
export class AgentService {
  private routerEngine?: RouterQueryEngine;
  private tools: Tool[] = [];

  constructor(
    private vectorStoreService: VectorStoreService,
    private routerService: RouterService
  ) {}

  /**
   * Initializes the AgentService by creating the RouterEngine and the toolset.
   * This should be called before running any queries.
   */
  async initialize() {
    console.log('🔄 Initializing Master Agent (AgentService)...');
    this.routerEngine = await this.routerService.createRouterEngine();
    this.tools = this.createTools();
    console.log('✅ Master Agent (AgentService) initialized successfully.');
  }

  /**
   * Creates the toolset for the Master Agent.
   */
  private createTools(): Tool[] {
    // Simple tools
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

    const weatherTool = tool({
      name: 'getWeather',
      description:
        'Get current weather information for a specific city. Use this when users ask about weather conditions.',
      parameters: z.object({
        city: z.string({ description: 'The name of the city to get weather for (in English)' }),
      }),
      execute: getWeatherInfo,
    });

    // Specialized Knowledge Base Tool powered by the RouterEngine
    const knowledgeBaseTool = tool({
      name: 'knowledgeBaseQuery',
      description:
        'Use this tool for complex questions about specific topics like machine learning or price index statistics. Use it when the query is not a simple calculation or weather request.',
      parameters: z.object({
        query: z.string({
          description: 'The detailed question to ask the knowledge base',
        }),
      }),
      execute: async ({ query }) => {
        if (!this.routerEngine) {
          throw new Error('RouterEngine is not initialized.');
        }
        const result = await this.routerEngine.query({ query });
        return result.response;
      },
    });

    return [addTool, multiplyTool, weatherTool, knowledgeBaseTool];
  }

  /**
   * Runs an agent query.
   * The `dataset` parameter is no longer needed as the RouterEngine handles selection.
   */
  async runQuery(query: string): Promise<string> {
    if (this.tools.length === 0) {
      throw new Error('AgentService is not initialized. Please call initialize() first.');
    }
    const myAgent = agent({ tools: this.tools });

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
   * Runs an agent query and streams the output.
   * The `dataset` parameter is no longer needed.
   */
  async *runQueryStream(query: string): AsyncGenerator<string, void, unknown> {
    if (this.tools.length === 0) {
      throw new Error('AgentService is not initialized. Please call initialize() first.');
    }
    const myAgent = agent({ tools: this.tools });

    const events = myAgent.runStream(query);

    for await (const event of events) {
      if (agentStreamEvent.include(event)) {
        yield event.data.delta;
      }
    }
  }
}
