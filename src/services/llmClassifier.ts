import { Settings } from 'llamaindex';
import { DATASET_CONFIGS } from '../config';
import type { DatasetKey } from './vectorStore';

export interface LLMClassificationResult {
  dataset: DatasetKey;
  confidence: number;
  reasoning: string;
}

export interface DatasetDescription {
  key: DatasetKey;
  name: string;
  description: string;
}

export class LLMClassifier {
  private datasetDescriptions: DatasetDescription[] = [
    {
      key: 'machine_learning',
      name: '机器学习课程内容',
      description: '包含机器学习相关的课程内容，涵盖算法、模型训练、数据处理、特征工程、模型评估等内容。适用于回答关于机器学习算法、模型训练、数据集划分、评估指标、超参数调优等问题。'
    },
    {
      key: 'price_index_statistics',
      name: '价格指数统计',
      description: '包含价格指数相关的统计数据，涵盖CPI、PPI等经济指标的历史数据和分析。适用于回答关于价格变动、通胀率、经济指标、价格趋势等问题。'
    }
  ];

  /**
   * 使用LLM对查询进行智能分类
   */
  async classify(query: string): Promise<LLMClassificationResult> {
    const prompt = this.buildClassificationPrompt(query);
    
    try {
      const response = await Settings.llm.complete({
        prompt,
        temperature: 0.1, // 低温度确保一致性
      });

      const result = this.parseClassificationResult(response.text);
      return result;
    } catch (error) {
      console.error('LLM分类失败:', error);
      throw new Error(`LLM分类服务异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 构建分类提示词
   */
  private buildClassificationPrompt(query: string): string {
    const datasetList = this.datasetDescriptions
      .map((desc, index) => `${index + 1}. ${desc.key}: ${desc.name}\n   ${desc.description}`)
      .join('\n\n');

    return `你是一个智能查询分类系统。请分析以下查询并选择最合适的数据集。

查询: "${query}"

可用数据集:
${datasetList}

请仔细分析查询的内容和意图，选择最合适的数据集。考虑以下因素：
1. 查询中的关键词和术语
2. 查询的问题类型和领域
3. 数据集的内容范围和适用性

请返回JSON格式的结果，包含以下字段：
- dataset: 数据集的key (machine_learning 或 price_index_statistics)
- confidence: 置信度 (0.0-1.0)
- reasoning: 选择理由 (简洁明了)

示例输出格式:
{"dataset": "machine_learning", "confidence": 0.9, "reasoning": "查询涉及数据集划分，属于机器学习领域"}

请只返回JSON格式的结果，不要包含其他内容:`;
  }

  /**
   * 解析LLM分类结果
   */
  private parseClassificationResult(response: string): LLMClassificationResult {
    try {
      // 清理响应文本，提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM响应中未找到有效的JSON格式');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // 验证必需字段
      if (!parsed.dataset || !parsed.confidence || !parsed.reasoning) {
        throw new Error('LLM响应缺少必需字段');
      }

      // 验证数据集是否有效
      if (!DATASET_CONFIGS[parsed.dataset as DatasetKey]) {
        throw new Error(`无效的数据集: ${parsed.dataset}`);
      }

      // 验证置信度范围
      const confidence = parseFloat(parsed.confidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        throw new Error(`无效的置信度: ${parsed.confidence}`);
      }

      return {
        dataset: parsed.dataset as DatasetKey,
        confidence: confidence,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.error('解析LLM分类结果失败:', error);
      console.error('原始响应:', response);
      
      // 返回默认结果
      return {
        dataset: 'price_index_statistics',
        confidence: 0.3,
        reasoning: `LLM响应解析失败，使用默认数据集: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 获取数据集描述
   */
  getDatasetDescriptions(): DatasetDescription[] {
    return this.datasetDescriptions;
  }

  /**
   * 添加新的数据集描述
   */
  addDatasetDescription(description: DatasetDescription): void {
    this.datasetDescriptions.push(description);
  }
}