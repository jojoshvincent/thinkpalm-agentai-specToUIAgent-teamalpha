import type {
  AnalystOutput,
  ArchitectOutput,
  ThemeOutput,
} from "./schemas";
import { runAnalyst } from "./runAnalyst";
import { runArchitect } from "./runArchitect";
import { runImplementer } from "./runImplementer";
import { runCritic } from "./runCritic";
import { validateGeneratedTsx } from "./validateGeneratedTsx";
import { runThemeStylist } from "./runThemeStylist";
import { runRuntimeValidator } from "./runRuntimeValidator";

export type AgentId =
  | "requirements_analyst"
  | "ui_architect"
  | "theme_stylist"
  | "tailwind_implementer"
  | "runtime_validator"
  | "ui_critic";

export type PipelineEvent =
  | { type: "agent_start"; agent: AgentId }
  | {
      type: "agent_complete";
      agent: "requirements_analyst";
      payload: AnalystOutput;
    }
  | {
      type: "agent_complete";
      agent: "ui_architect";
      payload: ArchitectOutput;
    }
  | {
      type: "agent_complete";
      agent: "theme_stylist";
      payload: ThemeOutput;
    }
  | {
      type: "agent_complete";
      agent: "tailwind_implementer" | "runtime_validator" | "ui_critic";
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
  try {
    const tailwindTarget = options?.tailwindTarget ?? "v4";
    const maxAttempts = 3;

    yield { type: "agent_start", agent: "requirements_analyst" };
    const analyst = await runAnalyst(prdText);
    yield {
      type: "agent_complete",
      agent: "requirements_analyst",
      payload: analyst,
    };

    yield { type: "agent_start", agent: "ui_architect" };
    const architect = await runArchitect(prdText, analyst);
    yield {
      type: "agent_complete",
      agent: "ui_architect",
      payload: architect,
    };

    yield { type: "agent_start", agent: "theme_stylist" };
    const theme = await runThemeStylist({
      prdText,
      analyst,
      architect,
      tailwindTarget,
    });
    yield {
      type: "agent_complete",
      agent: "theme_stylist",
      payload: theme,
    };

    let lastTsx = "";
    let revisionFeedback = "";
    let lastIssues: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      yield { type: "generation_attempt", attempt, maxAttempts };
      yield { type: "agent_start", agent: "tailwind_implementer" };
      const tsx = await runImplementer(prdText, analyst, architect, theme, {
        tailwindTarget,
        revisionFeedback,
      });
      yield { type: "agent_complete", agent: "tailwind_implementer" };
      lastTsx = tsx;

      const staticCheck = validateGeneratedTsx(tsx);
      if (!staticCheck.pass) {
        lastIssues = staticCheck.issues;
        revisionFeedback = `Revise the component. Fix all issues:\n- ${staticCheck.issues.join("\n- ")}`;
        if (attempt < maxAttempts) {
          yield {
            type: "generation_feedback",
            message:
              "Retrying after structural/style checks: " +
              staticCheck.issues.join(" | "),
          };
          continue;
        }
      }

      yield { type: "agent_start", agent: "runtime_validator" };
      const runtimeValidation = await runRuntimeValidator({
        tsx,
        tailwindTarget,
      });
      yield { type: "agent_complete", agent: "runtime_validator" };
      if (!runtimeValidation.pass) {
        lastIssues = runtimeValidation.likelyRuntimeErrors;
        revisionFeedback = runtimeValidation.repairPrompt;
        if (attempt < maxAttempts) {
          yield {
            type: "generation_feedback",
            message:
              "Retrying after runtime validation: " +
              runtimeValidation.likelyRuntimeErrors.join(" | "),
          };
          continue;
        }
      }

      yield { type: "agent_start", agent: "ui_critic" };
      const critic = await runCritic({
        prdText,
        analyst,
        architect,
        theme,
        tsx,
        tailwindTarget,
      });
      yield { type: "agent_complete", agent: "ui_critic" };

      if (critic.pass) {
        yield { type: "result", tsx, analyst, architect, theme };
        return;
      }

      lastIssues = critic.issues;
      revisionFeedback = critic.revisionPrompt;
      if (attempt < maxAttempts) {
        yield {
          type: "generation_feedback",
          message:
            `Retrying after critic score ${critic.score}/100. ` +
            critic.issues.join(" | "),
        };
      }
    }

    yield {
      type: "result",
      tsx: lastTsx,
      analyst: {
        ...analyst,
        constraints: [...analyst.constraints, ...lastIssues],
      },
      architect,
      theme,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unknown error during generation.";
    yield { type: "error", message };
  }
}
