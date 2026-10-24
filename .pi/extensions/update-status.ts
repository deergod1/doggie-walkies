/**
 * update_status: lets the agent announce what it is working on.
 *
 * The agent calls `update_status` with a phase, a sticky title and a short
 * description. The latest status is shown as a single colored line in the
 * footer (`PHASE │ title │ description`) and the title goes into the terminal
 * tab title. State lives in tool-result details so it follows the session
 * branch (resume, /tree, fork).
 */

import path from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";

const TOOL_NAME = "update_status";
const STATUS_KEY = "update-status";

const PHASES = ["planning", "exploring", "implementing", "testing", "debugging", "reviewing", "done"] as const;
type Phase = (typeof PHASES)[number];
type DisplayPhase = Phase | "idle" | "thinking";

type ThemeColor = Parameters<Theme["fg"]>[0];

const PHASE_STYLE: Record<DisplayPhase, { label: string; color: ThemeColor }> = {
	idle: { label: "IDLE", color: "dim" },
	thinking: { label: "THINK", color: "muted" },
	planning: { label: "PLAN", color: "mdHeading" },
	exploring: { label: "EXPLORE", color: "syntaxFunction" },
	implementing: { label: "BUILD", color: "accent" },
	testing: { label: "TEST", color: "warning" },
	debugging: { label: "DEBUG", color: "error" },
	reviewing: { label: "REVIEW", color: "syntaxKeyword" },
	done: { label: "DONE", color: "success" },
};

interface StatusDetails {
	phase: Phase;
	title: string;
	description: string;
	timestamp: number;
}

const Params = Type.Object({
	phase: Type.Optional(
		StringEnum(PHASES, {
			description: "Current phase. Omit to keep the previous phase.",
		}),
	),
	title: Type.Optional(
		Type.String({
			description:
				"Short title of the overall task (3-8 words). Set it when starting a task; omit to keep the current one.",
		}),
	),
	description: Type.String({
		description: "One short sentence on what you are doing right now.",
	}),
});

const projectName = () => path.basename(process.cwd());

function badge(theme: Theme, phase: DisplayPhase): string {
	const style = PHASE_STYLE[phase];
	return theme.bold(theme.inverse(theme.fg(style.color, ` ${style.label} `)));
}

function formatLine(theme: Theme, phase: DisplayPhase, title: string, description: string): string {
	const sep = theme.fg("dim", " │ ");
	const color = PHASE_STYLE[phase].color;
	return badge(theme, phase) + " " + theme.bold(theme.fg(color, title)) + sep + theme.fg("text", description);
}

/** Single-line component that never wraps. */
function line(text: string, pad: number) {
	return {
		render(width: number): string[] {
			return [truncateToWidth(" ".repeat(pad) + text, width)];
		},
		invalidate() {},
	};
}

export default function (pi: ExtensionAPI) {
	let current: StatusDetails | undefined;
	let running = false;

	const render = (ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;
		const theme = ctx.ui.theme;

		let phase: DisplayPhase;
		let title: string;
		let description: string;
		if (current && !(running && current.phase === "done")) {
			({ phase, title, description } = current);
		} else if (running) {
			phase = "thinking";
			title = current?.title ?? pi.getSessionName() ?? projectName();
			description = "reading the request…";
		} else {
			phase = "idle";
			title = pi.getSessionName() ?? projectName();
			description = "waiting for a task";
		}

		ctx.ui.setStatus(STATUS_KEY, formatLine(theme, phase, title, description));
		ctx.ui.setTitle(`π ${PHASE_STYLE[phase].label} · ${title} — ${projectName()}`);
	};

	const reconstruct = (ctx: ExtensionContext) => {
		current = undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "message") continue;
			const msg = entry.message;
			if (msg.role !== "toolResult" || msg.toolName !== TOOL_NAME) continue;
			const details = msg.details as StatusDetails | undefined;
			if (details?.title) current = details;
		}
		render(ctx);
	};

	pi.on("session_start", async (_event, ctx) => {
		running = false;
		reconstruct(ctx);
	});
	pi.on("session_tree", async (_event, ctx) => reconstruct(ctx));

	pi.on("agent_start", async (_event, ctx) => {
		running = true;
		render(ctx);
	});
	pi.on("agent_settled", async (_event, ctx) => {
		running = false;
		render(ctx);
	});
	pi.on("session_shutdown", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setStatus(STATUS_KEY, undefined);
		ctx.ui.setTitle(`π - ${projectName()}`);
	});

	pi.registerTool({
		name: TOOL_NAME,
		label: "Status",
		description:
			"Report what you are working on so the user can follow along. Shown as one line in the UI footer: " +
			"PHASE │ title │ description. The title is sticky (only set it when the task changes); the description " +
			"replaces the previous one. Returns nothing useful; just continue working afterwards.",
		promptSnippet: "Announce the current task title, phase and a one-line progress description in the UI footer",
		promptGuidelines: [
			"Before starting implementation work, call update_status with a phase, a short title for the task and a one-sentence description.",
			"Call update_status again when moving to a new phase (exploring, implementing, testing, debugging, reviewing) or a notably different step; not on every tool call.",
			"When the task is finished, call update_status with phase 'done' and a short summary of the outcome.",
			"Keep update_status text short and concrete (title 3-8 words, description under ~80 characters). Skip it for plain questions and trivial one-step answers.",
		],
		parameters: Params,
		renderShell: "self",

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const titleChanged = params.title !== undefined && params.title.trim() !== current?.title;
			const details: StatusDetails = {
				phase: params.phase ?? (titleChanged ? undefined : current?.phase) ?? "implementing",
				title: params.title?.trim() || current?.title || pi.getSessionName() || projectName(),
				description: params.description.trim(),
				timestamp: Date.now(),
			};
			current = details;
			render(ctx);
			return {
				content: [{ type: "text", text: "ok" }],
				details,
			};
		},

		// Rendered from args only so historical calls show what was sent at the time.
		renderCall(args, theme, context) {
			const sep = theme.fg("dim", " │ ");
			let text = theme.fg("dim", "◆ ");
			const color = args.phase ? PHASE_STYLE[args.phase].color : "muted";
			if (args.phase) text += badge(theme, args.phase) + " ";
			if (args.title?.trim()) text += theme.bold(theme.fg(color, args.title.trim())) + sep;
			text += theme.fg("muted", args.description ?? "…");
			return line(text, context.outputPad);
		},

		renderResult(result, _options, theme, context) {
			if (context.isError) {
				const text = result.content[0];
				return line(theme.fg("error", text?.type === "text" ? text.text : "update_status failed"), context.outputPad);
			}
			return { render: () => [], invalidate() {} };
		},
	});
}
