// Copyright (c) 2026 Min Chen (chenmin911130-cyber). All rights reserved.
// Unauthorized copying, modification, redistribution, or submission of this
// file (including as academic coursework) via any medium is strictly prohibited.

import { createRoot } from 'react-dom/client'
import App from './App'
import './App.css'

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(<App />)
}
