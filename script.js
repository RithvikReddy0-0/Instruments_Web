// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const instrumentSelectEl = document.getElementById('instrument-select');
    const volumeControlEl = document.getElementById('volume');
    const instrumentDisplayAreaEl = document.getElementById('instrument-display-area');
    const soundStatusBannerEl = document.getElementById('sound-status');
    const instructionsTextEl = document.getElementById('instrument-instructions');
    const sideCharacterEl = document.getElementById('side-character');
    const charMouthEl = document.getElementById('char-mouth');
    const charPupilLeftEl = document.getElementById('char-pupil-left');
    const charPupilRightEl = document.getElementById('char-pupil-right');
    const keyboardHintsEl = document.getElementById('keyboard-hints');


    // --- Audio Engine (largely same, small adjustments if any) ---
    class AudioEngine {
        constructor() {
            this.audioContext = null;
            this.masterGain = null;
            this.soundEnabled = false;
            this.isInitializing = false;
            this.notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            this.defaultEnvelope = { attack: 0.01, decay: 0.1, sustainLevel: 0.6, sustainTime: 0.15, release: 0.3 };
            this.defaultOscillatorType = 'triangle';
        }

        async initAudio() {
            if (this.soundEnabled || this.isInitializing) return true;
            this.isInitializing = true;
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                await this.audioContext.resume();
                this.masterGain = this.audioContext.createGain();
                this.masterGain.gain.setValueAtTime(parseFloat(volumeControlEl.value), this.audioContext.currentTime);
                this.masterGain.connect(this.audioContext.destination);
                this.soundEnabled = true;
                soundStatusBannerEl.style.display = 'none';
                console.log("AudioContext initialized.");
                return true;
            } catch (e) {
                console.error("Web Audio API initialization failed:", e);
                soundStatusBannerEl.textContent = "Sorry, Web Audio is not supported or could not be started.";
                soundStatusBannerEl.style.display = 'block';
                return false;
            } finally {
                this.isInitializing = false;
            }
        }

        noteToFrequency(noteName) {
            const note = noteName.replace(/[0-9#b]/g, ''); // Allow for 'b' if added
            const accidental = noteName.match(/[#b]/g)?.[0] || '';
            const fullNote = note + accidental;
            const octaveMatch = noteName.match(/\d+$/);
            if (!octaveMatch) { console.warn("Invalid note format:", noteName); return 0; }
            const octave = parseInt(octaveMatch[0]);
            const noteIndex = this.notes.indexOf(fullNote);
            if (noteIndex === -1) { console.warn("Note not found in scale:", fullNote); return 0;}
            const midiNote = 12 + (octave * 12) + noteIndex;
            return 440 * Math.pow(2, (midiNote - 69) / 12);
        }

        playNote({ frequency, oscillatorType = this.defaultOscillatorType, envelope = this.defaultEnvelope, durationScale = 1 }) {
            if (!this.soundEnabled || !this.audioContext || frequency <= 0) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(this.masterGain);
            oscillator.type = oscillatorType;
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

            const now = this.audioContext.currentTime;
            const { attack, decay, sustainLevel, sustainTime, release } = envelope;
            const scaledAttack = attack * durationScale;
            const scaledDecay = decay * durationScale;
            const scaledSustainTime = sustainTime * durationScale;
            const scaledRelease = release * durationScale;

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(1, now + scaledAttack);
            gainNode.gain.linearRampToValueAtTime(sustainLevel, now + scaledAttack + scaledDecay);
            gainNode.gain.setValueAtTime(sustainLevel, now + scaledAttack + scaledDecay + scaledSustainTime);
            gainNode.gain.linearRampToValueAtTime(0, now + scaledAttack + scaledDecay + scaledSustainTime + scaledRelease);

            oscillator.start(now);
            const stopTime = now + scaledAttack + scaledDecay + scaledSustainTime + scaledRelease + 0.05;
            oscillator.stop(stopTime);
            characterManager.reactToPlay(); // Character reaction
        }

        getNoteName(baseNoteIndex, baseOctave, steps) {
            let noteIndex = baseNoteIndex + steps;
            let octave = baseOctave;
            while (noteIndex >= this.notes.length) { noteIndex -= this.notes.length; octave++; }
            while (noteIndex < 0) { noteIndex += this.notes.length; octave--; }
            return this.notes[noteIndex] + octave;
        }
    }
    const audioEngine = new AudioEngine();

    // --- Character Manager ---
    const characterManager = {
        isLookingAtInstrument: false,
        lookInterval: null,

        setExpression(type) {
            switch (type) {
                case 'idle':
                    charMouthEl.setAttribute('d', 'M 35 90 Q 50 100 65 90'); // Smile
                    this.lookAround();
                    break;
                case 'playing':
                    charMouthEl.setAttribute('d', 'M 40 90 Q 50 95 60 90'); // Smaller smile or 'o'
                    this.lookAtInstrument();
                    break;
                case 'surprised':
                    charMouthEl.setAttribute('d', 'M 45 95 Q 50 85 55 95'); // o shape
                    this.lookAtInstrument(true); // Force look
                    break;
            }
        },
        reactToPlay() {
            sideCharacterEl.classList.remove('playing'); // remove to retrigger animation
            void sideCharacterEl.offsetWidth; // Trigger reflow
            sideCharacterEl.classList.add('playing');
            this.setExpression('playing');
            setTimeout(() => this.setExpression('idle'), 300);
        },
        reactToSwitch() {
            sideCharacterEl.classList.remove('switched');
            void sideCharacterEl.offsetWidth;
            sideCharacterEl.classList.add('switched');
            this.setExpression('surprised');
            setTimeout(() => this.setExpression('idle'), 500);
        },
        lookAtInstrument(force = false) {
            if (this.isLookingAtInstrument && !force) return;
            clearInterval(this.lookInterval);
            this.isLookingAtInstrument = true;
            // Assuming instrument is to the left of character from user's POV
            charPupilLeftEl.style.transform = 'translateX(-2px)';
            charPupilRightEl.style.transform = 'translateX(-2px)';
        },
        lookAround() {
            this.isLookingAtInstrument = false;
            clearInterval(this.lookInterval);
            this.lookInterval = setInterval(() => {
                const xL = Math.random() * 4 - 2;
                const yL = Math.random() * 2 - 1;
                const xR = Math.random() * 4 - 2;
                const yR = Math.random() * 2 - 1;
                charPupilLeftEl.style.transform = `translate(${xL}px, ${yL}px)`;
                charPupilRightEl.style.transform = `translate(${xR}px, ${yR}px)`;
            }, 2000 + Math.random() * 2000);
        },
        showKeyboardHints(instrumentKey) {
            const instrument = instruments[instrumentKey];
            if (instrument && instrument.keyboardHints) {
                keyboardHintsEl.innerHTML = `<pre>${instrument.keyboardHints}</pre>`;
                keyboardHintsEl.classList.add('visible');
            } else {
                keyboardHintsEl.classList.remove('visible');
            }
        },
        init() {
            this.setExpression('idle');
        }
    };

    // --- Keyboard Input Manager ---
    const keyboardManager = {
        activeMap: {},
        pressedKeys: new Set(),

        setMap(map) {
            this.activeMap = map || {};
        },

        handleKeyDown(e) {
            if (e.repeat) return; // Prevent spamming on key hold for most notes
            const key = e.key.toLowerCase();

            if (this.activeMap[key]) {
                e.preventDefault(); // Prevent browser shortcuts if key is mapped
                if (!audioEngine.soundEnabled) {
                    audioEngine.initAudio().then(success => {
                        if (success) this.triggerAction(key);
                    });
                } else {
                    this.triggerAction(key);
                }
                this.pressedKeys.add(key);
            }
        },

        triggerAction(key) {
            const action = this.activeMap[key];
            if (!action) return;

            if (action.type === 'note') {
                audioEngine.playNote({
                    frequency: audioEngine.noteToFrequency(action.noteName),
                    oscillatorType: action.sound.oscillatorType,
                    envelope: action.sound.envelope,
                    durationScale: action.sound.durationScale || 1
                });
                // Visual feedback for keyboard
                const targetElement = document.querySelector(`[data-note-id="${action.noteName.replace('#','sharp')}"]`);
                if (targetElement) {
                    targetElement.classList.add('keyboard-active');
                    setTimeout(() => targetElement.classList.remove('keyboard-active'), 200);
                }
            } else if (action.type === 'stringed_note') {
                const { stringIndex, fretNum, sound } = action;
                const stringConfig = instruments[currentInstrumentKey].config.openStrings[stringIndex];
                const baseNoteName = stringConfig.name;
                const baseNote = baseNoteName.replace(/[0-9#b]/g, '');
                const baseOctave = parseInt(baseNoteName.match(/\d+/)[0]);
                const baseNoteIndexVal = audioEngine.notes.indexOf(baseNote);
                const currentNoteName = audioEngine.getNoteName(baseNoteIndexVal, baseOctave, fretNum);
                const frequency = audioEngine.noteToFrequency(currentNoteName);

                audioEngine.playNote({ frequency, oscillatorType: sound.oscillatorType, envelope: sound.envelope });

                // Visual feedback: find the string and the specific note segment
                const stringDiv = instrumentDisplayAreaEl.querySelectorAll('.string')[stringIndex];
                if (stringDiv) {
                    stringDiv.classList.add('keyboard-active');
                    setTimeout(() => stringDiv.classList.remove('keyboard-active'), 200);
                    const noteSegment = stringDiv.querySelectorAll('.note-segment')[fretNum];
                    if(noteSegment) {
                        noteSegment.classList.add('keyboard-active-fret');
                        setTimeout(() => noteSegment.classList.remove('keyboard-active-fret'), 200);
                    }
                }
            }
        },

        handleKeyUp(e) {
            const key = e.key.toLowerCase();
            this.pressedKeys.delete(key);
            // Could add key-up visual effects if needed
        },

        init() {
            document.addEventListener('keydown', (e) => this.handleKeyDown(e));
            document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        }
    };


    // --- Generic UI Helper for Stringed Instruments ---
    function createStringedInstrumentUI(displayEl, config, instrumentClass, currentAudioEngine) {
        displayEl.innerHTML = '';
        // Unique wrapper for each instrument's visual style
        const visualWrapper = document.createElement('div');
        visualWrapper.className = `${instrumentClass}-visual`;
        displayEl.appendChild(visualWrapper);

        const container = document.createElement('div');
        container.className = instrumentClass;
        visualWrapper.appendChild(container);


        // Headstock, Neck, Body (simplified creation)
        ['headstock', 'neck', 'body'].forEach(partName => {
            const partEl = document.createElement('div');
            partEl.className = partName;
            if (partName === 'neck') {
                const nut = document.createElement('div');
                nut.className = 'nut';
                partEl.appendChild(nut);
                const fretboard = document.createElement('div');
                fretboard.className = 'fretboard'; // This will be populated later
                fretboard.id = `${instrumentClass}-fretboard`; // ID for targeting
                partEl.appendChild(fretboard);
            }
            if (partName === 'body') {
                 const soundHole = document.createElement('div'); soundHole.className = 'sound-hole'; partEl.appendChild(soundHole);
                 const bridge = document.createElement('div'); bridge.className = 'bridge'; partEl.appendChild(bridge);
            }
             if (partName === 'headstock' && config.openStrings) {
                config.openStrings.forEach((s, i) => {
                    const tuner = document.createElement('div');
                    tuner.className = `tuner tuner-${i} ${s.class ? s.class.replace('string-','tuner-') : '' }`;
                    partEl.appendChild(tuner);
                });
            }
            container.appendChild(partEl);
        });

        const fretboardEl = document.getElementById(`${instrumentClass}-fretboard`);
        if (!fretboardEl) { console.error("Fretboard element not found for", instrumentClass); return; }

        const { numFrets, openStrings, fretMarkers, sound } = config;
        // Ensure fretboard has dimensions before proceeding
        requestAnimationFrame(() => {
            const fretboardHeight = fretboardEl.offsetHeight;
            if (fretboardHeight === 0) {
                console.warn(`${instrumentClass} Fretboard height is 0, retrying render.`);
                setTimeout(() => createStringedInstrumentUI(displayEl, config, instrumentClass, currentAudioEngine), 100);
                return;
            }

            const fretPositions = [];
            for (let i = 0; i < numFrets + 1; i++) {
                const fretY = (i / (numFrets + 0.5)) * fretboardHeight * 0.92 + (fretboardHeight * 0.04); // Adjusted spacing
                fretPositions.push(fretY);
                if (i > 0) {
                    const fretEl = document.createElement('div');
                    fretEl.classList.add('fret');
                    fretEl.style.top = `${fretY}px`;
                    fretboardEl.appendChild(fretEl);
                }
                if (fretMarkers.includes(i) && i > 0) {
                    const marker = document.createElement('div');
                    marker.classList.add('fret-marker');
                    const prevFretY = fretPositions[i-1];
                    marker.style.top = `${(prevFretY + fretY) / 2}px`;
                    fretboardEl.appendChild(marker);
                    if (i === 12 && (instrumentClass === 'ukulele' || instrumentClass === 'guitar')) {
                        const marker2 = marker.cloneNode();
                        marker.style.transform = 'translateX(-50%) translateY(-7px)'; // Adjust for double dot
                        marker2.style.transform = 'translateX(-50%) translateY(7px)';
                        fretboardEl.appendChild(marker2);
                    }
                }
            }

            const stringContainer = document.createElement('div');
            stringContainer.classList.add('string-container');
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
                    noteSegment.style.top = `${topY}px`;
                    noteSegment.style.height = `${bottomY - topY}px`;

                    const currentNoteName = currentAudioEngine.getNoteName(baseNoteIndexVal, baseOctave, fretNum);
                    const frequency = currentAudioEngine.noteToFrequency(currentNoteName);
                    noteSegment.dataset.noteId = `${instrumentClass}-s${stringIndex}-f${fretNum}-${currentNoteName.replace('#','sharp')}`; // For keyboard targeting


                    const play = () => {
                         if (!currentAudioEngine.soundEnabled) {
                            currentAudioEngine.initAudio().then(success => {
                                if (success) {
                                    currentAudioEngine.playNote({ frequency, oscillatorType: sound.oscillatorType, envelope: sound.envelope });
                                    animateString(stringDiv);
                                }
                            });
                        } else {
                            currentAudioEngine.playNote({ frequency, oscillatorType: sound.oscillatorType, envelope: sound.envelope });
                            animateString(stringDiv);
                        }
                    };
                    noteSegment.addEventListener('mousedown', (e) => { e.preventDefault(); play(); });
                    noteSegment.addEventListener('touchstart', (e) => { e.preventDefault(); play(); }, { passive: false });
                    stringDiv.appendChild(noteSegment);
                }
                stringContainer.appendChild(stringDiv);
            });
            fretboardEl.appendChild(stringContainer);
        }); // End of requestAnimationFrame for fretboard height

        function animateString(stringEl) {
            stringEl.classList.add('plucked');
            setTimeout(() => stringEl.classList.remove('plucked'), 150);
        }
    }


    // --- Instrument Definitions ---
    let currentInstrumentKey = '';
    const instruments = {
        ukulele: {
            name: "Ukulele",
            instructions: "Click a fret or use keyboard (QWER: G-str, ASDF: C-str, ZXCV: E-str, UIOP: A-str for frets 0-3).",
            keyboardHints: "G: Q W E R\nC: A S D F\nE: Z X C V\nA: U I O P\n(Frets 0-3)",
            config: {
                numFrets: 12,
                openStrings: [
                    { name: 'G4', class: 'string-g', thickness: 2.5 }, { name: 'C4', class: 'string-c', thickness: 3 },
                    { name: 'E4', class: 'string-e', thickness: 2 }, { name: 'A4', class: 'string-a', thickness: 1.5 }
                ],
                fretMarkers: [3, 5, 7, 10, 12],
                sound: { oscillatorType: 'triangle', envelope: audioEngine.defaultEnvelope }
            },
            render: function(displayEl, audioEng) { createStringedInstrumentUI(displayEl, this.config, 'ukulele', audioEng); },
            getKeyboardMap: function() {
                const map = {};
                const keys = [
                    ['q','w','e','r'], ['a','s','d','f'],
                    ['z','x','c','v'], ['u','i','o','p']
                ];
                this.config.openStrings.forEach((str, sIdx) => {
                    for (let fIdx = 0; fIdx < Math.min(keys[sIdx].length, this.config.numFrets + 1); fIdx++) {
                        map[keys[sIdx][fIdx]] = { type: 'stringed_note', stringIndex: sIdx, fretNum: fIdx, sound: this.config.sound };
                    }
                });
                return map;
            }
        },
        guitar: {
            name: "Guitar (6-String)",
            instructions: "Click a fret or use keyboard (see hints). Limited mapping for demo.",
            keyboardHints: "E2: Q W E R T\nA2: A S D F G\nD3: Z X C V B\n(Frets 0-4 for first 3 strings)",
            config: {
                numFrets: 15,
                openStrings: [
                    { name: 'E2', thickness: 3.5 }, { name: 'A2', thickness: 3.0 }, { name: 'D3', thickness: 2.5 },
                    { name: 'G3', thickness: 2.0 }, { name: 'B3', thickness: 1.5 }, { name: 'E4', thickness: 1.0 }
                ],
                fretMarkers: [3, 5, 7, 9, 12, 15],
                sound: { oscillatorType: 'sawtooth', envelope: { attack: 0.005, decay: 0.2, sustainLevel: 0.5, sustainTime: 0.3, release: 0.4 } }
            },
            render: function(displayEl, audioEng) { createStringedInstrumentUI(displayEl, this.config, 'guitar', audioEng); },
            getKeyboardMap: function() {
                 const map = {};
                const keys = [ // Only mapping first 3 strings, 5 frets each for guitar demo
                    ['q','w','e','r','t'], ['a','s','d','f','g'], ['z','x','c','v','b']
                ];
                for(let sIdx = 0; sIdx < keys.length; sIdx++) {
                     for (let fIdx = 0; fIdx < Math.min(keys[sIdx].length, this.config.numFrets + 1); fIdx++) {
                        map[keys[sIdx][fIdx]] = { type: 'stringed_note', stringIndex: sIdx, fretNum: fIdx, sound: this.config.sound };
                    }
                }
                return map;
            }
        },
        piano: {
            name: "Piano Roll",
            instructions: "Click a key or use keyboard (ASDFGHJ for white keys C4-B4, WETYU for black keys).",
            keyboardHints: "C4-B4 White: A S D F G H J\nC#4-A#4 Black: W E T Y U",
            config: {
                startNote: 'C3', numOctaves: 2,
                sound: { oscillatorType: 'sine', envelope: { attack: 0.002, decay: 0.5, sustainLevel: 0.7, sustainTime: 0.1, release: 0.3 }, durationScale: 1.5 }
            },
            render: function(displayEl, currentAudioEngine) {
                displayEl.innerHTML = '';
                const visualWrapper = document.createElement('div');
                visualWrapper.className = 'piano-visual';
                displayEl.appendChild(visualWrapper);

                const pianoContainer = document.createElement('div');
                pianoContainer.className = 'piano-keyboard';
                visualWrapper.appendChild(pianoContainer);


                const { startNote, numOctaves, sound } = this.config;
                const baseNote = startNote.replace(/[0-9#b]/g, '');
                const baseOctave = parseInt(startNote.match(/\d+/)[0]);
                let whiteKeysRendered = 0;
                const keysData = [];

                const totalSemitones = numOctaves * 12;
                for (let i = 0; i < totalSemitones; i++) {
                    const noteNameFull = currentAudioEngine.getNoteName(currentAudioEngine.notes.indexOf(baseNote), baseOctave, i);
                    const noteSimple = noteNameFull.replace(/[0-9]/g, '');
                    const isBlackKey = noteSimple.includes('#');
                    keysData.push({ noteNameFull, noteSimple, isBlackKey, frequency: currentAudioEngine.noteToFrequency(noteNameFull) });
                    if (!isBlackKey) whiteKeysRendered++;
                }

                let currentWhiteKeyIndex = 0;
                keysData.forEach(keyData => {
                    const keyEl = document.createElement('div');
                    keyEl.classList.add('piano-key', keyData.isBlackKey ? 'black-key' : 'white-key');
                    keyEl.dataset.noteId = keyData.noteNameFull.replace('#','sharp'); // For keyboard targeting

                    const play = () => {
                         if (!currentAudioEngine.soundEnabled) {
                            currentAudioEngine.initAudio().then(success => {
                                if(success) {
                                    currentAudioEngine.playNote({ frequency: keyData.frequency, oscillatorType: sound.oscillatorType, envelope: sound.envelope, durationScale: sound.durationScale });
                                    animateKey(keyEl);
                                }
                            });
                        } else {
                            currentAudioEngine.playNote({ frequency: keyData.frequency, oscillatorType: sound.oscillatorType, envelope: sound.envelope, durationScale: sound.durationScale });
                            animateKey(keyEl);
                        }
                    };
                    keyEl.addEventListener('mousedown', (e) => { e.preventDefault(); play(); });
                    keyEl.addEventListener('touchstart', (e) => { e.preventDefault(); play(); }, { passive: false });
                    pianoContainer.appendChild(keyEl);

                    if (keyData.isBlackKey) {
                        keyEl.style.position = 'absolute';
                        keyEl.style.height = '60%';
                        keyEl.style.width = `calc(${100 / whiteKeysRendered}% * 0.6)`;
                        keyEl.style.left = `calc(${(currentWhiteKeyIndex -1) * (100 / whiteKeysRendered)}% + (${100 / whiteKeysRendered}% * 0.7))`;
                        keyEl.style.zIndex = '1';
                    } else {
                        keyEl.style.width = `${100 / whiteKeysRendered}%`;
                        currentWhiteKeyIndex++;
                    }
                });

                function animateKey(keyEl) {
                    keyEl.classList.add('pressed');
                    setTimeout(() => keyEl.classList.remove('pressed'), 150);
                }
            },
            getKeyboardMap: function() { // C4 octave for piano
                return {
                    'a': { type: 'note', noteName: 'C4', sound: this.config.sound }, 's': { type: 'note', noteName: 'D4', sound: this.config.sound },
                    'd': { type: 'note', noteName: 'E4', sound: this.config.sound }, 'f': { type: 'note', noteName: 'F4', sound: this.config.sound },
                    'g': { type: 'note', noteName: 'G4', sound: this.config.sound }, 'h': { type: 'note', noteName: 'A4', sound: this.config.sound },
                    'j': { type: 'note', noteName: 'B4', sound: this.config.sound },
                    'w': { type: 'note', noteName: 'C#4', sound: this.config.sound }, 'e': { type: 'note', noteName: 'D#4', sound: this.config.sound },
                    't': { type: 'note', noteName: 'F#4', sound: this.config.sound }, 'y': { type: 'note', noteName: 'G#4', sound: this.config.sound },
                    'u': { type: 'note', noteName: 'A#4', sound: this.config.sound },
                };
            }
        }
    };

    // --- Instrument Manager ---
    function loadInstrument(instrumentKey) {
        currentInstrumentKey = instrumentKey;
        if (!instruments[instrumentKey]) { console.error("Instrument not found:", instrumentKey); return; }

        instrumentDisplayAreaEl.classList.add('loading'); // Start fade out animation

        setTimeout(() => {
            const currentInstrument = instruments[instrumentKey];
            instrumentDisplayAreaEl.innerHTML = ''; // Clear previous instrument
            currentInstrument.render(instrumentDisplayAreaEl, audioEngine);
            instructionsTextEl.textContent = currentInstrument.instructions;

            if (currentInstrument.getKeyboardMap) {
                keyboardManager.setMap(currentInstrument.getKeyboardMap());
            } else {
                keyboardManager.setMap({}); // Clear map if not defined
            }
            characterManager.showKeyboardHints(instrumentKey);
            characterManager.reactToSwitch();
            instrumentDisplayAreaEl.classList.remove('loading'); // Start fade in animation
        }, 400); // Match CSS transition duration


        // Re-bind audio init to display area if needed (already handled by keydown and mousedown)
        const enableAudioHandler = () => {
            if (!audioEngine.soundEnabled) audioEngine.initAudio();
        };
        instrumentDisplayAreaEl.removeEventListener('click', enableAudioHandler);
        instrumentDisplayAreaEl.addEventListener('click', enableAudioHandler, { once: true });
    }


    // --- Event Listeners ---
    instrumentSelectEl.addEventListener('change', (e) => loadInstrument(e.target.value));
    volumeControlEl.addEventListener('input', (e) => {
        if (audioEngine.masterGain) {
            const newVolume = parseFloat(e.target.value);
            if (audioEngine.audioContext && audioEngine.audioContext.currentTime > 0) {
                audioEngine.masterGain.gain.setTargetAtTime(newVolume, audioEngine.audioContext.currentTime, 0.01);
            } else {
                audioEngine.masterGain.gain.value = newVolume;
            }
        }
    });
    soundStatusBannerEl.addEventListener('click', () => audioEngine.initAudio());

    // --- Initialization ---
    function initializeApp() {
        for (const key in instruments) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = instruments[key].name;
            instrumentSelectEl.appendChild(option);
        }
        if (instrumentSelectEl.options.length > 0) {
            loadInstrument(instrumentSelectEl.options[0].value);
        } else {
            instrumentDisplayAreaEl.innerHTML = "<p>No instruments available.</p>";
        }
        characterManager.init();
        keyboardManager.init();

        document.body.addEventListener('click', () => { // One-time general click to enable audio
            if (!audioEngine.soundEnabled && soundStatusBannerEl.style.display !== 'none') {
                audioEngine.initAudio();
            }
        }, { once: true });
    }

    initializeApp();
});