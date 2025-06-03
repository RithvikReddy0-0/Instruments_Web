// site-script.js
document.addEventListener('DOMContentLoaded', () => {
    const pageContentArea = document.getElementById('page-content');
    const navLinks = document.querySelectorAll('.site-nav .nav-link');
    const siteThemeToggleBtn = document.getElementById('theme-toggle-btn-site');
    const currentYearEl = document.getElementById('current-year');

    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }

    // --- Page Content Definitions ---
    const pageContents = {
        home: `
            <section class="hero-section">
                <div class="container">
                    <h1>Unleash Your Inner Musician</h1>
                    <p>Explore a world of virtual instruments right in your browser. Realistic, interactive, and fun!</p>
                    <a href="#instruments" class="btn launch-btn">Launch Instruments</a>
                </div>
            </section>
            <section class="page-section features">
                <div class="container">
                    <h2>Why <span>InstrumentHub</span>?</h2>
                    <div class="content-grid">
                        <div class="card">
                            <h3>Multi-Instrument Fun</h3>
                            <p>From pianos to guitars and drums, explore a variety of instruments with unique interactions.</p>
                        </div>
                        <div class="card">
                            <h3>Interactive Learning</h3>
                            <p>Visualize notes and get keyboard hints. Perfect for beginners and seasoned players alike.</p>
                        </div>
                        <div class="card">
                            <h3>Play Anywhere</h3>
                            <p>Accessible on desktop, tablet, and mobile. Your music studio on the go!</p>
                        </div>
                    </div>
                </div>
            </section>
        `,
        instruments: `
            <section class="page-section instrument-app-section">
                <div class="container">
                    <h2>The <span>Instrument Playground</span></h2>
                    <p>Select an instrument below and start playing. Use your mouse, touchscreen, or keyboard!</p>
                </div>
                <div id="instrument-app-wrapper">
                    <div class="app-container">
                        <div class="controls-panel">
                            <div class="control-group">
                                <label for="instrument-select">Instrument:</label>
                                <select id="instrument-select"></select>
                            </div>
                            <div class="control-group">
                                <label for="volume">Volume:</label>
                                <input type="range" id="volume" min="0" max="1" step="0.01" value="0.7" aria-label="Volume control">
                            </div>
                            <div class="control-group" id="metronome-controls" style="display:none;">
                                <label for="metronome-toggle">Metronome:</label>
                                <button id="metronome-toggle" class="control-button" aria-pressed="false">OFF</button>
                                <input type="number" id="metronome-bpm" value="120" min="40" max="240" aria-label="Metronome BPM" style="width: 70px;"> BPM
                            </div>
                            <div class="control-group" id="tuner-controls" style="display:none;">
                                <label>Tuner:</label>
                                <div id="tuner-display"></div>
                            </div>
                        </div>
                        <div id="sound-status" class="sound-status-banner">
                            Sound is OFF. Click the instrument or press a key to enable sound.
                        </div>
                        <div class="instrument-zone">
                            <div id="instrument-display-area-wrapper">
                                <div id="instrument-display-area"></div>
                                <div id="hand-animation-overlay"></div>
                            </div>
                            <div id="side-character-container">
                                <svg id="side-character" viewBox="0 0 100 120">
                                    <ellipse cx="50" cy="80" rx="40" ry="35" fill="#87CEEB" id="char-body"/>
                                    <ellipse cx="35" cy="65" rx="8" ry="10" fill="white" id="char-eye-left-bg"/>
                                    <ellipse cx="35" cy="65" rx="4" ry="5" fill="black" id="char-pupil-left"/>
                                    <ellipse cx="65" cy="65" rx="8" ry="10" fill="white" id="char-eye-right-bg"/>
                                    <ellipse cx="65" cy="65" rx="4" ry="5" fill="black" id="char-pupil-right"/>
                                    <path id="char-mouth" d="M 35 90 Q 50 100 65 90" stroke="black" stroke-width="3" fill="transparent"/>
                                </svg>
                                <div id="keyboard-hints" class="keyboard-hints-tooltip"></div>
                            </div>
                        </div>
                        <p id="instrument-instructions" class="instructions"></p>
                    </div>
                </div>
            </section>
        `,
        about: `
            <section class="page-section">
                <div class="container">
                    <h2>About <span>InstrumentHub</span></h2>
                    <p>InstrumentHub is a passion project designed to bring the joy of music creation to everyone, everywhere. Built with modern web technologies, it aims to provide a fun and interactive way to explore different musical instruments.</p>
                    <div class="content-grid">
                        <div class="card">
                            <h3>Our Mission</h3>
                            <p>To make musical expression accessible and enjoyable through an innovative virtual platform.</p>
                        </div>
                        <div class="card">
                            <h3>Technology</h3>
                            <p>Leveraging HTML, CSS, JavaScript, Web Audio API, and GSAP for a rich, interactive experience.</p>
                        </div>
                        <div class="card">
                            <h3>The Creator</h3>
                            <p>This app was brought to life by a developer passionate about music and web technology.</p>
                        </div>
                    </div>
                </div>
            </section>
        `,
        contact: `
            <section class="page-section">
                <div class="container">
                    <h2>Contact <span>Us</span></h2>
                    <p>Have questions, feedback, or just want to say hi? Reach out!</p>
                    <form id="contact-form" style="max-width: 600px; margin: 30px auto; text-align:left;">
                        <div style="margin-bottom: 15px;">
                            <label for="name" style="display:block; margin-bottom:5px;">Name:</label>
                            <input type="text" id="name" name="name" required style="width:100%; padding:10px; border-radius:5px; border:1px solid var(--site-nav-link); background:var(--site-header-bg); color: var(--site-text);">
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label for="email" style="display:block; margin-bottom:5px;">Email:</label>
                            <input type="email" id="email" name="email" required style="width:100%; padding:10px; border-radius:5px; border:1px solid var(--site-nav-link); background:var(--site-header-bg); color: var(--site-text);">
                        </div>
                        <div style="margin-bottom: 20px;">
                            <label for="message" style="display:block; margin-bottom:5px;">Message:</label>
                            <textarea id="message" name="message" rows="5" required style="width:100%; padding:10px; border-radius:5px; border:1px solid var(--site-nav-link); background:var(--site-header-bg); color: var(--site-text);"></textarea>
                        </div>
                        <button type="submit" class="btn">Send Message</button>
                    </form>
                </div>
            </section>
        `
    };

    // --- Site Theme Manager ---
    const SiteThemeManager = {
        currentTheme: document.body.classList.contains('dark-theme') ? 'dark-theme' : 'light-theme',
        toggleTheme() {
            document.body.classList.toggle('light-theme');
            document.body.classList.toggle('dark-theme');
            this.currentTheme = document.body.classList.contains('dark-theme') ? 'dark-theme' : 'light-theme';
            siteThemeToggleBtn.textContent = this.currentTheme === 'dark-theme' ? '🌓' : '☀️';
            localStorage.setItem('instrumentSiteTheme', this.currentTheme);

            if (window.AppThemeManager && typeof window.AppThemeManager.setTheme === 'function') {
                window.AppThemeManager.setTheme(this.currentTheme);
            }
        },
        loadTheme() {
            const savedTheme = localStorage.getItem('instrumentSiteTheme');
            if (savedTheme && savedTheme !== this.currentTheme) {
                this.toggleTheme(); // This will flip it to the saved theme
            }
            // Ensure button text is correct after potential load toggle
            siteThemeToggleBtn.textContent = this.currentTheme === 'dark-theme' ? '🌓' : '☀️';
        }
    };

    function loadPageContent(pageKey) {
        if (!pageContents[pageKey]) {
            console.error("Page not found:", pageKey);
            pageKey = 'home'; // Default to home
        }
        pageContentArea.classList.add('loading');

        gsap.to(pageContentArea, {
            opacity: 0,
            y: 20,
            duration: 0.25,
            ease: "power2.in",
            onComplete: () => {
                pageContentArea.innerHTML = pageContents[pageKey];
                pageContentArea.classList.remove('loading');
                gsap.fromTo(pageContentArea,
                    { opacity: 0, y: -20 },
                    { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
                );

                if (pageKey === 'instruments') {
                    if (window.initializeAppInstruments && typeof window.initializeAppInstruments === 'function') {
                        window.initializeAppInstruments();
                        if (window.AppThemeManager && typeof window.AppThemeManager.setTheme === 'function') {
                           window.AppThemeManager.setTheme(SiteThemeManager.currentTheme);
                        }
                    } else {
                        console.warn("initializeAppInstruments function not found. Instrument app might not load.");
                    }
                }

                navLinks.forEach(link => {
                    link.classList.toggle('active-link', link.dataset.page === pageKey);
                });

                if (pageKey === 'home') {
                    const launchBtn = document.querySelector('.launch-btn');
                    if (launchBtn) {
                        launchBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            window.location.hash = '#instruments';
                        });
                    }
                }
                if (pageKey === 'contact') {
                    const contactForm = document.getElementById('contact-form');
                    if (contactForm) {
                        contactForm.addEventListener('submit', (e) => {
                            e.preventDefault();
                            alert('Thank you for your message! (This is a demo form)');
                            contactForm.reset();
                        });
                    }
                }
            }
        });
    }

    function handleNavigation() {
        const hash = window.location.hash.substring(1) || 'home';
        loadPageContent(hash);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Let hashchange handle the loading
        });
    });

    window.addEventListener('hashchange', handleNavigation);
    siteThemeToggleBtn.addEventListener('click', () => SiteThemeManager.toggleTheme());

    SiteThemeManager.loadTheme();
    handleNavigation();
});