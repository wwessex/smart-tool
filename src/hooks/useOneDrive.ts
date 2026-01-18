/**
 * OneDrive integration hook for syncing SMART actions to user's OneDrive
 * Uses Microsoft Graph API via MSAL authentication
 */

import { useState, useCallback, useEffect } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError, AccountInfo } from '@azure/msal-browser';
import { msalConfig, loginRequest, GRAPH_API_BASE, ONEDRIVE_FOLDER_NAME } from '@/lib/msal-config';
import { HistoryItem } from '@/hooks/useSmartStorage';
import { SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';

// Storage keys
const STORAGE_KEYS = {
  clientId: 'smartTool.oneDrive.clientId',
  connected: 'smartTool.oneDrive.connected',
  userEmail: 'smartTool.oneDrive.userEmail',
  syncEnabled: 'smartTool.oneDrive.syncEnabled',
  lastSync: 'smartTool.oneDrive.lastSync',
  folderId: 'smartTool.oneDrive.folderId',
};

interface OneDriveState {
  isConnected: boolean;
  isConnecting: boolean;
  userEmail: string | null;
  syncEnabled: boolean;
  lastSync: string | null;
  clientId: string;
  error: string | null;
}

// Create MSAL instance (singleton)
let msalInstance: PublicClientApplication | null = null;

function getMsalInstance(clientId: string): PublicClientApplication | null {
  if (!clientId || clientId === 'YOUR_CLIENT_ID_PLACEHOLDER') {
    return null;
  }
  
  if (!msalInstance || msalInstance.getConfiguration().auth.clientId !== clientId) {
    const config = {
      ...msalConfig,
      auth: {
        ...msalConfig.auth,
        clientId,
      },
    };
    msalInstance = new PublicClientApplication(config);
    msalInstance.initialize().catch(console.error);
  }
  
  return msalInstance;
}

/**
 * Generate a unique filename for OneDrive uploads
 */
export function generateOneDriveFilename(item: HistoryItem): string {
  const forename = item.meta.forename?.replace(/[^a-zA-Z0-9]/g, '') || 'Unknown';
  const barrier = item.meta.barrier?.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '-') || 'action';
  const date = item.meta.date || new Date().toISOString().slice(0, 10);
  const shortId = item.id.slice(0, 8);
  
  return `${forename}_${barrier}_${date}_${shortId}.txt`;
}

/**
 * Format action content for OneDrive file
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

export function useOneDrive() {
  const [state, setState] = useState<OneDriveState>(() => ({
    isConnected: localStorage.getItem(STORAGE_KEYS.connected) === 'true',
    isConnecting: false,
    userEmail: localStorage.getItem(STORAGE_KEYS.userEmail),
    syncEnabled: localStorage.getItem(STORAGE_KEYS.syncEnabled) === 'true',
    lastSync: localStorage.getItem(STORAGE_KEYS.lastSync),
    clientId: localStorage.getItem(STORAGE_KEYS.clientId) || '',
    error: null,
  }));

  // Check if MSAL is properly initialized with valid client ID
  const hasValidClientId = state.clientId && state.clientId !== 'YOUR_CLIENT_ID_PLACEHOLDER';

  /**
   * Update client ID and reinitialize MSAL
   */
  const updateClientId = useCallback((clientId: string) => {
    localStorage.setItem(STORAGE_KEYS.clientId, clientId);
    setState(prev => ({ ...prev, clientId, error: null }));
    // Reset connection when client ID changes
    if (state.isConnected) {
      localStorage.removeItem(STORAGE_KEYS.connected);
      localStorage.removeItem(STORAGE_KEYS.userEmail);
      localStorage.removeItem(STORAGE_KEYS.folderId);
      setState(prev => ({ ...prev, isConnected: false, userEmail: null }));
    }
  }, [state.isConnected]);

  /**
   * Connect to OneDrive via Microsoft OAuth popup
   */
  const connect = useCallback(async () => {
    if (!hasValidClientId) {
      setState(prev => ({ ...prev, error: 'Please enter a valid Azure AD Client ID first.' }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const msal = getMsalInstance(state.clientId);
      if (!msal) {
        throw new Error('MSAL not initialized');
      }

      // Ensure MSAL is initialized
      await msal.initialize();

      // Try popup login
      const response = await msal.loginPopup(loginRequest);
      
      if (response.account) {
        const email = response.account.username;
        localStorage.setItem(STORAGE_KEYS.connected, 'true');
        localStorage.setItem(STORAGE_KEYS.userEmail, email);
        
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          userEmail: email,
        }));
      }
    } catch (err) {
      console.error('OneDrive connection error:', err);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Failed to connect to OneDrive',
      }));
    }
  }, [hasValidClientId, state.clientId]);

  /**
   * Disconnect from OneDrive
   */
  const disconnect = useCallback(async () => {
    try {
      const msal = getMsalInstance(state.clientId);
      if (msal) {
        const accounts = msal.getAllAccounts();
        if (accounts.length > 0) {
          await msal.logoutPopup({ account: accounts[0] });
        }
      }
    } catch (err) {
      console.error('Logout error:', err);
    }

    // Clear local storage
    localStorage.removeItem(STORAGE_KEYS.connected);
    localStorage.removeItem(STORAGE_KEYS.userEmail);
    localStorage.removeItem(STORAGE_KEYS.folderId);
    localStorage.removeItem(STORAGE_KEYS.lastSync);
    
    setState(prev => ({
      ...prev,
      isConnected: false,
      userEmail: null,
      lastSync: null,
    }));
  }, [state.clientId]);

  /**
   * Get access token for Graph API calls
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const msal = getMsalInstance(state.clientId);
    if (!msal) return null;

    try {
      const accounts = msal.getAllAccounts();
      if (accounts.length === 0) {
        throw new Error('No account found');
      }

      const response = await msal.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      return response.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        try {
          const response = await msal.acquireTokenPopup(loginRequest);
          return response.accessToken;
        } catch (popupErr) {
          console.error('Token popup error:', popupErr);
        }
      }
      console.error('Token error:', err);
      return null;
    }
  }, [state.clientId]);

  /**
   * Ensure the SMART Tool Actions folder exists in OneDrive
   */
  const ensureFolderExists = useCallback(async (): Promise<string | null> => {
    // Check if we have cached folder ID
    const cachedFolderId = localStorage.getItem(STORAGE_KEYS.folderId);
    if (cachedFolderId) {
      return cachedFolderId;
    }

    const token = await getAccessToken();
    if (!token) return null;

    try {
      // Try to get existing folder
      const searchResponse = await fetch(
        `${GRAPH_API_BASE}/me/drive/root:/${encodeURIComponent(ONEDRIVE_FOLDER_NAME)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (searchResponse.ok) {
        const folder = await searchResponse.json();
        localStorage.setItem(STORAGE_KEYS.folderId, folder.id);
        return folder.id;
      }

      // Create folder if it doesn't exist
      const createResponse = await fetch(`${GRAPH_API_BASE}/me/drive/root/children`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: ONEDRIVE_FOLDER_NAME,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        }),
      });

      if (createResponse.ok) {
        const folder = await createResponse.json();
        localStorage.setItem(STORAGE_KEYS.folderId, folder.id);
        return folder.id;
      }

      throw new Error('Failed to create folder');
    } catch (err) {
      console.error('Folder creation error:', err);
      return null;
    }
  }, [getAccessToken]);

  /**
   * Upload an action to OneDrive
   */
  const uploadAction = useCallback(async (item: HistoryItem): Promise<boolean> => {
    if (!state.isConnected || !state.syncEnabled) {
      return false;
    }

    const token = await getAccessToken();
    if (!token) {
      console.error('No access token available');
      return false;
    }

    try {
      const folderId = await ensureFolderExists();
      if (!folderId) {
        console.error('Could not ensure folder exists');
        return false;
      }

      const filename = generateOneDriveFilename(item);
      const content = formatActionForFile(item);

      // Upload file to OneDrive
      const response = await fetch(
        `${GRAPH_API_BASE}/me/drive/items/${folderId}:/${encodeURIComponent(filename)}:/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body: content,
        }
      );

      if (response.ok) {
        const now = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.lastSync, now);
        setState(prev => ({ ...prev, lastSync: now }));
        return true;
      }

      console.error('Upload failed:', response.status, await response.text());
      return false;
    } catch (err) {
      console.error('Upload error:', err);
      return false;
    }
  }, [state.isConnected, state.syncEnabled, getAccessToken, ensureFolderExists]);

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
    hasValidClientId,
    connect,
    disconnect,
    uploadAction,
    updateClientId,
    setSyncEnabled,
    clearError,
  };
}
