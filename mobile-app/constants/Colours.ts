// mobile-app/constants/Colours.ts
// Eclipse Blue — N3XO Fintech Palette

export const Colors = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  deepNavy: '#0A0E1A',          // Primary screen background
  deepNavyAlt: '#0D1221',       // Slight variant for depth/layering

  // ── Brand Accents ──────────────────────────────────────────────────────
  eclipseBlue: '#1B2FE8',       // Primary CTA button, brand highlight
  electricBlue: '#4D8FFF',      // Active icons, selected states, links
  eclipseBlueDark: '#1424C2',   // Pressed state / shadow tint

  // ── State Colours ────────────────────────────────────────────────────
  frozenTeal: '#2B7EC8',        // Frozen account background — deeper steel blue
  dangerRed: '#FF4D6A',         // Logout / destructive actions
  successGreen: '#00D48A',      // Positive balance / success states
  warningAmber: '#FFB020',      // Warning states

  // ── Glass / Card Surfaces ────────────────────────────────────────────
  glassCard: 'rgba(255,255,255,0.06)',     // Frosted glass card background
  glassCardHover: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(77,143,255,0.25)',    // Electric blue tint border
  glassDivider: 'rgba(77,143,255,0.15)',   // Subtle divider lines

  // ── Input Fields ───────────────────────────────────────────────────────
  inputBackground: 'rgba(255,255,255,0.08)', // Dark glass input background
  inputBorder: 'rgba(77,143,255,0.30)',

  // ── Text ─────────────────────────────────────────────────────────────
  textWhite: '#FFFFFF',                      // Primary text
  textSecondary: 'rgba(255,255,255,0.55)',   // Labels, subtext
  textMuted: 'rgba(255,255,255,0.30)',       // Very faint, placeholders
  textOrange: '#FFFFFF',                     // Legacy compat — now white logo

  // ── Tab Bar ───────────────────────────────────────────────────────────
  tabBarBackground: 'rgba(10,14,26,0.97)',   // Dark frosted glass tab bar
  tabBarActive: '#4D8FFF',                   // electricBlue
  tabBarInactive: 'rgba(255,255,255,0.32)',

  // ── Legacy aliases (keep for backward compat during rollout) ──────────
  backgroundBlue: '#0A0E1A',    // was #08c1ff → now deepNavy
  backgroundPeach: '#00D4C8',   // was #ADE6D8 → now frozenTeal
  buttonDark: '#1B2FE8',        // was #222222 → now eclipseBlue

  // ── Header ────────────────────────────────────────────────────────────
  header: {
    background: '#0A0E1A',
    tint: '#FFFFFF',
    peachBackground: '#00D4C8', // Frozen screen header
  },
};
