import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { i18n } from "../../i18n";
import {
  Plus,
  Folder,
  FileText,
  Trash2,
  Clock,
  MessageSquare,
} from "lucide-react";

type Conversation = {
  id: number;
  name: string;
  group_name: string | null;
  preset_id: string;
  created_at: string;
  updated_at: string;
};

type ConversationsListProps = {
  onNavigate: (view: string, conversationId?: string) => void;
};

export function ConversationsList({ onNavigate }: ConversationsListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  async function loadConversations() {
    try {
      setLoading(true);
      setError("");

      const convs = await invoke<Conversation[]>("list_conversations");
      setConversations(convs);

      // Extract unique groups
      const uniqueGroups = Array.from(
        new Set(convs.map((c) => c.group_name).filter((g) => g !== null)),
      ) as string[];
      setGroups(uniqueGroups);

      setLoading(false);
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setError(String(err));
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  const deleteConversation = async (id: number, name: string) => {
    if (!window.confirm(i18n.t("conversationsList.confirmDelete", name))) {
      return;
    }

    try {
      await invoke("delete_conversation", { conversationId: id });
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      setError(String(err));
    }
  };

  const filteredConversations = selectedGroup
    ? conversations.filter((c) => c.group_name === selectedGroup)
    : conversations;

  const groupedConversations = filteredConversations.reduce(
    (acc, conv) => {
      const group = conv.group_name || i18n.t("conversationsList.noGroup");
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(conv);
      return acc;
    },
    {} as Record<string, Conversation[]>,
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return i18n.t("conversationsList.justNow");
    if (diffMins < 60)
      return i18n.t("conversationsList.minutesAgo", String(diffMins));
    if (diffHours < 24)
      return i18n.t("conversationsList.hoursAgo", String(diffHours));
    if (diffDays < 7)
      return i18n.t("conversationsList.daysAgo", String(diffDays));

    return date.toLocaleDateString();
  };

  return (
    <div className="h-[calc(100vh-2.5rem)] bg-gray-50 dark:bg-gray-900 transition-colors overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {i18n.t("conversationsList.title")}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {conversations.length}{" "}
                {i18n.t("conversationsList.conversationsCount")}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => onNavigate("newConversation")}
                className="px-5 py-2.5 rounded-lg bg-gray-800 dark:bg-gray-700 text-white font-semibold hover:bg-gray-700 dark:hover:bg-gray-600 shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              >
                <Plus size={18} /> {i18n.t("conversationsList.new")}
              </button>
              <button
                onClick={() => onNavigate("home")}
                className="px-5 py-2.5 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium shadow-sm hover:shadow-md border border-gray-300 dark:border-gray-600 transition-all"
              >
                ← {i18n.t("home.title")}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Group filter */}
        {groups.length > 0 && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex gap-2 items-center overflow-x-auto pb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {i18n.t("conversationsList.filterByGroup")}:
              </span>
              <button
                onClick={() => setSelectedGroup(null)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedGroup === null
                    ? "bg-gray-800 dark:bg-gray-700 text-white"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
                }`}
              >
                {i18n.t("conversationsList.all")}
              </button>
              {groups.map((group) => (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedGroup === group
                      ? "bg-gray-800 dark:bg-gray-700 text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
                  }`}
                >
                  <Folder size={14} className="inline" /> {group}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {i18n.t("ui.loading")}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && conversations.length === 0 && (
          <div className="text-center py-12">
            <div className="mb-4">
              <MessageSquare size={64} className="mx-auto text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
              {i18n.t("conversationsList.noConversations")}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {i18n.t("conversationsList.createFirst")}
            </p>
            <button
              onClick={() => onNavigate("newConversation")}
              className="px-6 py-3 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-600 transform hover:scale-105 transition-all shadow-lg"
            >
              <Plus size={16} className="inline" />{" "}
              {i18n.t("conversationsList.new")}
            </button>
          </div>
        )}

        {/* Conversations grouped */}
        {!loading &&
          Object.keys(groupedConversations).map((groupName) => (
            <div key={groupName} className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                {groupName === i18n.t("conversationsList.noGroup") ? (
                  <FileText size={18} />
                ) : (
                  <Folder size={18} />
                )}
                {groupName}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({groupedConversations[groupName]?.length ?? 0})
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(groupedConversations[groupName] ?? []).map((conv) => (
                  <div
                    key={conv.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all p-4 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 cursor-pointer group"
                    onClick={() => onNavigate("chat", String(conv.id))}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate flex-1">
                        {conv.name}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id, conv.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-2"
                        title={i18n.t("conversationsList.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                        {i18n.t(`presets.${conv.preset_id}.label`)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      <Clock size={12} className="inline" />{" "}
                      {formatDate(conv.updated_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
