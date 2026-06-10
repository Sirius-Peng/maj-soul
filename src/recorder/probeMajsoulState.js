async function probeMajsoulState(webContents) {
  const js = `(() => {
    const res = { inMatch: undefined, playerCount: undefined };
    try {
      const g = globalThis;
      const inst = g.GameMgr?.Inst;
      const desktop = g.DesktopMgr?.Inst;

      if (typeof inst?.inGame === 'boolean') res.inMatch = inst.inGame;
      if (typeof inst?.isInGame === 'boolean') res.inMatch = inst.isInGame;
      if (typeof desktop?.inGame === 'boolean') res.inMatch = desktop.inGame;

      const players =
        inst?.players ||
        inst?._players ||
        inst?.player_datas ||
        desktop?.players ||
        desktop?._players;

      if (Array.isArray(players)) res.playerCount = players.length;
      if (typeof players === 'object' && players) {
        const values = Object.values(players);
        if (values.length > 0) res.playerCount = values.length;
      }
    } catch {}

    try {
      if (res.inMatch === undefined) {
        const href = globalThis.location?.href || '';
        if (/\\/match|\\/game|#\\/game/i.test(href)) res.inMatch = true;
      }
    } catch {}

    return res;
  })()`;

  try {
    const result = await webContents.executeJavaScript(js, true);
    if (result && typeof result === 'object') return result;
    return {};
  } catch {
    return {};
  }
}

module.exports = {
  probeMajsoulState,
};

