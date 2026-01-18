/**
 * MSAL Configuration for Microsoft OneDrive authentication
 * Uses Microsoft Graph API for file operations
 * 
 * SETUP INSTRUCTIONS (One-time admin setup):
 * 1. Go to https://portal.azure.com
 * 2. Navigate to "App registrations" → "New registration"
 * 3. Name: "SMART Action Tool" (or your preferred name)
 * 4. Supported account types: "Accounts in any organizational directory 
 *    (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts"
 * 5. Redirect URI: Select "Single-page application (SPA)" and enter your app URL
 *    (e.g., https://yourdomain.com or http://localhost:5173 for dev)
 * 6. Click Register
 * 7. Copy the "Application (client) ID" and paste it below
 * 8. Go to "API permissions" → "Add a permission" → "Microsoft Graph" 
 *    → "Delegated permissions" → Add "Files.ReadWrite" and "User.Read"
 * 
 * This single Client ID works for ALL users (personal, work, and school accounts).
 */

import { Configuration, LogLevel } from '@azure/msal-browser';

// ============================================================
// IMPORTANT: Replace this with your registered Azure AD App Client ID
// See setup instructions above. This only needs to be done once.
// ============================================================
const ONEDRIVE_CLIENT_ID = 'YOUR_CLIENT_ID_PLACEHOLDER';

export const msalConfig: Configuration = {
  auth: {
    clientId: ONEDRIVE_CLIENT_ID,
    // 'common' authority allows personal, work, and school accounts
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

// Consumer tenant ID (for personal Microsoft accounts)
export const CONSUMER_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';

// Check if a valid Client ID is configured
export function isOneDriveConfigured(): boolean {
  const clientId = msalConfig.auth.clientId;
  return clientId !== 'YOUR_CLIENT_ID_PLACEHOLDER' && clientId.length > 10;
}
