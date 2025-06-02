import 'dotenv/config';
import { agent, agentStreamEvent } from '@llamaindex/workflow';
import { tool, Settings } from 'llamaindex';
import { OpenAI } from '@llamaindex/openai';
import { z } from 'zod';
import { multiplyNumbers, sumNumbers } from './tools';

Settings.llm = new OpenAI({
  model: 'gpt-4o-mini',
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

const multiplyTool = tool({
  name: 'multiply',
  description: 'Use this function to multiply two numbers',
  parameters: z.object({
    a: z.number({ description: 'First number to multiply' }),
    b: z.number({ description: 'Second number to multiply' }),
  }),
  execute: multiplyNumbers,
});

async function main() {
  const tools = [addTool, multiplyTool];
  const myAgent = agent({ tools });
  const response = await myAgent.runStream('What is 1 + 1? and 2 * 2?');
  const events = myAgent.runStream('Add 101 and 303');
  for await (const event of events) {
    if (agentStreamEvent.include(event)) {
      process.stdout.write(event.data.delta);
    } else {
      console.log('\nWorkflow event:', JSON.stringify(event, null, 2));
    }
  }
  // console.log(events);
}
main().catch(console.error);
