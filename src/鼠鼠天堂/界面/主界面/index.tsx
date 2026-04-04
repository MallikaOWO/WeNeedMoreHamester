import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';

$(() => {
  (async () => {
    // 等待 MVU 变量框架初始化完成
    await waitGlobalInitialized('Mvu');

    // 等待当前楼层的 stat_data 被 initvar 正确设置
    await waitUntil(() => {
      try {
        const data = Mvu.getMvuData({ type: 'message', message_id: getCurrentMessageId() });
        return _.has(data, 'stat_data');
      } catch {
        return false;
      }
    });

    const container = document.getElementById('root');
    if (container) {
      createRoot(container).render(<App />);
    }
  })();
});
