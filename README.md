# Pi Extensions

Collection of extensions and skills for [Pi](https://github.com/earendil-works/pi) coding agent.

## Extensions

| Extension | Description |
|-----------|-------------|
| [pi-code-review](./pi-code-review/) | Code review for bugs, security, performance, style, and architecture |
| [pi-git-confirm](./pi-git-confirm/) | Prompts for confirmation before `git commit` and `git push` |
| [pi-plan-mode](./pi-plan-mode/) | Read-only exploration mode for safe code analysis |
| [pi-tps-extension](./pi-tps-extension/) | Real-time TPS (tokens per second) metrics |

## Skills

| Skill | Description |
|-------|-------------|
| [pi-web-search](./pi-web-search/) | Web search via DuckDuckGo HTML with result summarization |

## Usage

### Installing an Extension

Copy the extension source to `~/.pi/agent/extensions/` for auto-discovery:

```bash
# TPS metrics
cp pi-tps-extension/src/extension.ts ~/.pi/agent/extensions/tps-metrics.ts
```

Then reload Pi:

```
/reload
```

## Building Extensions

Each extension is a self-contained package with its own `package.json` and `tsconfig.json`:

```bash
cd <extension-folder>
npm install
npm run build
```

## License

MIT
