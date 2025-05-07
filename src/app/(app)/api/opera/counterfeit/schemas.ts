import { z } from 'zod';

// --- Schemas ---

// --- Base Schemas needed for Message --- 

// Assuming a basic structure for Attachment based on common patterns
const AttachmentSchema = z.object({
  contentType: z.string().optional(),
  content: z.string().optional(), // Or potentially z.any() or a more specific schema
}).describe("Schema for message attachments.");

// Assuming a basic structure for Source based on common patterns
const LanguageModelV1SourceSchema = z.object({
  type: z.literal('source'),
  contentType: z.string().optional(),
  data: z.record(z.any()).optional(), // Placeholder for source data structure
}).describe("Schema for language model sources.");

// Inferred ToolInvocation structure based on usage in message-bubble.tsx and index.d.ts
export const ToolInvocationSchema = z.object({
  toolCallId: z.string().describe("Unique ID for the tool call."),
  toolName: z.string().describe("Name of the tool being called."),
  args: z.record(z.any()).optional().describe("Arguments passed to the tool."),
  state: z.enum(['call', 'result']).describe("Current state of the tool invocation."),
  result: z.any().optional().describe("Result returned by the tool."), // Could be more specific (e.g., string, object, image data)
}).describe("Schema for a tool invocation within a message part.");

// --- UIPart Schemas --- 

const TextUIPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
}).describe("Schema for a text part of a message.");

const ToolInvocationUIPartSchema = z.object({
  type: z.literal('tool-invocation'),
  toolInvocation: ToolInvocationSchema,
}).describe("Schema for a tool invocation part of a message.");

const SourceUIPartSchema = z.object({
  type: z.literal('source'),
  source: LanguageModelV1SourceSchema, // Placeholder for source schema
}).describe("Schema for a source part of a message.");

const FileUIPartSchema = z.object({
  type: z.literal('file'),
  mimeType: z.string(),
  data: z.string(), // Base64 encoded data typically
}).describe("Schema for a file part of a message.");

const StepStartUIPartSchema = z.object({
  type: z.literal('step-start'),
}).describe("Schema for a step boundary part of a message.");

// Union of all UIPart types
const UIPartSchema = z.union([
  TextUIPartSchema,
  ToolInvocationUIPartSchema,
  SourceUIPartSchema,
  FileUIPartSchema,
  StepStartUIPartSchema,
]).describe("Union schema for all possible message parts.");

// --- Schemas for Plan Steps (Moved Before MessageSchema) ---

export const PlanStepInstructionSchema = z.object({
  type: z.enum(['reason', 'browser', 'terminal', 'answer']).describe("The type of step to perform: reasoning, browser action, terminal action, or final answer."),
  instruction: z.string().describe("The detailed instruction for the specified type. For 'reason' and 'answer', this is the content itself."),
});

export const PlanStepResultSchema = z.string().describe("The textual report of executing a plan step. This can be a summary, an answer, or an error message.");

export const PlanStepSchema = z.object({
  step: z.number().describe("The step number."),
  instruction: PlanStepInstructionSchema,
  report: PlanStepResultSchema.describe("The textual report of executing the step's instruction."),
  invocations: z.array(ToolInvocationSchema).optional().describe("An array of tool invocations made during this step."),
});

// --- Main Message Schema --- 

export const MessageSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  content: z.string().describe("Fallback text content."),
  role: z.enum(['system', 'user', 'assistant', 'data']), // Keeping 'data' role as per original type
  annotations: z.array(z.any()).optional().describe("Server-added annotations."),
  parts: z.array(UIPartSchema).optional().describe("Structured parts of the message."),
  experimental_attachments: z.array(AttachmentSchema).optional(),
  plan: z.array(PlanStepSchema).optional().describe("The plan associated with this message, if any (typically for summary messages)."),
  // Omitting deprecated fields like reasoning, data, toolInvocations unless needed
}).describe("Schema representing a message with structured parts.");

// --- Counter Messages Schema (depends on PlanStepSchema and MessageSchema) ---

export const CounterMessagesSchema = z.object({
  plan: z.array(PlanStepSchema).describe("The sequence of steps planned and executed."),
  finalMessages: z.array(MessageSchema).describe("The final list of messages, including intermediate steps and results, structured for display."), // Use local MessageSchema
  step: z.number().describe("The latest step number executed or being executed."),
});

// --- Types ---
export type Attachment = z.infer<typeof AttachmentSchema>;
export type LanguageModelV1Source = z.infer<typeof LanguageModelV1SourceSchema>;
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;
export type TextUIPart = z.infer<typeof TextUIPartSchema>;
export type ToolInvocationUIPart = z.infer<typeof ToolInvocationUIPartSchema>;
export type SourceUIPart = z.infer<typeof SourceUIPartSchema>;
export type FileUIPart = z.infer<typeof FileUIPartSchema>;
export type StepStartUIPart = z.infer<typeof StepStartUIPartSchema>;
export type UIPart = z.infer<typeof UIPartSchema>;
export type Message = z.infer<typeof MessageSchema>;

export type PlanStepInstruction = z.infer<typeof PlanStepInstructionSchema>;
export type PlanStepResult = z.infer<typeof PlanStepResultSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export type CounterMessages = z.infer<typeof CounterMessagesSchema>; 