import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';

$(() => {
  (async () => {
    // 等待 MVU 变量框架初始化完成（之后 stat_data 已可用）
    await waitGlobalInitialized('Mvu');

    const container = document.getElementById('root');
    if (container) {
      createRoot(container).render(<App />);
    }
  })();
});
