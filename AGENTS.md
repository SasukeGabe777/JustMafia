# Shared instructions for Mafia Town contributors and coding agents

Gabe uses Codex and Justin uses Claude Code against this same repository.
GitHub is the shared source of truth. These instructions apply to both agents.
Read `docs/COLLABORATION.md`, `PLAN.md`, and the relevant implementation before
changing code. Do not assume an old chat describes the current checkout.

## Keep contributors in sync

- Use a separate clone or worktree for each simultaneous task. Never have two
  agents edit the same working directory concurrently.
- Before each task, inspect `git status --short --branch`, fetch origin, and
  inspect recent commits and open pull requests when GitHub access is available.
  Preserve uncommitted work. Do not silently stash, discard, or overwrite it.
- Start new work from current `origin/main` on a task branch named
  `codex/<short-task>` or `claude/<short-task>`. Use a pull request to merge.
  Do not push feature work directly to `main`.
- Claim a task in a GitHub issue or draft PR before substantial edits. Describe
  the scope and files likely to overlap. If the other contributor is working
  in the same area, coordinate the boundary before making overlapping changes.
  Task claims are coordination notices, not automatic file locks.
- Keep changes focused. Do not include unrelated refactors, mass formatting,
  or dependency upgrades in a feature branch.
- Before requesting merge, fetch again, merge `origin/main` into the task
  branch, resolve conflicts preserving both contributors' intended behavior,
  and rerun the relevant checks on that integrated result. If the intended
  behavior is unclear, ask the contributor rather than choosing a whole side.
- Never force-push, rewrite shared history, use destructive resets/cleans, or
  replace files wholesale to resolve a conflict. Prefer ordinary merge commits.
- Report branch, commit, changed behavior, tests actually run, remaining limits,
  and PR URL. If network/authentication prevents syncing, say so explicitly;
  do not claim work is pushed or current with GitHub.
- After a merge, update local `main` with `git pull --ff-only` before starting
  the next task. Never restart an active party server without coordinating.

## Preserve the game architecture

- Extend existing systems; inspect current code before rebuilding anything.
- The server owns rules, roles, actions, votes, statuses, rewards, and purchases.
  TV payloads contain only public information, phones only authorized private
  information, and Judge payloads privileged information. Never hide secrets
  with CSS or send the entire hidden state to narration or player clients.
- Keep mechanics separate from cinematics and presentation-only narration.
  Preserve 100-player support, Human Narrator mode, existing role behavior,
  theme architecture, identity/reconnection, and server-side Judge checks.
- Prefer original artwork. Do not copy Darkest Dungeon artwork or add supplied
  asset archives to Git. Preserve the current local-only photo privacy model
  unless a separately agreed feature explicitly changes it.
- Do not commit `.data/`, profiles, credentials, `.env` secrets, `node_modules/`,
  logs, caches, or asset-audit downloads. Keep dependency changes intentional
  and commit `package-lock.json` with them.

## Verify and document

- Use `npm ci` for a fresh checkout and `npm start` to run the game.
- Run tests relevant to each change; use `npm test` before merging gameplay,
  socket/security, or broad rendering changes. It starts its own test servers;
  do not run multiple copies simultaneously in one environment.
- Add interaction/security regressions for new mechanics. A stub-canvas test
  does not establish browser appearance or phone performance; visually verify
  UI changes when possible and explicitly report untested interactions.
- Update the relevant part of `PLAN.md` with completed work, major decisions,
  actual validation, and remaining limitations. Do not rewrite its history or
  mark untested work as complete. Update README when usage changes.
