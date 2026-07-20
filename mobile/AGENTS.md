# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Design-system conventions (A1 unification)

- **Text**: new/edited code MUST render text via `<AppText variant="..." color="...">`
  (`src/components/AppText.tsx`) or spread a `typography.*` token — never inline
  `fontSize:` literals or raw `<Text>` with ad-hoc styles.
- **Fonts**: only the loaded families exist — `Lora_400Regular/500Medium/600SemiBold/700Bold`
  (headings) and `NunitoSans_400Regular/500Medium/600SemiBold/700Bold` (body/labels).
  **Never set `fontWeight` alongside a `fontFamily`** — weight is encoded in the family
  name; pairing them causes Android faux-bold or a silent system-font fallback.
- **Colors**: all colors come from `theme.colors` — no hex literals in screens/components.
- **Motion/haptics policy**: tappable cards/rows use `AnimatedPressable` (scale + haptics);
  haptics `light` = navigation taps, `medium` = state-changing actions (vote/submit),
  none = chat send. List entrances: `FadeInDown.springify()` staggered ≤60ms, capped at
  the first 6 items. No entrance animation in chat screens or long forms.
- **Loading/empty/error**: use the shared `Skeleton` / `EmptyState` / `ErrorState`
  components — do not hand-roll `ActivityIndicator` screens.
