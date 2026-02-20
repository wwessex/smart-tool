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
      // and cross-origin isolation headers for SharedArrayBuffer support
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: `/*
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless

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
      // Enable cross-origin isolation for SharedArrayBuffer support
      // Required for multi-threaded WASM in local AI inference
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "credentialless",
      },
    },
    plugins: [react(), cacheBustPlugin(), mode === "development" && componentTagger()].filter(Boolean),
    // Build workers as ES modules to support dynamic imports (e.g. @huggingface/transformers)
    worker: {
      format: 'es',
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@smart-tool/browser-native-llm": path.resolve(__dirname, "./browser-native-llm/src/index.ts"),
        "@smart-tool/lengua-materna": path.resolve(__dirname, "./browser-translation/src/index.ts"),
      },
    },
    build: {
      // SIMPLIFIED: Minimal chunking to avoid module loading failures
      // Only split out the absolute largest dependencies
      rollupOptions: {
        output: {
          // Minimal chunking - just one vendor bundle for reliability
          manualChunks: (id) => {
            // Put ALL node_modules in one vendor chunk for maximum reliability
            if (id.includes('node_modules')) {
              // Separate out heavy LLM/AI libraries
              if (id.includes('node_modules/@mlc-ai') ||
                  id.includes('node_modules/@huggingface/transformers') ||
                  id.includes('node_modules/onnxruntime-web')) {
                return 'vendor-llm';
              }
              // Everything else in one reliable vendor chunk
              return 'vendor';
            }
          },
          // Hash in filenames for cache busting
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      // Reduce chunk size warnings threshold
      chunkSizeWarningLimit: 500,
      // CI reliability: avoid requiring the optional "terser" package.
      // (If you later want terser again, add it as a dependency and switch back.)
      minify: 'esbuild',
      // Keep sourcemaps temporarily to make future runtime errors diagnosable
      sourcemap: true,
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
      exclude: ['@mlc-ai/web-llm', 'onnxruntime-web', '@smart-tool/lengua-materna'],

      // Some deps (e.g. transformers.js) contain BigInt literals (0n/1n) which require ES2020+.
      // Ensure the dependency pre-bundler doesn't downlevel to ES2019.
      esbuildOptions: {
        target: 'es2020',
      },
    },
    // Enable CSS minification
    css: {
      devSourcemap: false,
    },
    // Performance: Reduce bundle analysis time
    esbuild: {
      // Keep ES2020 so BigInt literals used by some deps don't break builds.
      target: 'es2020',

      // Remove console.logs in production
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      // Do NOT minify via esbuild when build.minify is 'terser'
      // (keeps transforms predictable across browsers)
      minifyIdentifiers: false,
      minifySyntax: false,
      minifyWhitespace: false,
    },
  };
});
