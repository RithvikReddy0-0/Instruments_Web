export class SessionRecorder {
  constructor(bus = null) {
    this.bus = bus;
    this.events = [];
    this.recording = false;
    this.replaying = false;
    this.startedAt = 0;
    this.timers = [];
  }

  start() {
    this.events = [];
    this.startedAt = performance.now();
    this.recording = true;
  }

  stop() {
    this.recording = false;
    this.replaying = false;
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
    this.saveLocal();
  }

  add(event) {
    if (!this.recording) return;
    this.events.push({ ...event, at: Math.round(performance.now() - this.startedAt) });
  }

  replay(callback) {
    if (!this.events.length) return;
    this.stop();
    this.replaying = true;
    this.timers = this.events.map((event) => window.setTimeout(() => callback(event), event.at));
    const endAt = Math.max(...this.events.map((event) => event.at)) + 900;
    this.timers.push(window.setTimeout(() => {
      this.replaying = false;
      this.timers = [];
    }, endAt));
  }

  saveLocal() {
    const payload = {
      version: 2,
      savedAt: new Date().toISOString(),
      events: this.events
    };
    // localStorage stays as a synchronous fallback; the bus lets the storage
    // layer mirror the take into IndexedDB without the recorder knowing about it.
    localStorage.setItem("instrumenthub-session", JSON.stringify(payload));
    this.bus?.emit("recording:saved", { events: this.events });
  }

  download() {
    const payload = JSON.stringify({
      app: "InstrumentHub",
      version: 2,
      exportedAt: new Date().toISOString(),
      events: this.events
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "instrumenthub-session.json";
    link.click();
    URL.revokeObjectURL(url);
  }
}
