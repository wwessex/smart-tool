/**
 * OneDrive integration hook for syncing SMART actions to user's OneDrive
 * Uses Microsoft Graph API via MSAL authentication
 * 
 * Supports personal, work, and school Microsoft accounts.
 */

import { useState, useCallback, useEffect } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { 
  msalConfig, 
  loginRequest, 
  GRAPH_API_BASE, 
  ONEDRIVE_FOLDER_NAME,
  CONSUMER_TENANT_ID,
  isOneDriveConfigured 
} from '@/lib/msal-config';
import { HistoryItem } from '@/hooks/useSmartStorage';
import { SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';

// Storage keys
const STORAGE_KEYS = {
  connected: 'smartTool.oneDrive.connected',
  userEmail: 'smartTool.oneDrive.userEmail',
  syncEnabled: 'smartTool.oneDrive.syncEnabled',
  lastSync: 'smartTool.oneDrive.lastSync',
  folderId: 'smartTool.oneDrive.folderId',
  accountType: 'smartTool.oneDrive.accountType',
  tenantName: 'smartTool.oneDrive.tenantName',
};

type AccountType = 'personal' | 'work' | null;

interface OneDriveState {
  isConnected: boolean;
  isConnecting: boolean;
  userEmail: string | null;
  syncEnabled: boolean;
  lastSync: string | null;
  accountType: AccountType;
  tenantName: string | null;
  error: string | null;
}

// Create MSAL instance (singleton)
let msalInstance: PublicClientApplication | null = null;

function getMsalInstance(): PublicClientApplication | null {
  if (!isOneDriveConfigured()) {
    return null;
  }
  
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
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
    accountType: (localStorage.getItem(STORAGE_KEYS.accountType) as AccountType) || null,
    tenantName: localStorage.getItem(STORAGE_KEYS.tenantName),
    error: null,
  }));

  // Check if OneDrive is properly configured
  const isConfigured = isOneDriveConfigured();

  /**
   * Fetch organization name for work/school accounts
   */
  const fetchOrganizationName = useCallback(async (token: string): Promise<string | null> => {
    try {
      const response = await fetch(`${GRAPH_API_BASE}/organization`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.value && data.value.length > 0) {
          return data.value[0].displayName || null;
        }
      }
    } catch (err) {
      console.warn('Could not fetch organization name:', err);
    }
    return null;
  }, []);

  /**
   * Connect to OneDrive via Microsoft OAuth popup
   * Shows account picker so users can choose personal/work/school account
   */
  const connect = useCallback(async () => {
    if (!isConfigured) {
      setState(prev => ({ ...prev, error: 'OneDrive integration is not configured. Contact your administrator.' }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const msal = getMsalInstance();
      if (!msal) {
        throw new Error('MSAL not initialized');
      }

      // Ensure MSAL is initialized
      await msal.initialize();

      // Force account picker to show all available accounts
      const response = await msal.loginPopup({
        ...loginRequest,
        prompt: 'select_account',
      });
      
      if (response.account) {
        const email = response.account.username;
        const tenantId = response.account.tenantId;
        
        // Determine account type based on tenant
        const isPersonal = tenantId === CONSUMER_TENANT_ID;
        const accountType: AccountType = isPersonal ? 'personal' : 'work';
        
        // Store basic connection info
        localStorage.setItem(STORAGE_KEYS.connected, 'true');
        localStorage.setItem(STORAGE_KEYS.userEmail, email);
        localStorage.setItem(STORAGE_KEYS.accountType, accountType);
        
        // For work accounts, try to fetch organization name
        let tenantName: string | null = null;
        if (!isPersonal && response.accessToken) {
          tenantName = await fetchOrganizationName(response.accessToken);
          if (tenantName) {
            localStorage.setItem(STORAGE_KEYS.tenantName, tenantName);
          }
        }
        
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          userEmail: email,
          accountType,
          tenantName,
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
  }, [isConfigured, fetchOrganizationName]);

  /**
   * Disconnect from OneDrive
   */
  const disconnect = useCallback(async () => {
    try {
      const msal = getMsalInstance();
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
    localStorage.removeItem(STORAGE_KEYS.accountType);
    localStorage.removeItem(STORAGE_KEYS.tenantName);
    
    setState(prev => ({
      ...prev,
      isConnected: false,
      userEmail: null,
      lastSync: null,
      accountType: null,
      tenantName: null,
    }));
  }, []);

  /**
   * Switch to a different Microsoft account
   */
  const switchAccount = useCallback(async () => {
    await disconnect();
    // Small delay to ensure logout completes, then reconnect
    setTimeout(() => connect(), 500);
  }, [disconnect, connect]);

  /**
   * Get access token for Graph API calls
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const msal = getMsalInstance();
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
  }, []);

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
    isConfigured,
    connect,
    disconnect,
    switchAccount,
    uploadAction,
    setSyncEnabled,
    clearError,
  };
}
