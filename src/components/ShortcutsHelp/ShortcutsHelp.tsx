import { X } from "lucide-react";
import { i18n } from "../../i18n";

interface ShortcutsHelpProps {
  onClose: () => void;
}

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {i18n.t("shortcuts.title")}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-6 space-y-6">
          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {i18n.t("shortcuts.navigation")}
            </h3>
            <div className="space-y-2">
              <ShortcutItem
                keys={["Ctrl", "H"]}
                description={i18n.t("shortcuts.goHome")}
              />
              <ShortcutItem
                keys={["Ctrl", "N"]}
                description={i18n.t("shortcuts.newConversation")}
              />
              <ShortcutItem
                keys={["Ctrl", "L"]}
                description={i18n.t("shortcuts.listConversations")}
              />
            </div>
          </div>

          {/* Chat */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {i18n.t("shortcuts.chat")}
            </h3>
            <div className="space-y-2">
              <ShortcutItem
                keys={["Enter"]}
                description={i18n.t("shortcuts.sendMessage")}
              />
              <ShortcutItem
                keys={["Shift", "Enter"]}
                description={i18n.t("shortcuts.newLine")}
              />
              <ShortcutItem
                keys={["Ctrl", "K"]}
                description={i18n.t("shortcuts.clearChat")}
              />
            </div>
          </div>

          {/* General */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {i18n.t("shortcuts.general")}
            </h3>
            <div className="space-y-2">
              <ShortcutItem
                keys={["Ctrl", "/"]}
                description={i18n.t("shortcuts.showShortcuts")}
              />
              <ShortcutItem
                keys={["Escape"]}
                description={i18n.t("shortcuts.closeModal")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ShortcutItemProps {
  keys: string[];
  description: string;
}

function ShortcutItem({ keys, description }: ShortcutItemProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {description}
      </span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index}>
            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span className="mx-1 text-gray-400">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
