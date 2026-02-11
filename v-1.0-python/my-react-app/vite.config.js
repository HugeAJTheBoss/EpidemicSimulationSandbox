import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const serveBackendImages = () => ({
  name: 'serve-backend-images',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url.startsWith('/sim_frame.png')) {
        const imagePath = path.resolve(__dirname, '../backend/sim_frame.png');
        console.log('Request for /sim_frame.png');
        try {
          if (fs.existsSync(imagePath)) {
            const stat = fs.statSync(imagePath);
            res.writeHead(200, {
              'Content-Type': 'image/png',
              'Content-Length': stat.size,
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            fs.createReadStream(imagePath).pipe(res);
            return;
          }
        } catch (e) {
          console.error('Error serving sim_frame.png:', e);
        }
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveBackendImages()],
  server: {
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/backend_2.0': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend_2.0/, ''),
      }
    }
  }
})

