import { useState } from "react";
import { i18n } from "./i18n";
import { Home } from "./components/Home";
import { Settings } from "./components/Settings";
import { NewConversation } from "./components/NewConversation";
import { Chat } from "./components/Chat";
import { ConversationsList } from "./components/ConversationsList";
import { ServerProvider } from "./contexts/ServerContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ServerStatusIndicator } from "./components/ServerStatusIndicator";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { TitleBar } from "./components/TitleBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import UpdateNotification from "./components/UpdateNotification";

type View = "home" | "chat" | "settings" | "newConversation" | "conversations";

export function App() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleNavigate = (view: string, conversationId?: string) => {
    // Validate view to prevent runtime errors
    const validViews: View[] = [
      "home",
      "chat",
      "settings",
      "newConversation",
      "conversations",
    ];
    if (validViews.includes(view as View)) {
      setCurrentView(view as View);
    } else {
      console.error(`[App] Invalid view attempted: ${view}`);
      setCurrentView("home"); // Fallback to safe default
    }

    if (conversationId) {
      setCurrentConversationId(conversationId);
    }
  };

  // Global keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "h",
      ctrl: true,
      handler: () => setCurrentView("home"),
      description: i18n.t("shortcuts.goHome"),
    },
    {
      key: "n",
      ctrl: true,
      handler: () => setCurrentView("newConversation"),
      description: i18n.t("shortcuts.newConversation"),
    },
    {
      key: "l",
      ctrl: true,
      handler: () => setCurrentView("conversations"),
      description: i18n.t("shortcuts.listConversations"),
    },
    {
      key: "/",
      ctrl: true,
      handler: () => setShowShortcuts(true),
      description: i18n.t("shortcuts.showShortcuts"),
    },
    {
      key: "Escape",
      handler: () => setShowShortcuts(false),
      description: i18n.t("shortcuts.closeModal"),
    },
  ]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ServerProvider>
          {/* Custom Title Bar */}
          <TitleBar onNavigate={handleNavigate} />

          {/* Global Server Status Indicator */}
          <div className="fixed top-12 right-4 z-50">
            <ServerStatusIndicator />
          </div>

          {/* Update Notification */}
          <UpdateNotification />

          {/* Views */}
          {currentView === "home" && <Home onNavigate={handleNavigate} />}
          {currentView === "conversations" && (
            <ConversationsList onNavigate={handleNavigate} />
          )}
          {currentView === "newConversation" && (
            <NewConversation onNavigate={handleNavigate} />
          )}
          {currentView === "settings" && (
            <Settings onNavigate={handleNavigate} />
          )}
          {currentView === "chat" && (
            <Chat
              onNavigate={handleNavigate}
              {...(currentConversationId
                ? { conversationId: currentConversationId }
                : {})}
            />
          )}

          {/* Shortcuts Help Modal */}
          {showShortcuts && (
            <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
          )}
        </ServerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
