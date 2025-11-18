import { Bot, User } from "lucide-react";
import { i18n } from "../../../i18n";
import { MessageToolbar } from "./MessageToolbar";
import { lazy, Suspense } from "react";

// Lazy-load Streamdown (bundles shiki/katex/mermaid) to shrink initial bundle
const Streamdown = lazy(() =>
  import("streamdown").then((m) => ({ default: m.Streamdown }))
);

export type BubbleRole = "user" | "assistant";

type Props = {
  role: BubbleRole;
  content: string;
  timestamp: Date;
  compact?: boolean;
  showAvatars?: boolean;
  isStreaming?: boolean;
  onCopy: () => void;
  onRegenerate?: () => void;
};

export function MessageBubble({
  role,
  content,
  timestamp,
  compact,
  showAvatars,
  isStreaming = false,
  onCopy,
  onRegenerate,
}: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-3xl ${isUser ? "w-auto" : "w-full"}`}>
        <div className="flex items-start gap-3">
          {showAvatars && !isUser && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {isUser ? i18n.t("chat.you") : i18n.t("chat.assistant")}
              </span>
              <span className="text-xs text-gray-400">
                {timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div
              className={`rounded-lg ${compact ? "px-3 py-2 max-w-[92%] text-[13px]" : "px-4 py-3 max-w-[85%]"} ${
                isUser
                  ? compact
                    ? "bg-gray-900/70 text-white backdrop-blur-sm"
                    : "bg-gray-800 dark:bg-gray-700 text-white"
                  : compact
                    ? "bg-gray-800/60 text-gray-100 backdrop-blur-sm border border-transparent"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {isUser ? (
                <p
                  className={`${compact ? "text-[13px] leading-relaxed" : "text-sm leading-relaxed"} whitespace-pre-wrap`}
                >
                  {content}
                </p>
              ) : (
                <div
                  className={`${compact ? "text-[13px] leading-relaxed" : "text-sm leading-relaxed"} prose prose-sm dark:prose-invert max-w-none`}
                >
                  <Suspense
                    fallback={
                      <div className="text-xs text-gray-500">Loading…</div>
                    }
                  >
                    <Streamdown isAnimating={isStreaming}>{content}</Streamdown>
                  </Suspense>
                </div>
              )}
            </div>
            {!isUser && (
              <MessageToolbar
                onCopy={onCopy}
                {...(onRegenerate ? { onRegenerate } : {})}
                {...(typeof compact === "boolean" ? { compact } : {})}
              />
            )}
          </div>
          {showAvatars && isUser && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-600 dark:bg-gray-600 flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
