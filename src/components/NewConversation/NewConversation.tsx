import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { i18n } from "../../i18n";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Code,
  GraduationCap,
  Lightbulb,
  FileText,
  BarChart3,
  Info,
  Gauge,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { SimpleModeView } from "./SimpleModeView";
import { ParameterInput } from "./components/ParameterInput";
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

type DownloadState = {
  filename: string;
  total?: number;
  written: number;
  status: string;
  error?: string | null;
};

type ModelParameters = {
  temperature: number;
  topP: number;
  maxTokens: number;
  repeatPenalty: number;
};

type Props = {
  onNavigate: (view: string, conversationId?: string) => void;
};

export function NewConversation({ onNavigate }: Props) {
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [installedPresets, setInstalledPresets] = useState<Set<string>>(
    new Set()
  );
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [conversationName, setConversationName] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateType>("general");
  const [selectedTone, setSelectedTone] = useState<ToneType>("neutral");
  // Code parameters
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguageType>("any");
  const [codeStyle, setCodeStyle] = useState<CodeStyleType>("concise");
  // Learning parameters
  const [learningLevel, setLearningLevel] =
    useState<LearningLevelType>("intermediate");
  const [learningStyle, setLearningStyle] =
    useState<LearningStyleType>("simple");
  // Brainstorm parameters
  const [brainstormType, setBrainstormType] =
    useState<BrainstormTypeType>("divergent");
  const [brainstormFormat, setBrainstormFormat] =
    useState<BrainstormFormatType>("list");
  // Writing parameters
  const [writingType, setWritingType] = useState<WritingTypeType>("email");
  const [writingTone, setWritingTone] = useState<WritingToneType>("formal");
  // Analysis parameters
  const [analysisDepth, setAnalysisDepth] =
    useState<AnalysisDepthType>("detailed");
  const [analysisFormat, setAnalysisFormat] =
    useState<AnalysisFormatType>("structured");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isExpertMode, setIsExpertMode] = useState<boolean>(false);
  const [_wizardStep, _setWizardStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [downloadStatus, setDownloadStatus] = useState<
    "idle" | "downloading" | "done"
  >("idle");
  const [dl, setDl] = useState<DownloadState | null>(null);
  const [showPerfTest, setShowPerfTest] = useState(false);
  const [perfTestResult, setPerfTestResult] = useState<{
    cpuCores: number;
    totalMemoryGb: number;
    tier: string;
  } | null>(null);

  const [parameters, setParameters] = useState<ModelParameters>({
    temperature: 0.5,
    topP: 0.85,
    maxTokens: 2048,
    repeatPenalty: 1.15,
  });

  // Initial dataset (optional)
  const [enableInitialDataset, setEnableInitialDataset] = useState(false);
  const [initialDatasetName, setInitialDatasetName] = useState("");
  const [initialDatasetText, setInitialDatasetText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await invoke<PresetMeta[]>("get_presets");
        setPresets(list);
        const installed = new Set<string>();
        for (const p of list) {
          try {
            const res = await invoke<{ need_download: boolean }>(
              "start_llama",
              {
                args: { presetId: p.id },
              }
            );
            if (!res.need_download) installed.add(p.id);
          } catch {
            // ignore
          }
        }
        setInstalledPresets(installed);
        if (list.length > 0) {
          const firstInstalled = list.find((p) => installed.has(p.id));
          setSelectedPreset(firstInstalled ? firstInstalled.id : list[0]!.id);
        }

        // Initialize with general template by default
        setSystemPrompt(i18n.t("newConversation.promptGeneral"));
      } catch (e) {
        console.error("Failed to load presets:", e);
      }
    })();
  }, []);

  // Update system prompt when tone changes
  useEffect(() => {
    const basePrompt = getTemplatePrompt(selectedTemplate);
    const promptWithTone = applyToneToPrompt(basePrompt, selectedTone);
    setSystemPrompt(promptWithTone);
  }, [selectedTone, selectedTemplate]);

  const downloadProgress =
    dl?.total && dl.total > 0
      ? Math.min(100, Math.floor((dl.written / dl.total) * 100))
      : null;

  async function importLocalModel() {
    try {
      setError("");
      if (!selectedPreset) {
        setError(i18n.t("newConversation.modelRequired"));
        return;
      }
      const file = await open({
        multiple: false,
        filters: [{ name: "GGUF", extensions: ["gguf"] }],
      });
      if (!file || typeof file !== "string") return;
      setBusy(true);
      await invoke<string>("import_pack", {
        args: { presetId: selectedPreset, sourcePath: file },
      });
      setInstalledPresets((prev) => new Set([...prev, selectedPreset]));
      setDownloadStatus("done");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function startDownload() {
    if (!selectedPreset) return;
    setBusy(true);
    setError("");
    setDownloadStatus("downloading");
    setDl({ filename: "", written: 0, status: "initializing", error: null });
    try {
      await invoke<string>("download_pack", {
        args: { presetId: selectedPreset },
      });
      const poll = setInterval(async () => {
        try {
          const st = await invoke<DownloadState>("download_status", {
            presetId: selectedPreset,
          });
          setDl(st);
          if (st.status === "done") {
            clearInterval(poll);
            setDownloadStatus("done");
            setBusy(false);
            setInstalledPresets((prev) => new Set([...prev, selectedPreset]));
          } else if (st.status === "error" || st.status === "canceled") {
            clearInterval(poll);
            setBusy(false);
            setDownloadStatus("idle");
            setError(st.error || i18n.t("ui.error"));
          }
        } catch (e) {
          console.error("poll error:", e);
        }
      }, 1000);
    } catch (e) {
      setBusy(false);
      setDownloadStatus("idle");
      setError(String(e));
    }
  }

  // Helper: Get model metadata (RAM, size, speed badge) - unused in expert mode but kept for future use
  // Helper: Get template prompt based on selected template
  function getTemplatePrompt(template: TemplateType): string {
    switch (template) {
      case "general":
        return i18n.t("newConversation.promptGeneral");
      case "coding":
        return i18n.t("newConversation.promptCoding");
      case "learning":
        return i18n.t("newConversation.promptLearning");
      case "brainstorm":
        return i18n.t("newConversation.promptBrainstorm");
      case "writing":
        return i18n.t("newConversation.promptWriting");
      case "analysis":
        return i18n.t("newConversation.promptAnalysis");
      case "custom":
      default:
        return "";
    }
  }

  // Helper: Apply tone modifier to system prompt
  function applyToneToPrompt(basePrompt: string, tone: ToneType): string {
    const toneModifiers = {
      neutral: "",
      polite:
        " Sois toujours courtois, respectueux et attentionné dans tes réponses.",
      enthusiastic:
        " Montre de l'enthousiasme et de l'énergie dans tes réponses. Motive et encourage l'utilisateur.",
      professional:
        " Adopte un ton formel, précis et professionnel. Utilise un vocabulaire technique approprié.",
      casual:
        " Sois décontracté et amical. Utilise un langage accessible et informel.",
      concise: " Sois bref et direct. Va droit au but sans détails superflus.",
      detailed:
        " Fournis des explications détaillées et complètes. Explore tous les aspects pertinents.",
    };
    return basePrompt + toneModifiers[tone];
  }

  // Handler: When user selects a template, update system prompt and parameters
  function handleTemplateChange(template: TemplateType) {
    setSelectedTemplate(template);
    const basePrompt = getTemplatePrompt(template);
    const promptWithTone = applyToneToPrompt(basePrompt, selectedTone);
    setSystemPrompt(promptWithTone);

    // Adjust parameters based on template type for Simple Mode
    if (!isExpertMode) {
      switch (template) {
        case "coding":
          // Code needs precision - anti-hallucination optimized
          setParameters({
            temperature: 0.2,
            topP: 0.85,
            maxTokens: 4096,
            repeatPenalty: 1.2,
          });
          break;
        case "writing":
          // Writing needs creativity but controlled
          setParameters({
            temperature: 0.6,
            topP: 0.9,
            maxTokens: 4096,
            repeatPenalty: 1.1,
          });
          break;
        case "learning":
          // Learning needs clarity and factual accuracy
          setParameters({
            temperature: 0.4,
            topP: 0.85,
            maxTokens: 3072,
            repeatPenalty: 1.15,
          });
          break;
        case "general":
        default:
          // Balanced defaults - anti-hallucination optimized
          setParameters({
            temperature: 0.5,
            topP: 0.85,
            maxTokens: 2048,
            repeatPenalty: 1.15,
          });
          break;
      }
    }
  }

  async function createConversation() {
    setError("");
    if (!selectedPreset) {
      setError(i18n.t("newConversation.modelRequired"));
      return;
    }
    if (!installedPresets.has(selectedPreset)) {
      setError(i18n.t("newConversation.downloadFirst"));
      return;
    }

    const finalName =
      conversationName.trim() || i18n.t("newConversation.title");

    setBusy(true);
    try {
      const conversationId = await invoke<number>("create_conversation", {
        args: {
          name: finalName,
          groupName: null,
          presetId: selectedPreset,
          systemPrompt: systemPrompt.trim() || null,
          parameters,
          initialDatasetName:
            enableInitialDataset && initialDatasetName.trim()
              ? initialDatasetName.trim()
              : null,
          initialDatasetText:
            enableInitialDataset && initialDatasetText.trim()
              ? initialDatasetText.trim()
              : null,
        },
      });
      onNavigate("chat", String(conversationId));
    } catch (e) {
      setBusy(false);
      setError(String(e));
    }
  }

  return (
    <div className="h-[calc(100vh-2.5rem)] bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors overflow-y-auto">
      <div className="max-w-3xl mx-auto p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold dark:text-white">
            {i18n.t("newConversation.title")}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setShowPerfTest(true);
                try {
                  const result = await invoke<{
                    cores: number;
                    ram_bytes: number;
                    tier: string;
                  }>("system_info");
                  setPerfTestResult({
                    cpuCores: result.cores,
                    totalMemoryGb: Math.round(result.ram_bytes / 1024 / 1024 / 1024),
                    tier: result.tier,
                  });
                } catch (err) {
                  console.error("Performance test failed:", err);
                }
              }}
              className="px-4 py-2 rounded-lg bg-gray-700 dark:bg-gray-700 text-white hover:bg-gray-600 dark:hover:bg-gray-600 font-medium transition-colors flex items-center gap-2"
            >
              <Gauge size={18} />
              {i18n.t("newConversation.perf.button")}
            </button>
            <button
              onClick={() => setIsExpertMode(!isExpertMode)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isExpertMode
                  ? "bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600"
                  : "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
              }`}
            >
              {isExpertMode
                ? i18n.t("newConversation.expertMode")
                : i18n.t("newConversation.simpleMode")}
            </button>
            <button
              onClick={() => onNavigate("home")}
              className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium transition-colors"
            >
              ← {i18n.t("home.title")}
            </button>
          </div>
        </div>

        {/* Performance Test Panel */}
        {showPerfTest && (
          <div className="mb-4 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Gauge size={18} />
                <span className="font-semibold">{i18n.t("newConversation.perf.title")}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const result = await invoke<{
                        cores: number;
                        ram_bytes: number;
                        tier: string;
                      }>("system_info");
                      setPerfTestResult({
                        cpuCores: result.cores,
                        totalMemoryGb: Math.round(result.ram_bytes / 1024 / 1024 / 1024),
                        tier: result.tier,
                      });
                    } catch (err) {
                      console.error("Performance test failed:", err);
                    }
                  }}
                  className="px-3 py-1.5 rounded-md bg-gray-700 dark:bg-gray-700 text-white text-sm hover:bg-gray-600 dark:hover:bg-gray-600"
                >
                  {i18n.t("newConversation.perf.runAgain")}
                </button>
                <button
                  onClick={() => setShowPerfTest(false)}
                  className="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {i18n.t("ui.close")}
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400">{i18n.t("newConversation.perf.cpuCores")}</div>
                <div className="text-gray-900 dark:text-gray-100 font-semibold">{perfTestResult ? perfTestResult.cpuCores : "..."}</div>
              </div>
              <div className="p-3 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400">{i18n.t("newConversation.perf.memoryGb")}</div>
                <div className="text-gray-900 dark:text-gray-100 font-semibold">{perfTestResult ? perfTestResult.totalMemoryGb : "..."}</div>
              </div>
              <div className="p-3 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400">{i18n.t("newConversation.perf.tier")}</div>
                <div className="text-gray-900 dark:text-gray-100 font-semibold capitalize">{perfTestResult ? perfTestResult.tier : "..."}</div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* MODE SIMPLE: Interface guidée */}
        {!isExpertMode && (
          <SimpleModeView
            conversationName={conversationName}
            setConversationName={setConversationName}
            selectedTemplate={selectedTemplate}
            handleTemplateChange={handleTemplateChange}
            selectedTone={selectedTone}
            setSelectedTone={setSelectedTone}
            codeLanguage={codeLanguage}
            setCodeLanguage={setCodeLanguage}
            codeStyle={codeStyle}
            setCodeStyle={setCodeStyle}
            learningLevel={learningLevel}
            setLearningLevel={setLearningLevel}
            learningStyle={learningStyle}
            setLearningStyle={setLearningStyle}
            brainstormType={brainstormType}
            setBrainstormType={setBrainstormType}
            brainstormFormat={brainstormFormat}
            setBrainstormFormat={setBrainstormFormat}
            writingType={writingType}
            setWritingType={setWritingType}
            writingTone={writingTone}
            setWritingTone={setWritingTone}
            analysisDepth={analysisDepth}
            setAnalysisDepth={setAnalysisDepth}
            analysisFormat={analysisFormat}
            setAnalysisFormat={setAnalysisFormat}
            presets={presets}
            selectedPreset={selectedPreset}
            setSelectedPreset={setSelectedPreset}
            installedPresets={installedPresets}
            busy={busy}
            downloadStatus={downloadStatus}
            downloadProgress={downloadProgress}
            startDownload={startDownload}
            importLocalModel={importLocalModel}
            createConversation={createConversation}
            dl={dl}
          />
        )}

        {/* MODE EXPERT: Interface complète */}
        {isExpertMode && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold">
                {i18n.t("newConversation.conversationName")}
              </label>
              <input
                type="text"
                value={conversationName}
                onChange={(e) => setConversationName(e.target.value)}
                placeholder={i18n.t(
                  "newConversation.conversationNamePlaceholder"
                )}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={busy}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold">
                {i18n.t("newConversation.selectModel")}
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={busy}
              >
                <option value="">
                  {i18n.t("newConversation.selectModel")}
                </option>
                {presets.map((p) => {
                  const installed = installedPresets.has(p.id);
                  return (
                    <option key={p.id} value={p.id}>
                      {i18n.t(p.labelKey)}{" "}
                      {installed ? "✓" : "(Download required)"}
                    </option>
                  );
                })}
              </select>

              {selectedPreset && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {i18n.t(
                    presets.find((p) => p.id === selectedPreset)?.descKey || ""
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={importLocalModel}
                  disabled={busy || !selectedPreset}
                  className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600"
                >
                  {i18n.t("newConversation.importLocal")}
                </button>
                {selectedPreset && installedPresets.has(selectedPreset) && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle size={14} />{" "}
                    {i18n.t("newConversation.modelAvailable")}
                  </span>
                )}
              </div>

              {selectedPreset &&
                !installedPresets.has(selectedPreset) &&
                downloadStatus === "idle" && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-800">
                    <button
                      onClick={startDownload}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors"
                    >
                      {i18n.t("ui.download")}
                    </button>
                  </div>
                )}

              {downloadStatus === "downloading" && (
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    {dl?.status === "initializing" && (
                      <span className="text-xs text-yellow-800 dark:text-yellow-300">
                        {i18n.t("ui.initializing")}
                      </span>
                    )}
                    {dl?.status === "running" && downloadProgress !== null && (
                      <>
                        <span className="font-medium text-sm text-yellow-900 dark:text-yellow-300">
                          {downloadProgress}%
                        </span>
                        {dl?.total && (
                          <span className="text-xs text-yellow-700 dark:text-yellow-400">
                            ({Math.round(dl.written / 1024 / 1024)} /{" "}
                            {Math.round(dl.total / 1024 / 1024)} MB)
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2">
                    <div
                      className="bg-yellow-600 dark:bg-yellow-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {downloadStatus === "done" && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-300 flex items-center gap-1">
                    <CheckCircle size={16} />{" "}
                    {i18n.t("newConversation.modelAvailable")}
                  </p>
                </div>
              )}
            </div>

            {/* Template selection avec radio buttons */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                {i18n.t("newConversation.conversationType")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTemplateChange("general")}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                    selectedTemplate === "general"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  disabled={busy}
                >
                  <MessageCircle
                    size={16}
                    className={
                      selectedTemplate === "general"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  />
                  <span className="text-sm font-medium">
                    {i18n.t("newConversation.templateGeneral")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTemplateChange("coding")}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                    selectedTemplate === "coding"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  disabled={busy}
                >
                  <Code
                    size={16}
                    className={
                      selectedTemplate === "coding"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  />
                  <span className="text-sm font-medium">
                    {i18n.t("newConversation.templateCoding")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTemplateChange("learning")}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                    selectedTemplate === "learning"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  disabled={busy}
                >
                  <GraduationCap
                    size={16}
                    className={
                      selectedTemplate === "learning"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  />
                  <span className="text-sm font-medium">
                    {i18n.t("newConversation.templateLearning")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTemplateChange("brainstorm")}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                    selectedTemplate === "brainstorm"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  disabled={busy}
                >
                  <Lightbulb
                    size={16}
                    className={
                      selectedTemplate === "brainstorm"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  />
                  <span className="text-sm font-medium">
                    {i18n.t("newConversation.templateBrainstorm")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTemplateChange("writing")}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                    selectedTemplate === "writing"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  disabled={busy}
                >
                  <FileText
                    size={16}
                    className={
                      selectedTemplate === "writing"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  />
                  <span className="text-sm font-medium">
                    {i18n.t("newConversation.templateWriting")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTemplateChange("analysis")}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                    selectedTemplate === "analysis"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  disabled={busy}
                >
                  <BarChart3
                    size={16}
                    className={
                      selectedTemplate === "analysis"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  />
                  <span className="text-sm font-medium">
                    {i18n.t("newConversation.templateAnalysis")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTemplateChange("custom")}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left col-span-2 ${
                    selectedTemplate === "custom"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  disabled={busy}
                >
                  <FileText
                    size={16}
                    className={
                      selectedTemplate === "custom"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  />
                  <span className="text-sm font-medium">
                    {i18n.t("newConversation.templateCustom")}
                  </span>
                </button>
              </div>
            </div>

            {/* System prompt textarea avec infobulle */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-semibold">
                  {i18n.t("newConversation.systemPrompt")}
                </label>
                <div className="group relative">
                  <Info
                    size={16}
                    className="text-gray-400 dark:text-gray-500 cursor-help"
                  />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-10">
                    {i18n.t("newConversation.systemPromptHelp")}
                  </div>
                </div>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={i18n.t("newConversation.systemPromptPlaceholder")}
                rows={4}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                disabled={busy}
              />
            </div>

            {/* Accordéon paramètres avancés */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                disabled={busy}
              >
                {showAdvanced ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
                {i18n.t("newConversation.advancedParameters")}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <ParameterInput
                      label={i18n.t("newConversation.temperature")}
                      helpText={i18n.t("newConversation.temperatureHelp")}
                      value={parameters.temperature}
                      onChange={(val) =>
                        setParameters({ ...parameters, temperature: val })
                      }
                      min={0}
                      max={2}
                      step={0.1}
                      disabled={busy}
                    />
                    <ParameterInput
                      label={i18n.t("newConversation.topP")}
                      helpText={i18n.t("newConversation.topPHelp")}
                      value={parameters.topP}
                      onChange={(val) =>
                        setParameters({ ...parameters, topP: val })
                      }
                      min={0}
                      max={1}
                      step={0.1}
                      disabled={busy}
                    />
                    <ParameterInput
                      label={i18n.t("newConversation.maxTokens")}
                      helpText={i18n.t("newConversation.maxTokensHelp")}
                      value={parameters.maxTokens}
                      onChange={(val) =>
                        setParameters({ ...parameters, maxTokens: val })
                      }
                      min={1}
                      max={4096}
                      step={1}
                      disabled={busy}
                      isInteger
                    />
                    <ParameterInput
                      label={i18n.t("newConversation.repeatPenalty")}
                      helpText={i18n.t("newConversation.repeatPenaltyHelp")}
                      value={parameters.repeatPenalty}
                      onChange={(val) =>
                        setParameters({ ...parameters, repeatPenalty: val })
                      }
                      min={0}
                      max={2}
                      step={0.1}
                      disabled={busy}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Optional initial dataset creation section */}
            <div className="space-y-2 mt-2 border-t border-gray-200 dark:border-gray-700 pt-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500"
                  checked={enableInitialDataset}
                  onChange={(e) => setEnableInitialDataset(e.target.checked)}
                  disabled={busy}
                />
                {i18n.t("newConversation.initialDatasetEnable")}
              </label>
              {enableInitialDataset && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {i18n.t("newConversation.initialDatasetNameLabel")}
                    </label>
                    <input
                      type="text"
                      value={initialDatasetName}
                      onChange={(e) => setInitialDatasetName(e.target.value)}
                      placeholder={i18n.t(
                        "newConversation.initialDatasetNamePlaceholder"
                      )}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {i18n.t("newConversation.initialDatasetContentLabel")}
                    </label>
                    <textarea
                      value={initialDatasetText}
                      onChange={(e) => setInitialDatasetText(e.target.value)}
                      placeholder={i18n.t(
                        "newConversation.initialDatasetContentPlaceholder"
                      )}
                      rows={6}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
                      disabled={busy}
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {i18n.t("newConversation.initialDatasetHelp")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-1">
              <button
                onClick={createConversation}
                disabled={
                  busy ||
                  !selectedPreset ||
                  !installedPresets.has(selectedPreset)
                }
                className="w-full px-5 py-2.5 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white font-semibold text-sm shadow-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {i18n.t("newConversation.createButton")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
