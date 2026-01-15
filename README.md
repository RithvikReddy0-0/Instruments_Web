# InstrumentHub 🎵

InstrumentHub is an interactive web application that brings a variety of virtual musical instruments right to your browser. Explore, play, and have fun with instruments like the Piano, Guitar, Drums, Ukulele, Violin, and more, Built with HTML, CSS, JavaScript, the Web Audio API, and GSAP for animations.


## Features

*   **Multi-Instrument Playground:**
    *   🎹 **Piano:** A 2-octave piano roll.
    *   🎸 **Acoustic Guitar:** 6-string guitar with fretboard interaction.
    *   🥁 **Drum Machine:** A set of playable drum pads.
    *   **Ukulele:** A classic 4-string ukulele.
    *   🎻 **Violin:** Fretless string instrument with sustained notes.
    *   🎸 **Bass Guitar:** 4-string bass guitar.
    *   **Xylophone:** A colorful set of tuned bars.
    *   **Flute:** A virtual flute with clickable keys.
    *   🎷 **Saxophone:** Playable saxophone interface.
    *   🎺 **Trumpet:** Virtual trumpet with valve-like keys.
*   **Interactive Play:** Use your mouse, touchscreen, or keyboard to play the instruments.
*   **Audio Engine:** Powered by the Web Audio API for dynamic sound generation.
*   **Visual Feedback:**
    *   Animated instrument parts (keys, strings, pads).
    *   Cute side character reacts to your playing and instrument switches.
    *   Keyboard hints displayed for each instrument.
*   **Controls:**(still under progress)
    *   Master volume control.
    *   Metronome with adjustable BPM (for relevant instruments).
    *   Visual tuner display for stringed instruments (plays open string sound for reference).
*   **Responsive Design:** Adapts to different screen sizes, with landscape mode suggested for optimal instrument experience.
*   **Light/Dark Theme:** Toggle between light and dark modes for the entire site.
*   **SPA-like Navigation:** Smooth page transitions for Home, Instruments, About, and Contact sections.

## Technologies Used

*   **HTML5:** Structure of the web application.
*   **CSS3:** Styling for the website and instruments, including Flexbox and Grid.
*   **JavaScript (ES6+):** Core application logic, instrument interactions, and DOM manipulation.
*   **Web Audio API:** For generating and controlling instrument sounds.
*   **GSAP (GreenSock Animation Platform):** For smooth animations and visual effects.
*   **Google Fonts:** For typography.

## Project Structure

instrument-hub/
├── index.html # Main HTML file for the single-page application
├── style.css # All CSS styles for the site and instruments
├── site-script.js # JavaScript for site navigation, page loading, and theme
├── app-script.js # JavaScript for the instrument application logic and UI
└── README.md # This file


## Getting Started

1.  **Clone the repository (or download the files):**
    ```bash
    git clone https://github.com/RithvikReddy0-0/instrument-hub.git
    cd instrument-hub
    ```
    (If you're not using Git, simply download the `index.html`, `style.css`, `site-script.js`, and `app-script.js` files into a single folder.)

2.  **Open `index.html` in your browser:**
    Navigate to the project directory and open the `index.html` file in a modern web browser (Chrome, Firefox, Edge, Safari recommended).

    No build process or local server is strictly required for basic functionality as it's a client-side application, but running it through a simple local server (like VS Code's Live Server extension) can prevent potential issues with file paths or browser security policies in some cases.

## How to Play

*   **Navigate to the "Instruments" page.**
*   **Select an instrument** from the dropdown menu.
*   **Enable Sound:** Click anywhere on the instrument display area or press a mapped keyboard key to enable audio (this is a browser security requirement).
*   **Play:**
    *   **Mouse/Touch:** Click or tap on the interactive parts of the instrument (keys, strings, pads, bars).
    *   **Keyboard:** Use the keyboard shortcuts displayed in the "Keyboard Hints" tooltip next to the side character.
*   **Adjust Volume:** Use the volume slider.
*   **Use Metronome/Tuner:** These controls will appear for relevant instruments.

## Future Enhancements (Ideas)

*   **Sample-based sounds:** Incorporate real instrument samples for more realistic audio.
*   **Advanced Tuning:** Implement microphone input and pitch detection for the tuner.
*   **Recording Feature:** Allow users to record and playback their compositions.
*   **More Instruments:** Expand the collection of virtual instruments.
*   **Music Theory Helpers:** Add scales, chords, and other learning aids.
*   **MIDI Support:** Allow connection of MIDI controllers.
*   **Accessibility Improvements:** Further enhance ARIA attributes and keyboard navigation.

## Contributing

Contributions are welcome! If you have ideas for improvements, new features, or bug fixes, please feel free to:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-amazing-feature`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some amazing feature'`).
5.  Push to the branch (`git push origin feature/your-amazing-feature`).
6.  Open a Pull Request.
