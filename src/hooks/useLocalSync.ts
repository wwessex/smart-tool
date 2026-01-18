/**
 * Local folder sync hook for saving SMART actions to a user-selected folder.
 * Uses the File System Access API for direct folder access.
 * 
 * Works best on desktop Chrome/Edge. If the user selects their OneDrive-synced
 * folder on Windows, files will automatically sync to the cloud.
 */

import { useState, useCallback, useEffect } from 'react';
import { HistoryItem } from '@/hooks/useSmartStorage';
import { SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';

// Type declarations for File System Access API (not in standard TS lib)
interface FSAPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FSADirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  queryPermission(descriptor?: FSAPermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FSAPermissionDescriptor): Promise<PermissionState>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FSAFileHandle>;
}

interface FSAFileHandle {
  readonly kind: 'file';
  readonly name: string;
  createWritable(): Promise<FSAWritableFileStream>;
}

interface FSAWritableFileStream extends WritableStream {
  write(data: string | Blob | ArrayBuffer): Promise<void>;
  close(): Promise<void>;
}

interface FSADirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

// Storage keys for localStorage (simple state)
const STORAGE_KEYS = {
  folderName: 'smartTool.localSync.folderName',
  syncEnabled: 'smartTool.localSync.syncEnabled',
  lastSync: 'smartTool.localSync.lastSync',
};

// IndexedDB config for storing folder handle
const DB_NAME = 'smart-tool-sync';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const FOLDER_HANDLE_KEY = 'folderHandle';

interface LocalSyncState {
  isConnected: boolean;
  isConnecting: boolean;
  folderName: string | null;
  syncEnabled: boolean;
  lastSync: string | null;
  error: string | null;
  isSupported: boolean;
}

/**
 * Open IndexedDB for storing folder handle
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Store folder handle in IndexedDB
 */
async function storeFolderHandle(handle: FSADirectoryHandle): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, FOLDER_HANDLE_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Retrieve folder handle from IndexedDB
 */
async function getFolderHandle(): Promise<FSADirectoryHandle | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(FOLDER_HANDLE_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch {
    return null;
  }
}

/**
 * Delete folder handle from IndexedDB
 */
async function deleteFolderHandle(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(FOLDER_HANDLE_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // Ignore errors when clearing
  }
}

/**
 * Generate a unique filename for file exports
 */
export function generateFilename(item: HistoryItem): string {
  const forename = item.meta.forename?.replace(/[^a-zA-Z0-9]/g, '') || 'Unknown';
  const barrier = item.meta.barrier?.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '-') || 'action';
  const date = item.meta.date || new Date().toISOString().slice(0, 10);
  const shortId = item.id.slice(0, 8);
  
  return `${forename}_${barrier}_${date}_${shortId}.txt`;
}

/**
 * Format action content for file
 */
export function formatActionForFile(item: HistoryItem): string {
  const lines: string[] = [
    'SMART Action Record',
    '==================',
    `Created: ${new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    `Participant: ${item.meta.forename || 'Unknown'}`,
    `Mode: ${item.mode === 'now' ? 'Barrier to Action' : 'Task-Based'}`,
    '',
    '--- Action (English) ---',
    item.text || '',
  ];

  // Add translation if available
  if (item.meta.translatedText && item.meta.translationLanguage) {
    const langInfo = SUPPORTED_LANGUAGES[item.meta.translationLanguage];
    const langLabel = langInfo?.nativeName || item.meta.translationLanguage;
    lines.push('', `--- Translation (${langLabel}) ---`, item.meta.translatedText);
  }

  return lines.join('\n');
}

// Check if File System Access API is supported
const isFileSystemAccessSupported = (): boolean => {
  return 'showDirectoryPicker' in window;
};

export function useLocalSync() {
  const [state, setState] = useState<LocalSyncState>(() => ({
    isConnected: !!localStorage.getItem(STORAGE_KEYS.folderName),
    isConnecting: false,
    folderName: localStorage.getItem(STORAGE_KEYS.folderName),
    syncEnabled: localStorage.getItem(STORAGE_KEYS.syncEnabled) === 'true',
    lastSync: localStorage.getItem(STORAGE_KEYS.lastSync),
    error: null,
    isSupported: isFileSystemAccessSupported(),
  }));

  // Internal ref to the folder handle
  const [folderHandle, setFolderHandle] = useState<FSADirectoryHandle | null>(null);

  // On mount, try to restore folder handle and verify permission
  useEffect(() => {
    let isMounted = true;
    
    async function restoreHandle() {
      if (!isFileSystemAccessSupported()) return;
      
      try {
        const handle = await getFolderHandle();
        if (!handle || !isMounted) return;

        // Check if we still have permission
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        
        if (permission === 'granted') {
          setFolderHandle(handle);
          if (isMounted) {
            setState(prev => ({
              ...prev,
              isConnected: true,
              folderName: handle.name,
            }));
          }
        } else {
          // Permission expired, but we can try to re-request on user action
          // For now, just store the handle so we can request on next write
          setFolderHandle(handle);
        }
      } catch (err) {
        console.warn('Error restoring folder handle:', err);
      }
    }

    restoreHandle();
    
    return () => { isMounted = false; };
  }, []);

  /**
   * Request permission for the stored folder handle
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!folderHandle) return false;
    
    try {
      const permission = await folderHandle.requestPermission({ mode: 'readwrite' });
      return permission === 'granted';
    } catch {
      return false;
    }
  }, [folderHandle]);

  /**
   * Open folder picker and store the selected folder
   */
  const selectFolder = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      setState(prev => ({ 
        ...prev, 
        error: 'Your browser doesn\'t support folder sync. Use Chrome or Edge on desktop.' 
      }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Open folder picker - use type assertion for non-standard API
      const showDirectoryPicker = (window as unknown as { showDirectoryPicker: (opts: FSADirectoryPickerOptions) => Promise<FSADirectoryHandle> }).showDirectoryPicker;
      const handle = await showDirectoryPicker({
        id: 'smart-tool-sync',
        mode: 'readwrite',
        startIn: 'documents',
      });

      // Store in IndexedDB for persistence
      await storeFolderHandle(handle);
      setFolderHandle(handle);

      // Store folder name in localStorage for quick UI display
      localStorage.setItem(STORAGE_KEYS.folderName, handle.name);

      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        folderName: handle.name,
        error: null,
      }));
    } catch (err) {
      // User cancelled or error
      if ((err as Error).name !== 'AbortError') {
        console.error('Folder selection error:', err);
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: 'Failed to select folder. Please try again.',
        }));
      } else {
        setState(prev => ({ ...prev, isConnecting: false }));
      }
    }
  }, []);

  /**
   * Disconnect from the selected folder
   */
  const disconnect = useCallback(async () => {
    await deleteFolderHandle();
    setFolderHandle(null);

    localStorage.removeItem(STORAGE_KEYS.folderName);
    localStorage.removeItem(STORAGE_KEYS.lastSync);

    setState(prev => ({
      ...prev,
      isConnected: false,
      folderName: null,
      lastSync: null,
    }));
  }, []);

  /**
   * Write an action to the selected folder
   */
  const writeAction = useCallback(async (item: HistoryItem): Promise<boolean> => {
    if (!folderHandle || !state.syncEnabled) {
      return false;
    }

    try {
      // Check/request permission
      let permission = await folderHandle.queryPermission({ mode: 'readwrite' });
      
      if (permission !== 'granted') {
        permission = await folderHandle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          setState(prev => ({ 
            ...prev, 
            error: 'Permission denied. Please reconnect the folder.' 
          }));
          return false;
        }
      }

      const filename = generateFilename(item);
      const content = formatActionForFile(item);

      // Create or overwrite file
      const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Update last sync time
      const now = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.lastSync, now);
      setState(prev => ({ ...prev, lastSync: now, error: null }));

      return true;
    } catch (err) {
      console.error('Write error:', err);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to save file. Check folder permissions.' 
      }));
      return false;
    }
  }, [folderHandle, state.syncEnabled]);

  /**
   * Toggle sync enabled/disabled
   */
  const setSyncEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(STORAGE_KEYS.syncEnabled, String(enabled));
    setState(prev => ({ ...prev, syncEnabled: enabled }));
  }, []);

  /**
   * Clear any error
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    selectFolder,
    disconnect,
    writeAction,
    setSyncEnabled,
    clearError,
    requestPermission,
  };
}

// For backwards compatibility, also export as useOneDrive
export { useLocalSync as useOneDrive };
