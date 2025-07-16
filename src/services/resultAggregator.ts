import { Settings } from 'llamaindex';
import type { SubQueryResult } from './subAgentExecutor';

export interface AggregatedResult {
  originalQuery: string;
  finalResponse: string;
  subResults: SubQueryResult[];
  aggregationReasoning: string;
  executionSummary: {
    totalSubQueries: number;
    successfulQueries: number;
    failedQueries: number;
    totalExecutionTime: number;
  };
}

export class ResultAggregator {
  /**
   * 聚合多个子查询结果
   */
  async aggregateResults(originalQuery: string, subResults: SubQueryResult[]): Promise<AggregatedResult> {
    // 如果只有一个子查询结果，直接返回
    if (subResults.length === 1) {
      const singleResult = subResults[0]!;
      return {
        originalQuery,
        finalResponse: singleResult.success ? singleResult.response : `❌ 查询失败: ${singleResult.error}`,
        subResults,
        aggregationReasoning: '单一查询，无需聚合',
        executionSummary: this.calculateExecutionSummary(subResults),
      };
    }

    // 多个子查询结果，需要LLM进行聚合
    try {
      const aggregatedResponse = await this.aggregateWithLLM(originalQuery, subResults);

      return {
        originalQuery,
        finalResponse: aggregatedResponse.response,
        subResults,
        aggregationReasoning: aggregatedResponse.reasoning,
        executionSummary: this.calculateExecutionSummary(subResults),
      };
    } catch (error) {
      // 聚合失败，使用简单的拼接方式
      const fallbackResponse = this.simpleFallbackAggregation(subResults);

      return {
        originalQuery,
        finalResponse: fallbackResponse,
        subResults,
        aggregationReasoning: `LLM聚合失败，使用简单拼接: ${error instanceof Error ? error.message : '未知错误'}`,
        executionSummary: this.calculateExecutionSummary(subResults),
      };
    }
  }

  /**
   * 使用LLM聚合多个子查询结果
   */
  private async aggregateWithLLM(
    originalQuery: string,
    subResults: SubQueryResult[]
  ): Promise<{ response: string; reasoning: string }> {
    const prompt = this.buildAggregationPrompt(originalQuery, subResults);

    const response = await Settings.llm.complete({
      prompt,
    });

    return this.parseAggregationResult(response.text);
  }

  /**
   * 构建聚合提示词
   */
  private buildAggregationPrompt(originalQuery: string, subResults: SubQueryResult[]): string {
    const successfulResults = subResults.filter(r => r.success);
    const failedResults = subResults.filter(r => !r.success);

    let resultsSection = '';

    if (successfulResults.length > 0) {
      resultsSection += '成功的查询结果：\n';
      successfulResults.forEach((result, index) => {
        resultsSection += `${index + 1}. ${result.type}查询: "${result.query}"\n`;
        resultsSection += `   回答: ${result.response}\n\n`;
      });
    }

    if (failedResults.length > 0) {
      resultsSection += '失败的查询：\n';
      failedResults.forEach((result, index) => {
        resultsSection += `${index + 1}. ${result.type}查询: "${result.query}"\n`;
        resultsSection += `   错误: ${result.error}\n\n`;
      });
    }

    return `你是一个智能回答聚合系统。请将多个子查询的结果整合成一个连贯、自然的回答。

原始用户查询: "${originalQuery}"

${resultsSection}

请根据以上查询结果，生成一个连贯的最终回答。要求：
1. 回答应该自然流畅，不要简单罗列结果
2. 如果有失败的查询，适当提及但不要过分强调
3. 保持专业和友好的语调
4. 确保回答完整地响应用户的原始查询

请返回JSON格式的结果：
{
  "response": "整合后的最终回答",
  "reasoning": "聚合决策的说明"
}

请只返回JSON格式的结果，不要包含其他内容：`;
  }

  /**
   * 解析聚合结果
   */
  private parseAggregationResult(response: string): { response: string; reasoning: string } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM响应中未找到有效的JSON格式');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.response) {
        throw new Error('LLM响应缺少必需的response字段');
      }

      return {
        response: parsed.response,
        reasoning: parsed.reasoning || '聚合完成',
      };
    } catch (error) {
      throw new Error(`解析聚合结果失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 简单的降级聚合方式
   */
  private simpleFallbackAggregation(subResults: SubQueryResult[]): string {
    const successfulResults = subResults.filter(r => r.success);
    const failedResults = subResults.filter(r => !r.success);

    let response = '';

    if (successfulResults.length > 0) {
      if (successfulResults.length === 1) {
        response = successfulResults[0]!.response;
      } else {
        response = successfulResults.map(r => r.response).join('\n\n');
      }
    }

    if (failedResults.length > 0) {
      if (response) {
        response += '\n\n';
      }
      response += `❌ 部分查询失败: ${failedResults.map(r => r.error).join(', ')}`;
    }

    return response || '❌ 所有查询都失败了';
  }

  /**
   * 计算执行摘要
   */
  private calculateExecutionSummary(subResults: SubQueryResult[]): AggregatedResult['executionSummary'] {
    const totalSubQueries = subResults.length;
    const successfulQueries = subResults.filter(r => r.success).length;
    const failedQueries = subResults.filter(r => !r.success).length;
    const totalExecutionTime = subResults.reduce((sum, r) => sum + (r.executionTime || 0), 0);

    return {
      totalSubQueries,
      successfulQueries,
      failedQueries,
      totalExecutionTime,
    };
  }
}
