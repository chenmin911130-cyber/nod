import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 渲染进程: 产物输出到 dist/。base './' 保证 file:// 下资源相对路径正确。
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
