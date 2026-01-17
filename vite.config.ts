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
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': [
              '@radix-ui/react-dialog', 
              '@radix-ui/react-select', 
              '@radix-ui/react-tabs', 
              '@radix-ui/react-tooltip',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
            ],
            'vendor-motion': ['framer-motion'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          },
        },
      },
      // Reduce chunk size warnings threshold
      chunkSizeWarningLimit: 600,
      // Use esbuild for minification (built-in, fastest)
      minify: 'esbuild',
      // Enable source maps for production debugging (optional)
      sourcemap: false,
      // Target modern browsers for smaller bundles
      target: 'es2020',
      // CSS code splitting
      cssCodeSplit: true,
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
  };
});
