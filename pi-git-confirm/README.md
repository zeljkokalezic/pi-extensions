# Git Confirm Extension

Prompts for confirmation before `git commit` and `git push` commands.

## Features

- **Commit confirmation**: Asks before any `git commit` command
- **Push confirmation**: Asks before any `git push` command
- **Non-interactive safe**: Silently allows commands when no UI is available

## Installation

Copy to your pi extensions directory:

```bash
mkdir -p ~/.pi/agent/extensions/git-confirm
cp pi-git-confirm/src/index.ts ~/.pi/agent/extensions/git-confirm/
```

Then reload Pi:

```
/reload
```
