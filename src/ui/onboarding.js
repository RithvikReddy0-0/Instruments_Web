/**
 * First-visit onboarding tour. Shows once (flag persisted via Storage), is fully
 * dismissible, keyboard accessible, and links each step to a real section.
 */

const STEPS = [
  { title: "Play an instrument", body: "Pick an instrument and play with your mouse, computer keyboard, or a MIDI controller.", target: "#playground", cta: "Open Playground" },
  { title: "Record something", body: "Open the Studio to record, edit notes on the piano roll, and export to MIDI or WAV.", target: "#studio", cta: "Open Studio" },
  { title: "Practice with feedback", body: "Train notes, intervals, chords, scales, and rhythm — scored in real time.", target: "#practice", cta: "Open Practice" },
  { title: "Explore theory & your coach", body: "Browse chords, scales, and the circle of fifths, then let the Coach tell you what to practice next.", target: "#theory", cta: "Open Theory" }
];

export async function initOnboarding({ storage }) {
  const seen = await storage.get("settings", "onboarded");
  if (seen) return;

  let step = 0;
  const overlay = document.createElement("div");
  overlay.className = "onb";
  overlay.innerHTML = `
    <div class="onb-backdrop"></div>
    <div class="onb-card" role="dialog" aria-modal="true" aria-labelledby="onbTitle">
      <p class="onb-eyebrow">Welcome to InstrumentHub Studio</p>
      <h2 id="onbTitle"></h2>
      <p class="onb-body"></p>
      <div class="onb-dots"></div>
      <div class="onb-actions">
        <button class="onb-skip" type="button">Skip tour</button>
        <div class="onb-nav">
          <button class="onb-go" type="button"></button>
          <button class="onb-next" type="button"></button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const titleEl = overlay.querySelector("#onbTitle");
  const bodyEl = overlay.querySelector(".onb-body");
  const dots = overlay.querySelector(".onb-dots");
  const nextBtn = overlay.querySelector(".onb-next");
  const goBtn = overlay.querySelector(".onb-go");

  function renderStep() {
    const s = STEPS[step];
    titleEl.textContent = s.title;
    bodyEl.textContent = s.body;
    nextBtn.textContent = step === STEPS.length - 1 ? "Finish" : "Next";
    goBtn.textContent = s.cta;
    dots.innerHTML = STEPS.map((_, i) => `<span class="onb-dot ${i === step ? "active" : ""}"></span>`).join("");
  }

  async function finish() {
    overlay.remove();
    await storage.put("settings", "onboarded", { at: Date.now() });
  }

  nextBtn.addEventListener("click", () => { if (step < STEPS.length - 1) { step += 1; renderStep(); } else finish(); });
  goBtn.addEventListener("click", () => { document.querySelector(STEPS[step].target)?.scrollIntoView({ behavior: "smooth" }); });
  overlay.querySelector(".onb-skip").addEventListener("click", finish);
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") finish(); });

  renderStep();
  requestAnimationFrame(() => nextBtn.focus());
}
