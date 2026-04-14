interface KnowledgeEnrichmentPromptBundle {
  system: string;
  user: string;
}

interface KnowledgeEnrichmentResponseApiShape {
  output_text?: string;
  error?: {
    message?: string;
  };
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
}

interface KnowledgeEnrichmentChatCompletionApiShape {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
            type?: string;
          }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface KnowledgeEnrichmentConfig {
  maxOutputTokens: number;
  model: string;
  promptVersion: string;
  provider: "openai";
  retryAttempts: number;
  retryBackoffMs: number;
  temperature: number;
  timeoutMs: number | null;
}

export interface KnowledgeEnrichmentModelInput {
  author: string | null;
  canonicalUrl: string | null;
  contentText: string | null;
  id: string;
  language: string | null;
  publishedAt: string | null;
  sourceTopic: string | null;
  title: string | null;
}

export interface KnowledgeEnrichmentOutput {
  classification: {
    label: string;
    topic: string | null;
  };
  importanceScore: number;
  keyPoints: string[];
  noteDraft: string | null;
  noveltyScore: number;
  preserveRecommendation: "discard" | "keep" | "review";
  summary: {
    long: string | null;
    short: string;
  };
  tags: string[];
  whyItMatters: string;
}

export interface KnowledgeEnrichmentResult {
  config: KnowledgeEnrichmentConfig;
  output: KnowledgeEnrichmentOutput;
}

export type KnowledgeEnrichmentRunner = (input: {
  config: KnowledgeEnrichmentConfig;
  item: KnowledgeEnrichmentModelInput;
}) => Promise<KnowledgeEnrichmentResult>;

const DEFAULT_KNOWLEDGE_ENRICHMENT_TIMEOUT_MS = 15_000;
const GLM_KNOWLEDGE_ENRICHMENT_TIMEOUT_MS = 60_000;

const DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG: KnowledgeEnrichmentConfig = {
  maxOutputTokens: 900,
  model: "gpt-4o-mini-2024-07-18",
  promptVersion: "v1",
  provider: "openai",
  retryAttempts: 1,
  retryBackoffMs: 250,
  temperature: 0.2,
  timeoutMs: DEFAULT_KNOWLEDGE_ENRICHMENT_TIMEOUT_MS,
};

const KNOWLEDGE_ENRICHMENT_OUTPUT_SCHEMA = {
  additionalProperties: false,
  properties: {
    classification: {
      additionalProperties: false,
      properties: {
        label: { type: "string" },
        topic: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
      },
      required: ["label", "topic"],
      type: "object",
    },
    importance_score: { maximum: 1, minimum: 0, type: "number" },
    key_points: {
      items: { type: "string" },
      maxItems: 5,
      minItems: 3,
      type: "array",
    },
    note_draft: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    novelty_score: { maximum: 1, minimum: 0, type: "number" },
    preserve_recommendation: {
      enum: ["keep", "discard", "review"],
      type: "string",
    },
    summary: {
      additionalProperties: false,
      properties: {
        long: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        short: { type: "string" },
      },
      required: ["short", "long"],
      type: "object",
    },
    tags: {
      items: { type: "string" },
      maxItems: 8,
      minItems: 1,
      type: "array",
    },
    why_it_matters: { type: "string" },
  },
  required: [
    "summary",
    "key_points",
    "classification",
    "tags",
    "importance_score",
    "novelty_score",
    "why_it_matters",
    "preserve_recommendation",
    "note_draft",
  ],
  type: "object",
} as const;

const KNOWLEDGE_ENRICHMENT_OUTPUT_TEMPLATE = JSON.stringify(
  {
    classification: {
      label: "string",
      topic: "string|null",
    },
    importance_score: 0.42,
    key_points: ["string", "string", "string"],
    note_draft: "string|null",
    novelty_score: 0.37,
    preserve_recommendation: "keep|discard|review",
    summary: {
      long: "string|null",
      short: "string",
    },
    tags: ["string"],
    why_it_matters: "string",
  },
  null,
  2,
);

export class KnowledgeEnrichmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeEnrichmentConfigurationError";
  }
}

export class KnowledgeEnrichmentOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeEnrichmentOutputError";
  }
}

export async function enrichItemWithModel(
  input: {
    config?: Partial<KnowledgeEnrichmentConfig>;
    item: KnowledgeEnrichmentModelInput;
  },
  runner: KnowledgeEnrichmentRunner = runKnowledgeEnrichment,
): Promise<KnowledgeEnrichmentResult> {
  const config = resolveKnowledgeEnrichmentConfig(input.config);

  return runner({
    config,
    item: input.item,
  });
}

export function resolveKnowledgeEnrichmentConfig(
  overrides: Partial<KnowledgeEnrichmentConfig> = {},
  environment: NodeJS.ProcessEnv = process.env,
): KnowledgeEnrichmentConfig {
  const provider = readProvider(environment.KNOWLEDGE_ENRICHMENT_PROVIDER);
  const model = readString(environment.KNOWLEDGE_ENRICHMENT_MODEL, DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.model);
  const baseUrl = resolveOpenAiBaseUrl(environment.KNOWLEDGE_ENRICHMENT_BASE_URL);
  const promptVersion = readString(
    environment.KNOWLEDGE_ENRICHMENT_PROMPT_VERSION,
    DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.promptVersion,
  );
  const temperature = readNumber(
    environment.KNOWLEDGE_ENRICHMENT_TEMPERATURE,
    DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.temperature,
  );
  const maxOutputTokens = readInteger(
    environment.KNOWLEDGE_ENRICHMENT_MAX_OUTPUT_TOKENS,
    DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.maxOutputTokens,
  );
  const timeoutDefault = resolveKnowledgeEnrichmentTimeoutDefault({
    baseUrl,
    model,
    provider,
  });
  const timeoutMs = resolveKnowledgeEnrichmentTimeoutMs({
    timeoutDefault,
    value: environment.KNOWLEDGE_ENRICHMENT_TIMEOUT_MS,
  });
  const retryAttempts = readInteger(
    environment.KNOWLEDGE_ENRICHMENT_RETRY_ATTEMPTS,
    DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.retryAttempts,
  );
  const retryBackoffMs = readInteger(
    environment.KNOWLEDGE_ENRICHMENT_RETRY_BACKOFF_MS,
    DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.retryBackoffMs,
  );

  return {
    maxOutputTokens: overrides.maxOutputTokens ?? maxOutputTokens,
    model: overrides.model ?? model,
    promptVersion: overrides.promptVersion ?? promptVersion,
    provider: overrides.provider ?? provider,
    retryAttempts: overrides.retryAttempts ?? retryAttempts,
    retryBackoffMs: overrides.retryBackoffMs ?? retryBackoffMs,
    temperature: overrides.temperature ?? temperature,
    timeoutMs: overrides.timeoutMs ?? timeoutMs,
  };
}

function resolveKnowledgeEnrichmentTimeoutDefault(input: {
  baseUrl: URL;
  model: string;
  provider: KnowledgeEnrichmentConfig["provider"];
}) {
  if (input.provider !== "openai") {
    return DEFAULT_KNOWLEDGE_ENRICHMENT_TIMEOUT_MS;
  }

  const hostname = input.baseUrl.hostname.toLowerCase();
  const normalizedModel = input.model.trim().toLowerCase();
  const usesGlmEndpoint = hostname === "open.bigmodel.cn" || hostname.endsWith(".bigmodel.cn");
  const usesGlmModel = normalizedModel.startsWith("glm-");

  if (usesGlmEndpoint || usesGlmModel) {
    return GLM_KNOWLEDGE_ENRICHMENT_TIMEOUT_MS;
  }

  return DEFAULT_KNOWLEDGE_ENRICHMENT_TIMEOUT_MS;
}

function resolveKnowledgeEnrichmentTimeoutMs(input: {
  timeoutDefault: number | null;
  value: string | undefined;
}) {
  const configuredTimeout = readOptionalInteger(input.value, input.timeoutDefault);

  if (
    configuredTimeout === DEFAULT_KNOWLEDGE_ENRICHMENT_TIMEOUT_MS &&
    typeof input.timeoutDefault === "number" &&
    input.timeoutDefault > configuredTimeout
  ) {
    return input.timeoutDefault;
  }

  return configuredTimeout;
}

export async function runKnowledgeEnrichment(input: {
  config: KnowledgeEnrichmentConfig;
  item: KnowledgeEnrichmentModelInput;
}): Promise<KnowledgeEnrichmentResult> {
  if (input.config.provider !== "openai") {
    throw new KnowledgeEnrichmentConfigurationError(
      `Knowledge enrichment provider ${input.config.provider} is not supported.`,
    );
  }

  return runOpenAiKnowledgeEnrichment(input);
}

function buildKnowledgeEnrichmentPrompts(input: {
  item: KnowledgeEnrichmentModelInput;
  promptVersion: string;
}): KnowledgeEnrichmentPromptBundle {
  if (input.promptVersion !== "v1") {
    throw new KnowledgeEnrichmentConfigurationError(
      `Knowledge enrichment prompt version ${input.promptVersion} is not supported.`,
    );
  }

  return {
    system: [
      "You are the Knowledge Layer enrichment model for Signal Inbox.",
      "Operate only on normalized Item data that has already passed capture and normalization.",
      "Return structured JSON that matches the provided schema exactly.",
      "Do not mention raw connectors, raw assets, HTML payloads, or extraction internals.",
      "The summary must be concise and product-ready.",
      "summary.short must stand on its own and must not repeat the title verbatim.",
      "Do not format summary.short as 'Title: ...', 'Title - ...', or a title-only label.",
      "The key_points array must contain 3 to 5 specific takeaways.",
      "Scores must be numbers between 0 and 1.",
      "Use preserve_recommendation=keep only when the item is worth preserving into Knowledge.",
      `Return this exact JSON shape: ${KNOWLEDGE_ENRICHMENT_OUTPUT_TEMPLATE}`,
    ].join("\n"),
    user: JSON.stringify(
      {
        item: {
          author: input.item.author,
          canonical_url: input.item.canonicalUrl,
          content_text: input.item.contentText,
          id: input.item.id,
          language: input.item.language,
          published_at: input.item.publishedAt,
          source_topic: input.item.sourceTopic,
          title: input.item.title,
        },
      },
      null,
      2,
    ),
  };
}

function ensureString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new KnowledgeEnrichmentOutputError(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new KnowledgeEnrichmentOutputError(`${fieldName} must not be empty.`);
  }

  return trimmed;
}

function ensureNullableString(value: unknown, fieldName: string) {
  if (value === null) {
    return null;
  }

  return ensureString(value, fieldName);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ensureKnowledgeEnrichmentSummaryShort(input: {
  item: Pick<KnowledgeEnrichmentModelInput, "title">;
  summaryShort: string;
}) {
  const summaryShort = normalizeWhitespace(input.summaryShort);
  const title = normalizeWhitespace(input.item.title ?? "");

  if (!title) {
    return summaryShort;
  }

  if (summaryShort.localeCompare(title, undefined, { sensitivity: "accent" }) === 0) {
    throw new KnowledgeEnrichmentOutputError(
      "summary.short must not repeat the item title verbatim.",
    );
  }

  const repeatedTitlePattern = new RegExp(`^${escapeRegExp(title)}\\s*[:\\-\\u2013\\u2014]\\s+`, "i");

  if (repeatedTitlePattern.test(summaryShort)) {
    throw new KnowledgeEnrichmentOutputError(
      "summary.short must not repeat the item title as a prefixed label.",
    );
  }

  return summaryShort;
}

function ensureScore(value: unknown, fieldName: string) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
    throw new KnowledgeEnrichmentOutputError(`${fieldName} must be a number between 0 and 1.`);
  }

  return Number(value.toFixed(2));
}

function ensureStringArray(
  value: unknown,
  fieldName: string,
  constraints?: { maxLength?: number; minLength?: number },
) {
  if (!Array.isArray(value)) {
    throw new KnowledgeEnrichmentOutputError(`${fieldName} must be an array of strings.`);
  }

  if (constraints?.minLength !== undefined && value.length < constraints.minLength) {
    throw new KnowledgeEnrichmentOutputError(
      `${fieldName} must contain at least ${constraints.minLength} entries.`,
    );
  }

  if (constraints?.maxLength !== undefined && value.length > constraints.maxLength) {
    throw new KnowledgeEnrichmentOutputError(
      `${fieldName} must contain at most ${constraints.maxLength} entries.`,
    );
  }

  return value.map((entry, index) => ensureString(entry, `${fieldName}[${index}]`));
}

function extractOutputText(response: KnowledgeEnrichmentResponseApiShape) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const fallbackText = response.output
    ?.flatMap((entry) => entry.content ?? [])
    .map((entry) => (entry.type === "output_text" || entry.type === "text" ? entry.text : null))
    .find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  return fallbackText ?? null;
}

function extractChatCompletionText(response: KnowledgeEnrichmentChatCompletionApiShape) {
  const messageContent = response.choices?.[0]?.message?.content;

  if (typeof messageContent === "string" && messageContent.trim()) {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return (
      messageContent
        .map((entry) => (entry.type === "output_text" || entry.type === "text" ? entry.text : null))
        .find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) ?? null
    );
  }

  return null;
}

async function readJsonBody(response: Response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return null;
  }
}

function parseKnowledgeEnrichmentOutput(value: unknown): KnowledgeEnrichmentOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new KnowledgeEnrichmentOutputError("Knowledge enrichment output must be an object.");
  }

  const record = value as Record<string, unknown>;
  const summary = record.summary;
  const classification = record.classification;

  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    throw new KnowledgeEnrichmentOutputError("summary must be an object.");
  }

  if (!classification || typeof classification !== "object" || Array.isArray(classification)) {
    throw new KnowledgeEnrichmentOutputError("classification must be an object.");
  }

  const summaryRecord = summary as Record<string, unknown>;
  const classificationRecord = classification as Record<string, unknown>;
  const preserveRecommendation = record.preserve_recommendation;

  if (
    preserveRecommendation !== "discard" &&
    preserveRecommendation !== "keep" &&
    preserveRecommendation !== "review"
  ) {
    throw new KnowledgeEnrichmentOutputError(
      "preserve_recommendation must be one of discard, keep, or review.",
    );
  }

  return {
    classification: {
      label: ensureString(classificationRecord.label, "classification.label"),
      topic: ensureNullableString(classificationRecord.topic, "classification.topic"),
    },
    importanceScore: ensureScore(record.importance_score, "importance_score"),
    keyPoints: ensureStringArray(record.key_points, "key_points", {
      maxLength: 5,
      minLength: 3,
    }),
    noteDraft: ensureNullableString(record.note_draft, "note_draft"),
    noveltyScore: ensureScore(record.novelty_score, "novelty_score"),
    preserveRecommendation,
    summary: {
      long: ensureNullableString(summaryRecord.long, "summary.long"),
      short: ensureString(summaryRecord.short, "summary.short"),
    },
    tags: ensureStringArray(record.tags, "tags", {
      maxLength: 8,
      minLength: 1,
    }),
    whyItMatters: ensureString(record.why_it_matters, "why_it_matters"),
  };
}

export function validateKnowledgeEnrichmentOutput(value: unknown): KnowledgeEnrichmentOutput {
  return parseKnowledgeEnrichmentOutput(value);
}

function buildResponseFormats(baseUrl: URL) {
  const jsonSchemaFormat = {
    responseFormat: {
      json_schema: {
        name: "knowledge_enrichment",
        schema: KNOWLEDGE_ENRICHMENT_OUTPUT_SCHEMA,
        strict: true,
      },
      type: "json_schema",
    },
    type: "json_schema" as const,
  };
  const jsonObjectFormat = {
    responseFormat: {
      type: "json_object",
    },
    type: "json_object" as const,
  };

  return baseUrl.hostname === "api.openai.com"
    ? [jsonSchemaFormat, jsonObjectFormat]
    : [jsonObjectFormat, jsonSchemaFormat];
}

function buildProviderSpecificRequestFields(baseUrl: URL) {
  return baseUrl.hostname === "api.openai.com"
    ? {}
    : {
        thinking: {
          type: "disabled",
        },
      };
}

async function runOpenAiKnowledgeEnrichment(input: {
  config: KnowledgeEnrichmentConfig;
  item: KnowledgeEnrichmentModelInput;
}): Promise<KnowledgeEnrichmentResult> {
  const apiKey = process.env.KNOWLEDGE_ENRICHMENT_API_KEY?.trim();
  const baseUrl = resolveOpenAiBaseUrl(process.env.KNOWLEDGE_ENRICHMENT_BASE_URL);

  if (!apiKey) {
    throw new KnowledgeEnrichmentConfigurationError(
      "KNOWLEDGE_ENRICHMENT_API_KEY must be set for model-backed knowledge enrichment.",
    );
  }

  const prompts = buildKnowledgeEnrichmentPrompts({
    item: input.item,
    promptVersion: input.config.promptVersion,
  });
  const responseFormats = buildResponseFormats(baseUrl);
  const providerSpecificRequestFields = buildProviderSpecificRequestFields(baseUrl);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= input.config.retryAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId =
      input.config.timeoutMs === null
        ? null
        : setTimeout(() => controller.abort(), input.config.timeoutMs);

    try {
      for (const format of responseFormats) {
        const response = await fetch(new URL("chat/completions", baseUrl), {
          body: JSON.stringify({
            max_tokens: input.config.maxOutputTokens,
            messages: [
              {
                content: prompts.system,
                role: "system",
              },
              {
                content: prompts.user,
                role: "user",
              },
            ],
            model: input.config.model,
            response_format: format.responseFormat,
            temperature: input.config.temperature,
            ...providerSpecificRequestFields,
          }),
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });
        const responseJson = (await readJsonBody(response)) as KnowledgeEnrichmentChatCompletionApiShape | null;

        if (!response.ok) {
          const errorMessage = responseJson?.error?.message;
          const error = new Error(
            errorMessage
              ? `OpenAI-compatible knowledge enrichment failed: ${errorMessage}`
              : `OpenAI-compatible knowledge enrichment failed with status ${response.status}.`,
          );

          lastError = error;
          continue;
        }

        const outputText = responseJson ? extractChatCompletionText(responseJson) : null;

        if (!outputText) {
          lastError = new KnowledgeEnrichmentOutputError(
            "OpenAI-compatible knowledge enrichment returned no structured output text.",
          );
          continue;
        }

        try {
          const output = validateKnowledgeEnrichmentOutput(JSON.parse(outputText) as unknown);

          ensureKnowledgeEnrichmentSummaryShort({
            item: input.item,
            summaryShort: output.summary.short,
          });

          return {
            config: input.config,
            output,
          };
        } catch (error) {
          lastError = error;

          if (format.type === "json_schema") {
            continue;
          }

          throw error;
        }
      }
    } catch (error) {
      lastError = error;

      if (attempt >= input.config.retryAttempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, input.config.retryBackoffMs));
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OpenAI knowledge enrichment failed.");
}

function resolveOpenAiBaseUrl(value: string | undefined) {
  if (!value?.trim()) {
    return new URL("https://api.openai.com/v1/");
  }

  try {
    const parsed = new URL(value);

    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }

    return parsed;
  } catch {
    throw new KnowledgeEnrichmentConfigurationError(
      `KNOWLEDGE_ENRICHMENT_BASE_URL ${value} is not a valid absolute URL.`,
    );
  }
}

function readInteger(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new KnowledgeEnrichmentConfigurationError(
      `Expected a non-negative integer, received ${value}.`,
    );
  }

  return parsedValue;
}

function readNumber(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    throw new KnowledgeEnrichmentConfigurationError(`Expected a number, received ${value}.`);
  }

  return parsedValue;
}

function readOptionalInteger(value: string | undefined, fallback: number | null) {
  if (!value?.trim()) {
    return fallback;
  }

  if (value === "null") {
    return null;
  }

  return readInteger(value, 0);
}

function readProvider(value: string | undefined): KnowledgeEnrichmentConfig["provider"] {
  if (!value?.trim()) {
    return DEFAULT_KNOWLEDGE_ENRICHMENT_CONFIG.provider;
  }

  if (value !== "openai") {
    throw new KnowledgeEnrichmentConfigurationError(
      `Knowledge enrichment provider ${value} is not supported.`,
    );
  }

  return value;
}

function readString(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

export const aiPackage = {
  name: "@signal-inbox/ai",
  responsibility: "Provider abstraction, prompts, and task routing.",
} as const;
