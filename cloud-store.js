// Serialize local mutations, but calculate each one again against the latest
// server document inside a transaction. React updaters never perform I/O.
function createCloudStore({ db, docRef, onData, onError, onPending }) {
  let base = {}, queue = [], busy = false, disposed = false, buffered = null;
  function render() {
    if (disposed) return;
    let view = base;
    for (const entry of queue) {
      try { view = { ...view, ...entry.update(view) }; } catch (_) { /* Validate again on the server. */ }
    }
    onData(view);
    onPending(queue.length);
  }
  async function drain() {
    if (busy || disposed || !queue.length) return;
    busy = true;
    const entry = queue[0];
    buffered = null;
    let succeeded = false;
    try {
      const committed = await db.runTransaction(async tx => {
        const snapshot = await tx.get(docRef);
        if (disposed) throw new Error('La sesión cambió antes de guardar.');
        const current = snapshot.exists ? snapshot.data() : {};
        const patch = entry.update(current);
        // Top-level field masks REPLACE maps, so deleted nested balances stay deleted.
        tx.set(docRef, patch, { mergeFields: Object.keys(patch) });
        return { ...current, ...patch };
      });
      base = committed;
      succeeded = true;
      // Catch up with snapshots received during this operation (including other devices).
      try { const latest = await docRef.get({ source: 'server' }); base = latest.exists ? latest.data() : {}; } catch (_) { /* The transaction itself succeeded. */ }
    } catch (error) {
      if (buffered) base = buffered;
      if (!disposed) onError(error);
    }
    queue.shift();
    busy = false;
    render();
    entry.resolve(succeeded);
    drain();
  }
  return {
    receive(data) { if (disposed) return; if (busy) { buffered = data; } else { base = data; render(); } },
    commit(update) {
      if (disposed) return Promise.resolve(false);
      return new Promise(resolve => { queue.push({ update, resolve }); render(); drain(); });
    },
    dispose() { disposed = true; queue.forEach(entry => entry.resolve(false)); queue = []; }
  };
}
module.exports = { createCloudStore };
