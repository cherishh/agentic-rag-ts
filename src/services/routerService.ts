import {
  QueryEngineTool,
  RouterQueryEngine,
} from 'llamaindex';
import {
  ResponseSynthesizer,
  SimpleResponseBuilder,
} from 'llamaindex/synthesizers';
import { VectorStoreService, DatasetKey } from './vectorStore';

// Custom prompt template for handling tabular data
const TABLE_CONTEXT_PROMPT = (context: string, query: string) => `
Context information is below.
---------------------
${context}
---------------------
Given the context information and not prior knowledge, answer the query.
The context contains comma-separated table data. To answer the query, you must:
1.  Find the row that matches the metric in the query (e.g., '居民消费价格指数' for a CPI query).
2.  Find the column that matches the date in the query (e.g., '2025年4月').
3.  Extract the value at the intersection of the identified row and column.
4.  If a precise value is found, state it directly. If not, say you cannot find the specific data.

Query: ${query}
Answer:
`;

/**
 * Service for creating and managing the RouterQueryEngine.
 * This engine is a "knowledge base expert" that selects the appropriate
 * dataset (QueryEngineTool) to answer a query.
 */
export class RouterService {
  constructor(private vectorStoreService: VectorStoreService) {}

  /**
   * Creates the RouterQueryEngine which acts as a specialized agent
   * for querying knowledge bases.
   * @returns A configured RouterQueryEngine instance.
   */
  async createRouterEngine() {
    console.log('🔄 Creating Router Engine...');

    const machineLearningTool = await this.createQueryEngineTool(
      'machine_learning',
      'This tool can answer detailed questions about machine learning, deep learning, algorithms like logistic regression, gradient descent, and related course content.'
    );

    const priceIndexTool = await this.createQueryEngineTool(
      'price_index_statistics',
      'This tool can answer questions about price index statistics, Consumer Price Index (CPI), Producer Price Index (PPI), and other macroeconomic data.'
    );

    const routerEngine = new RouterQueryEngine({
      queryEngineTools: [machineLearningTool, priceIndexTool],
    });

    console.log('✅ Router Engine created successfully.');
    return routerEngine;
  }

  /**
   * Helper method to create a QueryEngineTool for a specific dataset.
   * @param dataset The key of the dataset.
   * @param description The description for the tool.
   * @returns A configured QueryEngineTool.
   */
  private async createQueryEngineTool(
    dataset: DatasetKey,
    description: string
  ): Promise<QueryEngineTool> {
    const index = await this.vectorStoreService.getIndex(dataset);

    // Default query engine
    let queryEngine = index.asQueryEngine();

    // If the dataset is the one with tabular data, apply the custom prompt
    if (dataset === 'price_index_statistics') {
      const responseSynthesizer = new ResponseSynthesizer({
        responseBuilder: new SimpleResponseBuilder({ textQATemplate: TABLE_CONTEXT_PROMPT }),
      });

      queryEngine = index.asQueryEngine({
        responseSynthesizer,
      });
    }

    return new QueryEngineTool({
      queryEngine,
      metadata: {
        name: `${dataset}_query_tool`,
        description,
      },
    });
  }
}
