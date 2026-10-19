# Design System

ApplyTrack uses the approved Claude Version B Teal/Terracotta design: a working
product, not a marketing dashboard. Keep dense data scannable, next actions clear,
and real pending/error/empty states truthful.

## Source and Ownership

The protected `UI_update` branch contains the canonical
[Version B prototype](https://github.com/YijunYuan-Work/ApplyTrack/blob/c3a18b349adff6ed54e4608cd11dd2bde3fa3bed/new_design/ApplyTrack%20Version%20B%20-%20Teal%20Terracotta.html)
and [remaining-screen reference](https://github.com/YijunYuan-Work/ApplyTrack/blob/63394fae41fbd5ad989d5ce01749b41041b626ee/new_design/ApplyTrack%20UI%202.0%20-%20Remaining%20Screens.html).
Do not modify that branch or copy prototype data, mock actions or account behavior
into the application. Actual Version B color usage supersedes stale palette labels.

[src/index.css](../src/index.css) owns tokens, fonts, focus and reduced motion.
[AppLayout.css](../src/components/AppLayout.css) owns navigation;
[App.css](../src/App.css) and [theme.css](../src/styles/theme.css) retain shared
defaults/fallbacks. Page interiors belong to the focused stylesheets in
[src/styles](../src/styles), not new global override layers.

## Color and Typography

| Palette | Value | Role |
| --- | --- | --- |
| Deep Teal | `#286A73` | Navigation, headings, primary actions, Offer |
| Sea Glass | `#8DBFC2` | Applied markers and supporting accents |
| Peach Sorbet | `#F3B59D` | Rejected markers and sidebar Add |
| Cream Sand | `#F1DEBA` | Application canvas |
| Terracotta | `#B66D55` | Interview markers and focus accent |

Surfaces use `#FFFDF8`, fields/details `#FFFFFF`, and soft panels `#F7EDDA`.
Use semantic tokens rather than replacing every color with a palette base.

| Status | Label background / text |
| --- | --- |
| Applied | `#D7EAEA` / `#286A73` |
| Interview | `#A05A43` / `#FFFDF8` |
| Offer | `#286A73` / `#FFFDF8` |
| Rejected | `#FBE3D8` / `#8A4A35` |

Dashboard/mobile Add uses deeper Terracotta `#A05A43`; sidebar text uses
`#CDE3E4` for contrast. Actual error, warning and success feedback retains its
own semantic colors, not decorative status colors.

Figtree is the UI family; JetBrains Mono is for compact metadata. Both are
self-hosted in [src/assets/fonts](../src/assets/fonts), with their OFL notices.
Keep fixed type sizes, zero letter spacing, token spacing/radii and readable wrapping.

## Responsive Behavior

| CSS viewport | Navigation and content |
| --- | --- |
| `width >= 1040px` | 248px labeled sidebar; four Board columns |
| `640px <= width < 1040px` | 76px icon rail with accessible names/tooltips; two Board columns |
| `width < 640px` | 60px top bar and 70px bottom navigation plus safe areas; one active Board stage |

Use CSS range queries consistently, including fractional widths. The List hides
secondary columns below 1280px, then becomes phone-friendly rows below 640px.
Select All follows the visible Board scope; List selection stays current-page.
Sign Out is in the sidebar/rail or mobile Profile, not duplicated visibly.

Details use a modal side drawer, changing to a bottom sheet below 640px. Add/Edit
remain full pages. Progress uses a Sankey Map above phone width and compact outcome
rows on phone; Calendar uses seven desktop columns, four tablet columns and a
single-column phone layout. Auth is split desktop, centered tablet and unframed
phone. Import preview adapts to stacked phone rows with confirmation before writes.

## Interaction and Accessibility

Preserve native control semantics, named icon actions, visible 3px focus rings,
keyboard navigation, modal focus restoration and practical failure/retry feedback.
Aim for at least 44px actionable targets on tablet/phone; never use color alone.
Motion tokens are 140ms press, 200ms hover, 320ms navigation, 420ms entrance and
800ms chart. Respect reduced motion and do not hide canonical values behind animation.
Verify 1440/768/390px and relevant boundaries; automated checks are not WCAG certification.
