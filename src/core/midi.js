/**
 * Web MIDI source.
 *
 * MIDI is just another input device: it translates incoming MIDI messages into
 * the SAME note:on / note:off stream every other input uses, by calling
 * KeyboardManager.emitNoteOn / emitNoteOff. It owns no audio and no
 * instrument knowledge. Diagnostics + device list go into StateManager, which
 * the UI renders from. Sustain (CC64) is published as a "control:sustain"
 * event so it flows through the same code path as the on-screen pedal toggle.
 *
 * `noteNamer` is injected (e.g. AudioEngine.midiToNote) so note-number → name
 * conversion is reused without this module depending on the audio engine.
 */

// MIDI status bytes (high nibble = command, low nibble = channel)
const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;
const PITCH_BEND = 0xe0;
const MOD_WHEEL = 1;
const SUSTAIN_PEDAL = 64;

export class MidiManager {
  constructor(bus, input, state, noteNamer) {
    this.bus = bus;
    this.input = input;
    this.state = state;
    this.noteNamer = noteNamer;
    this.access = null;
    this.ports = new Map(); // id -> MIDIInput (so we don't double-bind)
  }

  async init() {
    if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
      this.state.set("midi.supported", false);
      return false;
    }
    this.state.set("midi.supported", true);
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (error) {
      // API exists but access was refused/unavailable. This is an expected,
      // benign state (no controller / permission declined), so log at info
      // level — keep `supported` true and flag the denial for the UI.
      console.info("[midi] access unavailable:", error?.name || error);
      this.state.set("midi.error", "denied");
      this.state.set("midi.enabled", false);
      return false;
    }
    this.state.set("midi.error", null);
    this.access.onstatechange = () => this.refreshDevices();
    this.refreshDevices();
    this.state.set("midi.enabled", true);
    return true;
  }

  refreshDevices() {
    if (!this.access) return;
    const devices = [];
    const liveIds = new Set();

    this.access.inputs.forEach((port) => {
      liveIds.add(port.id);
      devices.push({
        id: port.id,
        name: port.name || "Unknown device",
        manufacturer: port.manufacturer || "",
        state: port.state
      });
      if (!this.ports.has(port.id)) {
        port.onmidimessage = (message) => this.handleMessage(port, message);
        this.ports.set(port.id, port);
      }
    });

    // Drop handlers for ports that disappeared.
    [...this.ports.keys()].forEach((id) => {
      if (!liveIds.has(id)) this.ports.delete(id);
    });

    const prevCount = (this.state.get("midi.devices") || []).length;
    this.state.set("midi.devices", devices);
    if (devices.length > prevCount) {
      this.bus.emit("toast", { message: `MIDI connected: ${devices[devices.length - 1].name}`, kind: "success" });
    }
  }

  handleMessage(port, message) {
    const [status, data1 = 0, data2 = 0] = message.data;
    const command = status & 0xf0;
    const channel = (status & 0x0f) + 1;

    if (command === NOTE_ON && data2 > 0) {
      const note = this.noteNamer(data1);
      this.input.emitNoteOn(note, data2 / 127, "midi");
      this.report(port, channel, `Note On ${note}`, data2);
    } else if (command === NOTE_OFF || (command === NOTE_ON && data2 === 0)) {
      const note = this.noteNamer(data1);
      this.input.emitNoteOff(note, "midi");
      this.report(port, channel, `Note Off ${note}`, 0);
    } else if (command === CONTROL_CHANGE && data1 === SUSTAIN_PEDAL) {
      const down = data2 >= 64;
      this.bus.emit("control:sustain", { down });
      this.report(port, channel, `Sustain ${down ? "On" : "Off"} (CC64)`, data2);
    } else if (command === CONTROL_CHANGE && data1 === MOD_WHEEL) {
      this.bus.emit("control:modulation", { value: data2 / 127 });
      this.report(port, channel, `Mod Wheel (CC1)`, data2);
    } else if (command === PITCH_BEND) {
      const bend = ((data2 << 7) | data1) - 8192; // 14-bit, centered at 0
      this.bus.emit("control:pitchbend", { value: bend / 8192 });
      this.report(port, channel, "Pitch Bend", data2);
    } else {
      this.report(port, channel, `0x${command.toString(16)} CC${data1}`, data2);
    }
  }

  report(port, channel, label, velocity) {
    this.state.set("midi.last", {
      device: port.name || "Unknown device",
      channel,
      message: label,
      velocity,
      at: Date.now()
    });
  }
}
