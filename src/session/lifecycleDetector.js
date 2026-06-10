class GameLifecycleDetector {
  constructor() {
    this._prevInMatch = undefined;
  }

  update(probe) {
    const events = [];
    const inMatch = probe?.inMatch;
    if (typeof inMatch !== 'boolean') return events;

    if (this._prevInMatch === undefined) {
      this._prevInMatch = inMatch;
      return events;
    }

    if (!this._prevInMatch && inMatch) {
      events.push({ type: 'match_started' });
    } else if (this._prevInMatch && !inMatch) {
      events.push({ type: 'match_ended' });
    }

    this._prevInMatch = inMatch;
    return events;
  }
}

module.exports = {
  GameLifecycleDetector,
};

