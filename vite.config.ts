import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Performance optimizations
      rollupOptions: {
        output: {
          // Code splitting for better caching
          manualChunks: (id) => {
            // React core bundle
            if (id.includes('node_modules/react/') || 
                id.includes('node_modules/react-dom/') || 
                id.includes('node_modules/react-router')) {
              return 'vendor-react';
            }
            // Heavy charting library - separate chunk for lazy loading
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'vendor-charts';
            }
            // Animation library
            if (id.includes('node_modules/framer-motion')) {
              return 'vendor-motion';
            }
            // UI components - Radix primitives
            if (id.includes('node_modules/@radix-ui')) {
              return 'vendor-ui';
            }
            // Form handling
            if (id.includes('node_modules/react-hook-form') || 
                id.includes('node_modules/@hookform') || 
                id.includes('node_modules/zod')) {
              return 'vendor-forms';
            }
            // Query/data fetching
            if (id.includes('node_modules/@tanstack/react-query') ||
                id.includes('node_modules/@supabase')) {
              return 'vendor-data';
            }
            // LLM is huge - keep it completely separate
            if (id.includes('node_modules/@mlc-ai')) {
              return 'vendor-llm';
            }
          },
          // Improve chunk naming for better caching
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
