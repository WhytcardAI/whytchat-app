// Shared types for NewConversation components

export type TemplateType =
  | "general"
  | "coding"
  | "learning"
  | "brainstorm"
  | "writing"
  | "analysis"
  | "custom";

export type ToneType =
  | "neutral"
  | "polite"
  | "enthusiastic"
  | "professional"
  | "casual"
  | "concise"
  | "detailed";

export type CodeLanguageType =
  | "any"
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "csharp"
  | "cpp"
  | "rust"
  | "go"
  | "php";

export type CodeStyleType =
  | "concise"
  | "detailed"
  | "production"
  | "educational";

export type LearningLevelType = "beginner" | "intermediate" | "advanced";

export type LearningStyleType =
  | "simple"
  | "detailed"
  | "practical"
  | "theoretical";

export type BrainstormTypeType =
  | "divergent"
  | "convergent"
  | "lateral"
  | "analytical";

export type BrainstormFormatType =
  | "list"
  | "mindmap"
  | "structured"
  | "freeform";

export type WritingTypeType =
  | "email"
  | "article"
  | "report"
  | "creative"
  | "technical"
  | "marketing";

export type WritingToneType =
  | "formal"
  | "casual"
  | "persuasive"
  | "informative"
  | "creative";

export type AnalysisDepthType = "overview" | "detailed" | "comprehensive";

export type AnalysisFormatType = "summary" | "structured" | "datadriven";

export type PresetMeta = {
  id: string;
  labelKey: string;
  descKey: string;
  useCases?: string[];
};

export type ModelInfo = {
  ram: string;
  size: string;
  badge: "fast" | "balanced" | "powerful";
};

// Model information lookup table
export function getModelInfo(presetId: string): ModelInfo {
  const modelData: Record<string, ModelInfo> = {
    // Light models (~2GB)
    llama32_3b_light: { ram: "4 GB", size: "~2.0 GB", badge: "fast" },
    qwen_coder_1_5b_light: { ram: "3 GB", size: "~1.0 GB", badge: "fast" },
    // Balanced models (~4-5GB)
    mistral_balanced: { ram: "6 GB", size: "~4.1 GB", badge: "balanced" },
    qwen_coder_fast: { ram: "6 GB", size: "~4.8 GB", badge: "balanced" },
    openhermes_balanced: { ram: "6 GB", size: "~4.1 GB", badge: "balanced" },
    nous_hermes_balanced: { ram: "6 GB", size: "~4.1 GB", badge: "balanced" },
    // Heavy models (5-10GB)
    llama31_8b_heavy: { ram: "8 GB", size: "~5.7 GB", badge: "powerful" },
    wizardlm_heavy: { ram: "8 GB", size: "~5.4 GB", badge: "powerful" },
    dolphin_heavy: { ram: "8 GB", size: "~5.4 GB", badge: "powerful" },
    qwen_coder_14b_heavy: {
      ram: "12 GB",
      size: "~9.8 GB",
      badge: "powerful",
    },
    // New 2025 SOTA models
    qwen25_7b_balanced: { ram: "6 GB", size: "~4.8 GB", badge: "balanced" },
    qwen25_32b_heavy: { ram: "20 GB", size: "~18.5 GB", badge: "powerful" },
    llama33_70b_powerful: {
      ram: "48 GB",
      size: "~40 GB",
      badge: "powerful",
    },
    mistral_small3_balanced: {
      ram: "16 GB",
      size: "~14 GB",
      badge: "balanced",
    },
  };
  return (
    modelData[presetId] || { ram: "6 GB", size: "~5 GB", badge: "balanced" }
  );
}
