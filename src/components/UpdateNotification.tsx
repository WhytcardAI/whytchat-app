import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Download, AlertCircle } from 'lucide-react';

interface UpdateNotificationProps {
  locale: string;
  translations: Record<string, any>;
}

export default function UpdateNotification({ locale, translations }: UpdateNotificationProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [currentVersion, setCurrentVersion] = useState('0.3.1');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const t = translations.update || {};

  useEffect(() => {
    checkForUpdates();
    // Check for updates once per day
    const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async () => {
    try {
      const lastCheck = localStorage.getItem('lastUpdateCheck');
      const now = Date.now();
      
      // Check at most once per day
      if (lastCheck && now - parseInt(lastCheck) < 24 * 60 * 60 * 1000) {
        return;
      }

      const version = await invoke<string | null>('check_update');
      localStorage.setItem('lastUpdateCheck', now.toString());
      
      if (version) {
        setNewVersion(version);
        setUpdateAvailable(true);
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
    }
  };

  const handleUpdateNow = async () => {
    setDownloading(true);
    setError('');
    
    try {
      await invoke('install_update');
      // Update will trigger restart automatically
    } catch (err) {
      setError(err as string);
      setDownloading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Download className="w-6 h-6 text-blue-500" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {t.available || 'Update available'}
          </h3>
          
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-3">
            <p>
              {t.currentVersion || 'Current version'}: <span className="font-medium">{currentVersion}</span>
            </p>
            <p>
              {t.newVersion || 'New version'}: <span className="font-medium text-blue-600 dark:text-blue-400">{newVersion}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-3">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {downloading ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t.downloading || 'Downloading update...'}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleUpdateNow}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                {t.download || 'Update now'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {t.later || 'Later'}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
