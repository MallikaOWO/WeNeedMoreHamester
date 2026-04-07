// 自动更新脚本 — 暴露 UpdateService 到全局，供 React 前端调用

const CARD_NAME = '鼠鼠天堂';

const UpdateService = {
  async getLocalVersion(): Promise<string | null> {
    try {
      const char = await getCharacter(CARD_NAME);
      return char.version || null;
    } catch {
      return null;
    }
  },

  async backupWorldbook(): Promise<boolean> {
    const wbName = getCharWorldbookNames('current').primary;
    if (!wbName) return true;
    try {
      const wb = await getWorldbook(wbName);
      await createOrReplaceWorldbook(`${wbName} (更新前备份)`, wb);
      return true;
    } catch {
      return false;
    }
  },

  async installUpdate(downloadUrl: string, _version: string): Promise<boolean> {
    const resp = await fetch(downloadUrl, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`下载失败 (${resp.status})`);
    const blob = await resp.blob();
    // importRawCharacter 会触发角色重载，销毁当前脚本 iframe，
    // 之后的代码不会执行。PNG 本身已包含正确版本号。
    await importRawCharacter(CARD_NAME, blob);
    return true;
  },

  toast(type: 'success' | 'error' | 'info', message: string) {
    toastr[type](message);
  },
};

initializeGlobal('UpdateService', UpdateService);
