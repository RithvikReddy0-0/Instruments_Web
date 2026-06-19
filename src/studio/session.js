/**
 * Session persistence — saved studio projects in IndexedDB.
 *
 * Thin layer over the shared Storage (the "sessions" object store). The working
 * clip is autosaved separately by the studio into the "settings" store so it
 * survives reload without cluttering the saved-session list.
 */

export class SessionStore {
  constructor(storage) {
    this.storage = storage;
  }

  /** Saved sessions, newest first. */
  async list() {
    const all = await this.storage.list("sessions");
    return (all || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async save(clip) {
    const record = { ...clip, updatedAt: Date.now() };
    await this.storage.put("sessions", record.id, record);
    return record;
  }

  load(id) {
    return this.storage.get("sessions", id);
  }

  async rename(id, name) {
    const clip = await this.load(id);
    if (!clip) return null;
    clip.name = name;
    return this.save(clip);
  }

  remove(id) {
    return this.storage.delete("sessions", id);
  }
}
