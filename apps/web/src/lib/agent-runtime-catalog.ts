export type RuntimeOption = {
  value: string;
  label: string;
};

export type RuntimeModel = RuntimeOption & {
  reasoningLevels: RuntimeOption[];
  defaultReasoningLevel?: string;
};

export type RuntimeProvider = RuntimeOption & {
  models: RuntimeModel[];
};

const standardReasoningLevels: RuntimeOption[] = [
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyen" },
  { value: "high", label: "Élevé" },
];

const extendedReasoningLevels: RuntimeOption[] = [
  ...standardReasoningLevels,
  { value: "xhigh", label: "Très élevé" },
  { value: "max", label: "Maximum" },
];

const openAiReasoningLevels: RuntimeOption[] = [
  ...extendedReasoningLevels,
  { value: "ultra", label: "Ultra" },
];

export const runtimeProviders: RuntimeProvider[] = [
  {
    value: "openai",
    label: "OpenAI",
    models: [
      {
        value: "gpt-5.6-sol",
        label: "GPT-5.6 Sol",
        reasoningLevels: openAiReasoningLevels,
        defaultReasoningLevel: "low",
      },
      {
        value: "gpt-5.6-terra",
        label: "GPT-5.6 Terra",
        reasoningLevels: openAiReasoningLevels,
        defaultReasoningLevel: "medium",
      },
    ],
  },
  {
    value: "anthropic",
    label: "Anthropic",
    models: [
      {
        value: "claude-fable-5",
        label: "Claude Fable 5",
        reasoningLevels: extendedReasoningLevels,
        defaultReasoningLevel: "high",
      },
      {
        value: "claude-opus-5",
        label: "Claude Opus 5",
        reasoningLevels: extendedReasoningLevels,
        defaultReasoningLevel: "high",
      },
      {
        value: "claude-sonnet-5",
        label: "Claude Sonnet 5",
        reasoningLevels: extendedReasoningLevels,
        defaultReasoningLevel: "high",
      },
      {
        value: "claude-haiku-4-5-20251001",
        label: "Claude Haiku 4.5",
        reasoningLevels: [],
      },
    ],
  },
  {
    value: "google",
    label: "Google Gemini",
    models: [
      {
        value: "gemini-3.6-flash",
        label: "Gemini 3.6 Flash",
        reasoningLevels: [
          { value: "medium", label: "Moyen" },
          { value: "high", label: "Élevé" },
        ],
        defaultReasoningLevel: "medium",
      },
      {
        value: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash-Lite",
        reasoningLevels: [
          { value: "minimal", label: "Minimal" },
          { value: "medium", label: "Moyen" },
          { value: "high", label: "Élevé" },
        ],
        defaultReasoningLevel: "minimal",
      },
    ],
  },
];

export function getRuntimeProvider(value: string): RuntimeProvider | undefined {
  return runtimeProviders.find((provider) => provider.value === value);
}

export function getRuntimeModel(
  providerValue: string,
  modelValue: string,
): RuntimeModel | undefined {
  return getRuntimeProvider(providerValue)?.models.find(
    (model) => model.value === modelValue,
  );
}
