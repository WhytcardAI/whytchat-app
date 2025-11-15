import { i18n, availableLocaleCodes } from "../../i18n";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { InstallLlamaServer } from "../InstallLlamaServer";
import { useTheme } from "../../contexts/ThemeContext";
import {
  Sun,
  Moon,
  MessageSquare,
  Plus,
  List,
  Settings as SettingsIcon,
  Info,
  Lock,
  Cpu,
  Bot,
  Zap,
  Keyboard,
  MessageCircle,
  Heart,
  ExternalLink,
  Coffee,
  Sparkles,
  ShoppingBag,
} from "lucide-react";

type HomeProps = {
  onNavigate: (view: string) => void;
};

export function Home({ onNavigate }: HomeProps) {
  const { theme, toggleTheme } = useTheme();
  const [locale, setLocale] = useState(i18n.getLocale());
  const [hasConversations, setHasConversations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [serverInstalled, setServerInstalled] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [showShop, setShowShop] = useState(false);

  useEffect(() => {
    const handleLocaleChange = () => {
      setLocale(i18n.getLocale());
    };
    window.addEventListener("localechange", handleLocaleChange);
    return () => window.removeEventListener("localechange", handleLocaleChange);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const conversations =
          await invoke<Array<{ id: number; name: string }>>(
            "list_conversations"
          );
        setHasConversations(conversations.length > 0);
      } catch (error) {
        console.error("Failed to load conversations:", error);
        setHasConversations(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const status = await invoke<{ installed: boolean }>(
          "check_llama_server"
        );
        setServerInstalled(status.installed);
        if (!status.installed) {
          setShowInstallModal(true);
        }
      } catch (error) {
        console.error("Failed to check llama-server:", error);
      }
    })();
  }, []);

  const handleLocaleChange = (newLocale: string) => {
    i18n.setLocale(newLocale);
    setLocale(newLocale);
  };

  return (
    <div className="h-[calc(100vh-2.5rem)] bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6 transition-colors overflow-y-auto">
      <div className="max-w-4xl w-full">
        {/* Theme & Language Selector */}
        <div className="flex justify-end gap-2 mb-6">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all"
            title={
              theme === "light" ? "Switch to dark mode" : "Switch to light mode"
            }
          >
            {theme === "light" ? (
              <Moon size={18} className="text-gray-700" />
            ) : (
              <Sun size={18} className="text-yellow-400" />
            )}
          </button>
          <select
            value={locale}
            onChange={(e) => handleLocaleChange(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all"
          >
            {availableLocaleCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>

        {!showAbout && !showShop ? (
          /* Main Content */
          <div className="text-center space-y-8">
            {/* Logo / Title */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-gray-800 dark:bg-gray-700 rounded-lg">
                  <MessageSquare size={36} className="text-white" />
                </div>
              </div>
              <h1 className="text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-3">
                {i18n.t("home.title")}
              </h1>
              <p className="text-base text-gray-600 dark:text-gray-400">
                {i18n.t("home.poweredBy")}
              </p>
            </div>

            {/* Main Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onNavigate("conversations")}
                disabled={!hasConversations || loading}
                className="w-full sm:w-auto px-8 py-3 rounded-lg bg-gray-800 dark:bg-gray-700 text-white font-semibold hover:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <List size={18} /> {i18n.t("home.continue")}
              </button>

              <button
                onClick={() => onNavigate("newConversation")}
                className="w-full sm:w-auto px-8 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Plus size={18} /> {i18n.t("home.new")}
              </button>
            </div>

            {/* Settings, Shop & About links */}
            <div className="pt-2 flex items-center justify-center gap-6">
              <button
                onClick={() => setShowAbout(true)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium flex items-center gap-2 transition-colors"
              >
                <Info size={16} /> {i18n.t("home.about")}
              </button>
              <button
                onClick={() => setShowShop(true)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium flex items-center gap-2 transition-colors"
              >
                <ShoppingBag size={16} /> {i18n.t("home.shop")}
              </button>
              <button
                onClick={() => onNavigate("settings")}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium flex items-center gap-2 transition-colors"
              >
                <SettingsIcon size={16} /> {i18n.t("home.settings")}
              </button>
            </div>

            {/* Footer info */}
            <div className="pt-2">
              <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                100% local • Privacy first
              </p>
            </div>
          </div>
        ) : showAbout ? (
          /* About Section */
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => setShowAbout(false)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium flex items-center gap-2 transition-colors"
            >
              ← {i18n.t("home.title")}
            </button>

            {/* About Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Info size={24} />
                {i18n.t("home.aboutTitle")}
              </h2>

              <div className="space-y-6">
                {/* Privacy */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Lock
                        size={20}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {i18n.t("home.aboutPrivacy")}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {i18n.t("home.aboutPrivacyDesc")}
                    </p>
                  </div>
                </div>

                {/* Local AI */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Cpu
                        size={20}
                        className="text-blue-600 dark:text-blue-400"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {i18n.t("home.aboutLocal")}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {i18n.t("home.aboutLocalDesc")}
                    </p>
                  </div>
                </div>

                {/* Models */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Bot
                        size={20}
                        className="text-purple-600 dark:text-purple-400"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {i18n.t("home.aboutModels")}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {i18n.t("home.aboutModelsDesc")}
                    </p>
                  </div>
                </div>

                {/* Usage */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <Zap
                        size={20}
                        className="text-yellow-600 dark:text-yellow-400"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {i18n.t("home.aboutUsage")}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                      {i18n.t("home.aboutUsageDesc")}
                    </p>
                  </div>
                </div>

                {/* Shortcuts */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <Keyboard
                        size={20}
                        className="text-gray-600 dark:text-gray-400"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {i18n.t("home.aboutShortcuts")}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-line">
                      {i18n.t("home.aboutShortcutsDesc")}
                    </p>
                  </div>
                </div>

                {/* Discord */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <MessageCircle
                        size={20}
                        className="text-indigo-600 dark:text-indigo-400"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {i18n.t("home.aboutDiscord")}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {i18n.t("home.aboutDiscordDesc")}
                    </p>
                    <a
                      href="https://discord.gg/pDzsNsQE"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {i18n.t("home.aboutDiscordButton")}
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>

                {/* Donation */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Heart
                        size={20}
                        className="text-red-600 dark:text-red-400"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {i18n.t("home.aboutDonation")}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {i18n.t("home.aboutDonationDesc")}
                    </p>
                    <div className="flex gap-2">
                      <a
                        href="https://donate.stripe.com/5kQ3cw8Ch7GafgEfyE9k401"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-all"
                        title={i18n.t("home.aboutDonationCoffee")}
                      >
                        <Coffee size={14} />
                        <span className="hidden sm:inline">
                          {i18n.t("home.aboutDonationCoffee")}
                        </span>
                      </a>
                      <a
                        href="https://donate.stripe.com/28E6oI05LgcG8Sg1HO9k402"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-sm font-medium rounded-lg transition-all"
                        title={i18n.t("home.aboutDonationHappiness")}
                      >
                        <Heart size={14} />
                        <span className="hidden sm:inline">
                          {i18n.t("home.aboutDonationHappiness")}
                        </span>
                      </a>
                      <a
                        href="https://donate.stripe.com/aFafZi7ydaSm9Wk86c9k403"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all"
                        title={i18n.t("home.aboutDonationHope")}
                      >
                        <Sparkles size={14} />
                        <span className="hidden sm:inline">
                          {i18n.t("home.aboutDonationHope")}
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Shop Section */
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => setShowShop(false)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium flex items-center gap-2 transition-colors"
            >
              ← {i18n.t("home.title")}
            </button>

            {/* Shop Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <ShoppingBag size={24} />
                {i18n.t("home.shopTitle")}
              </h2>

              <div className="space-y-6">
                {/* Shop Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {i18n.t("home.shopDescription")}
                </p>

                {/* Donation Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Coffee */}
                  <a
                    href="https://donate.stripe.com/5kQ3cw8Ch7GafgEfyE9k401"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-xl p-6 flex flex-col items-center bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-transparent hover:shadow-xl transition-all duration-300"
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-amber-500 to-orange-600" />

                    <div className="relative z-10 w-full flex flex-col items-center">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600 text-white transition-all duration-300 group-hover:scale-110">
                          <Coffee size={24} />
                        </div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                          5€
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent group-hover:text-white transition-all duration-300">
                        {i18n.t("home.shopCoffeeTitle")}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-white/90 text-center transition-colors">
                        {i18n.t("home.shopCoffeeDesc")}
                      </p>
                    </div>
                  </a>

                  {/* Happiness */}
                  <a
                    href="https://donate.stripe.com/28E6oI05LgcG8Sg1HO9k402"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-xl p-6 flex flex-col items-center bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-transparent hover:shadow-xl transition-all duration-300"
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-pink-500 to-rose-600" />

                    <div className="relative z-10 w-full flex flex-col items-center">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-600 text-white transition-all duration-300 group-hover:scale-110">
                          <Heart size={24} />
                        </div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent">
                          50€
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent group-hover:text-white transition-all duration-300">
                        {i18n.t("home.shopHappinessTitle")}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-white/90 text-center transition-colors">
                        {i18n.t("home.shopHappinessDesc")}
                      </p>
                    </div>
                  </a>

                  {/* Hope */}
                  <a
                    href="https://donate.stripe.com/aFafZi7ydaSm9Wk86c9k403"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-xl p-6 flex flex-col items-center bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-transparent hover:shadow-xl transition-all duration-300"
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-blue-500 to-indigo-600" />

                    <div className="relative z-10 w-full flex flex-col items-center">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white transition-all duration-300 group-hover:scale-110">
                          <Sparkles size={24} />
                        </div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                          200€
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent group-hover:text-white transition-all duration-300">
                        {i18n.t("home.shopHopeTitle")}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-white/90 text-center transition-colors">
                        {i18n.t("home.shopHopeDesc")}
                      </p>
                    </div>
                  </a>
                </div>

                {/* Buy me a gift button */}
                <div className="flex justify-center pt-4">
                  <a
                    href="https://donate.stripe.com/dR66oI8Ch7Ga0fKbII"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
                  >
                    <Heart size={20} />
                    {i18n.t("home.shopGift")}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Install Modal */}
      {showInstallModal && !serverInstalled && (
        <InstallLlamaServer
          onComplete={() => {
            setServerInstalled(true);
            setShowInstallModal(false);
          }}
          onCancel={() => setShowInstallModal(false)}
        />
      )}
    </div>
  );
}
