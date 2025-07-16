# Phase 1: Hierarchical Agent Refactoring

This plan outlines the steps to refactor the existing single-agent architecture into a two-layered "Master Agent + Router Engine" model.

## Todo

- [x] **1. Create Router Engine Service (`src/services/routerService.ts`)**
    - [x] Create the file `src/services/routerService.ts`.
    - [x] Define a `RouterService` class.
    - [x] Implement a method `createRouterEngine()` that:
        - Creates `QueryEngineTool` for `machine_learning`.
        - Creates `QueryEngineTool` for `price_index_statistics`.
        - Combines them using `RouterQueryEngine`.

- [x] **2. Refactor `agentService.ts` into Master Agent**
    - [x] Modify `agentService.ts` to import `RouterService`.
    - [x] Update the `createTools` method to build the Master Agent's toolset:
        - Keep simple tools (`sumNumbers`, `getWeather`).
        - Remove the old direct `queryTool`.
        - Add a new `knowledgeBaseTool` that executes a query against the `RouterEngine`.

- [x] **3. Integrate Services in `app.ts`**
    - [x] Instantiate the new `RouterService` in `app.ts`.
    - [x] Pass the `RouterService` instance to the `AgentService`.

- [x] **4. Verification**
    - [x] Test simple tool usage (weather, calculator) via the `/agent` endpoint.
    - [x] Test knowledge base routing for "machine learning" questions.
    - [x] Test knowledge base routing for "price index" questions.
    - [x] Observe server logs to confirm correct tool routing.

## Review

Phase 1 of the refactoring is complete. We have successfully transformed the application's architecture from a single, monolithic agent to a more intelligent, two-layered hierarchical model.

### Key Changes:

1.  **`RouterService` Created:** A new, specialized service (`src/services/routerService.ts`) was introduced. Its sole responsibility is to create and manage a `RouterQueryEngine`. This engine acts as a "knowledge base expert," intelligently selecting the correct dataset (`machine_learning` or `price_index_statistics`) based on the user's query.

2.  **`AgentService` Refactored to `Master Agent`:** The existing `agentService.ts` was significantly refactored. It no longer directly handles knowledge queries. Instead, it functions as a `Master Agent` that:
    *   Manages simple, direct-execution tools (like weather and calculator).
    *   Delegates complex, knowledge-based questions to the `RouterService` via a new `knowledgeBaseTool`.

3.  **Centralized Initialization:** The application's entry point (`app.ts`) was updated to orchestrate the initialization of the new services. It now ensures the `Master Agent` and its underlying `RouterEngine` are created and ready when the application starts.

### Outcome:

The system is now significantly more robust and scalable. The separation of concerns is much clearer:

-   The **Master Agent** handles high-level task dispatching.
-   The **Router Engine** handles specialized, content-based routing.

This new architecture performed successfully in all verification tests, correctly routing simple, machine learning, and price index queries to the appropriate tools. This lays a solid and essential foundation for Phase 2, where we will explore more advanced capabilities like cross-dataset querying and task decomposition.
