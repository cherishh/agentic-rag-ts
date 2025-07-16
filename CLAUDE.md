# CLAUDE.md

## Principles
1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the `todo.md` file with a summary of the changes you made and any other relevant information.


## Development Commands

### Primary Commands
- `bun run server` - Start API server (production mode)
- `bun run server:watch` - Start API server with auto-reload (development)
- `bun run server:prod` - Start API server in production mode with NODE_ENV=production
- `bun run dev` - Run CLI demo/main functionality
- `bun run dev:watch` - Run CLI demo with auto-reload
- `bun run build` - Build the application to ./out directory
- `bun run clean` - Clean build artifacts
- `bun run test:vectorstore` - Run vector store tests

### Testing
- `node test-api.js` - Test API endpoints (requires server to be running)

## Architecture Overview

This is an **Agentic RAG (Retrieval-Augmented Generation)** application built with TypeScript, using:
- **LlamaIndex.TS** as the RAG framework
- **Qdrant Cloud** as the vector database
- **OpenAI** for LLM and embeddings
- **Hono** for REST API server
- **Bun** as runtime and package manager

### Core Components

1. **Application Layer** (`src/app.ts`): Main RAGApplication class that orchestrates all services
2. **Services Layer**:
   - `vectorStore.ts` - Manages Qdrant vector database operations
   - `queryService.ts` - Handles basic RAG queries
   - `agentService.ts` - Manages agentic queries with tools (math, weather, RAG)
   - `weatherService.ts` - Weather API integration
3. **API Layer** (`src/api/`): Hono-based REST API with interactive documentation
4. **Configuration** (`src/config.ts`): Centralized configuration management

### Entry Points
- `src/index.ts` - API server entry point
- `src/main.ts` - CLI demo/development entry point
- `index.ts` - Root export file for SDK usage

## Dataset Management

Datasets are configured in `src/config.ts` under `DATASET_CONFIGS`:
- `machine_learning` - ML course transcripts (~390k characters)
- `price_index_statistics` - National statistics price index data

Current dataset is controlled by `CURRENT_DATASET` constant.

## Environment Variables Required

```
OPENAI_API_KEY=your_openai_api_key
OPENAI_EMBED_API_KEY=your_openai_embedding_api_key (optional, falls back to OPENAI_API_KEY)
QDRANT_URL=your_qdrant_cloud_url
QDRANT_API_KEY=your_qdrant_api_key
WEATHER_API_KEY=your_weather_api_key (optional, from weatherapi.com)
PORT=3000 (optional, default port for API server)
```

## Key Features

1. **Multi-modal Querying**: Basic RAG, agentic RAG with tools, cross-dataset queries
2. **Tool Integration**: Math operations, weather queries, knowledge retrieval
3. **Streaming Support**: Agent queries support streaming responses
4. **API & SDK**: Both REST API and direct SDK usage supported
5. **Health Monitoring**: Built-in health checks and dataset statistics

## API Server

When server runs:
- API Documentation: http://localhost:3000
- Health Check: http://localhost:3000/health  
- Status: http://localhost:3000/status

## Important Notes

- Uses **Bun** instead of Node.js/npm
- Configuration warns against using OpenRouter (no embedding/tool calling support)
- Chinese language support with UTF-8 encoded datasets
- Embedding model specifically chosen for Chinese text support
- Vector database operations are automatically managed (creation, connection, health checks)