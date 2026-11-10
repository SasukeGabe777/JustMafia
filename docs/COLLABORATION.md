# Gabe / Codex and Justin / Claude workflow

Both contributors develop the same game in separate local checkouts. Merge
small, reviewed pull requests into `main`; pull the merged work before starting
another task. A running LAN server serves its local checkout, not GitHub, and
does not automatically deploy merged updates.

## First checkout

Accept the GitHub collaborator invitation and authenticate Git with your own
account. Install Git and a current Node.js LTS release, then run:

```sh
git clone https://github.com/SasukeGabe777/JustMafia.git
cd JustMafia
npm ci
npm test
npm start
```

The server prints its LAN address. Local entry points are `/`, `/play`,
`/judge`, `/test`, `/preview`, and `/art`. The Judge needs credentials issued
by a created town; opening `/judge` alone does not grant access.
Profiles are local in `.data/profiles.json`; running rooms are memory-only.
Each developer keeps their own runtime data. Do not sync it through Git.

## Start a task

First inspect the working tree. If it has changes, preserve them and finish or
coordinate that work before switching branches. With a clean tree:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c claude/short-task
```

Codex uses `codex/short-task` instead. Check recent commits, open PRs, and
`PLAN.md`. Open an issue or draft PR stating who is working, the intended
behavior, and likely shared files. An issue is a notice, not an exclusive lock.
Coordinate overlapping work through GitHub comments or the other contributor;
do not assume an agent can see the other person's private chat.

High-overlap areas include `game.js`, `server.js`, `public/shared/roles.js`,
`rules/night-pipeline.js`, `public/play.js`, `public/judge.js`, and town/cinema
rendering. For overlapping changes, split responsibilities or merge one PR
first and build the next on updated `main`.

## Publish and integrate

Review your diff and stage the intended files explicitly, then:

```sh
git commit -m "Describe the behavior changed"
git push -u origin claude/short-task
```

Open a PR against `main` (the GitHub website is sufficient; `gh` is optional).
Before final review, integrate the latest main on your task branch:

```sh
git fetch origin
git merge origin/main
```

Resolve conflicts by understanding both changes, then rerun affected tests.
Never resolve a conflict by blindly accepting an entire file as ours/theirs.
Run `npm test` for gameplay/security or broad renderer changes and record exact
results. Test UI in the browser when possible; document any unavailable checks.
Push the integrated branch normally. If `main` advances again in a conflicting
area, integrate and validate again before merge.

Have the other contributor review and merge the PR. If the author merges after
explicit agreement, use GitHub's normal PR merge; do not force-push main.
After merge, each contributor updates a clean local main using
`git pull --ff-only origin main`. Run `npm ci` when dependencies changed.
Coordinate server restarts: restarting ends in-memory party sessions.

## Handoff

Each PR describes the problem, resulting behavior, affected systems, checks
actually completed, and limitations. Update the relevant `PLAN.md` section.
End an agent session with the branch, commit, PR URL, and any uncommitted work
or overlap warnings. Do not treat a chat promise as a shared GitHub update.

## Repository settings Gabe should enable on GitHub

For `main`, use branch protection or a ruleset (where available) requiring a
pull request and one approval, preventing force pushes and deletion, and
dismissing stale approvals after new commits. Once CI exists, require its
checks and an up-to-date branch before merging. These settings must be enabled
on GitHub; these documents alone do not enforce them. Existing collaborator
write access does not itself prevent a direct push.
