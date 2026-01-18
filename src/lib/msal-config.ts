/**
 * MSAL Configuration for Microsoft OneDrive authentication
 * Uses Microsoft Graph API for file operations
 */

import { Configuration, LogLevel } from '@azure/msal-browser';

// Public client ID for OneDrive integration
// Users can provide their own Azure AD app client ID in settings
const ONEDRIVE_CLIENT_ID = 'YOUR_CLIENT_ID_PLACEHOLDER';

export const msalConfig: Configuration = {
  auth: {
    clientId: ONEDRIVE_CLIENT_ID,
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
    postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : '',
  },
  cache: {
    cacheLocation: 'localStorage',
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error('[MSAL]', message);
            break;
          case LogLevel.Warning:
            console.warn('[MSAL]', message);
            break;
        }
      },
    },
  },
};

// Scopes needed for OneDrive file operations
export const loginRequest = {
  scopes: ['Files.ReadWrite', 'User.Read'],
};

// Graph API base URL
export const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Folder name for SMART Tool actions
export const ONEDRIVE_FOLDER_NAME = 'SMART Tool Actions';
