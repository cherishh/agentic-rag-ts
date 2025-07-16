import { tool } from 'llamaindex';
import { z } from 'zod';
import { sumNumbers, multiplyNumbers, getWeatherInfo } from './agentService';
import { RouterEngine } from './routerEngine';
import { VectorStoreService } from './vectorStore';

export interface QueryAnalysis {
  queryType: 'direct_tool' | 'knowledge_query';
  confidence: number;
  toolName?: string;
  domain?: string;
  reasoning: string;
}

export interface MasterAgentResponse {
  query: string;
  response: string;
  analysis: QueryAnalysis;
  selectedDataset?: string;
  routingReason?: string;
}

export class MasterAgent {
  private routerEngine: RouterEngine;

  constructor(vectorStoreService: VectorStoreService) {
    this.routerEngine = new RouterEngine(vectorStoreService);
  }

  /**
   * 处理查询的主入口
   */
  async processQuery(query: string): Promise<MasterAgentResponse> {
    // 1. 分析查询意图
    const analysis = await this.analyzeQueryIntent(query);
    
    // 2. 根据意图类型处理查询
    let response: string;
    let selectedDataset: string | undefined;
    let routingReason: string | undefined;

    if (analysis.queryType === 'direct_tool') {
      response = await this.handleDirectTool(query, analysis.toolName!);
    } else {
      // 如果Master Agent已经识别出了domain，优先使用它
      const routingResult = await this.routerEngine.routeQuery(query, analysis.domain);
      response = routingResult.response;
      selectedDataset = routingResult.selectedDataset;
      routingReason = routingResult.routingReason;
    }

    return {
      query,
      response,
      analysis,
      selectedDataset,
      routingReason,
    };
  }

  /**
   * 分析查询意图
   */
  private async analyzeQueryIntent(query: string): Promise<QueryAnalysis> {
    // 数学计算关键词
    const mathKeywords = [
      '计算', '算', '加', '减', '乘', '除', '等于', 
      '+', '-', '*', '×', '÷', '/', '=',
      'calculate', 'compute', 'add', 'subtract', 'multiply', 'divide'
    ];

    // 天气查询关键词
    const weatherKeywords = [
      '天气', '温度', '气温', '下雨', '晴天', '阴天', '雨天', '雪天',
      'weather', 'temperature', 'rain', 'sunny', 'cloudy'
    ];

    // 机器学习领域关键词
    const mlKeywords = [
      '机器学习', '深度学习', '神经网络', '算法', '模型', '训练',
      '梯度下降', '反向传播', '过拟合', '欠拟合', '交叉验证',
      'machine learning', 'deep learning', 'neural network', 'algorithm',
      'model', 'training', 'gradient descent', 'backpropagation', 'overfitting'
    ];

    // 价格指数领域关键词
    const priceIndexKeywords = [
      '价格指数', '物价', 'CPI', 'PPI', '消费价格', '生产价格',
      '通胀', '通缩', '价格', '指数', '统计',
      'price index', 'inflation', 'deflation', 'consumer price', 'producer price'
    ];

    const lowerQuery = query.toLowerCase();

    // 检查是否为直接工具调用
    if (mathKeywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()))) {
      // 进一步判断是加法还是乘法
      if (lowerQuery.includes('乘') || lowerQuery.includes('×') || lowerQuery.includes('*')) {
        return {
          queryType: 'direct_tool',
          confidence: 0.9,
          toolName: 'multiply',
          reasoning: '查询包含乘法运算关键词',
        };
      } else {
        return {
          queryType: 'direct_tool',
          confidence: 0.9,
          toolName: 'add',
          reasoning: '查询包含数学运算关键词',
        };
      }
    }

    if (weatherKeywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()))) {
      return {
        queryType: 'direct_tool',
        confidence: 0.9,
        toolName: 'weather',
        reasoning: '查询包含天气相关关键词',
      };
    }

    // 检查知识库查询的领域
    if (mlKeywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()))) {
      return {
        queryType: 'knowledge_query',
        confidence: 0.8,
        domain: 'machine_learning',
        reasoning: '查询包含机器学习领域关键词',
      };
    }

    if (priceIndexKeywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()))) {
      return {
        queryType: 'knowledge_query',
        confidence: 0.8,
        domain: 'price_index_statistics',
        reasoning: '查询包含价格指数领域关键词',
      };
    }

    // 默认作为知识库查询处理
    return {
      queryType: 'knowledge_query',
      confidence: 0.5,
      reasoning: '无法明确识别查询类型，默认作为知识库查询处理',
    };
  }

  /**
   * 处理直接工具调用
   */
  private async handleDirectTool(query: string, toolName: string): Promise<string> {
    try {
      switch (toolName) {
        case 'add':
          return await this.handleMathOperation(query, 'add');
        case 'multiply':
          return await this.handleMathOperation(query, 'multiply');
        case 'weather':
          return await this.handleWeatherQuery(query);
        default:
          throw new Error(`未知的工具类型: ${toolName}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        return `❌ 工具调用失败：${error.message}`;
      }
      return `❌ 工具调用失败：未知错误`;
    }
  }

  /**
   * 处理数学运算
   */
  private async handleMathOperation(query: string, operation: 'add' | 'multiply'): Promise<string> {
    // 简单的数字提取逻辑
    const numbers = query.match(/\d+(\.\d+)?/g);
    
    if (!numbers || numbers.length < 2) {
      return `❌ 无法从查询中提取两个数字进行${operation === 'add' ? '加法' : '乘法'}运算`;
    }

    const a = parseFloat(numbers[0]);
    const b = parseFloat(numbers[1]);

    if (operation === 'add') {
      const result = sumNumbers({ a, b });
      return `🔢 计算结果：${a} + ${b} = ${result}`;
    } else {
      const result = multiplyNumbers({ a, b });
      return `🔢 计算结果：${a} × ${b} = ${result}`;
    }
  }

  /**
   * 处理天气查询
   */
  private async handleWeatherQuery(query: string): Promise<string> {
    // 简单的城市名提取逻辑
    const cityMatches = query.match(/([^\s]+?)(?:的天气|天气)/);
    let city = cityMatches ? cityMatches[1] : '北京';

    // 中文城市名转英文
    const cityTranslations: { [key: string]: string } = {
      '北京': 'Beijing',
      '上海': 'Shanghai',
      '广州': 'Guangzhou',
      '深圳': 'Shenzhen',
      '杭州': 'Hangzhou',
      '南京': 'Nanjing',
      '成都': 'Chengdu',
      '武汉': 'Wuhan',
    };

    const englishCity = cityTranslations[city] || city;
    return await getWeatherInfo({ city: englishCity });
  }
}