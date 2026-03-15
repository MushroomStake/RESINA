import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.shell}>
      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          <a href="/" className={styles.logo}>
            <span className={styles.logoMark}>R</span>
            RESINA
          </a>

          <nav>
            <ul className={styles.navLinks}>
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#platforms">Platforms</a>
              </li>
              <li>
                <a href="#download">Download</a>
              </li>
              <li>
                <a href="#contact">Contact</a>
              </li>
            </ul>
          </nav>

          <a href="#platforms" className={`${styles.navLinks} ${styles.navCta}`}>
            Get Started
          </a>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}>✦ Now available on Web &amp; Mobile</span>
            <h1 className={styles.heroTitle}>
              Everything you need,{" "}
              <span>in one place</span>
            </h1>
            <p className={styles.heroSubtitle}>
              RESINA is your all-in-one platform — access the full web experience from
              your browser or stay connected on the go with the mobile app.
            </p>
            <div className={styles.heroActions}>
              <a href="#platforms" className={styles.btnPrimary}>
                🌐 Open Web App
              </a>
              <a href="#download" className={styles.btnSecondary}>
                📱 Download App
              </a>
            </div>
          </div>

          {/* Platform mockups */}
          <div className={styles.heroVisual}>
            {/* Browser mockup */}
            <div className={styles.mockupWeb}>
              <div className={styles.mockupBar}>
                <span
                  className={styles.mockupDot}
                  style={{ background: "#ff5f57" }}
                />
                <span
                  className={styles.mockupDot}
                  style={{ background: "#febc2e" }}
                />
                <span
                  className={styles.mockupDot}
                  style={{ background: "#28c840" }}
                />
              </div>
              <div className={styles.mockupBody}>
                <div
                  className={`${styles.mockupRow} ${styles.mockupRowShort}`}
                />
                <div
                  className={`${styles.mockupRow} ${styles.mockupRowMed}`}
                />
                <div className={styles.mockupGrid}>
                  <div className={styles.mockupCard} />
                  <div className={styles.mockupCard} />
                  <div className={styles.mockupCard} />
                  <div className={styles.mockupCard} />
                </div>
              </div>
            </div>

            {/* Phone mockup */}
            <div className={styles.mockupMobile}>
              <div className={styles.mockupNotch}>
                <div className={styles.mockupNotchBar} />
              </div>
              <div className={styles.mockupMobileBody}>
                <div
                  className={`${styles.mockupMobileRow}`}
                  style={{ width: "70%" }}
                />
                <div
                  className={`${styles.mockupMobileRow}`}
                  style={{ width: "50%" }}
                />
                <div className={styles.mockupMobileCard} />
                <div
                  className={`${styles.mockupMobileRow}`}
                  style={{ width: "80%" }}
                />
                <div
                  className={`${styles.mockupMobileRow}`}
                  style={{ width: "60%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Strip ────────────────────────────────────────────── */}
      <div className={styles.statsStrip}>
        <div className={styles.statsInner}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>2</span>
            <span className={styles.statLabel}>Platforms</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>100%</span>
            <span className={styles.statLabel}>Synced Data</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>24/7</span>
            <span className={styles.statLabel}>Availability</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>v1.0</span>
            <span className={styles.statLabel}>Latest Release</span>
          </div>
        </div>
      </div>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section className={styles.section} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Features</span>
            <h2 className={styles.sectionTitle}>
              Built for <span>every workflow</span>
            </h2>
            <p className={styles.sectionDesc}>
              From powerful web tools to a seamless mobile experience, RESINA
              is designed to keep you productive wherever you are.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>⚡</div>
              <h3 className={styles.featureTitle}>Real-Time Sync</h3>
              <p className={styles.featureDesc}>
                Your data is instantly synchronized across web and mobile so
                you're always working with the latest information.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔒</div>
              <h3 className={styles.featureTitle}>Secure &amp; Private</h3>
              <p className={styles.featureDesc}>
                End-to-end encryption and industry-standard security practices
                keep your data safe on every device.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📊</div>
              <h3 className={styles.featureTitle}>Smart Dashboard</h3>
              <p className={styles.featureDesc}>
                Gain clear insights with an intuitive dashboard that surfaces
                the metrics and actions that matter most.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📱</div>
              <h3 className={styles.featureTitle}>Native Mobile App</h3>
              <p className={styles.featureDesc}>
                Available on iOS and Android, the RESINA mobile app gives you
                full functionality on the go.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🌐</div>
              <h3 className={styles.featureTitle}>Web Access</h3>
              <p className={styles.featureDesc}>
                No downloads required — access RESINA directly from any modern
                browser for the full experience.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔔</div>
              <h3 className={styles.featureTitle}>Push Notifications</h3>
              <p className={styles.featureDesc}>
                Stay informed with timely alerts and updates delivered directly
                to your mobile device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platforms ──────────────────────────────────────────────── */}
      <section
        className={`${styles.section} ${styles.sectionAlt}`}
        id="platforms"
      >
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Platforms</span>
            <h2 className={styles.sectionTitle}>
              Choose how you <span>access RESINA</span>
            </h2>
            <p className={styles.sectionDesc}>
              Whether you prefer the browser or your phone, RESINA delivers a
              consistent, polished experience on both.
            </p>
          </div>

          <div className={styles.platformsGrid}>
            {/* Web Platform */}
            <div className={styles.platformCard}>
              <div className={styles.platformCardHeader}>
                <span className={styles.platformBadge}>🌐 Web App</span>
                <h3 className={styles.platformTitle}>RESINA for Web</h3>
                <p className={styles.platformDesc}>
                  The full-featured web application, accessible from any device
                  with a browser. No installation required.
                </p>
              </div>

              <div className={styles.platformPreview}>
                <span className={styles.platformPreviewIcon}>🖥️</span>
              </div>

              <ul className={styles.platformFeatureList}>
                <li className={styles.platformFeatureItem}>
                  Full dashboard &amp; analytics
                </li>
                <li className={styles.platformFeatureItem}>
                  No installation required
                </li>
                <li className={styles.platformFeatureItem}>
                  Works on any modern browser
                </li>
                <li className={styles.platformFeatureItem}>
                  Real-time data updates
                </li>
              </ul>

              <a href="#" className={styles.platformAction}>
                🚀 Launch Web App
              </a>
            </div>

            {/* Mobile Platform */}
            <div className={styles.platformCard} id="download">
              <div className={styles.platformCardHeader}>
                <span className={styles.platformBadge}>📱 Mobile App</span>
                <h3 className={styles.platformTitle}>RESINA for Mobile</h3>
                <p className={styles.platformDesc}>
                  The native mobile experience for iOS and Android — designed
                  for speed and convenience on the go.
                </p>
              </div>

              <div className={styles.platformPreview}>
                <span className={styles.platformPreviewIcon}>📱</span>
              </div>

              <ul className={styles.platformFeatureList}>
                <li className={styles.platformFeatureItem}>
                  Available on iOS &amp; Android
                </li>
                <li className={styles.platformFeatureItem}>
                  Push notifications
                </li>
                <li className={styles.platformFeatureItem}>
                  Offline-capable features
                </li>
                <li className={styles.platformFeatureItem}>
                  Native device integrations
                </li>
              </ul>

              <a href="#" className={styles.platformAction}>
                ⬇️ Download Mobile App
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────── */}
      <section className={styles.ctaBanner} id="contact">
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>
            Ready to get started with RESINA?
          </h2>
          <p className={styles.ctaDesc}>
            Join thousands of users who rely on RESINA every day. Sign up for
            free and experience both the web and mobile apps.
          </p>
          <div className={styles.ctaActions}>
            <a href="#" className={styles.ctaBtnWhite}>
              🌐 Try Web App — Free
            </a>
            <a href="#download" className={styles.ctaBtnOutline}>
              📱 Get Mobile App
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <a href="/" className={styles.logo}>
                <span className={styles.logoMark}>R</span>
                RESINA
              </a>
              <p className={styles.footerBrandDesc}>
                RESINA is a unified platform connecting your web and mobile
                workflows. Built for productivity, designed for everyone.
              </p>
            </div>

            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Product</span>
              <ul className={styles.footerLinks}>
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#platforms">Web App</a>
                </li>
                <li>
                  <a href="#download">Mobile App</a>
                </li>
              </ul>
            </div>

            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Company</span>
              <ul className={styles.footerLinks}>
                <li>
                  <a href="#">About</a>
                </li>
                <li>
                  <a href="#">Blog</a>
                </li>
                <li>
                  <a href="#">Careers</a>
                </li>
              </ul>
            </div>

            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Support</span>
              <ul className={styles.footerLinks}>
                <li>
                  <a href="#">Documentation</a>
                </li>
                <li>
                  <a href="#">Help Center</a>
                </li>
                <li>
                  <a href="#contact">Contact Us</a>
                </li>
              </ul>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p className={styles.footerCopyright}>
              © {new Date().getFullYear()} RESINA. All rights reserved.
            </p>
            <div className={styles.footerSocials}>
              <a
                href="#"
                className={styles.socialLink}
                aria-label="Twitter / X"
              >
                𝕏
              </a>
              <a
                href="#"
                className={styles.socialLink}
                aria-label="GitHub"
              >
                ⌥
              </a>
              <a
                href="#"
                className={styles.socialLink}
                aria-label="LinkedIn"
              >
                in
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
