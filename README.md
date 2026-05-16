# Pi Extensions

Collection of extensions and skills for [Pi](https://github.com/earendil-works/pi) coding agent.

## Extensions

| Extension | Description |
|-----------|-------------|
| [pi-tps-extension](./pi-tps-extension/) | Real-time TPS (tokens per second) metrics |

## Usage

Copy the desired skill file to `~/.pi/skills/`:

```bash
cp pi-tps-extension/src/extension.ts ~/.pi/skills/tps-metrics.ts
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
