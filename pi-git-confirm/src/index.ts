/**
 * Git Confirm Extension
 *
 * Prompts for confirmation before git commit and git push commands.
 * Prevents accidental commits or pushes.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Patterns that trigger confirmation
const GIT_COMMANDS = [
	{ pattern: /\bgit\s+commit\b/i, label: "git commit" },
	{ pattern: /\bgit\s+push\b/i, label: "git push" },
];

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = event.input.command as string;
		const match = GIT_COMMANDS.find((cmd) => cmd.pattern.test(command));

		if (match && ctx.hasUI) {
			const choice = await ctx.ui.select(
				`⚠️ ${match.label}`,
				[`Allow ${match.label}`, "No"],
			);

			if (choice !== `Allow ${match.label}`) {
				return { block: true, reason: `${match.label} blocked by user` };
			}
		}

		return undefined;
	});
}
