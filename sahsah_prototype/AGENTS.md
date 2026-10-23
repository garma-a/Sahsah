# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Required skill selection

For **every user prompt**, check for relevant skills before substantive investigation, answering, or implementation, even when the user does not name a skill.

1. Search the available skill names and descriptions by the request's intent, the work involved, and the project's actual stack. If the session catalog is incomplete, inspect project `.agents/skills/` and installed user skill directories such as `~/.agents/skills/` and `$CODEX_HOME/skills/`.
2. Select the smallest set of skills that covers the request. Open and read each selected `SKILL.md` before proceeding; read supporting references when their instructions require them. Reassess the selection on every prompt and whenever the task changes.
3. Follow the selected workflows, prerequisites, and verification requirements within the user's authorized scope. Respect skills restricted to explicit invocation. If a relevant skill is unavailable or incompatible, state the limitation briefly and use a compatible approach.
4. Briefly identify the skills being used and why. When no skill applies, proceed normally after checking; unrelated skills are unnecessary.

Use these starting points, then check the catalog for any other relevant skills:

| Task | Skills to consider |
| --- | --- |
| New UI, visual redesign, layout, or typography | `frontend-design` |
| Tailwind tokens, themes, component variants, or consistent styling | `tailwind-design-system` |
| React implementation or performance | `vercel-react-best-practices` |
| Reusable React components or component API refactoring | `vercel-composition-patterns` |
| Accessibility, usability, or UI review | `web-design-guidelines` |
| Bug diagnosis or performance regression | `diagnosing-bugs` |
| Browser workflows or end-to-end tests | `e2e`; preserve the existing test framework unless a change is authorized |
| Test-first implementation | `tdd` |
| Implementing a Figma design | `figma:figma-design-to-code` |
| Editing agent instructions | `writing-for-agents` |

This project uses React and Vite. Apply Next.js-specific skills only when the code actually in scope uses Next.js and meets the skill's prerequisites. A skill recommendation alone does not authorize a framework upgrade or a new test framework.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
