import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Plugin to inject build timestamp for cache-busting
function cacheBustPlugin(): Plugin {
  const buildTime = Date.now();
  return {
    name: 'cache-bust',
    transformIndexHtml(html) {
      // Add cache-busting query string to script/link tags and meta tag with build time
      return html
        .replace(
          '</head>',
          `  <meta name="build-version" content="${buildTime}">\n  </head>`
        );
    },
    generateBundle(_, bundle) {
      // Add _headers file for Netlify/Cloudflare Pages with cache control
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: `/*
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/*.html
  Cache-Control: no-cache, no-store, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // Always use relative paths for portable static builds
    base: './',
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), cacheBustPlugin(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // SIMPLIFIED: Minimal chunking to avoid module loading failures
      // Only split out the absolute largest dependencies
      rollupOptions: {
        output: {
        inlineDynamicImports: true,
          // Minimal chunking - just one vendor bundle for reliability
// Hash in filenames for cache busting
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      // Reduce chunk size warnings threshold
      chunkSizeWarningLimit: 500,
      // Use esbuild for minification (built-in, fastest)
      minify: 'esbuild',
      // Disable source maps for production (smaller bundle)
      sourcemap: false,
      // Target modern browsers for smaller bundles
      target: 'es2020',
      // CSS code splitting
      cssCodeSplit: true,
      // Enable tree shaking report in build output
      reportCompressedSize: true,
    },
    // Optimize deps for faster dev startup
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'react-router-dom',
        'framer-motion',
        '@tanstack/react-query',
      ],
      // Exclude heavy deps from pre-bundling if not needed immediately
      exclude: ['@mlc-ai/web-llm'],
    },
    // Enable CSS minification
    css: {
      devSourcemap: false,
    },
    // Performance: Reduce bundle analysis time
    esbuild: {
      // Remove console.logs in production
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      // Minify whitespace and identifiers
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
    },
  };
});
