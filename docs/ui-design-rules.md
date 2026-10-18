# UI/UX Design Rules for the Discord VC Scheduling App

These rules apply to all UI work unless a specific instruction overrides them. The
tokens and components that implement them live in `client/src/styles/` and
`client/src/components/ui/`.

## 1. Overall Design Philosophy
- Design a modern, polished SaaS web application focused on scheduling Discord voice chat sessions.
- Prioritize visual consistency, usability, readability, and simplicity over unnecessary visual effects.
- Use a dark, gaming-inspired aesthetic with the restraint and clarity of a professional productivity app.
- The interface should feel familiar to Discord users without directly copying Discord's entire UI.
- Favor clean layouts, subtle borders, consistent spacing, and clear visual hierarchy.
- Avoid generic AI-generated website aesthetics, excessive gradients, excessive glassmorphism, and unnecessary decorative elements.

## 2. Design System and Consistency
- Establish reusable design tokens for colors, typography, spacing, borders, corner radii, shadows, and transitions.
- Reuse existing design tokens and components instead of creating new styles for every page.
- Use a consistent 4px or 8px spacing system.
- Use consistent corner radii: approximately 6–8px for inputs and buttons, and 10–14px for cards and larger containers.
- Use subtle borders and restrained shadows to distinguish surfaces.
- Maintain consistent alignment, padding, component sizing, and spacing throughout the application.
- Before introducing a new design pattern, check whether an existing component can be reused or extended.

## 3. Color Palette
- Use a dark charcoal background rather than pure black.
- Use slightly lighter surfaces for cards, panels, navigation, and modals.
- Use a restrained purple, periwinkle, or Discord-inspired blue-violet as the primary accent.
- Reserve accent colors for primary actions, selected navigation, links, and important interactive states.
- Use green for success and confirmed states, yellow or orange for pending states, and red for destructive actions or errors.
- Maintain sufficient contrast between text and its background.
- Do not assign arbitrary colors to individual cards or components.
- Never rely on color alone to communicate status.
- Support a consistent theme throughout the application.

Suggested starting colors:
- Main background: `#171821`
- Card background: `#222430`
- Elevated surface: `#2B2D3B`
- Primary accent: `#8B7CFF`
- Primary text: `#F3F4F8`
- Secondary text: `#A5A7B8`
- Borders: `#383A4B`
- Success: `#45C99A`
- Warning: `#F2B95E`
- Error: `#F16C78`

Treat these colors as design tokens that can be adjusted globally.

## 4. Typography
- Use one consistent, modern sans-serif font, such as Inter or Geist.
- Use a clear hierarchy between page headings, section headings, card titles, body text, and metadata.
- Suggested sizes:
  - Page headings: 28–36px
  - Section headings: 20–24px
  - Card titles: 16–18px
  - Body text: 14–16px
  - Metadata and labels: 12–14px
- Use font weight and spacing to establish hierarchy rather than relying exclusively on font size.
- Avoid excessive bold text, all-caps headings, and unnecessary font variations.
- Keep secondary text readable and maintain adequate contrast.

## 5. Layout and Spacing
- Use a consistent layout grid and predictable content widths.
- Align elements to common horizontal and vertical guides.
- Group related information together and separate unrelated sections with whitespace.
- Avoid cramped layouts, excessive empty space, and inconsistent component spacing.
- Keep important information and primary actions near the top of the page.
- Use cards only when they meaningfully group related content.
- Avoid excessive nesting of cards inside other cards.
- Prevent content from overflowing its containers.
- Maintain a clear distinction between the page background, navigation, content areas, and elevated surfaces.

## 6. Navigation
- Keep navigation simple, predictable, and consistent across pages.
- Use clear labels for major destinations, such as Dashboard, Sessions, Availability, Servers, and Settings, where applicable.
- Clearly indicate the active navigation item.
- Use consistent icons from one icon library.
- Do not mix unrelated icon styles or use emojis as substitutes for interface icons.
- Avoid unnecessary navigation items and duplicate ways to reach the same destination.
- Preserve the existing application's navigation structure unless there is a clear usability reason to change it.

## 7. Buttons and Interactive Elements
- Establish three button levels: primary, secondary, and tertiary or text actions.
- Use the primary style for the most important action on each screen.
- Keep button heights, padding, corner radii, and typography consistent.
- Provide hover, active, focus, disabled, and loading states where appropriate.
- Use clear action labels, such as "Create Session," "Save Changes," and "Join Discord."
- Avoid vague labels such as "Submit" when a more descriptive label is possible.
- Make clickable areas sufficiently large for comfortable mouse and touch interaction.
- Do not make decorative elements appear interactive.
- Prevent duplicate submissions while an action is processing.

## 8. Forms and Scheduling
- Place labels above inputs and do not rely exclusively on placeholders.
- Group related fields, such as session name, date, time, server, and voice channel.
- Use appropriate date and time inputs.
- Clearly distinguish required and optional fields.
- Validate user input and display helpful, localized error messages.
- Preserve entered data when a submission fails.
- Show visible success feedback after a session is created or updated.
- Confirm destructive actions, such as deleting a scheduled session.
- Make scheduling forms easy to scan and complete without unnecessary steps.
- Handle time zones and daylight-saving transitions correctly.

## 9. Session Cards and Scheduling Information
- Make session cards visually consistent throughout the application.
- Prioritize the session name, date, and time.
- Display relevant information such as attendee count, RSVP status, Discord server, and voice channel.
- Clearly distinguish Going, Maybe, Can't Attend, Pending, Confirmed, Cancelled, and Completed states where applicable.
- Use badges sparingly and consistently.
- Group session information logically rather than scattering metadata across the card.
- Make the primary action for each session easy to identify.
- Use consistent alignment and positioning for card actions.
- Provide clear empty states when no sessions exist.
- Ensure long session names, usernames, and server names do not break the layout.

## 10. Discord Integration
- Use Discord avatars, usernames, server icons, and channel information when available and authorized.
- Maintain a consistent presentation of Discord-related information.
- Make the relationship between a scheduled session and its associated Discord server or voice channel clear.
- Clearly communicate integration status, permission issues, connection errors, and loading states.
- Provide useful feedback when Discord-related operations fail.
- Never display a join or connection action that the existing integration does not actually support.
- Do not fabricate user presence, server membership, attendee counts, or session status.
- Preserve existing authentication, API calls, permissions, and backend integration behavior when modifying the UI.

## 11. Responsive Design
- Support desktop, tablet, and mobile layouts.
- Use responsive grids and flexible containers instead of fixed widths wherever practical.
- Collapse multi-column layouts into a single column on narrow screens.
- Ensure navigation remains usable on mobile.
- Prevent horizontal scrolling in the primary application layout.
- Make calendars, scheduling forms, and session cards usable with touch input.
- Keep primary actions accessible on smaller screens.
- Test layouts at approximately 375px, 768px, 1024px, and 1440px viewport widths.

## 12. Accessibility
- Maintain WCAG AA contrast requirements where applicable.
- Support keyboard navigation throughout the application.
- Provide visible focus indicators.
- Use semantic HTML elements and a logical heading hierarchy.
- Associate form inputs with accessible labels.
- Provide accessible names for icon-only buttons.
- Do not communicate important information through color alone.
- Respect reduced-motion preferences.
- Avoid animations that interfere with reading or interaction.

## 13. Animation and Visual Polish
- Use subtle transitions for hover states, dropdowns, dialogs, and navigation changes.
- Keep most interface transitions within approximately 120–220ms.
- Avoid unnecessary bouncing, excessive scaling, continuous animation, and distracting motion.
- Use shadows, borders, and background changes to communicate interaction and depth.
- Maintain visual stability when content loads.
- Use loading indicators or skeletons only when they improve the perceived experience.
- Prefer subtle, purposeful effects over visual spectacle.

## 14. Loading, Error, and Empty States
- Design explicit loading, success, error, disabled, and empty states for important interactions.
- Provide helpful messages instead of blank panels or unexplained failures.
- Include a relevant next action in empty states when possible.
- Distinguish between a genuinely empty session list and data that failed to load.
- Display recoverable errors with an appropriate retry option.
- Never silently discard user input or imply that an operation succeeded when it failed.

## 15. Code Quality and Implementation Constraints
- Inspect the existing project structure, framework, styling system, and component conventions before making changes.
- Reuse existing dependencies and components whenever practical.
- Do not introduce a new UI framework, component library, or dependency without a clear need.
- Keep styling maintainable and avoid duplicated CSS or conflicting overrides.
- Separate reusable components from page-specific layout logic.
- Use semantic, descriptive component and class names.
- Avoid unnecessary abstractions for simple UI elements.
- Do not rewrite working backend logic, API integrations, authentication, database schemas, or application routing merely to improve the appearance.
- Preserve all existing functionality unless a behavior change is explicitly requested.
- Do not replace real data or working functionality with hardcoded mock data.
- Keep the implementation compatible with the project's existing framework and conventions.

## 16. Required Workflow for UI Changes
For each UI improvement:
1. Inspect the relevant pages, components, styles, and dependencies.
2. Identify the main usability or visual consistency problems.
3. Establish or reuse the appropriate design tokens and components.
4. Implement the smallest coherent set of changes needed to improve the interface.
5. Check that the layout works at desktop and mobile widths.
6. Verify that existing interactions, forms, API calls, and navigation still work.
7. Check for layout overflow, inconsistent spacing, broken states, and console errors.
8. Summarize the files changed, the improvements made, and any remaining issues.

## 17. Final Design Standard
The finished application should feel like a cohesive, production-quality scheduling product rather than a collection of independently styled pages.

Prioritize, in order:
1. Usability and clarity.
2. Consistency across the application.
3. Visual hierarchy and spacing.
4. Responsive behavior and accessibility.
5. Subtle visual polish.

When a design decision is unclear, prefer the simpler, more consistent, and more maintainable option. Do not add complexity purely for aesthetic reasons.
