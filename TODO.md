# WhytChat Onboarding Tutorial - Implementation TODO

**Date**: 2025-11-18
**Status**: Planning Phase
**Priority**: High
**Goal**: Implement guided onboarding tutorial for first-time users with hardware scan and model recommendation.

---

## 🎯 Objectives

1. **Welcome Screen**: Present WhytCard branding, language selection
2. **Hardware Scan** (opt-in): Analyze CPU cores + RAM to recommend model size
3. **Model Guidance**: Suggest appropriate presets based on system capabilities
4. **First Conversation**: Guide user through creating their first chat
5. **External Models**: Explain how to find and use custom GGUF models
6. **Completion**: Store flag to prevent re-showing on subsequent launches

---

## 📋 Implementation Checklist

### Phase 1: Architecture & Planning ✅ DONE

- [x] Read and analyze existing codebase
- [x] Identify integration points (App.tsx, Home.tsx, NewConversation.tsx)
- [x] Define onboarding flow (7 steps)
- [x] Document state management strategy (localStorage flag)
- [x] Plan i18n key structure

### Phase 2: i18n Preparation

- [ ] **Define complete i18n key structure** (see section below)
- [ ] Add keys to canonical locale (`en/` or `fr/` - **TO CLARIFY**)
- [ ] Replicate keys across all 8 locales (en, fr, es, de, it, pt, nl, pl)
- [ ] Run `npm run check:i18n` to validate parity
- [ ] Test key fallback behavior

**i18n Keys Structure** (prefix `onboarding.`):

```typescript
onboarding.welcome.title; // "Bienvenue sur WhytChat"
onboarding.welcome.subtitle; // "Une application par WhytCard"
onboarding.welcome.description; // Intro text
onboarding.welcome.startButton; // "Commencer"

onboarding.language.label; // "Choisissez votre langue"

onboarding.scan.title; // "Analyse des performances"
onboarding.scan.consentText; // Explanation + privacy assurance
onboarding.scan.startButton; // "Analyser mon système"
onboarding.scan.skipButton; // "Passer cette étape"
onboarding.scan.running; // "Analyse en cours..."

onboarding.scan.result.title; // "Résultats de l'analyse"
onboarding.scan.result.ram; // "Mémoire RAM : {ram} GB"
onboarding.scan.result.cores; // "Cœurs CPU : {cores}"
onboarding.scan.result.tierSmall; // "Système léger - Modèles jusqu'à 4GB"
onboarding.scan.result.tierMedium; // "Système équilibré - Modèles 4-12GB"
onboarding.scan.result.tierLarge; // "Système puissant - Modèles >12GB"
onboarding.scan.result.warningLowRam; // Warning for <4GB RAM

onboarding.model.title; // "Sélection du modèle"
onboarding.model.suggestion; // "Nous recommandons :"
onboarding.model.noInstalled; // "Aucun modèle installé"
onboarding.model.downloadButton; // "Télécharger un modèle"
onboarding.model.pickInstalled; // "Choisir un modèle installé"

onboarding.conversation.title; // "Créer votre première conversation"
onboarding.conversation.helpText; // Guide sur les templates et tons

onboarding.external.title; // "Trouver des modèles GGUF"
onboarding.external.where; // "Sites recommandés (Hugging Face...)"
onboarding.external.naming; // "Guide de nommage (Q4_K_M, etc.)"
onboarding.external.warning; // "Attention à la taille des fichiers"

onboarding.finish.title; // "Prêt à discuter !"
onboarding.finish.createNowButton; // "Créer une conversation"
onboarding.finish.laterButton; // "Explorer d'abord"

onboarding.progress; // "Étape {current} sur {total}"
onboarding.nextButton; // "Suivant"
onboarding.backButton; // "Retour"
```

### Phase 3: Rust Backend (System Scan)

- [ ] **Add `sysinfo` crate dependency** to `src-tauri/Cargo.toml`
  ```toml
  sysinfo = "0.30"  # Check latest stable version
  ```
- [ ] **Create `system_info` command** in `src-tauri/src/main.rs`:
  - Struct `SystemInfo { cores: usize, ram_bytes: u64, tier: String }`
  - Function to calculate tier: small (≤4GB), medium (4-12GB), large (>12GB)
  - Error handling for platform incompatibilities
- [ ] **Register command** in Tauri builder `.invoke_handler()`
- [ ] **Update Tauri capabilities** (if v2): add command to allowlist
- [ ] Run `cargo check` to validate compilation
- [ ] Test command via `invoke("system_info")` in dev console

**Rust Implementation Skeleton**:

```rust
use sysinfo::{System, SystemExt};

#[derive(serde::Serialize)]
struct SystemInfo {
    cores: usize,
    ram_bytes: u64,
    tier: String,
}

#[tauri::command]
fn system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cores = sys.cpus().len();
    let ram = sys.total_memory() * 1024; // Convert KiB to bytes

    let tier = if ram <= 4 * 1024 * 1024 * 1024 {
        "small".to_string()
    } else if ram <= 12 * 1024 * 1024 * 1024 {
        "medium".to_string()
    } else {
        "large".to_string()
    };

    Ok(SystemInfo {
        cores,
        ram_bytes: ram,
        tier,
    })
}
```

### Phase 4: Frontend Component (`OnboardingWizard.tsx`)

- [ ] **Create component file** `src/components/OnboardingWizard/OnboardingWizard.tsx`
- [ ] **Create types file** `src/components/OnboardingWizard/types.ts`
- [ ] **Create index barrel** `src/components/OnboardingWizard/index.tsx`
- [ ] **Implement state management**:
  - `step: number` (1-7)
  - `scanStatus: 'idle' | 'running' | 'done' | 'error'`
  - `scanData: SystemInfo | null`
  - `selectedPreset: string | null`
  - `installedPresets: Set<string>`
- [ ] **Implement step components**:
  1. Welcome (language selector + start button)
  2. Scan consent (explanation + buttons)
  3. Scan results (display + recommendations)
  4. Model selection (list installed or suggest download)
  5. Conversation guide (templates explanation)
  6. External models guide (links + naming)
  7. Finish (create conversation or explore)
- [ ] **Add progress indicator** (step counter + visual bar)
- [ ] **Add navigation** (Back/Next/Skip buttons)
- [ ] **Handle errors gracefully** (scan failure → manual selection fallback)

**Component Structure**:

```typescript
type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface SystemInfo {
  cores: number;
  ram_bytes: number;
  tier: "small" | "medium" | "large";
}

interface OnboardingWizardProps {
  onComplete: (conversationId?: string) => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [scanStatus, setScanStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [scanData, setScanData] = useState<SystemInfo | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Implementation...
}
```

### Phase 5: Integration into App

- [ ] **Modify `App.tsx`**:
  - Check `localStorage.getItem('onboardingCompleted')` at mount
  - If not set, render `<OnboardingWizard />` fullscreen before normal UI
  - Pass `onComplete` callback to set flag and navigate
- [ ] **Handle completion scenarios**:
  - Create conversation → navigate to Chat
  - Explore later → set flag and show Home
- [ ] **Test localStorage persistence** (clear + reload)

**App.tsx Integration**:

```typescript
const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
  return !localStorage.getItem('onboardingCompleted');
});

if (showOnboarding) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <OnboardingWizard
          onComplete={(conversationId) => {
            localStorage.setItem('onboardingCompleted', 'true');
            setShowOnboarding(false);
            if (conversationId) {
              handleNavigate('chat', conversationId);
            } else {
              handleNavigate('home');
            }
          }}
        />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

### Phase 6: Styling & UX

- [ ] **Design wizard layout** (centered card, responsive)
- [ ] **Add animations** (step transitions, scan loading)
- [ ] **Icons** (lucide-react: Cpu, MemoryStick, Sparkles, Check, etc.)
- [ ] **Dark mode support** (Tailwind dark: variants)
- [ ] **Accessibility**:
  - Proper heading hierarchy (h1, h2)
  - ARIA labels for buttons
  - Keyboard navigation (Tab, Enter, Escape)
  - Focus management between steps

### Phase 7: Testing & Validation

- [ ] **Manual Testing**:
  - Delete `onboardingCompleted` from localStorage
  - Launch app → verify wizard appears
  - Complete all steps → verify conversation created
  - Relaunch → verify wizard does NOT appear
  - Test language switch during onboarding
  - Test scan on different RAM configs (mock if needed)
  - Test skip functionality
  - Test back/next navigation
- [ ] **Edge Cases**:
  - No installed presets → download flow
  - Scan error → fallback to manual selection
  - Server not installed → integrate with InstallLlamaServer modal
- [ ] **Build Validation**:
  - `npm run check:i18n` → 100% parity
  - `npm run check:version` → versions synced
  - `npm run build` → no errors
  - `cargo check` → no warnings
  - Test production build behavior

### Phase 8: Documentation & Cleanup

- [ ] **Update ARCHITECTURE.md** (add onboarding flow diagram)
- [ ] **Update README.md** (mention first-run experience)
- [ ] **Add comments** to complex logic (tier calculation, preset filtering)
- [ ] **Remove console.logs** (keep only error logs)
- [ ] **Update memory files** (`/memories/v2_app.md`)
- [ ] **Update todos.md** in workspace-docs

---

## 🔧 Technical Decisions

### 1. Locale Canonical: **TO CLARIFY**

- Current `i18n.ts` uses `fr` as default fallback
- ARCHITECTURE.md states `en` is canonical
- **Decision needed**: Keep FR or switch to EN?
- **Impact**: Determines which locale to populate first

### 2. Conversation Creation Strategy

- **Option A** (Recommended): Direct creation via `invoke("create_conversation")` in wizard
  - Pros: Seamless UX, faster onboarding
  - Cons: Duplicates some NewConversation logic
- **Option B**: Redirect to `newConversation` view with pre-filled values
  - Pros: Reuses existing logic
  - Cons: Extra navigation step, less guided

**Decision**: Option A (direct creation) for MVP

### 3. Server Installation Integration

- Current: `InstallLlamaServer` modal triggered on Home
- **Proposal**: If server not installed, show mini-step in wizard before model selection
- Alternative: Redirect to Home for server install, then resume wizard
- **Decision**: Mini-step in wizard (step 1.5) for continuity

### 4. Hardware Scan Granularity

- **MVP**: CPU cores + RAM only
- **Future**: GPU detection (CUDA/Metal), disk speed, free space
- **Privacy**: All data processed locally, never stored or transmitted

---

## 🚀 Deployment Plan

### Pre-Merge Checklist

- [ ] All tests pass (manual + validation scripts)
- [ ] i18n parity confirmed across 8 locales
- [ ] No console errors in dev mode
- [ ] Code reviewed (self-review against checklist)
- [ ] Commit messages follow Conventional Commits
- [ ] Branch named `feat/onboarding-wizard`

### Post-Merge Tasks

- [ ] Tag release (if shipped in new version)
- [ ] Update website download page with "New: Guided Setup"
- [ ] Create user documentation (GIF/video of onboarding flow)
- [ ] Monitor user feedback (Discord, GitHub issues)

---

## 📊 Success Metrics

- **Primary**: New users complete onboarding without confusion
- **Secondary**: 80%+ users allow hardware scan
- **Tertiary**: Model recommendations accepted 70%+ of time

---

## 🐛 Known Limitations (MVP)

1. **No version tracking**: Onboarding shown once, period (future: version-based re-trigger)
2. **Single language during flow**: Language switch during wizard not persisted (minor)
3. **No GPU detection**: Only CPU + RAM analyzed
4. **Manual preset download**: If no model installed, user redirected to download UI (not inline)
5. **No rollback**: Can't restart onboarding after completion without clearing localStorage

---

## 📚 References

- **Codebase Analysis**: See workspace-docs/knowledge-base/todos.md (Intent entry 2025-11-18)
- **i18n Guide**: 13-app-i18n-checklist-v2.instructions.md
- **Dependency Management**: 03-dependency-management-v2.instructions.md
- **Code Hygiene**: 04-code-hygiene-v2.instructions.md
- **Architecture**: V2/whytchat-app/ARCHITECTURE.md

---

## ⏱️ Estimated Timeline

- **Phase 1-2** (Planning + i18n): 1-2 hours
- **Phase 3** (Rust backend): 1 hour
- **Phase 4-5** (Frontend + integration): 3-4 hours
- **Phase 6** (Styling): 1-2 hours
- **Phase 7** (Testing): 2 hours
- **Phase 8** (Documentation): 1 hour

**Total**: ~10-12 hours of focused development

---

## 🔄 Next Immediate Actions

1. **CLARIFY**: Canonical locale (FR vs EN)
2. **CLARIFY**: Conversation creation strategy (direct vs redirect)
3. **START**: Add i18n keys to all locales (Phase 2)
4. **START**: Add `sysinfo` dependency to Cargo.toml (Phase 3)

---

**Last Updated**: 2025-11-18
**Assignee**: GitHub Copilot Agent
**Status**: Awaiting clarification on decisions 1-2 before proceeding to Phase 2
