# Deployment Instructions

## Quick Start

1. Download the `dist.zip` artifact from GitHub Actions
2. Extract and upload all files to your web hosting
3. Done!

## Cache Clearing (Important for Updates)

When deploying updates, users may see cached versions. To ensure fresh content:

### For Users
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or clear browser cache and reload

### For Hosting
The build includes cache-control headers for:
- **Netlify/Cloudflare Pages**: Uses `_headers` file automatically
- **Apache**: Uses `.htaccess` file automatically  
- **Nginx**: Add to your config:
  ```nginx
  location / {
      add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
  location /assets/ {
      add_header Cache-Control "public, max-age=31536000, immutable";
  }
  ```

## Troubleshooting

### Stuck on Loading Screen
1. Open browser DevTools (F12)
2. Go to Application → Service Workers
3. Click "Unregister" for any workers
4. Go to Application → Storage → Clear site data
5. Reload the page

### Still Having Issues?
- Try incognito/private browsing mode
- Check browser console for errors
- Ensure all files from `dist/` were uploaded

## Build Verification

After upload, verify these files exist:
- `index.html`
- `assets/` folder with JS/CSS files
- `manifest.json`
- `sw.js`
