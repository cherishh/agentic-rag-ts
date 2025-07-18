import 'dotenv/config';

export const DATASET_CONFIGS = {
  machine_learning: {
    collectionName: 'machine_learning_documents',
    dataPath: './data/machine_learning_transcript',
    description: '机器学习课程内容',
  },
  price_index_statistics: {
    collectionName: 'price_index_statistics',
    dataPath: './data/price_index_statistics_utf8',
    description: '价格指数统计',
  },
} as const;

export const CURRENT_DATASET = 'price_index_statistics' as keyof typeof DATASET_CONFIGS;

export const QDRANT_CONFIG = {
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
};

// export const OPENAI_CONFIG = {
//   apiKey: process.env.OPENAI_API_KEY!,
//   model: 'openai/gpt-4o',
//   temperature: 0,
//   baseUrl: 'https://openrouter.ai/api/v1',
// };
export const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
  temperature: 0,
  baseUrl: 'https://api.openai.com/v1',
};

export const EMBEDDING_CONFIG = {
  apiKey: process.env.OPENAI_EMBED_API_KEY,
  model: 'text-embedding-3-small',
  baseUrl: 'https://api.openai.com/v1',
};

export const WEATHER_CONFIG = {
  // 使用weatherapi.com API
  // 注册免费账号：https://www.weatherapi.com/
  apiKey: process.env.WEATHER_API_KEY!,
  baseUrl: 'http://api.weatherapi.com/v1',
  defaultCity: '上海',
};

// 文档分块配置
export const CHUNKING_CONFIG = {
  chunkSize: 1024,
  chunkOverlap: 200,
  separator: '\n\n',
  paragraphSeparator: '\n',
};

// 检索配置
export const RETRIEVAL_CONFIG = {
  similarityTopK: 5,
};

// 日志配置
export const LOG_CONFIG = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
  enableConsole: process.env.LOG_CONSOLE !== 'false',
  enableTimestamp: process.env.LOG_TIMESTAMP !== 'false',
};
