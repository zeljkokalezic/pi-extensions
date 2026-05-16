# TPS Metrics for Pi

Real-time tokens per second (TPS) metrics display for the Pi coding agent.

## Features

- 🚀 Real-time TPS display during streaming
- 📊 Final summary with total tokens and average TPS
- ⏱️ Peak TPS tracking
- 🧹 Automatic cleanup after streaming ends

## Installation

### Option 1: As a Pi Skill (Recommended)

1. Copy the skill file to your Pi skills directory:
   ```bash
   cp tps-metrics.ts ~/.pi/skills/
   ```

2. Restart Pi or reload skills:
   ```
   /reload
   ```

### Option 2: As a Pi Package

1. Build the extension:
   ```bash
   npm install
   npm run build
   ```

2. Install as a Pi package:
   ```bash
   pi install ./dist/extension.js
   ```

## Usage

The extension automatically activates when Pi starts streaming a response. You'll see:

**During streaming:**
```
🚀 45.2 t/s
```

**After streaming completes:**
```
✅ 1250 tokens in 27.6s (45.3 t/s avg)
```

The metrics appear in the footer alongside other status information.

## Metrics Explained

- **TPS (Tokens Per Second)**: Average token generation speed since streaming started
- **Peak TPS**: Highest instantaneous TPS achieved during streaming
- **Total Tokens**: Total output tokens generated in the response
- **Elapsed Time**: Time taken to generate the response

## Customization

You can modify the skill file to change:
- Display format (emoji, text)
- Update frequency
- Metric precision
- Cleanup delay

## Troubleshooting

- **Metrics not showing**: Ensure Pi is streaming (not using non-streaming mode)
- **Inaccurate TPS**: Some providers don't report token counts in real-time
- **Status not clearing**: Use `/reload` to refresh the skill

## License

MIT
