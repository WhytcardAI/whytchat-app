import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface UpdateSectionProps {
  translations: Record<string, any>;
}

export default function UpdateSection({ translations }: UpdateSectionProps) {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [currentVersion] = useState('0.3.1');
  const [lastChecked, setLastChecked] = useState<string>('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const t = translations.update || {};

  const formatLastChecked = (timestamp: string) => {
    if (!timestamp) return t.lastChecked?.replace('{time}', t.checking || 'Never') || 'Never checked';
    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let timeStr = '';
    if (diffMins < 1) {
      timeStr = 'just now';
    } else if (diffMins < 60) {
      timeStr = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      timeStr = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      timeStr = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    return t.lastChecked?.replace('{time}', timeStr) || `Last checked: ${timeStr}`;
  };

  const handleCheckForUpdates = async () => {
    setChecking(true);
    setError('');
    setUpdateAvailable(false);
    
    try {
      const version = await invoke<string | null>('check_update');
      const now = Date.now().toString();
      localStorage.setItem('lastUpdateCheck', now);
      setLastChecked(now);
      
      if (version) {
        setNewVersion(version);
        setUpdateAvailable(true);
      }
    } catch (err) {
      setError(err as string || t.error || 'Update check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleInstallUpdate = async () => {
    setDownloading(true);
    setError('');
    
    try {
      await invoke('install_update');
      // Update will trigger restart automatically
    } catch (err) {
      setError(err as string || 'Update installation failed');
      setDownloading(false);
    }
  };

  const storedLastCheck = localStorage.getItem('lastUpdateCheck');

  return (
    <div className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {t.settingsTitle || 'Updates'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t.settingsDesc || 'Manage application updates and notifications'}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t.currentVersion || 'Current version'}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              v{currentVersion}
            </p>
          </div>
          
          {updateAvailable && (
            <div className="text-right">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {t.newVersion || 'New version'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                v{newVersion}
              </p>
            </div>
          )}
        </div>

        {storedLastCheck && !checking && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatLastChecked(storedLastCheck)}
          </p>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {updateAvailable && !downloading && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {t.available || 'Update available'}
            </p>
          </div>
        )}

        {!updateAvailable && !checking && !error && lastChecked && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-xs text-green-600 dark:text-green-400">
              {t.upToDate || 'You are up to date!'}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleCheckForUpdates}
            disabled={checking || downloading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? (t.checking || 'Checking...') : (t.manualCheck || 'Check now')}
          </button>

          {updateAvailable && !downloading && (
            <button
              onClick={handleInstallUpdate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              <Download className="w-4 h-4" />
              {t.download || 'Update now'}
            </button>
          )}

          {downloading && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              {t.downloading || 'Downloading...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
