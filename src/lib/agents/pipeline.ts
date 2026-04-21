import type {
  AnalystOutput,
  ArchitectOutput,
  PipelineState,
  QaOutput,
  ThemeOutput,
} from "./schemas";
import { runAnalyst } from "./runAnalyst";
import { runArchitect } from "./runArchitect";
import { runImplementer } from "./runImplementer";
import { runCritic } from "./runCritic";
import { validateGeneratedTsx } from "./validateGeneratedTsx";
import { runThemeStylist } from "./runThemeStylist";
import { writePipelineState } from "./stateStore";

export type AgentId =
  | "prd_analyst"
  | "ux_planner"
  | "design_agent"
  | "ui_generator"
  | "qa_agent";

export type PipelineEvent =
  | { type: "agent_start"; agent: AgentId }
  | {
      type: "agent_complete";
      agent: "prd_analyst";
      payload: AnalystOutput;
    }
  | {
      type: "agent_complete";
      agent: "ux_planner";
      payload: ArchitectOutput;
    }
  | {
      type: "agent_complete";
      agent: "design_agent";
      payload: ThemeOutput;
    }
  | {
      type: "agent_complete";
      agent: "ui_generator" | "qa_agent";
      payload?: QaOutput;
    }
  | {
      type: "result";
      tsx: string;
      analyst: AnalystOutput;
      architect: ArchitectOutput;
      theme: ThemeOutput;
    }
  | { type: "generation_attempt"; attempt: number; maxAttempts: number }
  | { type: "generation_feedback"; message: string }
  | { type: "error"; message: string };

export async function* runPipeline(
  prdText: string,
  options?: {
    tailwindTarget?: "v4" | "v3";
  },
): AsyncGenerator<PipelineEvent> {
  const now = () => new Date().toISOString();

  const state: PipelineState = {
    jobId: crypto.randomUUID(),
    createdAt: now(),
    updatedAt: now(),
    status: "running",
    currentAgent: null,
    prdText,
    tailwindTarget: options?.tailwindTarget ?? "v4",
    attempt: 0,
    maxAttempts: 3,
    revisionFeedback: "",
    lastIssues: [],
    lastTsx: "",
    analyst: null,
    architect: null,
    theme: null,
    qa: null,
  };

  const persist = async () => {
    state.updatedAt = now();
    await writePipelineState(state);
  };

  try {
    await persist();

    yield { type: "agent_start", agent: "prd_analyst" };
    state.currentAgent = "prd_analyst";
    await persist();
    const analyst = await runAnalyst(prdText);
    state.analyst = analyst;
    yield {
      type: "agent_complete",
      agent: "prd_analyst",
      payload: analyst,
    };
    await persist();

    yield { type: "agent_start", agent: "ux_planner" };
    state.currentAgent = "ux_planner";
    await persist();
    const architect = await runArchitect(prdText, analyst);
    state.architect = architect;
    yield {
      type: "agent_complete",
      agent: "ux_planner",
      payload: architect,
    };
    await persist();

    yield { type: "agent_start", agent: "design_agent" };
    state.currentAgent = "design_agent";
    await persist();
    const theme = await runThemeStylist({
      prdText,
      analyst,
      architect,
      tailwindTarget: state.tailwindTarget,
    });
    state.theme = theme;
    yield {
      type: "agent_complete",
      agent: "design_agent",
      payload: theme,
    };
    await persist();

    for (let attempt = 1; attempt <= state.maxAttempts; attempt += 1) {
      state.attempt = attempt;
      yield { type: "generation_attempt", attempt, maxAttempts: state.maxAttempts };
      await persist();

      yield { type: "agent_start", agent: "ui_generator" };
      state.currentAgent = "ui_generator";
      await persist();
      const tsx = await runImplementer(prdText, analyst, architect, theme, {
        tailwindTarget: state.tailwindTarget,
        revisionFeedback:
          state.revisionFeedback ||
          "Initial generation pass. Produce the best complete version.",
      });
      yield { type: "agent_complete", agent: "ui_generator" };
      state.lastTsx = tsx;
      await persist();

      const staticCheck = validateGeneratedTsx(tsx);
      if (!staticCheck.pass) {
        state.lastIssues = staticCheck.issues;
        state.revisionFeedback = `Revise the component and fix all issues:\n- ${staticCheck.issues.join("\n- ")}`;
        await persist();
        if (attempt < state.maxAttempts) {
          yield {
            type: "generation_feedback",
            message:
              "Retrying after structural/style checks: " +
              staticCheck.issues.join(" | "),
          };
          continue;
        }
      }

      yield { type: "agent_start", agent: "qa_agent" };
      state.currentAgent = "qa_agent";
      await persist();
      const qa = await runCritic({
        prdText,
        analyst,
        architect,
        theme,
        tsx,
        tailwindTarget: state.tailwindTarget,
      });
      state.qa = qa;
      yield { type: "agent_complete", agent: "qa_agent", payload: qa };
      await persist();

      if (qa.decision === "approve") {
        state.status = "completed";
        state.currentAgent = null;
        await persist();
        yield { type: "result", tsx, analyst, architect, theme };
        return;
      }

      if (qa.decision === "reject") {
        throw new Error(
          `QA rejected output: ${qa.summary || qa.issues.join(" | ")}`,
        );
      }

      state.lastIssues = qa.issues;
      state.revisionFeedback = [
        qa.summary,
        "Fixes to apply:",
        ...qa.fixes.map((fix) => `- ${fix}`),
      ].join("\n");
      await persist();

      if (qa.routeTo === "ux_planner") {
        yield {
          type: "generation_feedback",
          message:
            "QA requested layout refinement. Re-planning UX structure before regenerating UI.",
        };
        yield { type: "agent_start", agent: "ux_planner" };
        state.currentAgent = "ux_planner";
        await persist();
        const replannedArchitect = await runArchitect(prdText, analyst);
        state.architect = replannedArchitect;
        yield {
          type: "agent_complete",
          agent: "ux_planner",
          payload: replannedArchitect,
        };

        yield { type: "agent_start", agent: "design_agent" };
        state.currentAgent = "design_agent";
        await persist();
        const redesignedTheme = await runThemeStylist({
          prdText,
          analyst,
          architect: replannedArchitect,
          tailwindTarget: state.tailwindTarget,
        });
        state.theme = redesignedTheme;
        yield {
          type: "agent_complete",
          agent: "design_agent",
          payload: redesignedTheme,
        };
        await persist();
      }

      if (attempt < state.maxAttempts) {
        yield {
          type: "generation_feedback",
          message:
            `QA requested refinement (${qa.severity}). ` + qa.issues.join(" | "),
        };
      }
    }

    state.status = "completed";
    state.currentAgent = null;
    await persist();
    yield {
      type: "result",
      tsx: state.lastTsx,
      analyst: {
        ...analyst,
        constraints: [...analyst.constraints, ...state.lastIssues],
      },
      architect: state.architect ?? architect,
      theme: state.theme ?? theme,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unknown error during generation.";
    state.status = "failed";
    state.currentAgent = null;
    state.lastIssues = [message];
    await persist();
    yield { type: "error", message };
  }
}
