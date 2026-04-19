# Code style + conventions

## TypeScript

- Both packages use TypeScript strict mode + `strictTypeChecked` ESLint rules
  (typescript-eslint flat config). Lint runs as part of `npm run check`.
- ESM modules: imports must include the `.js` extension even for `.ts` files
  (`import { foo } from './bar.js'`).
- Avoid `any`. When a type genuinely is unknown, use `unknown` and narrow.
- Async methods that don't `await` will fail lint
  (`@typescript-eslint/require-await`); make them sync if there's no await.

## Comments

- Default to none. Only write a comment when the **why** is non-obvious — a
  hidden constraint, a workaround for a specific browser/runtime quirk, or
  behavior a reader would otherwise question.
- Don't restate what the code does. Don't reference task IDs or PRs.
- One-liner is almost always enough. No multi-paragraph block comments.

## Errors and validation

- Validate inputs at boundaries: `sanitizeOwner`, `sanitizeName`,
  `sanitizeVersion`, `sanitizeFilePath` from `server/src/storage.ts`. Trust
  callers inside the package.
- Domain errors are classes with a stable `code` field (see
  `SkillExistsError`, `NonMonotonicVersionError`). Routes catch by class, not
  by message-string matching.
- Path traversal: `sanitizeFilePath` rejects `..`, absolute paths, empty
  segments. Both storage backends additionally re-resolve and check the result
  is inside the skill dir.

## SSR

- Always use the `html` tagged template from `server/src/ui/html.ts`. Never
  `String.raw` or template-concatenate user data into HTML.
- For optional sub-trees, ternaries that return `html\`...\`` or `''` are the
  norm.
- Use `i18n.ts` for all human-facing strings. Don't hardcode English in
  templates.

## Formatting

- Prettier owns formatting. Don't hand-format. Run `npm run format` before
  committing.
- Lines that look weirdly wrapped after Prettier are usually fine.

## Comments policy in this codebase specifically

The CSS in `assets.ts` uses short `/* — section divider */` comments to navigate
the long stylesheet. That's intentional and helpful given the file size; keep
the section structure when adding rules.

## Don't

- Don't add backwards-compatibility shims for code only this repo uses.
- Don't introduce gradients, rounded corners, or italic body text in the UI —
  the design language is pixel-NES with hard edges.
- Don't add CSS animations that delay content reveal — explicitly removed by
  user feedback.
- Don't leave large or binary files in `examples/`. The sample SKILL must stay
  text-only and small.
