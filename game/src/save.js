// Saving: cash, missions done and the player's position persist in
// localStorage so Continue picks the run back up.
const KEY = 'palmira-heat-save-v1';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function saveGame(W) {
  try {
    const p = W.player;
    const data = {
      cash: W.cash,
      missionsDone: W.missions.done,
      missionIndex: W.missions.index,
      x: p.onFoot || !p.car ? p.x : p.car.x,
      y: p.onFoot || !p.car ? p.y : p.car.y,
      hp: Math.max(20, p.hp),
      armed: p.armed,
      ammo: p.ammo,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    W.toast = 'GAME SAVED';
    W.toastTimer = 2.5;
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
