import { VectorStoreService } from './vectorStore';
import { DATASET_CONFIGS } from '../config';
import { LLMClassifier } from './llmClassifier';
import type { DatasetKey } from './vectorStore';

export interface DatasetSelection {
  dataset: DatasetKey;
  confidence: number;
  reasoning: string;
}

export interface RouterResponse {
  response: string;
  selectedDataset: string;
  routingReason: string;
  confidence: number;
}

export class RouterEngine {
  private llmClassifier: LLMClassifier;

  constructor(private vectorStoreService: VectorStoreService) {
    this.llmClassifier = new LLMClassifier();
  }

  /**
   * 路由查询到最合适的数据集
   */
  async routeQuery(query: string, suggestedDataset?: string): Promise<RouterResponse> {
    let selection: DatasetSelection;
    
    // 1. 如果有建议的数据集，优先使用
    if (suggestedDataset && suggestedDataset in DATASET_CONFIGS) {
      selection = {
        dataset: suggestedDataset as DatasetKey,
        confidence: 0.9,
        reasoning: `Master Agent 建议使用 ${suggestedDataset} 数据集`,
      };
    } else {
      // 2. 否则选择最佳数据集
      selection = await this.selectBestDataset(query);
    }
    
    // 3. 创建专门的查询工具并执行查询
    const response = await this.executeQuery(query, selection.dataset);
    
    return {
      response,
      selectedDataset: DATASET_CONFIGS[selection.dataset].description,
      routingReason: selection.reasoning,
      confidence: selection.confidence,
    };
  }

  /**
   * 选择最佳数据集 - 简化版决策流程
   */
  private async selectBestDataset(query: string): Promise<DatasetSelection> {
    const lowerQuery = query.toLowerCase();

    // 机器学习领域关键词（更全面）
    const mlKeywords = [
      // 基础概念
      '机器学习', '深度学习', '人工智能', '算法', '模型', '训练',
      '神经网络', '卷积', '循环', '递归', '前馈',
      // 数据集相关
      'dev set', 'test set', 'validation set', 'training set',
      '训练集', '验证集', '测试集', '开发集', '数据集划分',
      '数据集', '数据分割', '数据切分', '训练数据', '测试数据',
      // 算法相关
      '梯度下降', '反向传播', '优化', '损失函数', '激活函数',
      '回归', '分类', '聚类', '降维', '特征', '决策树',
      '支持向量机', '随机森林', '朴素贝叶斯', '逻辑回归',
      // 模型评估
      '准确率', '精确率', '召回率', 'F1分数', 'F1 score', 'AUC', 'ROC',
      '混淆矩阵', '模型评估', '性能评估', '评估指标', '评估方法',
      'precision', 'recall', 'accuracy', 'f1', 'confusion matrix',
      // 数据处理
      '数据预处理', '特征工程', '数据清洗', '数据增强',
      '特征选择', '数据标注', '数据归一化', '数据标准化',
      'data preprocessing', 'feature engineering', 'data cleaning',
      // 模型训练
      '模型训练', '模型选择', '超参数', '调参', '优化器',
      '学习率', '批量大小', 'epoch', 'batch size', 'learning rate',
      '模型部署', '模型优化', '模型调试',
      // 学习方法
      '监督学习', '无监督学习', '强化学习', '半监督学习',
      'supervised learning', 'unsupervised learning', 'reinforcement learning',
      // 问题和概念
      '过拟合', '欠拟合', '交叉验证', '正则化', '归一化',
      '批量', '梯度', '权重', '偏置', '激活',
      // 英文关键词
      'machine learning', 'deep learning', 'neural network', 'algorithm',
      'model', 'training', 'gradient descent', 'backpropagation',
      'overfitting', 'underfitting', 'cross validation', 'regularization',
      'classification', 'regression', 'clustering', 'feature',
      'optimization', 'loss function', 'activation function'
    ];

    // 价格指数领域关键词（更全面）
    const priceIndexKeywords = [
      // 基础概念
      '价格指数', '物价', '价格', '指数', '统计',
      // 具体指数
      'CPI', 'PPI', '消费价格', '生产价格', '消费者价格',
      '居民消费', '工业生产', '农产品', '食品',
      // 经济概念
      '通胀', '通缩', '通胀率', '增长率', '同比', '环比',
      '经济', '宏观', '微观', '市场', '商品',
      // 时间相关
      '月度', '季度', '年度', '最近', '过去', '趋势',
      '一个月', '三个月', '半年', '一年',
      // 英文关键词
      'price index', 'inflation', 'deflation', 'consumer price',
      'producer price', 'economic', 'market', 'commodity'
    ];

    // 1. 计算关键词匹配分数
    const mlScore = this.calculateKeywordScore(lowerQuery, mlKeywords);
    const priceScore = this.calculateKeywordScore(lowerQuery, priceIndexKeywords);
    
    // 选择最高分数的数据集
    const bestScore = Math.max(mlScore, priceScore);
    const bestDataset = mlScore > priceScore ? 'machine_learning' : 'price_index_statistics';
    
    // 2. 置信度判断
    if (bestScore > 0.6) {
      return {
        dataset: bestDataset,
        confidence: Math.min(bestScore, 0.95),
        reasoning: `关键词匹配 (得分: ${bestScore.toFixed(2)})`,
      };
    }
    
    // 3. LLM智能分类
    try {
      console.log(`关键词匹配分数较低 (${bestScore.toFixed(2)})，使用LLM分类`);
      const llmResult = await this.llmClassifier.classify(query);
      
      return {
        dataset: llmResult.dataset,
        confidence: llmResult.confidence,
        reasoning: `LLM智能分类: ${llmResult.reasoning}`,
      };
    } catch (error) {
      console.error('LLM分类失败，使用默认数据集:', error);
      
      // 4. 容错：LLM不可用时使用默认数据集
      return {
        dataset: 'price_index_statistics',
        confidence: 0.4,
        reasoning: `LLM服务异常，使用默认数据集: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 计算关键词匹配分数
   */
  private calculateKeywordScore(query: string, keywords: string[]): number {
    let score = 0;
    let matches = 0;

    for (const keyword of keywords) {
      if (query.includes(keyword.toLowerCase())) {
        matches++;
        // 长关键词给更高权重
        const weight = keyword.length > 5 ? 0.15 : 0.1;
        score += weight;
      }
    }

    // 如果有多个关键词匹配，给额外加分
    if (matches > 1) {
      score += matches * 0.05;
    }

    return Math.min(score, 1.0);
  }


  /**
   * 执行查询
   */
  private async executeQuery(query: string, dataset: DatasetKey): Promise<string> {
    try {
      const index = await this.vectorStoreService.getIndex(dataset);
      const queryEngine = index.asQueryEngine({
        retriever: index.asRetriever({ 
          similarityTopK: 5 
        }),
      });

      const response = await queryEngine.query({ query });
      return response.toString();
    } catch (error) {
      console.error(`❌ 查询数据集 ${dataset} 失败:`, error);
      
      if (error instanceof Error) {
        return `❌ 查询失败：${error.message}`;
      }
      return `❌ 查询失败：未知错误`;
    }
  }

  /**
   * 跨数据集查询
   */
  async crossDatasetQuery(query: string, datasets?: DatasetKey[]): Promise<RouterResponse[]> {
    const targetDatasets = datasets || (['machine_learning', 'price_index_statistics'] as DatasetKey[]);
    const results: RouterResponse[] = [];

    for (const dataset of targetDatasets) {
      try {
        const response = await this.executeQuery(query, dataset);
        results.push({
          response,
          selectedDataset: DATASET_CONFIGS[dataset].description,
          routingReason: `跨数据集查询 - ${dataset}`,
          confidence: 0.8,
        });
      } catch (error) {
        console.error(`❌ 跨数据集查询失败 (${dataset}):`, error);
      }
    }

    return results;
  }
}