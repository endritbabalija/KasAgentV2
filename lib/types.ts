import type { InferUITools, UIMessage } from "ai";
import type { aiTools } from "./ai/tools";

// Infer all tool types from the actual tools object
export type ChatTools = InferUITools<typeof aiTools>;

// Custom data types for dataStream.write() — extend as tools adopt factory pattern
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type CustomUIDataTypes = {};

// Fully typed message used across client components
export type ChatMessage = UIMessage<unknown, CustomUIDataTypes, ChatTools>;
