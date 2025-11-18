# Onboarding Tutorial - Technical Implementation Guide

**Version**: 1.0
**Date**: 2025-11-18
**Target**: WhytChat v0.4.0+
**Status**: Implementation Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Phase 1: Rust Backend (System Scan)](#phase-1-rust-backend-system-scan)
4. [Phase 2: i18n Structure](#phase-2-i18n-structure)
5. [Phase 3: React Component](#phase-3-react-component)
6. [Phase 4: App Integration](#phase-4-app-integration)
7. [Testing Guide](#testing-guide)
8. [Troubleshooting](#troubleshooting)
9. [References](#references)

---

## Overview

### Goal

Implement a guided first-run tutorial that:

- Welcomes users with WhytCard branding
- Optionally scans system hardware (CPU cores + RAM)
- Recommends appropriate model sizes based on resources
- Guides through first conversation creation
- Explains how to find external GGUF models

### Key Principles

- **Privacy First**: Scan only with explicit consent, no data transmission
- **Progressive Disclosure**: Show information when needed
- **Skip-friendly**: Users can bypass any step
- **Persistent**: Flag in localStorage prevents re-showing
- **Accessible**: Keyboard navigation, ARIA labels, focus management

---

## Architecture

### Data Flow

```
App.tsx (mount)
    ↓
Check localStorage['onboardingCompleted']
    ↓
if absent → Render <OnboardingWizard />
    ↓
User clicks "Start Scan" (Step 2)
    ↓
Frontend invokes system_info()
    ↓
Rust backend (sysinfo crate)
    ↓
Returns { cores, ram_bytes, tier }
    ↓
Frontend displays recommendation
    ↓
User selects/downloads model
    ↓
User completes wizard
    ↓
localStorage['onboardingCompleted'] = 'true'
    ↓
Navigate to Home or Chat
```

### Component Structure

```
src/components/OnboardingWizard/
├── OnboardingWizard.tsx       (Main container, step orchestration)
├── types.ts                   (TypeScript interfaces)
├── index.tsx                  (Barrel export)
└── steps/
    ├── WelcomeStep.tsx        (Step 1: Branding + language)
    ├── ScanConsentStep.tsx    (Step 2: Explain scan + buttons)
    ├── ScanResultsStep.tsx    (Step 3: Display tier + recommendations)
    ├── ModelSelectionStep.tsx (Step 4: Pick installed or download)
    ├── ConversationGuideStep.tsx (Step 5: Templates overview)
    ├── ExternalModelsStep.tsx (Step 6: GGUF sources)
    └── FinishStep.tsx         (Step 7: Create conversation CTA)
```

---

## Phase 1: Rust Backend (System Scan)

### 1.1 Add Dependency

**File**: `src-tauri/Cargo.toml`

```toml
[dependencies]
sysinfo = "0.30"  # Check for latest stable: https://crates.io/crates/sysinfo
serde = { version = "1.0", features = ["derive"] }
tauri = { version = "2.0", features = ["..."] }
```

**Validation**: Run `cargo check` to verify compilation.

### 1.2 Implement System Info Command

**File**: `src-tauri/src/main.rs`

```rust
use sysinfo::{System, SystemExt};

/// System information response structure
#[derive(serde::Serialize)]
struct SystemInfo {
    /// Number of logical CPU cores
    cores: usize,
    /// Total system RAM in bytes
    ram_bytes: u64,
    /// Recommended model tier: "small" | "medium" | "large"
    tier: String,
}

/// Retrieve system hardware information for model recommendation
///
/// Returns:
/// - cores: Logical CPU core count (physical cores × threads per core)
/// - ram_bytes: Total installed RAM (not available RAM)
/// - tier: Recommendation based on RAM:
///   - "small" (≤4GB): Lightweight models (3B-7B Q4_K_M)
///   - "medium" (4-12GB): Balanced models (7B-14B Q4_K_M)
///   - "large" (>12GB): Large models (32B+ or 70B with lower quant)
///
/// # Privacy
/// This command only reads local system specs. No data is transmitted
/// over the network. Execution requires explicit user consent via UI.
#[tauri::command]
fn system_info() -> Result<SystemInfo, String> {
    // Initialize system information collector
    let mut sys = System::new_all();

    // Refresh to get current data
    sys.refresh_all();

    // Get logical CPU core count
    let cores = sys.cpus().len();

    // Get total RAM in bytes (sysinfo returns bytes natively in v0.30+)
    // Note: total_memory() returns KiB in older versions, bytes in 0.30+
    let ram_bytes = sys.total_memory();

    // Calculate recommended tier based on available RAM
    let tier = if ram_bytes <= 4 * 1024 * 1024 * 1024 {
        // ≤4GB: Recommend lightweight models
        "small".to_string()
    } else if ram_bytes <= 12 * 1024 * 1024 * 1024 {
        // 4-12GB: Recommend balanced models
        "medium".to_string()
    } else {
        // >12GB: Recommend large models
        "large".to_string()
    };

    Ok(SystemInfo {
        cores,
        ram_bytes,
        tier,
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            system_info,
            // ... other existing commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 1.3 Update Tauri Capabilities (v2 only)

If your `tauri.conf.json` uses capabilities configuration:

**File**: `src-tauri/capabilities/default.json` (or main capabilities file)

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    {
      "identifier": "system_info",
      "allow": ["system_info"]
    }
  ]
}
```

### 1.4 Error Handling

Add proper error handling for edge cases:

```rust
#[tauri::command]
fn system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cores = sys.cpus().len();
    if cores == 0 {
        return Err("Unable to detect CPU cores".to_string());
    }

    let ram_bytes = sys.total_memory();
    if ram_bytes == 0 {
        return Err("Unable to detect system memory".to_string());
    }

    let tier = calculate_tier(ram_bytes);

    Ok(SystemInfo { cores, ram_bytes, tier })
}

fn calculate_tier(ram_bytes: u64) -> String {
    const GB: u64 = 1024 * 1024 * 1024;

    match ram_bytes {
        0..=4*GB => "small".to_string(),
        ..=12*GB => "medium".to_string(),
        _ => "large".to_string(),
    }
}
```

### 1.5 Testing the Command

**Via Browser Console** (after `npm run tauri dev`):

```javascript
import { invoke } from "@tauri-apps/api/core";

const info = await invoke("system_info");
console.log("System Info:", info);
// Expected: { cores: 8, ram_bytes: 16777216000, tier: "large" }
```

---

## Phase 2: i18n Structure

### 2.1 Key Hierarchy

All keys prefixed with `onboarding.` to avoid namespace collisions.

**File**: `src/locales/en/translation.json` (or canonical locale)

```json
{
  "onboarding": {
    "progress": "Step {{current}} of {{total}}",
    "nextButton": "Next",
    "backButton": "Back",
    "skipButton": "Skip",

    "welcome": {
      "title": "Welcome to WhytChat",
      "subtitle": "An application by WhytCard",
      "description": "WhytChat is your local, privacy-focused AI assistant. All conversations stay on your device—no cloud, no tracking.",
      "startButton": "Get Started",
      "languageLabel": "Choose your language"
    },

    "scan": {
      "title": "System Performance Analysis",
      "consentText": "To recommend the best model for your computer, we can perform a quick scan of your CPU and RAM. This analysis happens entirely on your device—no data is sent anywhere.",
      "privacyNote": "🔒 100% local • No data transmitted",
      "startButton": "Scan My System",
      "skipButton": "Skip This Step",
      "runningMessage": "Analyzing hardware...",
      "errorMessage": "Unable to scan system. You can still select a model manually."
    },

    "result": {
      "title": "Analysis Complete",
      "ramLabel": "RAM: {{ram}} GB",
      "coresLabel": "CPU Cores: {{cores}}",
      "tierSmall": {
        "title": "💡 Lightweight System",
        "description": "Your computer has {{ram}}GB of RAM. We recommend lightweight models up to 4GB in size.",
        "examples": "Recommended: Qwen 2.5 7B, Llama 3.2 3B, Mistral 7B (Q4_K_M)"
      },
      "tierMedium": {
        "title": "⚡ Balanced System",
        "description": "Your computer has {{ram}}GB of RAM. You can run medium-sized models (4-12GB) comfortably.",
        "examples": "Recommended: Qwen 2.5 32B, Llama 3.1 14B, Mistral Small 3 24B"
      },
      "tierLarge": {
        "title": "🚀 Powerful System",
        "description": "Your computer has {{ram}}GB of RAM. You can run large models (12GB+) including 70B parameter models.",
        "examples": "Recommended: Llama 3.3 70B, Qwen 2.5 72B, DeepSeek V3"
      },
      "warningLowRam": "⚠️ With {{ram}}GB RAM, start with smaller models. Larger models may cause slowdowns."
    },

    "model": {
      "title": "Select a Model",
      "suggestion": "Based on your system, we recommend:",
      "noInstalled": "No models installed yet.",
      "downloadButton": "Download Recommended Model",
      "pickInstalled": "Choose an Installed Model",
      "installedBadge": "✓ Installed",
      "sizeLabel": "Size: {{size}} GB"
    },

    "conversation": {
      "title": "Create Your First Conversation",
      "helpText": "WhytChat offers specialized templates for different tasks:",
      "templates": {
        "general": "**General**: Balanced assistant for everyday questions",
        "coding": "**Coding**: Optimized for programming and technical help",
        "learning": "**Learning**: Explains concepts clearly with examples",
        "writing": "**Writing**: Helps with creative and professional writing",
        "brainstorm": "**Brainstorm**: Generates ideas and explores possibilities",
        "analysis": "**Analysis**: Detailed examination and insights"
      },
      "toneInfo": "You can also adjust the tone (casual, professional, concise, etc.) to match your preference.",
      "skipToCreate": "You can customize these settings later when creating conversations."
    },

    "external": {
      "title": "Finding More Models",
      "subtitle": "WhytChat supports any GGUF format model. Here's where to find them:",
      "sources": {
        "huggingface": {
          "name": "Hugging Face",
          "description": "Largest model repository. Search for 'GGUF' in the model hub.",
          "link": "https://huggingface.co/models?search=gguf"
        },
        "bartowski": {
          "name": "Bartowski's Quantizations",
          "description": "High-quality GGUF quantizations of popular models.",
          "link": "https://huggingface.co/bartowski"
        },
        "thebloke": {
          "name": "TheBloke (Archive)",
          "description": "Historical collection of GGUF models (mostly pre-2024).",
          "link": "https://huggingface.co/TheBloke"
        }
      },
      "namingGuide": {
        "title": "Understanding Model Names",
        "format": "**Format**: `model-name-size-quant.gguf`",
        "examples": [
          "`llama-3.1-8B-Q4_K_M.gguf` → Llama 3.1, 8 billion params, Q4_K_M quantization",
          "`qwen2.5-7B-instruct-Q5_K_S.gguf` → Qwen 2.5, 7B, instruction-tuned, Q5 quant"
        ],
        "quantExplainer": "**Quantization** (Q4, Q5, Q8): Lower numbers = smaller file but less accurate. Q4_K_M is a good balance."
      },
      "sizeWarning": "⚠️ **Important**: Check file sizes before downloading. A 70B Q4 model can be 40GB+. Make sure you have enough disk space and RAM.",
      "importHelp": "To use downloaded models: Go to **New Conversation** → **Import Local Model** → Select your `.gguf` file."
    },

    "finish": {
      "title": "You're All Set!",
      "subtitle": "Ready to start chatting with your AI assistant.",
      "features": [
        "🔒 100% private — everything stays on your device",
        "⚡ Fast responses — no internet required after model download",
        "🎨 Multiple templates — coding, writing, learning, and more",
        "📚 RAG support — import documents for context-aware answers"
      ],
      "createNowButton": "Create My First Conversation",
      "laterButton": "Explore Settings First",
      "tipLabel": "💡 Pro Tip:",
      "tipText": "Use Ctrl+N to quickly create new conversations from anywhere in the app."
    }
  }
}
```

### 2.2 Locale Replication

**Critical**: Replicate structure to all 8 locales:

- `en/` (canonical if following architecture)
- `fr/` (canonical if following current i18n.ts default)
- `de/`, `es/`, `it/`, `pt/`, `nl/`, `pl/`

For MVP, you can duplicate English text in all locales, then translate later:

```bash
# From app root
cp src/locales/en/translation.json src/locales/fr/onboarding.json
cp src/locales/en/translation.json src/locales/es/onboarding.json
# ... repeat for all locales
```

Or merge into existing `translation.json` files if structure is flat.

### 2.3 Validation

```bash
npm run check:i18n
```

Expected output: `✅ All locales have matching keys`

---

## Phase 3: React Component

### 3.1 Types Definition

**File**: `src/components/OnboardingWizard/types.ts`

```typescript
export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ScanStatus = "idle" | "running" | "done" | "error";

export type ModelTier = "small" | "medium" | "large";

export interface SystemInfo {
  cores: number;
  ram_bytes: number;
  tier: ModelTier;
}

export interface PresetInfo {
  id: string;
  labelKey: string;
  descKey: string;
  size: number; // in GB
  installed: boolean;
}

export interface OnboardingWizardProps {
  onComplete: (conversationId?: string) => void;
}

export interface StepComponentProps {
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
}
```

### 3.2 Main Container

**File**: `src/components/OnboardingWizard/OnboardingWizard.tsx`

```typescript
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { i18n } from '../../i18n';
import type {
  OnboardingStep,
  ScanStatus,
  SystemInfo,
  PresetInfo,
  OnboardingWizardProps,
} from './types';
import { WelcomeStep } from './steps/WelcomeStep';
import { ScanConsentStep } from './steps/ScanConsentStep';
import { ScanResultsStep } from './steps/ScanResultsStep';
import { ModelSelectionStep } from './steps/ModelSelectionStep';
import { ConversationGuideStep } from './steps/ConversationGuideStep';
import { ExternalModelsStep } from './steps/ExternalModelsStep';
import { FinishStep } from './steps/FinishStep';
import { Loader2, Check } from 'lucide-react';

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanData, setScanData] = useState<SystemInfo | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [installedPresets, setInstalledPresets] = useState<Set<string>>(new Set());

  const totalSteps = 7;

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const list = await invoke<PresetInfo[]>('get_presets');
      setPresets(list);

      // Check which presets are installed
      const installed = new Set<string>();
      for (const preset of list) {
        try {
          const res = await invoke<{ need_download: boolean }>('start_llama', {
            args: { presetId: preset.id },
          });
          if (!res.need_download) {
            installed.add(preset.id);
          }
        } catch {
          // Preset not installed
        }
      }
      setInstalledPresets(installed);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  const handleStartScan = async () => {
    setScanStatus('running');
    try {
      const info = await invoke<SystemInfo>('system_info');
      setScanData(info);
      setScanStatus('done');
      setStep(3); // Go to results
    } catch (error) {
      console.error('Scan failed:', error);
      setScanStatus('error');
    }
  };

  const handleSkipScan = () => {
    setStep(4); // Skip to model selection
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
  };

  const handleFinish = async (createConversation: boolean) => {
    if (createConversation && selectedPreset && installedPresets.has(selectedPreset)) {
      try {
        // Create default conversation
        const conversationId = await invoke<number>('create_conversation', {
          args: {
            name: i18n.t('newConversation.title'),
            groupName: null,
            presetId: selectedPreset,
            systemPrompt: i18n.t('newConversation.promptGeneral'),
            parameters: {
              temperature: 0.5,
              topP: 0.85,
              maxTokens: 2048,
              repeatPenalty: 1.15,
            },
            initialDatasetName: null,
            initialDatasetText: null,
          },
        });

        // Mark onboarding complete
        localStorage.setItem('onboardingCompleted', 'true');

        // Navigate to chat with new conversation
        onComplete(String(conversationId));
      } catch (error) {
        console.error('Failed to create conversation:', error);
        localStorage.setItem('onboardingCompleted', 'true');
        onComplete();
      }
    } else {
      // Just mark complete and go to home
      localStorage.setItem('onboardingCompleted', 'true');
      onComplete();
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep((prev) => (prev + 1) as OnboardingStep);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as OnboardingStep);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {i18n.t('onboarding.progress', { current: step, total: totalSteps })}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round((step / totalSteps) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {step === 1 && (
            <WelcomeStep onNext={handleNext} onBack={handleBack} />
          )}
          {step === 2 && (
            <ScanConsentStep
              onNext={handleNext}
              onBack={handleBack}
              onStartScan={handleStartScan}
              onSkip={handleSkipScan}
              scanStatus={scanStatus}
            />
          )}
          {step === 3 && scanData && (
            <ScanResultsStep
              onNext={handleNext}
              onBack={handleBack}
              scanData={scanData}
            />
          )}
          {step === 4 && (
            <ModelSelectionStep
              onNext={handleNext}
              onBack={handleBack}
              presets={presets}
              installedPresets={installedPresets}
              selectedPreset={selectedPreset}
              onSelectPreset={handleSelectPreset}
              recommendedTier={scanData?.tier}
            />
          )}
          {step === 5 && (
            <ConversationGuideStep onNext={handleNext} onBack={handleBack} />
          )}
          {step === 6 && (
            <ExternalModelsStep onNext={handleNext} onBack={handleBack} />
          )}
          {step === 7 && (
            <FinishStep
              onFinish={handleFinish}
              canCreateConversation={
                selectedPreset !== null && installedPresets.has(selectedPreset)
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

### 3.3 Example Step Component

**File**: `src/components/OnboardingWizard/steps/WelcomeStep.tsx`

```typescript
import { i18n, availableLocaleCodes } from '../../../i18n';
import { StepComponentProps } from '../types';
import { MessageSquare, Globe } from 'lucide-react';

export function WelcomeStep({ onNext }: StepComponentProps) {
  return (
    <div className="text-center space-y-6">
      {/* Logo/Icon */}
      <div className="flex justify-center">
        <div className="p-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
          <MessageSquare size={48} className="text-white" />
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {i18n.t('onboarding.welcome.title')}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          {i18n.t('onboarding.welcome.subtitle')}
        </p>
      </div>

      {/* Description */}
      <p className="text-base text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
        {i18n.t('onboarding.welcome.description')}
      </p>

      {/* Language Selector */}
      <div className="flex items-center justify-center gap-3">
        <Globe size={20} className="text-gray-500" />
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {i18n.t('onboarding.welcome.languageLabel')}:
        </label>
        <select
          value={i18n.getLocale()}
          onChange={(e) => i18n.setLocale(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          {availableLocaleCodes.map((code) => (
            <option key={code} value={code}>
              {code.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Start Button */}
      <button
        onClick={onNext}
        className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
      >
        {i18n.t('onboarding.welcome.startButton')}
      </button>
    </div>
  );
}
```

### 3.4 Index Export

**File**: `src/components/OnboardingWizard/index.tsx`

```typescript
export { OnboardingWizard } from "./OnboardingWizard";
export type {
  OnboardingStep,
  ScanStatus,
  SystemInfo,
  ModelTier,
  PresetInfo,
  OnboardingWizardProps,
} from "./types";
```

---

## Phase 4: App Integration

### 4.1 Modify App.tsx

**File**: `src/App.tsx`

```typescript
import { useState } from 'react';
import { OnboardingWizard } from './components/OnboardingWizard';
// ... other imports

export function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    // Check if onboarding has been completed
    try {
      return !localStorage.getItem('onboardingCompleted');
    } catch {
      return false; // If localStorage fails, skip onboarding
    }
  });

  const handleNavigate = (view: string, conversationId?: string) => {
    // ... existing navigation logic
  };

  const handleOnboardingComplete = (conversationId?: string) => {
    setShowOnboarding(false);
    if (conversationId) {
      handleNavigate('chat', conversationId);
    } else {
      handleNavigate('home');
    }
  };

  // Show onboarding wizard if not completed
  if (showOnboarding) {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // Normal app UI
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ServerProvider>
          <TitleBar onNavigate={handleNavigate} />
          {/* ... rest of app */}
        </ServerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

### 4.2 Testing Integration

**Manual Test**:

1. Open DevTools → Application → Local Storage
2. Delete key `onboardingCompleted`
3. Refresh app
4. Wizard should appear fullscreen

**Reset for Testing**:

```javascript
// In browser console
localStorage.removeItem("onboardingCompleted");
location.reload();
```

---

## Testing Guide

### Unit Tests (Future)

```typescript
// src/components/OnboardingWizard/__tests__/OnboardingWizard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingWizard } from '../OnboardingWizard';

describe('OnboardingWizard', () => {
  it('renders welcome step initially', () => {
    render(<OnboardingWizard onComplete={() => {}} />);
    expect(screen.getByText(/welcome to whytchat/i)).toBeInTheDocument();
  });

  it('advances to next step on button click', () => {
    render(<OnboardingWizard onComplete={() => {}} />);
    fireEvent.click(screen.getByText(/get started/i));
    expect(screen.getByText(/system performance/i)).toBeInTheDocument();
  });

  it('calls onComplete with conversation ID', async () => {
    const mockComplete = jest.fn();
    render(<OnboardingWizard onComplete={mockComplete} />);
    // ... simulate completing wizard
    expect(mockComplete).toHaveBeenCalledWith('123');
  });
});
```

### Integration Tests

**Playwright E2E** (Future):

```typescript
// e2e/onboarding.spec.ts
import { test, expect } from "@playwright/test";

test("first run onboarding flow", async ({ page }) => {
  await page.goto("http://localhost:5173");

  // Should show onboarding
  await expect(page.locator("text=Welcome to WhytChat")).toBeVisible();

  // Click through steps
  await page.click('button:has-text("Get Started")');
  await page.click('button:has-text("Skip This Step")');
  // ... continue through wizard

  // After completion, should see home
  await expect(page.locator("text=WhytChat")).toBeVisible();

  // Refresh should NOT show onboarding again
  await page.reload();
  await expect(page.locator("text=Welcome to WhytChat")).not.toBeVisible();
});
```

### Manual Testing Checklist

- [ ] Fresh install: Delete `onboardingCompleted` from localStorage
- [ ] Step navigation: Forward/back buttons work correctly
- [ ] Skip functionality: Can skip optional steps
- [ ] System scan: Displays correct RAM/cores
- [ ] Tier recommendation: Matches expected tier for RAM
- [ ] Model selection: Only shows installed models correctly
- [ ] Language switch: Changes UI language during onboarding
- [ ] Conversation creation: Successfully creates and navigates
- [ ] Persistence: Flag prevents re-showing on reload
- [ ] Dark mode: All steps render correctly in dark theme
- [ ] Keyboard navigation: Tab/Enter/Escape work as expected
- [ ] Screen reader: ARIA labels read correctly (test with NVDA/JAWS)

---

## Troubleshooting

### Issue: `system_info` command not found

**Symptoms**: `invoke('system_info')` throws error.

**Solutions**:

1. Verify command is registered in `main.rs`:
   ```rust
   .invoke_handler(tauri::generate_handler![system_info])
   ```
2. Check Tauri capabilities (v2) include the command
3. Rebuild Rust: `cargo clean && cargo build`
4. Restart dev server: `npm run tauri dev`

### Issue: RAM reported as 0 bytes

**Symptoms**: `ram_bytes: 0` in response.

**Solutions**:

1. Update `sysinfo` to latest version: `cargo update -p sysinfo`
2. Check sysinfo version compatibility (0.30+ uses bytes, older uses KiB)
3. Add error handling for zero values
4. Test on different OS (behavior varies Windows/Linux/macOS)

### Issue: Onboarding shows every time

**Symptoms**: Flag not persisting.

**Solutions**:

1. Check localStorage is not blocked (private browsing)
2. Verify key name exactly matches: `onboardingCompleted`
3. Check for errors in browser console during `setItem`
4. Test localStorage manually: `localStorage.setItem('test', 'works')`

### Issue: i18n keys not found

**Symptoms**: Fallback text or `undefined` displayed.

**Solutions**:

1. Run `npm run check:i18n` to verify parity
2. Check key path is correct (e.g., `onboarding.welcome.title`)
3. Ensure all locales have the keys
4. Restart dev server after adding keys
5. Check `i18n.ts` fallback chain

### Issue: Can't select model in Step 4

**Symptoms**: All models show "Download required".

**Solutions**:

1. Install at least one model via normal flow first
2. Check `installedPresets` Set is populated correctly
3. Verify `start_llama` command returns correct `need_download` status
4. Test preset detection: `invoke('start_llama', { args: { presetId: 'qwen-7b' } })`

---

## References

### Documentation

- **sysinfo crate**: https://docs.rs/sysinfo/latest/sysinfo/
- **Tauri v2 Commands**: https://v2.tauri.app/develop/calling-rust/
- **Tauri Invoke Handler**: https://tauri.app/v1/guides/features/command
- **React Testing Library**: https://testing-library.com/docs/react-testing-library/intro/

### Code Examples

- Context7 sysinfo docs: `/guillaumegomez/sysinfo` (13 snippets)
- Tauri tutorial: https://tauritutorials.com/blog/tauri-command-fundamentals
- Tauri by example: https://dev.to/giuliano1993/learn-tauri-by-doing-part-1

### Internal References

- `TODO.md`: Full implementation checklist
- `ARCHITECTURE.md`: App architecture overview
- `.github/instructions/13-app-i18n-checklist-v2.instructions.md`: i18n workflow

---

## Changelog

**v1.0** (2025-11-18):

- Initial documentation
- Complete Rust backend guide
- i18n structure defined
- React component architecture
- App integration pattern
- Testing strategies
- Troubleshooting section

---

**Next Steps**: Proceed to Phase 2 (i18n implementation) or Phase 3 (component creation) based on priority.
