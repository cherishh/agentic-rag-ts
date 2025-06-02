import 'dotenv/config';
import { agent, agentStreamEvent } from '@llamaindex/workflow';
import { tool, Settings } from 'llamaindex';
import { OpenAI } from '@llamaindex/openai';
import { z } from 'zod';
import { sumNumbers } from './tools';

Settings.llm = new OpenAI({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
});

const addTool = tool({
  name: 'sumNumbers',
  description: 'Use this function to sum two numbers',
  parameters: z.object({
    a: z.number({
      description: 'First number to sum',
    }),
    b: z.number({
      description: 'Second number to sum',
    }),
  }),
  execute: sumNumbers,
});

async function main() {
  const tools = [addTool];
  const myAgent = agent({ tools });
  const response = await myAgent.run('What is 1 + 1?');
  console.log(response);
}
main().catch(console.error);
