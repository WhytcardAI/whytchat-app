import { useEffect } from "react";
import {
  CheckCircle,
  MessageCircle,
  Code,
  GraduationCap,
  FileText,
} from "lucide-react";
import { i18n } from "../../i18n";
import type {
  TemplateType,
  ToneType,
  CodeLanguageType,
  CodeStyleType,
  LearningLevelType,
  LearningStyleType,
  BrainstormTypeType,
  BrainstormFormatType,
  WritingTypeType,
  WritingToneType,
  AnalysisDepthType,
  AnalysisFormatType,
  PresetMeta,
} from "./types";
import { getModelInfo } from "./types";

type Props = {
  conversationName: string;
  setConversationName: (name: string) => void;
  selectedTemplate: TemplateType;
  handleTemplateChange: (template: TemplateType) => void;
  selectedTone: ToneType;
  setSelectedTone: (tone: ToneType) => void;
  codeLanguage: CodeLanguageType;
  setCodeLanguage: (lang: CodeLanguageType) => void;
  codeStyle: CodeStyleType;
  setCodeStyle: (style: CodeStyleType) => void;
  learningLevel: LearningLevelType;
  setLearningLevel: (level: LearningLevelType) => void;
  learningStyle: LearningStyleType;
  setLearningStyle: (style: LearningStyleType) => void;
  brainstormType: BrainstormTypeType;
  setBrainstormType: (type: BrainstormTypeType) => void;
  brainstormFormat: BrainstormFormatType;
  setBrainstormFormat: (format: BrainstormFormatType) => void;
  writingType: WritingTypeType;
  setWritingType: (type: WritingTypeType) => void;
  writingTone: WritingToneType;
  setWritingTone: (tone: WritingToneType) => void;
  analysisDepth: AnalysisDepthType;
  setAnalysisDepth: (depth: AnalysisDepthType) => void;
  analysisFormat: AnalysisFormatType;
  setAnalysisFormat: (format: AnalysisFormatType) => void;
  presets: PresetMeta[];
  selectedPreset: string;
  setSelectedPreset: (id: string) => void;
  installedPresets: Set<string>;
  busy: boolean;
  downloadStatus: "idle" | "downloading" | "done";
  downloadProgress: number | null;
  startDownload: () => void;
  importLocalModel: () => void;
  createConversation: () => void;
  dl: {
    filename: string;
    total?: number;
    written: number;
    status: string;
    error?: string | null;
  } | null;
};

export function SimpleModeView({
  conversationName,
  setConversationName,
  selectedTemplate,
  handleTemplateChange,
  selectedTone,
  setSelectedTone,
  codeLanguage,
  setCodeLanguage,
  codeStyle,
  setCodeStyle,
  learningLevel,
  setLearningLevel,
  learningStyle,
  setLearningStyle,
  brainstormType,
  setBrainstormType,
  brainstormFormat,
  setBrainstormFormat,
  writingType,
  setWritingType,
  writingTone,
  setWritingTone,
  analysisDepth,
  setAnalysisDepth,
  analysisFormat,
  setAnalysisFormat,
  presets,
  selectedPreset,
  setSelectedPreset,
  installedPresets,
  busy,
  downloadStatus,
  downloadProgress,
  startDownload,
  importLocalModel,
  createConversation,
  dl,
}: Props) {
  // Helper: Get model metadata
  // Filter presets based on selected template
  const filteredPresets = presets.filter((preset) => {
    if (!preset.useCases || preset.useCases.length === 0) return false; // Hide if no useCases defined
    return preset.useCases.includes(selectedTemplate);
  });

  // Auto-select best available model (prefer installed, then lightest)
  useEffect(() => {
    if (filteredPresets.length === 0) return;

    // Try to find an installed model first
    const installedFiltered = filteredPresets.filter((p) =>
      installedPresets.has(p.id),
    );
    if (installedFiltered.length > 0 && installedFiltered[0]) {
      setSelectedPreset(installedFiltered[0].id);
      return;
    }

    // Otherwise, select the lightest model (first in filtered list)
    if (filteredPresets[0]) {
      setSelectedPreset(filteredPresets[0].id);
    }
  }, [selectedTemplate, filteredPresets, installedPresets, setSelectedPreset]);

  return (
    <div className="space-y-3">
      {/* Intro explicative */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5">
        <p className="text-xs text-blue-800 dark:text-blue-400">
          {i18n.t("newConversation.simpleModeIntro")}
        </p>
      </div>

      {/* Étape 1: Nom de la conversation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
            1
          </div>
          <h3 className="text-sm font-semibold">
            {i18n.t("newConversation.conversationName")}
          </h3>
        </div>
        <input
          type="text"
          value={conversationName}
          onChange={(e) => setConversationName(e.target.value)}
          placeholder={i18n.t("newConversation.conversationNamePlaceholder")}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          disabled={busy}
        />
      </div>

      {/* Étape 2: Quel usage? */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
            2
          </div>
          <h3 className="text-sm font-semibold">
            {i18n.t("newConversation.conversationType")}
          </h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleTemplateChange("general")}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
              selectedTemplate === "general"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            disabled={busy}
          >
            <MessageCircle
              size={18}
              className={
                selectedTemplate === "general"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400"
              }
            />
            <span className="text-xs font-medium text-center">
              {i18n.t("newConversation.templateGeneral")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTemplateChange("coding")}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
              selectedTemplate === "coding"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            disabled={busy}
          >
            <Code
              size={18}
              className={
                selectedTemplate === "coding"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400"
              }
            />
            <span className="text-xs font-medium text-center">
              {i18n.t("newConversation.templateCoding")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTemplateChange("learning")}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
              selectedTemplate === "learning"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            disabled={busy}
          >
            <GraduationCap
              size={18}
              className={
                selectedTemplate === "learning"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400"
              }
            />
            <span className="text-xs font-medium text-center">
              {i18n.t("newConversation.templateLearning")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTemplateChange("writing")}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
              selectedTemplate === "writing"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            disabled={busy}
          >
            <FileText
              size={18}
              className={
                selectedTemplate === "writing"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400"
              }
            />
            <span className="text-xs font-medium text-center">
              {i18n.t("newConversation.templateWriting")}
            </span>
          </button>
        </div>
      </div>

      {/* Étape 3: Personnaliser selon le type de conversation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
            3
          </div>
          <h3 className="text-sm font-semibold">
            {i18n.t("newConversation.customizeAI")}
          </h3>
        </div>

        {/* General: Tone selector */}
        {selectedTemplate === "general" && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              {i18n.t("newConversation.selectTone")}
            </label>
            <select
              value={selectedTone}
              onChange={(e) => setSelectedTone(e.target.value as ToneType)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              disabled={busy}
            >
              <option value="neutral">{i18n.t("tones.neutral")}</option>
              <option value="polite">{i18n.t("tones.polite")}</option>
              <option value="enthusiastic">
                {i18n.t("tones.enthusiastic")}
              </option>
              <option value="professional">
                {i18n.t("tones.professional")}
              </option>
              <option value="casual">{i18n.t("tones.casual")}</option>
              <option value="concise">{i18n.t("tones.concise")}</option>
              <option value="detailed">{i18n.t("tones.detailed")}</option>
            </select>
          </div>
        )}

        {/* Coding: Language + Style */}
        {selectedTemplate === "coding" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.codingLanguage")}
              </label>
              <select
                value={codeLanguage}
                onChange={(e) =>
                  setCodeLanguage(e.target.value as CodeLanguageType)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="any">{i18n.t("coding.language.any")}</option>
                <option value="javascript">
                  {i18n.t("coding.language.javascript")}
                </option>
                <option value="typescript">
                  {i18n.t("coding.language.typescript")}
                </option>
                <option value="python">
                  {i18n.t("coding.language.python")}
                </option>
                <option value="java">{i18n.t("coding.language.java")}</option>
                <option value="csharp">
                  {i18n.t("coding.language.csharp")}
                </option>
                <option value="cpp">{i18n.t("coding.language.cpp")}</option>
                <option value="rust">{i18n.t("coding.language.rust")}</option>
                <option value="go">{i18n.t("coding.language.go")}</option>
                <option value="php">{i18n.t("coding.language.php")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.codingStyle")}
              </label>
              <select
                value={codeStyle}
                onChange={(e) => setCodeStyle(e.target.value as CodeStyleType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="concise">
                  {i18n.t("coding.style.concise")}
                </option>
                <option value="detailed">
                  {i18n.t("coding.style.detailed")}
                </option>
                <option value="production">
                  {i18n.t("coding.style.production")}
                </option>
                <option value="educational">
                  {i18n.t("coding.style.educational")}
                </option>
              </select>
            </div>
          </div>
        )}

        {/* Learning: Level + Style */}
        {selectedTemplate === "learning" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.learningLevel")}
              </label>
              <select
                value={learningLevel}
                onChange={(e) =>
                  setLearningLevel(e.target.value as LearningLevelType)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="beginner">
                  {i18n.t("learning.level.beginner")}
                </option>
                <option value="intermediate">
                  {i18n.t("learning.level.intermediate")}
                </option>
                <option value="advanced">
                  {i18n.t("learning.level.advanced")}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.learningStyle")}
              </label>
              <select
                value={learningStyle}
                onChange={(e) =>
                  setLearningStyle(e.target.value as LearningStyleType)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="simple">
                  {i18n.t("learning.style.simple")}
                </option>
                <option value="detailed">
                  {i18n.t("learning.style.detailed")}
                </option>
                <option value="practical">
                  {i18n.t("learning.style.practical")}
                </option>
                <option value="theoretical">
                  {i18n.t("learning.style.theoretical")}
                </option>
              </select>
            </div>
          </div>
        )}

        {/* Brainstorm: Type + Format */}
        {selectedTemplate === "brainstorm" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.brainstormType")}
              </label>
              <select
                value={brainstormType}
                onChange={(e) =>
                  setBrainstormType(e.target.value as BrainstormTypeType)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="divergent">
                  {i18n.t("brainstorm.type.divergent")}
                </option>
                <option value="convergent">
                  {i18n.t("brainstorm.type.convergent")}
                </option>
                <option value="lateral">
                  {i18n.t("brainstorm.type.lateral")}
                </option>
                <option value="analytical">
                  {i18n.t("brainstorm.type.analytical")}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.brainstormFormat")}
              </label>
              <select
                value={brainstormFormat}
                onChange={(e) =>
                  setBrainstormFormat(e.target.value as BrainstormFormatType)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="list">{i18n.t("brainstorm.format.list")}</option>
                <option value="mindmap">
                  {i18n.t("brainstorm.format.mindmap")}
                </option>
                <option value="structured">
                  {i18n.t("brainstorm.format.structured")}
                </option>
                <option value="freeform">
                  {i18n.t("brainstorm.format.freeform")}
                </option>
              </select>
            </div>
          </div>
        )}

        {/* Writing: Type + Tone */}
        {selectedTemplate === "writing" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.writingType")}
              </label>
              <select
                value={writingType}
                onChange={(e) =>
                  setWritingType(e.target.value as WritingTypeType)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="email">{i18n.t("writing.type.email")}</option>
                <option value="article">
                  {i18n.t("writing.type.article")}
                </option>
                <option value="report">{i18n.t("writing.type.report")}</option>
                <option value="creative">
                  {i18n.t("writing.type.creative")}
                </option>
                <option value="technical">
                  {i18n.t("writing.type.technical")}
                </option>
                <option value="marketing">
                  {i18n.t("writing.type.marketing")}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.writingTone")}
              </label>
              <select
                value={writingTone}
                onChange={(e) =>
                  setWritingTone(e.target.value as WritingToneType)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="formal">{i18n.t("writing.tone.formal")}</option>
                <option value="casual">{i18n.t("writing.tone.casual")}</option>
                <option value="persuasive">
                  {i18n.t("writing.tone.persuasive")}
                </option>
                <option value="informative">
                  {i18n.t("writing.tone.informative")}
                </option>
                <option value="creative">
                  {i18n.t("writing.tone.creative")}
                </option>
              </select>
            </div>
          </div>
        )}

        {/* Analysis: Depth + Format */}
        {selectedTemplate === "analysis" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.analysisDepth")}
              </label>
              <select
                value={analysisDepth}
                onChange={(e) =>
                  setAnalysisDepth(e.target.value as AnalysisDepthType)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="overview">
                  {i18n.t("analysis.depth.overview")}
                </option>
                <option value="detailed">
                  {i18n.t("analysis.depth.detailed")}
                </option>
                <option value="comprehensive">
                  {i18n.t("analysis.depth.comprehensive")}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {i18n.t("newConversation.analysisFormat")}
              </label>
              <select
                value={analysisFormat}
                onChange={(e) =>
                  setAnalysisFormat(e.target.value as AnalysisFormatType)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={busy}
              >
                <option value="summary">
                  {i18n.t("analysis.format.summary")}
                </option>
                <option value="structured">
                  {i18n.t("analysis.format.structured")}
                </option>
                <option value="datadriven">
                  {i18n.t("analysis.format.datadriven")}
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Auto-select best available model */}
      {filteredPresets.length === 0 && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-yellow-800 dark:text-yellow-300">
            {i18n.t("newConversation.noModelsAvailable")}
          </p>
        </div>
      )}

      {/* Download section (auto-select best model) */}
      {selectedPreset &&
        !installedPresets.has(selectedPreset) &&
        downloadStatus === "idle" && (
          <div className="mt-3 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-2">
              {i18n.t("newConversation.modelNotInstalled")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={startDownload}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-600"
              >
                {i18n.t("ui.download")} ({getModelInfo(selectedPreset).size})
              </button>
              <button
                onClick={importLocalModel}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {i18n.t("newConversation.importLocal")}
              </button>
            </div>
          </div>
        )}

      {downloadStatus === "downloading" && (
        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-medium text-blue-900 dark:text-blue-300">
              {i18n.t("ui.downloading")}...
            </span>
            {dl?.status === "running" && downloadProgress !== null && (
              <span className="text-xs text-blue-700 dark:text-blue-400">
                {downloadProgress}%
              </span>
            )}
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${downloadProgress || 0}%` }}
            />
          </div>
        </div>
      )}

      {downloadStatus === "done" && (
        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-800 dark:text-green-300 flex items-center gap-1">
            <CheckCircle size={12} /> {i18n.t("newConversation.modelAvailable")}
          </p>
        </div>
      )}

      {/* Bouton créer */}
      <button
        onClick={createConversation}
        disabled={
          busy || !selectedPreset || !installedPresets.has(selectedPreset)
        }
        className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white font-semibold text-sm shadow hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
      >
        {i18n.t("newConversation.createButton")}
      </button>
    </div>
  );
}
