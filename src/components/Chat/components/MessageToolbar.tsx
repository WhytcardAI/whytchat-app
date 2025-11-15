import { Copy, RefreshCw } from "lucide-react";
import { i18n } from "../../../i18n";

type Props = {
  onCopy: () => void;
  onRegenerate?: (() => void) | undefined;
  compact?: boolean;
};

export function MessageToolbar({ onCopy, onRegenerate, compact }: Props) {
  const base =
    "text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1";
  return (
    <div className="flex items-center gap-2 mt-2">
      <button onClick={onCopy} className={base}>
        <Copy size={compact ? 10 : 12} /> {i18n.t("chat.copyMessage")}
      </button>
      <button onClick={onRegenerate} className={base} disabled={!onRegenerate}>
        <RefreshCw size={compact ? 10 : 12} /> {i18n.t("chat.regenerate")}
      </button>
    </div>
  );
}
