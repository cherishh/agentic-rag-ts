import { VectorStoreService } from './vectorStore';
import { RouterEngine } from './routerEngine';
import { sumNumbers, multiplyNumbers, getWeatherInfo } from './agentService';
import type { SubQuery } from './queryDecomposer';

export interface SubQueryResult {
  id: string;
  query: string;
  type: SubQuery['type'];
  response: string;
  success: boolean;
  error?: string;
  executionTime?: number;
}

export class SubAgentExecutor {
  private routerEngine: RouterEngine;

  constructor(private vectorStoreService: VectorStoreService) {
    this.routerEngine = new RouterEngine(vectorStoreService);
  }

  /**
   * 执行单个子查询
   */
  async executeSubQuery(subQuery: SubQuery): Promise<SubQueryResult> {
    const startTime = Date.now();

    try {
      let response: string;

      switch (subQuery.type) {
        case 'knowledge_query':
          response = await this.handleKnowledgeQuery(subQuery.query);
          break;
        case 'math_calculation':
          response = await this.handleMathCalculation(subQuery.query);
          break;
        case 'weather_query':
          response = await this.handleWeatherQuery(subQuery.query);
          break;
        default:
          throw new Error(`不支持的查询类型: ${subQuery.type}`);
      }

      return {
        id: subQuery.id,
        query: subQuery.query,
        type: subQuery.type,
        response,
        success: true,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        id: subQuery.id,
        query: subQuery.query,
        type: subQuery.type,
        response: '',
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 批量执行子查询
   */
  async executeSubQueries(subQueries: SubQuery[]): Promise<SubQueryResult[]> {
    const results: SubQueryResult[] = [];

    // 按优先级顺序执行（目前是串行，可以改为并行）
    for (const subQuery of subQueries) {
      const result = await this.executeSubQuery(subQuery);
      results.push(result);
    }

    return results;
  }

  /**
   * 处理知识库查询
   */
  private async handleKnowledgeQuery(query: string): Promise<string> {
    try {
      // 使用路由引擎来选择合适的数据集并执行查询
      const routingResult = await this.routerEngine.routeQuery(query);
      return routingResult.response;
    } catch (error) {
      throw new Error(`知识库查询失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 处理数学计算
   */
  private async handleMathCalculation(query: string): Promise<string> {
    try {
      // 提取数字
      const numbers = query.match(/\d+(\.\d+)?/g);

      if (!numbers || numbers.length < 2) {
        throw new Error('无法从查询中提取足够的数字进行计算');
      }

      const a = parseFloat(numbers[0]!);
      const b = parseFloat(numbers[1]!);

      // 判断运算类型
      const lowerQuery = query.toLowerCase();

      if (lowerQuery.includes('乘') || lowerQuery.includes('×') || lowerQuery.includes('*')) {
        const result = multiplyNumbers({ a, b });
        return `🔢 计算结果：${a} × ${b} = ${result}`;
      } else if (lowerQuery.includes('加') || lowerQuery.includes('+')) {
        const result = sumNumbers({ a, b });
        return `🔢 计算结果：${a} + ${b} = ${result}`;
      } else {
        // 默认尝试乘法
        const result = multiplyNumbers({ a, b });
        return `🔢 计算结果：${a} × ${b} = ${result}`;
      }
    } catch (error) {
      throw new Error(`数学计算失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 处理天气查询
   */
  private async handleWeatherQuery(query: string): Promise<string> {
    try {
      // 提取城市名
      const cityMatches = query.match(/([^\s]+?)(?:的天气|天气)/);
      let city = cityMatches ? cityMatches[1] : '北京';

      // 中文城市名转英文
      const cityTranslations: { [key: string]: string } = {
        北京: 'Beijing',
        上海: 'Shanghai',
        广州: 'Guangzhou',
        深圳: 'Shenzhen',
        杭州: 'Hangzhou',
        南京: 'Nanjing',
        成都: 'Chengdu',
        武汉: 'Wuhan',
      };

      const englishCity = city ? cityTranslations[city] || city : 'Beijing';
      return await getWeatherInfo({ city: englishCity });
    } catch (error) {
      throw new Error(`天气查询失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}
