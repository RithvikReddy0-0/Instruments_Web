// Expose an initialization function globally
function initializeAppInstruments() {
    // --- DOM Elements (queried AFTER #instruments page content is loaded) ---
    const instrumentSelectElApp = document.getElementById('instrument-select');
    const volumeControlElApp = document.getElementById('volume');
    const instrumentDisplayAreaElApp = document.getElementById('instrument-display-area');
    const handAnimationOverlayElApp = document.getElementById('hand-animation-overlay');
    const soundStatusBannerElApp = document.getElementById('sound-status');
    const instructionsTextElApp = document.getElementById('instrument-instructions');
    const sideCharacterElApp = document.getElementById('side-character');
    const charMouthElApp = document.getElementById('char-mouth');
    const charPupilLeftElApp = document.getElementById('char-pupil-left');
    const charPupilRightElApp = document.getElementById('char-pupil-right');
    const keyboardHintsElApp = document.getElementById('keyboard-hints');
    
    const metronomeToggleBtnApp = document.getElementById('metronome-toggle');
    const metronomeBpmInputApp = document.getElementById('metronome-bpm');
    const metronomeControlsElApp = document.getElementById('metronome-controls');
    const tunerControlsElApp = document.getElementById('tuner-controls');
    const tunerDisplayElApp = document.getElementById('tuner-display');

    // --- GSAP Animations Manager ---
    const AnimationManager = {
        instrumentLoad(target) {
            if (!target) return;
            gsap.fromTo(target, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" });
        },
        instrumentUnload(target, callback) {
            if (!target) { if (callback) callback(); return; }
            gsap.to(target, { opacity: 0, scale: 0.9, duration: 0.3, ease: "power2.in", onComplete: callback });
        },
        uiElementPopIn(target) {
            if (!target) return;
            gsap.fromTo(target, {scale:0.5, opacity:0}, {scale:1, opacity:1, duration:0.3, ease:"back.out(2)"});
        }
    };

    // --- Audio Engine ---
    class AudioEngineApp {
        constructor() {
            this.audioContext = null; this.masterGain = null; this.soundEnabled = false; this.isInitializing = false;
            this.notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            this.defaultEnvelope = { attack: 0.01, decay: 0.1, sustainLevel: 0.6, sustainTime: 0.15, release: 0.3 };
            this.activeOscillators = {}; // To manage stopping notes, e.g., for wind instruments
        }
        async initAudio() {
            if (this.soundEnabled || this.isInitializing) return true; this.isInitializing = true;
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); await this.audioContext.resume();
                this.masterGain = this.audioContext.createGain();
                if(volumeControlElApp) this.masterGain.gain.setValueAtTime(parseFloat(volumeControlElApp.value), this.audioContext.currentTime);
                this.masterGain.connect(this.audioContext.destination); this.soundEnabled = true;
                if(soundStatusBannerElApp) soundStatusBannerElApp.style.display = 'none'; console.log("AudioContext initialized."); return true;
            } catch (e) {
                console.error("Web Audio API initialization failed:", e);
                if(soundStatusBannerElApp) { soundStatusBannerElApp.textContent = "Web Audio API not supported or failed to start."; soundStatusBannerElApp.style.display = 'block';}
                return false;
            } finally { this.isInitializing = false; }
        }
        noteToFrequency(noteName) {
            if (!noteName || typeof noteName !== 'string') { console.warn("Invalid noteName:", noteName); return 0; }
            const note = noteName.replace(/[0-9#b]/g, '');
            const accidental = noteName.match(/[#b]/g)?.[0] || '';
            const fullNote = note + accidental;
            const octaveMatch = noteName.match(/\d+$/);
            if (!octaveMatch) { console.warn("Invalid note format (no octave):", noteName); return 0; }
            const octave = parseInt(octaveMatch[0]);
            const noteIndex = this.notes.indexOf(fullNote);
            if (noteIndex === -1) { console.warn("Note not found in scale:", fullNote); return 0;}
            const midiNote = 12 + (octave * 12) + noteIndex;
            return 440 * Math.pow(2, (midiNote - 69) / 12);
        }
        
        playNote({ noteId, frequency, oscillatorType = 'triangle', envelope = this.defaultEnvelope, durationScale = 1, isSustained = false }) {
            if (!this.soundEnabled || !this.audioContext ) return;
            if (frequency <= 0) return;

            const now = this.audioContext.currentTime;
            const gainNode = this.audioContext.createGain();
            gainNode.connect(this.masterGain);

            const { attack, decay, sustainLevel, sustainTime, release } = envelope;
            const scaledAttack = attack * durationScale;
            const scaledDecay = decay * durationScale;
            const scaledSustainTime = sustainTime * durationScale;
            const scaledRelease = release * durationScale;
            const totalDuration = scaledAttack + scaledDecay + scaledSustainTime + scaledRelease;

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(1, now + scaledAttack);
            gainNode.gain.linearRampToValueAtTime(sustainLevel, now + scaledAttack + scaledDecay);

            const oscillator = this.audioContext.createOscillator();
            oscillator.connect(gainNode);
            oscillator.type = oscillatorType;
            oscillator.frequency.setValueAtTime(frequency, now);
            oscillator.start(now);

            if (isSustained && noteId) {
                if (this.activeOscillators[noteId]) { // Stop previous if any
                    this.stopNote(noteId, 0.01); // Quick fade out
                }
                this.activeOscillators[noteId] = { oscillator, gainNode, envelope, sustainLevel, scaledAttack, scaledDecay };
                 // Sustain indefinitely until stopNote is called
                gainNode.gain.setValueAtTime(sustainLevel, now + scaledAttack + scaledDecay);
            } else {
                // Non-sustained note, schedule stop
                gainNode.gain.setValueAtTime(sustainLevel, now + scaledAttack + scaledDecay + scaledSustainTime);
                gainNode.gain.linearRampToValueAtTime(0, now + totalDuration);
                oscillator.stop(now + totalDuration + 0.05); // Add small buffer
            }
            SideCharacterManagerApp.reactToPlay();
        }

        stopNote(noteId, customReleaseTime) {
            if (!this.audioContext || !this.activeOscillators[noteId]) return;

            const { oscillator, gainNode, envelope, sustainLevel, scaledAttack, scaledDecay } = this.activeOscillators[noteId];
            const now = this.audioContext.currentTime;
            
            const releaseTime = customReleaseTime !== undefined ? customReleaseTime : (envelope.release || this.defaultEnvelope.release);

            gainNode.gain.cancelScheduledValues(now); // Cancel any previous ramps
            // Start ramp down from current gain value or sustainLevel
            const currentGain = gainNode.gain.value; // Get current gain
            gainNode.gain.setValueAtTime(currentGain, now); 
            gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
            
            oscillator.stop(now + releaseTime + 0.05);
            delete this.activeOscillators[noteId];
        }

        getNoteName(baseNoteIndex, baseOctave, steps) {
            let noteIndex = baseNoteIndex + steps;
            let octave = baseOctave;
            while (noteIndex >= this.notes.length) { noteIndex -= this.notes.length; octave++; }
            while (noteIndex < 0) { noteIndex += this.notes.length; octave--; }
            return this.notes[noteIndex] + octave;
        }
        playMetronomeTick(isStrongBeat = false) {
            if (!this.soundEnabled || !this.audioContext) return;
            const now = this.audioContext.currentTime;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(isStrongBeat ? 880 : 660, now);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(1, now + 0.005);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        }
    }
    const audioEngineApp = new AudioEngineApp();

    // --- AppThemeManager (Stub, as site theme controls it) ---
    window.AppThemeManager = {
        currentTheme: '',
        setTheme: function(themeName) {
            this.currentTheme = themeName;
            // App-specific theme updates could go here if #instrument-app-wrapper had its own classes
            // console.log("App theme synced to:", themeName);
        }
    };

    // --- Side Character Manager (App specific) ---
    const SideCharacterManagerApp = {
        isLookingAtInstrument: false, lookInterval: null,
        setExpression(type) {
            if(!charMouthElApp || !gsap) return;
            let mouthPath = 'M 35 90 Q 50 100 65 90'; // Idle smile
            if (type === 'playing') mouthPath = 'M 40 90 Q 50 95 60 90'; // Smaller smile/o
            else if (type === 'surprised') mouthPath = 'M 45 95 Q 50 85 55 95'; // O shape
            gsap.to(charMouthElApp, { attr: { d: mouthPath }, duration: 0.2, ease: "power1.out" });
            if (type === 'idle') this.lookAround(); else this.lookAtInstrument(type === 'surprised');
        },
        reactToPlay() {
            if(!sideCharacterElApp || !gsap) return;
            gsap.killTweensOf(sideCharacterElApp); // Kill existing bob/bounce
            gsap.fromTo(sideCharacterElApp, { scale: 1, y: 0 }, { scale: 1.05, y: -5, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.out" });
            this.setExpression('playing'); setTimeout(() => this.setExpression('idle'), 300);
        },
        reactToSwitch() {
            if(!sideCharacterElApp || !gsap) return;
             gsap.fromTo(sideCharacterElApp, { scale: 0.8, rotation: -5 }, { scale: 1, rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" } );
            this.setExpression('surprised'); setTimeout(() => this.setExpression('idle'), 600);
        },
        lookAtInstrument(force = false) {
            if ((this.isLookingAtInstrument && !force) || !charPupilLeftElApp || !charPupilRightElApp || !gsap) return;
            clearInterval(this.lookInterval); this.isLookingAtInstrument = true;
            gsap.to([charPupilLeftElApp, charPupilRightElApp], { x: -2, duration: 0.3, ease: "power2.out" });
        },
        lookAround() {
            if (this.isLookingAtInstrument === false && this.lookInterval) return; // Already looking around
            if (!charPupilLeftElApp || !charPupilRightElApp || !gsap) return;
            this.isLookingAtInstrument = false;
            clearInterval(this.lookInterval);
            const movePupils = () => {
                gsap.to(charPupilLeftElApp, { x: Math.random() * 4 - 2, y: Math.random() * 2 - 1, duration: 0.5, ease: "power1.inOut" });
                gsap.to(charPupilRightElApp, { x: Math.random() * 4 - 2, y: Math.random() * 2 - 1, duration: 0.5, ease: "power1.inOut" });
            };
            movePupils(); // Initial move
            this.lookInterval = setInterval(movePupils, 2000 + Math.random() * 2000);
        },
        showKeyboardHints(instrumentKey) {
            if(!keyboardHintsElApp || !gsap) return;
            const instrument = instrumentsApp[instrumentKey];
            keyboardHintsElApp.innerHTML = (instrument && instrument.keyboardHints) ? `<pre>${instrument.keyboardHints}</pre>` : '';
            gsap.to(keyboardHintsElApp, { opacity: (instrument && instrument.keyboardHints) ? 1 : 0, duration: 0.3, ease: "power2.out", onStart: () => {
                if (instrument && instrument.keyboardHints) keyboardHintsElApp.classList.add('visible');
            }, onComplete: () => {
                if (!(instrument && instrument.keyboardHints)) keyboardHintsElApp.classList.remove('visible');
            }});
        },
        init() { this.setExpression('idle'); }
    };

    // --- Hand Animation Manager (App specific) ---
    const HandAnimationManagerApp = {
        currentHandSvg: null,
        initHand(instrumentType, config) {
            if(!handAnimationOverlayElApp || !gsap) return;
            handAnimationOverlayElApp.innerHTML = ''; // Clear previous
            if (instrumentType === 'piano' && config.keyWidth && config.keyHeight) {
                // Simplified piano hand - placeholder logic
                // A full hand animation system is complex. This just shows it can be integrated.
                // console.log("Piano hand animation initialized (placeholder).");
            }
        },
        animateKeyPress(keyElement) {
            if(!handAnimationOverlayElApp || !this.currentHandSvg || currentInstrumentKeyApp !== 'piano' || !gsap) return;
            // Placeholder: GSAP hand animation for piano would go here
            // e.g., move a finger SVG to the keyElement's position
        },
    };

    // --- Keyboard Input Manager (App specific) ---
    const KeyboardInputManagerApp = {
        activeMap: {}, pressedKeys: new Set(),
        setMap(map) { this.activeMap = map || {}; this.pressedKeys.clear(); },
        triggerAction(key, eventType = 'keydown') { // eventType can be 'keydown' or 'keyup'
            const action = this.activeMap[key]; if (!action) return;
            let targetElement = null;

            if (action.type === 'note') {
                if (eventType === 'keydown') {
                    audioEngineApp.playNote({
                        noteId: action.noteName, // For sustained notes
                        frequency: audioEngineApp.noteToFrequency(action.noteName),
                        oscillatorType: action.sound.oscillatorType,
                        envelope: action.sound.envelope,
                        durationScale: action.sound.durationScale || 1,
                        isSustained: action.sound.isSustained || false
                    });
                } else if (eventType === 'keyup' && action.sound.isSustained) {
                    audioEngineApp.stopNote(action.noteName);
                }
                targetElement = document.querySelector(`#instrument-app-wrapper [data-note-id="${action.noteName.replace('#','sharp')}"]`);
                if (targetElement && currentInstrumentKeyApp === 'piano' && eventType === 'keydown') HandAnimationManagerApp.animateKeyPress(targetElement);

            } else if (action.type === 'stringed_note') {
                 if (eventType === 'keydown') { // Stringed notes are not typically sustained by key hold in this model
                    const stringConfig = instrumentsApp[currentInstrumentKeyApp].config.openStrings[action.stringIndex];
                    const baseNoteName = stringConfig.name;
                    const baseNote = baseNoteName.replace(/[0-9#b]/g, '');
                    const baseOctave = parseInt(baseNoteName.match(/\d+/)[0]);
                    const baseNoteIndexVal = audioEngineApp.notes.indexOf(baseNote);
                    const currentNoteName = audioEngineApp.getNoteName(baseNoteIndexVal, baseOctave, action.fretNum);
                    const frequency = audioEngineApp.noteToFrequency(currentNoteName);

                    audioEngineApp.playNote({ frequency, oscillatorType: action.sound.oscillatorType, envelope: action.sound.envelope });
                    
                    const stringDiv = instrumentDisplayAreaElApp.querySelectorAll('.string')[action.stringIndex];
                    if (stringDiv) {
                        stringDiv.classList.add('keyboard-active'); setTimeout(() => stringDiv.classList.remove('keyboard-active'), 200);
                        const noteSegment = stringDiv.querySelectorAll('.note-segment')[action.fretNum];
                        if(noteSegment) {
                            noteSegment.classList.add('keyboard-active-fret'); setTimeout(() => noteSegment.classList.remove('keyboard-active-fret'), 200);
                        }
                    }
                 }
            } else if (action.type === 'drum_pad') {
                if (eventType === 'keydown') {
                    audioEngineApp.playNote({
                        noteId: action.id, // Drum pads are not sustained
                        frequency: action.sound.frequency || audioEngineApp.noteToFrequency(action.sound.noteName) || 200, // Drums use fixed freq or sample
                        oscillatorType: action.sound.oscillatorType,
                        envelope: action.sound.envelope,
                        durationScale: action.sound.durationScale || 1
                    });
                }
                targetElement = document.querySelector(`#instrument-app-wrapper [data-note-id="${action.id}"]`);
            }


            if (targetElement && eventType === 'keydown') {
                targetElement.classList.add('keyboard-active');
            } else if (targetElement && eventType === 'keyup') {
                targetElement.classList.remove('keyboard-active');
            }
        },
        handleKeyDown(e) {
            const key = e.key.toLowerCase();
            if (this.activeMap[key]) {
                e.preventDefault(); // Prevent browser shortcuts
                if (this.pressedKeys.has(key) && !(this.activeMap[key].allowRepeat)) return; // Prevent re-trigger unless allowed

                if (!audioEngineApp.soundEnabled) {
                    audioEngineApp.initAudio().then(success => { if (success) this.triggerAction(key, 'keydown'); });
                } else {
                    this.triggerAction(key, 'keydown');
                }
                this.pressedKeys.add(key);
            }
        },
        handleKeyUp(e) {
            const key = e.key.toLowerCase();
            if (this.activeMap[key]) {
                this.triggerAction(key, 'keyup'); // Handle key up for sustained notes or visual feedback
            }
            this.pressedKeys.delete(key);
        },
        init() {
            document.removeEventListener('keydown', this.handleKeyDownBound); // Remove previous if any
            document.removeEventListener('keyup', this.handleKeyUpBound);
            this.handleKeyDownBound = this.handleKeyDown.bind(this);
            this.handleKeyUpBound = this.handleKeyUp.bind(this);
            document.addEventListener('keydown', this.handleKeyDownBound);
            document.addEventListener('keyup', this.handleKeyUpBound);
        }
    };

    // --- Metronome (App specific) ---
    const MetronomeApp = {
        isPlaying: false, bpm: 120, intervalId: null, beatCount: 0, timeSignature: 4,
        toggle() {
            if(!metronomeToggleBtnApp || !metronomeBpmInputApp) return;
            this.isPlaying = !this.isPlaying;
            metronomeToggleBtnApp.textContent = this.isPlaying ? "ON" : "OFF";
            metronomeToggleBtnApp.setAttribute('aria-pressed', this.isPlaying.toString());
            gsap.to(metronomeToggleBtnApp, {backgroundColor: this.isPlaying ? 'var(--accent-secondary)' : 'var(--bg-main)', duration:0.2});
            if (this.isPlaying) {
                if (!audioEngineApp.soundEnabled) audioEngineApp.initAudio();
                this.bpm = parseInt(metronomeBpmInputApp.value) || 120;
                this.start();
            } else { this.stop(); }
        },
        setBpm(newBpm) {
            this.bpm = Math.max(40, Math.min(240, parseInt(newBpm) || 120));
            if(metronomeBpmInputApp) metronomeBpmInputApp.value = this.bpm;
            if (this.isPlaying) { this.stop(); this.start(); }
        },
        start() {
            this.stop(); // Clear any existing interval
            this.beatCount = 0;
            const intervalTime = (60 / this.bpm) * 1000;
            this.intervalId = setInterval(() => {
                audioEngineApp.playMetronomeTick(this.beatCount % this.timeSignature === 0);
                this.beatCount++;
            }, intervalTime);
        },
        stop() { clearInterval(this.intervalId); this.intervalId = null; }
    };

    // --- Tuner (App specific, Visual only for now) ---
    const TunerApp = {
        show(instrumentConfig) {
            if(!tunerDisplayElApp || !tunerControlsElApp || !gsap) return;
            tunerDisplayElApp.innerHTML = '';
            if (instrumentConfig && instrumentConfig.openStrings && instrumentsApp[currentInstrumentKeyApp].type === 'stringed') {
                instrumentConfig.openStrings.forEach(string => {
                    const stringEl = document.createElement('div');
                    stringEl.className = 'tuner-string';
                    stringEl.textContent = string.name.replace(/[0-9]/g, ''); // Show just note name
                    // Actual tuning logic would require microphone input and pitch detection (complex)
                    // For demo, we'll just display them.
                    stringEl.addEventListener('click', () => { // Play open string sound on click for reference
                        if (!audioEngineApp.soundEnabled) audioEngineApp.initAudio();
                        const freq = audioEngineApp.noteToFrequency(string.name);
                        audioEngineApp.playNote({frequency: freq, oscillatorType: instrumentConfig.sound.oscillatorType, envelope: instrumentConfig.sound.envelope });
                        gsap.fromTo(stringEl, {scale:1.2},{scale:1, duration:0.3, ease:"elastic.out(1,0.5)"});
                    });
                    tunerDisplayElApp.appendChild(stringEl);
                });
                tunerControlsElApp.style.display = 'flex';
                AnimationManager.uiElementPopIn(tunerControlsElApp);
            } else {
                tunerControlsElApp.style.display = 'none';
            }
        }
    };

    // --- Screen Orientation Manager (App specific interaction with global overlay) ---
    const ScreenOrientationManagerApp = {
        isLandscapeSufficient() { return window.innerWidth > window.innerHeight && window.innerWidth >= 600; }, // Adjusted threshold
        checkAndSuggest() {
            const globalOrientationOverlay = document.getElementById('orientation-suggestion-overlay');
            if (!globalOrientationOverlay || !gsap) return;
            
            const instrumentRequiresLandscape = currentInstrumentKeyApp && instrumentsApp[currentInstrumentKeyApp] && 
                                                (instrumentsApp[currentInstrumentKeyApp].type === 'stringed' || 
                                                 instrumentsApp[currentInstrumentKeyApp].type === 'keyboard' ||
                                                 instrumentsApp[currentInstrumentKeyApp].type === 'xylophone');

            if (instrumentRequiresLandscape && !this.isLandscapeSufficient()) {
                 gsap.fromTo(globalOrientationOverlay, {display:"none", opacity:0}, {display:"flex", opacity:1, duration:0.3});
            } else {
                 this.dismissSuggestion(false); // Dismiss without animation if not needed or already landscape
            }
        },
        dismissSuggestion(animate = true) {
            const globalOrientationOverlay = document.getElementById('orientation-suggestion-overlay');
            if(!globalOrientationOverlay || !gsap) return;
            if (animate) {
                gsap.to(globalOrientationOverlay, {opacity:0, duration:0.3, onComplete: () => globalOrientationOverlay.style.display = "none"});
            } else {
                 globalOrientationOverlay.style.display = "none";
                 globalOrientationOverlay.style.opacity = 0;
            }
        },
        init() {
            const globalDismissBtn = document.getElementById('dismiss-orientation-suggestion');
            if(globalDismissBtn) globalDismissBtn.addEventListener('click', () => this.dismissSuggestion());
            window.removeEventListener('resize', this.checkAndSuggestBound);
            this.checkAndSuggestBound = this.checkAndSuggest.bind(this);
            window.addEventListener('resize', this.checkAndSuggestBound);
        }
    };

    // --- Generic UI Helper for Stringed Instruments ---
    function createStringedInstrumentUI(displayEl, config, instrumentClass, currentAudioEngine) {
        displayEl.innerHTML = '';
        const visualWrapper = document.createElement('div');
        visualWrapper.className = `stringed-instrument-visual ${instrumentClass}-visual`; // e.g. guitar-visual
        displayEl.appendChild(visualWrapper);

        const container = document.createElement('div');
        container.className = `stringed-instrument ${instrumentClass}`; // e.g. guitar
        visualWrapper.appendChild(container);

        const headstock = document.createElement('div'); headstock.className = 'headstock';
        config.openStrings.forEach((s, i) => {
            const tuner = document.createElement('div');
            tuner.className = `tuner tuner-${i}`;
            headstock.appendChild(tuner);
        });
        container.appendChild(headstock);

        const neck = document.createElement('div'); neck.className = 'neck';
        const nut = document.createElement('div'); nut.className = 'nut'; neck.appendChild(nut);
        const fretboard = document.createElement('div'); fretboard.className = 'fretboard';
        fretboard.id = `${instrumentClass}-fretboard`; neck.appendChild(fretboard);
        container.appendChild(neck);
        
        const body = document.createElement('div'); body.className = 'body';
        if (instrumentClass === 'violin') {
            const fHolesContainer = document.createElement('div'); fHolesContainer.className = 'f-holes-container';
            const fHole1 = document.createElement('div'); fHole1.className = 'sound-hole'; fHolesContainer.appendChild(fHole1);
            const fHole2 = document.createElement('div'); fHole2.className = 'sound-hole'; fHolesContainer.appendChild(fHole2);
            body.appendChild(fHolesContainer);
        } else if (instrumentClass !== 'bass-guitar') { // Bass guitars often don't have a visible sound hole
             const soundHole = document.createElement('div'); soundHole.className = 'sound-hole'; body.appendChild(soundHole);
        }
        const bridge = document.createElement('div'); bridge.className = 'bridge'; body.appendChild(bridge);
         if (instrumentClass === 'violin') {
            const tailpiece = document.createElement('div'); tailpiece.className = 'tailpiece'; body.appendChild(tailpiece);
        }
        container.appendChild(body);


        const fretboardEl = document.getElementById(`${instrumentClass}-fretboard`);
        if (!fretboardEl) { console.error("Fretboard element not found for", instrumentClass); return; }

        const { numFrets, openStrings, fretMarkers, sound, isFretless } = config;
        
        requestAnimationFrame(() => { // Ensure fretboard has dimensions
            const fretboardHeight = fretboardEl.offsetHeight;
            if (fretboardHeight === 0 && displayEl.checkVisibility()) { // Check if visible
                console.warn(`${instrumentClass} Fretboard height is 0, retrying render.`);
                setTimeout(() => createStringedInstrumentUI(displayEl, config, instrumentClass, currentAudioEngine), 100);
                return;
            }

            const fretPositions = [];
            for (let i = 0; i < numFrets + 1; i++) {
                const fretY = (i / (numFrets + 0.5)) * fretboardHeight * 0.95 + (fretboardHeight * 0.025);
                fretPositions.push(fretY);
                if (i > 0 && !isFretless) {
                    const fretEl = document.createElement('div'); fretEl.classList.add('fret');
                    fretEl.style.top = `${fretY}px`; fretboardEl.appendChild(fretEl);
                }
                if (fretMarkers && fretMarkers.includes(i) && i > 0 && !isFretless) {
                    const marker = document.createElement('div'); marker.classList.add('fret-marker');
                    const prevFretY = fretPositions[i-1];
                    marker.style.top = `${(prevFretY + fretY) / 2}px`;
                    fretboardEl.appendChild(marker);
                    if (i === 12 && (instrumentClass === 'guitar' || instrumentClass === 'ukulele' || instrumentClass === 'bass-guitar')) { // Double dot at 12th
                        const marker2 = marker.cloneNode();
                        marker.style.transform = 'translateX(-50%) translateY(-6px)';
                        marker2.style.transform = 'translateX(-50%) translateY(6px)';
                        fretboardEl.appendChild(marker2);
                    }
                }
            }

            const stringContainer = document.createElement('div'); stringContainer.classList.add('string-container');
            openStrings.forEach((os, stringIndex) => {
                const stringDiv = document.createElement('div');
                stringDiv.classList.add('string', os.class || `string-idx-${stringIndex}`);
                stringDiv.style.width = `${os.thickness || 2}px`;

                const baseNoteName = os.name;
                const baseNote = baseNoteName.replace(/[0-9#b]/g, '');
                const baseOctave = parseInt(baseNoteName.match(/\d+/)[0]);
                const baseNoteIndexVal = currentAudioEngine.notes.indexOf(baseNote);

                for (let fretNum = 0; fretNum <= numFrets; fretNum++) {
                    const noteSegment = document.createElement('div');
                    noteSegment.classList.add('note-segment');
                    const topY = (fretNum === 0) ? 0 : fretPositions[fretNum-1];
                    const bottomY = fretPositions[fretNum];
                    noteSegment.style.top = `${topY}px`; noteSegment.style.height = `${bottomY - topY}px`;

                    const currentNoteName = currentAudioEngine.getNoteName(baseNoteIndexVal, baseOctave, fretNum);
                    const frequency = currentAudioEngine.noteToFrequency(currentNoteName);
                    noteSegment.dataset.noteId = `${instrumentClass}-s${stringIndex}-f${fretNum}-${currentNoteName.replace('#','sharp')}`;

                    const play = () => {
                         if (!currentAudioEngine.soundEnabled) {
                            currentAudioEngine.initAudio().then(success => {
                                if (success) { currentAudioEngine.playNote({ frequency, oscillatorType: sound.oscillatorType, envelope: sound.envelope }); animateString(stringDiv); }
                            });
                        } else { currentAudioEngine.playNote({ frequency, oscillatorType: sound.oscillatorType, envelope: sound.envelope }); animateString(stringDiv); }
                    };
                    noteSegment.addEventListener('mousedown', (e) => { e.preventDefault(); play(); });
                    noteSegment.addEventListener('touchstart', (e) => { e.preventDefault(); play(); }, { passive: false });
                    stringDiv.appendChild(noteSegment);
                }
                stringContainer.appendChild(stringDiv);
            });
            fretboardEl.appendChild(stringContainer);
        });

        function animateString(stringEl) {
            stringEl.classList.add('plucked');
            setTimeout(() => stringEl.classList.remove('plucked'), 150);
        }
    }

    // --- Instrument Definitions (App specific) ---
    let currentInstrumentKeyApp = '';
    const instrumentsApp = {
        piano: {
            name: "Piano", type: "keyboard",
            instructions: "Click a key or use keyboard (ASDFGHJ for white keys C4-B4, WETYU for black keys).",
            keyboardHints: "C4-B4 White: A S D F G H J\nC#4-A#4 Black: W E T Y U",
            config: {
                startNote: 'C3', numOctaves: 2, keyWidth: 0, keyHeight: 0, // keyWidth/Height for HandAnim
                sound: { oscillatorType: 'triangle', envelope: { attack: 0.005, decay: 0.7, sustainLevel: 0.4, sustainTime: 0.2, release: 0.5 }, durationScale: 1.8 }
            },
            render: function(displayEl, audioEng) {
                displayEl.innerHTML = '';
                const visualWrapper = document.createElement('div'); visualWrapper.className = 'piano-visual'; displayEl.appendChild(visualWrapper);
                const pianoContainer = document.createElement('div'); pianoContainer.className = 'piano-keyboard'; visualWrapper.appendChild(pianoContainer);

                const { startNote, numOctaves, sound } = this.config;
                const baseNote = startNote.replace(/[0-9#b]/g, ''); const baseOctave = parseInt(startNote.match(/\d+/)[0]);
                let whiteKeysRendered = 0; const keysData = [];
                const totalSemitones = numOctaves * 12;
                for (let i = 0; i < totalSemitones; i++) {
                    const noteNameFull = audioEng.getNoteName(audioEng.notes.indexOf(baseNote), baseOctave, i);
                    const isBlackKey = noteNameFull.includes('#');
                    keysData.push({ noteNameFull, isBlackKey, frequency: audioEng.noteToFrequency(noteNameFull) });
                    if (!isBlackKey) whiteKeysRendered++;
                }
                this.config.keyHeight = pianoContainer.offsetHeight; // For hand animation (rough)
                this.config.keyWidth = pianoContainer.offsetWidth / whiteKeysRendered;

                let currentWhiteKeyIndex = 0;
                keysData.forEach(keyData => {
                    const keyEl = document.createElement('div');
                    keyEl.classList.add('piano-key', keyData.isBlackKey ? 'black-key' : 'white-key');
                    keyEl.dataset.noteId = keyData.noteNameFull.replace('#','sharp');
                    const play = () => {
                         if (!audioEng.soundEnabled) { audioEng.initAudio().then(s => s && audioEng.playNote({...sound, frequency: keyData.frequency, noteId: keyData.noteNameFull }) && keyEl.classList.add('pressed') ); }
                         else { audioEng.playNote({...sound, frequency: keyData.frequency, noteId: keyData.noteNameFull }); keyEl.classList.add('pressed'); }
                         setTimeout(()=>keyEl.classList.remove('pressed'), 150); HandAnimationManagerApp.animateKeyPress(keyEl);
                    };
                    keyEl.addEventListener('mousedown', (e) => { e.preventDefault(); play(); });
                    keyEl.addEventListener('touchstart', (e) => { e.preventDefault(); play(); }, { passive: false });
                    pianoContainer.appendChild(keyEl);
                    if (keyData.isBlackKey) {
                        keyEl.style.position = 'absolute'; keyEl.style.height = '60%';
                        keyEl.style.width = `calc(${100 / whiteKeysRendered}% * 0.6)`;
                        keyEl.style.left = `calc(${(currentWhiteKeyIndex -1) * (100 / whiteKeysRendered)}% + (${100 / whiteKeysRendered}% * 0.65))`; // Adjusted for better centering
                        keyEl.style.zIndex = '1';
                    } else { keyEl.style.width = `${100 / whiteKeysRendered}%`; currentWhiteKeyIndex++; }
                });
                HandAnimationManagerApp.initHand('piano', this.config);
            },
            getKeyboardMap: function() {
                return {
                    'a': { type: 'note', noteName: 'C4', sound: this.config.sound }, 's': { type: 'note', noteName: 'D4', sound: this.config.sound },
                    'd': { type: 'note', noteName: 'E4', sound: this.config.sound }, 'f': { type: 'note', noteName: 'F4', sound: this.config.sound },
                    'g': { type: 'note', noteName: 'G4', sound: this.config.sound }, 'h': { type: 'note', noteName: 'A4', sound: this.config.sound },
                    'j': { type: 'note', noteName: 'B4', sound: this.config.sound }, 'k': { type: 'note', noteName: 'C5', sound: this.config.sound },
                    'w': { type: 'note', noteName: 'C#4', sound: this.config.sound }, 'e': { type: 'note', noteName: 'D#4', sound: this.config.sound },
                    't': { type: 'note', noteName: 'F#4', sound: this.config.sound }, 'y': { type: 'note', noteName: 'G#4', sound: this.config.sound },
                    'u': { type: 'note', noteName: 'A#4', sound: this.config.sound },
                };
            }
        },
        acousticGuitar: {
            name: "Acoustic Guitar", type: "stringed",
            instructions: "Click a fret or use keyboard (see hints).",
            keyboardHints: "E2: Q W E R T\nA2: A S D F G\nD3: Z X C V B\n(Frets 0-4 for first 3 strings)",
            config: {
                numFrets: 15, openStrings: [
                    { name: 'E2', thickness: 3.5 }, { name: 'A2', thickness: 3.0 }, { name: 'D3', thickness: 2.5 },
                    { name: 'G3', thickness: 2.0 }, { name: 'B3', thickness: 1.5 }, { name: 'E4', thickness: 1.0 }
                ], fretMarkers: [3, 5, 7, 9, 12, 15],
                sound: { oscillatorType: 'triangle', envelope: { attack: 0.005, decay: 0.4, sustainLevel: 0.3, sustainTime: 0.5, release: 0.6 } }
            },
            render: function(displayEl, audioEng) { createStringedInstrumentUI(displayEl, this.config, 'guitar', audioEng); },
            getKeyboardMap: function() {
                const map = {}; const keys = [['q','w','e','r','t'], ['a','s','d','f','g'], ['z','x','c','v','b']];
                for(let sIdx = 0; sIdx < keys.length; sIdx++) {
                     for (let fIdx = 0; fIdx < Math.min(keys[sIdx].length, this.config.numFrets + 1); fIdx++) {
                        map[keys[sIdx][fIdx]] = { type: 'stringed_note', stringIndex: sIdx, fretNum: fIdx, sound: this.config.sound };
                    }
                } return map;
            }
        },
        drumMachine: {
            name: "Drum Machine", type: "percussion",
            instructions: "Click pads or use keyboard (see hints).",
            keyboardHints: "Kick: Q, Snare: W, Hat: E\nClap: A, Tom1: S, Tom2: D",
            config: {
                pads: [
                    { id: 'kick', label: 'Kick', sound: { oscillatorType: 'sine', frequency: 60, envelope: { attack: 0.001, decay: 0.15, sustainLevel: 0.01, sustainTime:0.01, release: 0.02 } } },
                    { id: 'snare', label: 'Snare', sound: { oscillatorType: 'triangle', frequency: 220, envelope: { attack: 0.001, decay: 0.1, sustainLevel: 0.1, sustainTime:0.01, release: 0.05 } } }, // Simplified, real snare is noise based
                    { id: 'hihat', label: 'Hi-Hat', sound: { oscillatorType: 'square', frequency: 800, envelope: { attack: 0.001, decay: 0.05, sustainLevel: 0.05, sustainTime:0.01, release: 0.03 } } },
                    { id: 'clap', label: 'Clap', sound: { oscillatorType: 'triangle', frequency: 300, envelope: { attack: 0.005, decay: 0.08, sustainLevel: 0.1, sustainTime:0.01, release: 0.04 } } },
                    { id: 'tom1', label: 'Tom 1', sound: { oscillatorType: 'sine', frequency: 150, envelope: { attack: 0.002, decay: 0.2, sustainLevel: 0.01, sustainTime:0.01, release: 0.03 } } },
                    { id: 'tom2', label: 'Tom 2', sound: { oscillatorType: 'sine', frequency: 120, envelope: { attack: 0.002, decay: 0.25, sustainLevel: 0.01, sustainTime:0.01, release: 0.03 } } },
                ],
                sound: { /* default for pads if not specified */ }
            },
            render: function(displayEl, audioEng) {
                displayEl.innerHTML = '';
                const visualWrapper = document.createElement('div'); visualWrapper.className = 'drum-machine-visual'; displayEl.appendChild(visualWrapper);
                const padsContainer = document.createElement('div'); padsContainer.className = 'drum-pads'; visualWrapper.appendChild(padsContainer);
                this.config.pads.forEach(padConfig => {
                    const padEl = document.createElement('div'); padEl.className = 'drum-pad';
                    padEl.textContent = padConfig.label; padEl.dataset.noteId = padConfig.id;
                    const play = () => {
                        if (!audioEng.soundEnabled) { audioEng.initAudio().then(s => s && audioEng.playNote({ ...padConfig.sound, noteId: padConfig.id}) && padEl.classList.add('pressed')); }
                        else { audioEng.playNote({ ...padConfig.sound, noteId: padConfig.id }); padEl.classList.add('pressed'); }
                        setTimeout(()=>padEl.classList.remove('pressed'), 100);
                    };
                    padEl.addEventListener('mousedown', (e) => { e.preventDefault(); play(); });
                    padEl.addEventListener('touchstart', (e) => { e.preventDefault(); play(); }, { passive: false });
                    padsContainer.appendChild(padEl);
                });
            },
            getKeyboardMap: function() {
                const map = {}; const keys = ['q','w','e','a','s','d','z','x','c'];
                this.config.pads.forEach((pad, i) => {
                    if (keys[i]) map[keys[i]] = { type: 'drum_pad', id: pad.id, sound: pad.sound };
                });
                return map;
            }
        },
        ukulele: {
            name: "Ukulele", type: "stringed",
            instructions: "Click frets or use keyboard (QWER: G-str, ASDF: C-str, etc.).",
            keyboardHints: "G4: Q W E R\nC4: A S D F\nE4: Z X C V\nA4: U I O P\n(Frets 0-3)",
            config: {
                numFrets: 12, openStrings: [
                    { name: 'G4', thickness: 2.5 }, { name: 'C4', thickness: 3 },
                    { name: 'E4', thickness: 2 }, { name: 'A4', thickness: 1.5 }
                ], fretMarkers: [3, 5, 7, 10, 12],
                sound: { oscillatorType: 'sine', envelope: { attack: 0.01, decay: 0.3, sustainLevel: 0.2, sustainTime: 0.3, release: 0.4 } }
            },
            render: function(displayEl, audioEng) { createStringedInstrumentUI(displayEl, this.config, 'ukulele', audioEng); },
            getKeyboardMap: function() {
                const map = {}; const keys = [['q','w','e','r'],['a','s','d','f'],['z','x','c','v'],['u','i','o','p']];
                this.config.openStrings.forEach((str, sIdx) => {
                    for (let fIdx = 0; fIdx < Math.min(keys[sIdx].length, this.config.numFrets + 1); fIdx++) {
                        map[keys[sIdx][fIdx]] = { type: 'stringed_note', stringIndex: sIdx, fretNum: fIdx, sound: this.config.sound };
                    }
                }); return map;
            }
        },
        violin: {
            name: "Violin", type: "stringed",
            instructions: "Click on the fingerboard or use keyboard. Notes sustain while key is pressed.",
            keyboardHints: "G3: Q W E R\nD4: A S D F\nA4: Z X C V\nE5: U I O P\n(Positions 0-3, sustained)",
            config: {
                numFrets: 7, // Simplified "positions" for violin
                isFretless: true, // Visual cue for violin
                openStrings: [ { name: 'G3', thickness: 2.5 }, { name: 'D4', thickness: 2 }, { name: 'A4', thickness: 1.5 }, { name: 'E5', thickness: 1 } ],
                fretMarkers: [], // No fret markers for violin typically
                sound: { oscillatorType: 'sawtooth', isSustained: true, envelope: { attack: 0.05, decay: 0.1, sustainLevel: 0.7, release: 0.3 } }
            },
            render: function(displayEl, audioEng) { createStringedInstrumentUI(displayEl, this.config, 'violin', audioEng); },
            getKeyboardMap: function() {
                const map = {}; const keys = [['q','w','e','r'],['a','s','d','f'],['z','x','c','v'],['u','i','o','p']];
                this.config.openStrings.forEach((str, sIdx) => {
                    for (let fIdx = 0; fIdx < Math.min(keys[sIdx].length, this.config.numFrets + 1); fIdx++) {
                        // For sustained stringed notes, we map to a 'note' type with the calculated note name
                        const baseNoteName = this.config.openStrings[sIdx].name;
                        const baseNote = baseNoteName.replace(/[0-9#b]/g, '');
                        const baseOctave = parseInt(baseNoteName.match(/\d+/)[0]);
                        const baseNoteIndexVal = audioEngineApp.notes.indexOf(baseNote);
                        const currentNoteName = audioEngineApp.getNoteName(baseNoteIndexVal, baseOctave, fIdx);
                        map[keys[sIdx][fIdx]] = { type: 'note', noteName: currentNoteName, sound: this.config.sound, allowRepeat: false };
                    }
                }); return map;
            }
        },
        bassGuitar: {
            name: "Bass Guitar", type: "stringed",
            instructions: "Click a fret or use keyboard.",
            keyboardHints: "E1: Q W E R T\nA1: A S D F G\nD2: Z X C V B\nG2: Y U I O P\n(Frets 0-4)",
            config: {
                numFrets: 15, openStrings: [
                    { name: 'E1', thickness: 4.5 }, { name: 'A1', thickness: 4.0 },
                    { name: 'D2', thickness: 3.5 }, { name: 'G2', thickness: 3.0 }
                ], fretMarkers: [3, 5, 7, 9, 12, 15],
                sound: { oscillatorType: 'sine', envelope: { attack: 0.01, decay: 0.5, sustainLevel: 0.4, sustainTime: 0.6, release: 0.7 } }
            },
            render: function(displayEl, audioEng) { createStringedInstrumentUI(displayEl, this.config, 'bass-guitar', audioEng); },
            getKeyboardMap: function() {
                const map = {}; const keys = [['q','w','e','r','t'],['a','s','d','f','g'],['z','x','c','v','b'],['y','u','i','o','p']];
                this.config.openStrings.forEach((str, sIdx) => {
                    if (!keys[sIdx]) return;
                    for (let fIdx = 0; fIdx < Math.min(keys[sIdx].length, this.config.numFrets + 1); fIdx++) {
                        map[keys[sIdx][fIdx]] = { type: 'stringed_note', stringIndex: sIdx, fretNum: fIdx, sound: this.config.sound };
                    }
                }); return map;
            }
        },
        xylophone: {
            name: "Xylophone", type: "xylophone", // custom type for metronome logic
            instructions: "Click bars or use keyboard (ASDFGHJKL;').",
            keyboardHints: "C4-C5: A S D F G H J K L ; '",
            config: {
                startNote: 'C4', numNotes: 12, // One octave
                sound: { oscillatorType: 'sine', envelope: { attack: 0.001, decay: 0.4, sustainLevel: 0.01, sustainTime: 0.2, release: 0.2 }, durationScale: 0.8 }
            },
            render: function(displayEl, audioEng) {
                displayEl.innerHTML = '';
                const visualWrapper = document.createElement('div'); visualWrapper.className = 'xylophone-visual'; displayEl.appendChild(visualWrapper);
                const keyboard = document.createElement('div'); keyboard.className = 'xylophone-keyboard'; visualWrapper.appendChild(keyboard);

                const { startNote, numNotes, sound } = this.config;
                const baseNote = startNote.replace(/[0-9#b]/g, ''); const baseOctave = parseInt(startNote.match(/\d+/)[0]);
                const maxWidth = 90; // percent
                const minWidth = 40; // percent

                for(let i = 0; i < numNotes; i++) {
                    const noteNameFull = audioEng.getNoteName(audioEng.notes.indexOf(baseNote), baseOctave, i);
                    const frequency = audioEng.noteToFrequency(noteNameFull);
                    const barEl = document.createElement('div');
                    barEl.className = 'xylophone-bar';
                    barEl.dataset.noteId = noteNameFull.replace('#','sharp');
                    barEl.textContent = noteNameFull.replace(/[0-9]/g, ''); // Display C, C#, D etc.
                    // Bars get shorter for higher notes
                    barEl.style.width = `${maxWidth - ((maxWidth - minWidth) / (numNotes -1)) * i}%`;

                    const play = () => {
                         if (!audioEng.soundEnabled) { audioEng.initAudio().then(s => s && audioEng.playNote({...sound, frequency, noteId: noteNameFull }) && barEl.classList.add('pressed')); }
                         else { audioEng.playNote({...sound, frequency, noteId: noteNameFull }); barEl.classList.add('pressed'); }
                         setTimeout(()=>barEl.classList.remove('pressed'), 150);
                    };
                    barEl.addEventListener('mousedown', (e) => { e.preventDefault(); play(); });
                    barEl.addEventListener('touchstart', (e) => { e.preventDefault(); play(); }, { passive: false });
                    keyboard.appendChild(barEl);
                }
            },
            getKeyboardMap: function() {
                const map = {}; const keys = ['a','s','d','f','g','h','j','k','l',';','\'']; // C4 to B4 then C5
                const { startNote, numNotes, sound } = this.config;
                const baseNote = startNote.replace(/[0-9#b]/g, ''); const baseOctave = parseInt(startNote.match(/\d+/)[0]);
                for(let i = 0; i < Math.min(numNotes, keys.length); i++) {
                    const noteNameFull = audioEngineApp.getNoteName(audioEngineApp.notes.indexOf(baseNote), baseOctave, i);
                    map[keys[i]] = { type: 'note', noteName: noteNameFull, sound: sound };
                }
                return map;
            }
        },
        // --- Wind Instruments (Flute, Saxophone, Trumpet) ---
        // Helper for wind instrument rendering
        createWindInstrumentUI: function(displayEl, config, instrumentClass, audioEng) {
            displayEl.innerHTML = '';
            const visualWrapper = document.createElement('div'); visualWrapper.className = `wind-instrument-visual ${instrumentClass}-visual`; displayEl.appendChild(visualWrapper);
            const body = document.createElement('div'); body.className = `wind-instrument-body ${instrumentClass}-body`; visualWrapper.appendChild(body);

            const mouthpiece = document.createElement('div'); mouthpiece.className = 'mouthpiece'; body.appendChild(mouthpiece);
            
            const keyRowsContainer = document.createElement('div'); keyRowsContainer.className = 'wind-key-rows';
            config.keyLayout.forEach(rowKeys => {
                const keyRow = document.createElement('div'); keyRow.className = 'wind-key-row';
                rowKeys.forEach(keyNote => {
                    if (keyNote === null) { // Placeholder for spacing
                        const spacer = document.createElement('div'); spacer.style.width = '35px'; spacer.style.height = '35px'; // Adjust size as needed
                        keyRow.appendChild(spacer);
                        return;
                    }
                    const noteNameFull = keyNote;
                    const frequency = audioEng.noteToFrequency(noteNameFull);
                    const keyEl = document.createElement('div');
                    keyEl.className = 'wind-key';
                    keyEl.dataset.noteId = noteNameFull.replace('#','sharp');
                    keyEl.textContent = noteNameFull.replace(/[0-9#b]/g,'');

                    const play = () => {
                        if (!audioEng.soundEnabled) { audioEng.initAudio().then(s => { if(s) audioEng.playNote({...config.sound, frequency, noteId:noteNameFull}); }); }
                        else { audioEng.playNote({...config.sound, frequency, noteId:noteNameFull}); }
                        keyEl.classList.add('pressed');
                    };
                    const stop = () => {
                        audioEng.stopNote(noteNameFull);
                        keyEl.classList.remove('pressed');
                    };

                    keyEl.addEventListener('mousedown', (e) => { e.preventDefault(); play(); });
                    keyEl.addEventListener('mouseup', (e) => { e.preventDefault(); stop(); });
                    keyEl.addEventListener('mouseleave', (e) => { if(keyEl.classList.contains('pressed')) stop(); }); // Stop if mouse leaves while pressed
                    keyEl.addEventListener('touchstart', (e) => { e.preventDefault(); play(); }, { passive: false });
                    keyEl.addEventListener('touchend', (e) => { e.preventDefault(); stop(); });
                    keyRow.appendChild(keyEl);
                });
                keyRowsContainer.appendChild(keyRow);
            });
            body.appendChild(keyRowsContainer);

            const bell = document.createElement('div'); bell.className = 'bell'; body.appendChild(bell);
        },
        flute: {
            name: "Flute", type: "wind",
            instructions: "Click/hold keys or use keyboard. Notes sustain while key is held.",
            keyboardHints: "C4-B4: A S D F G H J K",
            config: {
                sound: { oscillatorType: 'sine', isSustained: true, envelope: { attack: 0.08, decay: 0.1, sustainLevel: 0.7, release: 0.15 } },
                keyLayout: [ ['C4', 'D4', 'E4'], ['F4', 'G4', 'A4'], ['B4', 'C5'] ] // Simple C Major scale for demo
            },
            render: function(displayEl, audioEng) { instrumentsApp.createWindInstrumentUI(displayEl, this.config, 'flute', audioEng); },
            getKeyboardMap: function() {
                const map = {}; const keys = ['a','s','d','f','g','h','j','k'];
                const notes = ['C4','D4','E4','F4','G4','A4','B4','C5'];
                keys.forEach((key, i) => {
                    if(notes[i]) map[key] = { type: 'note', noteName: notes[i], sound: this.config.sound, allowRepeat: false };
                });
                return map;
            }
        },
        saxophone: {
            name: "Saxophone", type: "wind",
            instructions: "Click/hold keys or use keyboard. Notes sustain while key is held.",
            keyboardHints: "C4-A4: A S D F G H J",
            config: {
                sound: { oscillatorType: 'sawtooth', isSustained: true, envelope: { attack: 0.1, decay: 0.15, sustainLevel: 0.6, release: 0.25 } },
                keyLayout: [ ['C4', 'D4', 'E4'], [null, 'F4', 'G4', 'A4'], [null, 'B3', 'C#4'] ] // Mixed notes for variety
            },
            render: function(displayEl, audioEng) { instrumentsApp.createWindInstrumentUI(displayEl, this.config, 'saxophone', audioEng); },
            getKeyboardMap: function() {
                const map = {}; const keys = ['a','s','d','f','g','h','j'];
                const notes = ['C4','D4','E4','F4','G4','A4','B3']; // Map to available layout
                keys.forEach((key, i) => {
                    if(notes[i]) map[key] = { type: 'note', noteName: notes[i], sound: this.config.sound, allowRepeat: false };
                });
                return map;
            }
        },
        trumpet: {
            name: "Trumpet", type: "wind",
            instructions: "Click/hold keys or use keyboard. Notes sustain while key is held.",
            keyboardHints: "G3-F4: A S D F G H J",
            config: {
                sound: { oscillatorType: 'square', isSustained: true, envelope: { attack: 0.03, decay: 0.1, sustainLevel: 0.8, release: 0.1 } },
                keyLayout: [ ['G3', 'A3', 'B3'], ['C4', 'D4', 'E4', 'F4'] ] // Typical trumpet range start
            },
            render: function(displayEl, audioEng) { instrumentsApp.createWindInstrumentUI(displayEl, this.config, 'trumpet', audioEng); },
            getKeyboardMap: function() {
                const map = {}; const keys = ['a','s','d','f','g','h','j'];
                const notes = ['G3','A3','B3','C4','D4','E4','F4'];
                keys.forEach((key, i) => {
                    if(notes[i]) map[key] = { type: 'note', noteName: notes[i], sound: this.config.sound, allowRepeat: false };
                });
                return map;
            }
        },
    };

    // --- Instrument Manager (App specific) ---
    function loadInstrumentApp(instrumentKey) {
        currentInstrumentKeyApp = instrumentKey;
        const instrument = instrumentsApp[instrumentKey];
        if (!instrument || !instrumentDisplayAreaElApp) {
            console.error("Instrument or display area not found:", instrumentKey);
            if (instrumentDisplayAreaElApp) instrumentDisplayAreaElApp.innerHTML = "<p>Error loading instrument.</p>";
            return;
        }
        if (audioEngineApp.activeOscillators) { // Stop any lingering sustained notes
            Object.keys(audioEngineApp.activeOscillators).forEach(noteId => audioEngineApp.stopNote(noteId, 0.01));
        }

        AnimationManager.instrumentUnload(instrumentDisplayAreaElApp.firstChild, () => { // Unload current child
            instrumentDisplayAreaElApp.innerHTML = ''; // Clear after animation
            instrument.render(instrumentDisplayAreaElApp, audioEngineApp);
            // The new instrument is appended by its render function. Animate it.
            AnimationManager.instrumentLoad(instrumentDisplayAreaElApp.firstChild);

            if(instructionsTextElApp) instructionsTextElApp.textContent = instrument.instructions || "Play this cool instrument!";
            KeyboardInputManagerApp.setMap(instrument.getKeyboardMap ? instrument.getKeyboardMap() : {});
            SideCharacterManagerApp.showKeyboardHints(instrumentKey);
            SideCharacterManagerApp.reactToSwitch();

            const showMetronome = instrument.type === 'percussion' || instrument.type === 'keyboard' || instrument.type === 'xylophone';
            if(metronomeControlsElApp) metronomeControlsElApp.style.display = showMetronome ? 'flex' : 'none';
            if (!showMetronome && MetronomeApp.isPlaying) MetronomeApp.toggle(); // Turn off if hidden

            if (instrument.type === 'stringed') TunerApp.show(instrument.config);
            else if(tunerControlsElApp) tunerControlsElApp.style.display = 'none';
            
            ScreenOrientationManagerApp.checkAndSuggest();
        });
    }

    // --- Event Listeners (App specific) ---
    if(instrumentSelectElApp) instrumentSelectElApp.addEventListener('change', (e) => loadInstrumentApp(e.target.value));
    if(volumeControlElApp) volumeControlElApp.addEventListener('input', (e) => { if(audioEngineApp.masterGain && audioEngineApp.audioContext) audioEngineApp.masterGain.gain.setTargetAtTime(parseFloat(e.target.value), audioEngineApp.audioContext.currentTime, 0.01); });
    if(soundStatusBannerElApp) soundStatusBannerElApp.addEventListener('click', () => audioEngineApp.initAudio());
    if(metronomeToggleBtnApp) metronomeToggleBtnApp.addEventListener('click', () => MetronomeApp.toggle());
    if(metronomeBpmInputApp) {
        metronomeBpmInputApp.addEventListener('change', (e) => MetronomeApp.setBpm(e.target.value));
        // 'input' event for live update can be too frequent for setInterval restart
        // metronomeBpmInputApp.addEventListener('input', (e) => MetronomeApp.setBpm(e.target.value));
    }

    // --- Initialization Function for the App ---
    function initInstrumentAppInternals() {
        if (!document.getElementById('instrument-select')) { // Check if DOM is ready
            console.warn("Instrument app elements not found. Retrying init in 100ms.");
            setTimeout(initInstrumentAppInternals, 100);
            return;
        }

        if(instrumentSelectElApp) {
            instrumentSelectElApp.innerHTML = ''; // Clear if re-initializing
            for (const key in instrumentsApp) {
                const option = document.createElement('option');
                option.value = key; option.textContent = instrumentsApp[key].name;
                instrumentSelectElApp.appendChild(option);
            }
            if (instrumentSelectElApp.options.length > 0) {
                loadInstrumentApp(instrumentSelectElApp.options[0].value);
            } else if (instrumentDisplayAreaElApp) {
                instrumentDisplayAreaElApp.innerHTML = "<p>No instruments available to load.</p>";
            }
        }
        
        SideCharacterManagerApp.init();
        KeyboardInputManagerApp.init();
        ScreenOrientationManagerApp.init();

        const appWrapper = document.getElementById('instrument-app-wrapper');
        const firstSoundEnableHandler = () => {
            if (!audioEngineApp.soundEnabled && soundStatusBannerElApp && soundStatusBannerElApp.style.display !== 'none') {
                audioEngineApp.initAudio();
            }
        };
        if (appWrapper) appWrapper.addEventListener('click', firstSoundEnableHandler, { once: true });
        document.addEventListener('keydown', firstSoundEnableHandler, { once: true });
        
        console.log("InstrumentHub App Internals Initialized.");
    }

    initInstrumentAppInternals(); // Call the app's own internal setup
}
// End of initializeAppInstruments global function.