// import tailwindcss from '@tailwindcss/vite';
// import react from '@vitejs/plugin-react';
// import { VitePWA } from 'vite-plugin-pwa';
// import path from 'path';
// import { defineConfig } from 'vite';

// export default defineConfig(() => {
//   return {
//     plugins: [
//       react(),
//       tailwindcss(),
//       VitePWA({
//         registerType: 'autoUpdate',
//         devOptions: {
//           enabled: true, // Evita el 404 en localhost
//         },
//         manifest: {
//           name: 'Mi PWA App',
//           short_name: 'PWAApp',
//           theme_color: '#ffffff',
//           icons: [
//             {
//               src: 'pwa-192x192.png',
//               sizes: '192x192',
//               type: 'image/png',
//             },
//           ],
//         },
//       }),
//     ],
//     resolve: {
//       alias: {
//         '@': path.resolve(__dirname, '.'),
//       },
//     },
//     server: {
//       hmr: process.env.DISABLE_HMR !== 'true',
//       watch: process.env.DISABLE_HMR === 'true' ? null : {},
//       proxy: {
//         '/evolution-api': {
//           target: 'http://localhost:8081',
//           changeOrigin: true,
//           rewrite: (path) => path.replace(/^\/evolution-api/, ''),
//         },
//       },
//     },
//   };
// });

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true, // Evita el 404 en localhost
        },
        manifest: {
          name: 'Mi PWA App',
          short_name: 'PWAApp',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/evolution-api': {
          target: 'https://marvelous-determination-production-ced5.up.railway.app',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/evolution-api/, ''),
        },
      },
    },
  };
});