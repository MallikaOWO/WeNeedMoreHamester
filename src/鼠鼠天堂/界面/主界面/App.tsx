// 3.2 布局框架 — 资源栏 + 标签页切换

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

const ResourceStrip: React.FC = () => {
  const { state } = useStore();
  const g = state.game;
  return (
    <div className="resource-strip">
      <div className="resource-cell">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
          <span>⚡ 能源</span>
          <span style={{ color: 'var(--color-energy)' }}>{g.energy}/{g.energyCap}</span>
        </div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${Math.min(100, (g.energy / g.energyCap) * 100)}%`, background: 'var(--color-energy)' }} />
        </div>
      </div>
      <div className="resource-cell">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
          <span>✨ 星尘</span>
          <span style={{ color: 'var(--color-stardust)' }}>{g.stardust}</span>
        </div>
      </div>
      <div className="resource-cell">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
          <span>💝 心情</span>
          <span style={{ color: 'var(--color-happiness)' }}>{g.happiness}</span>
        </div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${g.happiness}%`, background: g.happiness > 60 ? 'var(--color-happiness)' : g.happiness > 30 ? 'var(--color-energy)' : 'var(--color-mood)' }} />
        </div>
      </div>
    </div>
  );
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
        color: 'var(--color-text-muted)'
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🐹</div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>正在连接乐园...</div>
      </div>
    );
  }

  const ActiveView = TAB_COMPONENTS[state.tab];
  const guides = getTabGuides(state.game);

  return (
    <div style={{
      maxWidth: 500,
      margin: '0 auto',
      padding: '0 10px 20px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 常驻资源栏 */}
      <ResourceStrip />

      {/* 标签栏 */}
      <div className="tab-bar" style={{ marginTop: 8 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${state.tab === t.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
          >
            {t.label}
            {guides[t.id] && state.tab !== t.id && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-mood)',
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
    </div>
  );
};

const App: React.FC = () => (
  <StoreProvider>
    <AppInner />
  </StoreProvider>
);

export default App;
