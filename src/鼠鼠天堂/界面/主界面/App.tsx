// 3.2 布局框架 — 标签页切换

import React from 'react';
import { StoreProvider, useStore, type TabId } from './store';
import { getTabGuides } from './guides';
import Overview from './views/Overview';
import Events from './views/Events';
import Facilities from './views/Facilities';
import Hamsters from './views/Hamsters';
import Angels from './views/Angels';
import Log from './views/Log';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'hamsters', label: '鼠鼠' },
  { id: 'facilities', label: '设施' },
  { id: 'angels', label: '天使' },
  { id: 'events', label: '事件' },
  { id: 'log', label: '日志' },
];

const TAB_COMPONENTS: Record<TabId, React.FC> = {
  overview: Overview,
  hamsters: Hamsters,
  facilities: Facilities,
  angels: Angels,
  events: Events,
  log: Log,
};

const AppInner: React.FC = () => {
  const { state, dispatch } = useStore();

  if (state.loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-happiness)'
      }}>
        <div style={{ fontSize: 40, marginBottom: 16, animation: 'wobble 2s infinite' }}>🐹🍭</div>
        <div style={{ fontWeight: 800, letterSpacing: 2 }}>正在接入乐园终端...</div>
      </div>
    );
  }

  const ActiveView = TAB_COMPONENTS[state.tab];
  const guides = getTabGuides(state.game);

  return (
    <div style={{ 
      maxWidth: 500, 
      margin: '0 auto', 
      padding: '16px 12px 40px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 顶部标题栏 (可选) */}
      <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 10 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-text)', textShadow: '0 2px 4px rgba(244, 114, 182, 0.2)' }}>
          🐹 鼠鼠乐园 <span style={{ color: 'var(--color-happiness)' }}>Paradise</span>
        </div>
      </div>

      {/* 标签栏 */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${state.tab === t.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
            style={{ position: 'relative' }}
          >
            {t.label}
            {guides[t.id] && state.tab !== t.id && (
              <span style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--color-mood)',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(248, 113, 113, 0.4)',
                animation: 'pulse 1.5s infinite'
              }} />
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1 }}>
        <ActiveView />
      </div>

      {/* 底部装饰或留白 */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => (
  <StoreProvider>
    <AppInner />
  </StoreProvider>
);

export default App;
