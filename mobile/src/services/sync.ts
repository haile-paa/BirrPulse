import { api } from '@/lib/api';
import { SYNC_COLLECTIONS, useApp, type CollectionName } from '@/store/useApp';

type Changes = Partial<Record<CollectionName, Array<{ id: string; updatedAt: number }>>>;
interface PullResponse { serverTime: number; changes: Changes }

let running = false;

/** Push local changes since the last sync, then pull remote ones. Last-write-wins on updatedAt. */
export async function syncNow(): Promise<{ pushed: number; pulled: number } | null> {
  if (running) return null;
  running = true;
  try {
    const st = useApp.getState();
    const since = st.settings.lastSync;
    const push: Changes = {};
    let pushed = 0;
    for (const name of SYNC_COLLECTIONS) {
      const docs = (st[name] as Array<{ id: string; updatedAt: number }>).filter((d) => d.updatedAt > since);
      if (docs.length) { push[name] = docs; pushed += docs.length; }
    }
    if (pushed) await api('/sync/push', { method: 'POST', body: JSON.stringify({ changes: push }) });
    const res = await api<PullResponse>(`/sync/pull?since=${since}`);
    let pulled = 0;
    for (const name of SYNC_COLLECTIONS) pulled += res.changes[name]?.length ?? 0;
    useApp.getState().mergeRemote(res.changes as never, res.serverTime);
    return { pushed, pulled };
  } finally {
    running = false;
  }
}
