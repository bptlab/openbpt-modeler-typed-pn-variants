/**
 * Command-line runner (Node):
 *
 *   npm run generate-log -- <net.xml> <MAX_OBJECTS> [seed] [options]
 *
 * npm runs it from the repository root, so relative paths are resolved from there.
 *
 * Options:
 *   --max-per-type=Order:3,Item:10  maximum number of created objects per object type
 *                                   (data class name or id)
 *   --out=<file>                    where to write the OCEL 2.0 log
 *                                   (default: <net name>.ocel.xml in the current directory)
 *   --no-log                        only simulate, do not create a log
 *   --mode=default                  log mode: "default" or "state-aware"
 *   --log-silent                    state-aware mode: also log silent firings
 *   --start-time=<ISO 8601>         time of the first firing (default 2025-01-01T00:00:00Z)
 *   --time-step=<seconds>           time between consecutive firings (default 60)
 *   --tokens                        also print the consumed and produced tokens
 */
import { readFileSync, writeFileSync } from "fs";
import { basename, extname, resolve } from "path";
import { EventLogInputError } from "./errors";
import { generateEventLog, type GenerateEventLogOptions } from "./index";
import type { OcelModeName } from "./ocel/modes";
import type { ObjectTypeLimits } from "./types/limits";

const USAGE = [
  "Usage: npm run generate-log -- <net.xml> <MAX_OBJECTS> [seed] [options]",
  "Options: --max-per-type=Order:3,Item:10  --out=<file>  --no-log  --mode=default|state-aware",
  "         --log-silent  --start-time=<ISO 8601>  --time-step=<seconds>  --tokens",
].join("\n");

interface CliArguments {
  file: string;
  maxObjects: number;
  out?: string;
  options: GenerateEventLogOptions;
}

function parseArguments(args: readonly string[]): CliArguments {
  const positional: string[] = [];
  const options: GenerateEventLogOptions = {};
  let out: string | undefined;

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const separator = arg.indexOf("=");
    const name = separator === -1 ? arg : arg.slice(0, separator);
    const value = separator === -1 ? undefined : arg.slice(separator + 1);
    const requireValue = (): string => {
      if (value === undefined || value === "") {
        throw new EventLogInputError(`Option ${name} needs a value.\n${USAGE}`);
      }
      return value;
    };
    const requireNoValue = (): void => {
      if (value !== undefined) {
        throw new EventLogInputError(`Option ${name} takes no value.`);
      }
    };

    switch (name) {
      case "--max-per-type":
        options.maxObjectsPerType = parseObjectTypeLimits(
          requireValue(),
          options.maxObjectsPerType,
        );
        break;
      case "--out":
        out = requireValue();
        break;
      case "--no-log":
        requireNoValue();
        options.generateLog = false;
        break;
      case "--mode":
        // Checked against the available modes by the log generation
        options.mode = requireValue() as OcelModeName;
        break;
      case "--log-silent":
        requireNoValue();
        options.logSilentTransitions = true;
        break;
      case "--start-time":
        options.startTime = requireValue();
        break;
      case "--time-step":
        options.timeStepSeconds = parseNumber(requireValue(), "the time step");
        break;
      case "--tokens":
        requireNoValue();
        options.showTokens = true;
        break;
      default:
        throw new EventLogInputError(`Unknown option "${arg}".\n${USAGE}`);
    }
  }

  if (out !== undefined && options.generateLog === false) {
    throw new EventLogInputError("--out cannot be combined with --no-log.");
  }

  const [file, maxObjectsArg, seedArg, ...extra] = positional;
  if (!file || maxObjectsArg === undefined) {
    throw new EventLogInputError(
      `The net file and MAX_OBJECTS are required.\n${USAGE}`,
    );
  }
  if (extra.length > 0) {
    throw new EventLogInputError(
      `Unexpected argument "${extra[0]}".\n${USAGE}`,
    );
  }
  if (seedArg !== undefined) {
    options.seed = parseNumber(seedArg, "the seed");
  }

  return {
    file,
    maxObjects: parseNumber(maxObjectsArg, "MAX_OBJECTS"),
    out,
    options,
  };
}

/**
 * Parses `Order:3,Item:10`. The count follows the last colon, so type names may contain colons.
 * Whether the counts are valid (non-negative integers) is checked by the simulation.
 */
function parseObjectTypeLimits(
  text: string,
  limits: ObjectTypeLimits = {},
): ObjectTypeLimits {
  for (const entry of text.split(",")) {
    const separator = entry.lastIndexOf(":");
    const type = entry.slice(0, separator).trim();
    const count = entry.slice(separator + 1).trim();
    if (separator === -1 || type === "" || count === "") {
      throw new EventLogInputError(
        `Invalid --max-per-type entry "${entry}", expected <type>:<count>, e.g. Order:3.`,
      );
    }
    if (Object.prototype.hasOwnProperty.call(limits, type)) {
      throw new EventLogInputError(
        `Object type "${type}" is listed twice in --max-per-type.`,
      );
    }
    limits[type] = parseNumber(count, `the maximum for object type "${type}"`);
  }
  return limits;
}

function parseNumber(text: string, what: string): number {
  const value = Number(text);
  if (text.trim() === "" || Number.isNaN(value)) {
    throw new EventLogInputError(
      `Expected a number for ${what}, got "${text}".`,
    );
  }
  return value;
}

async function main(args: readonly string[]): Promise<void> {
  const { file, maxObjects, out, options } = parseArguments(args);

  let xml: string;
  try {
    xml = readFileSync(file, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new EventLogInputError(`Cannot read "${file}": ${reason}`);
  }

  const { log, ocelXml } = await generateEventLog(xml, maxObjects, options);
  if (!log || ocelXml === undefined) return;

  const outFile = resolve(out ?? `${basename(file, extname(file))}.ocel.xml`);
  try {
    writeFileSync(outFile, ocelXml, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new EventLogInputError(`Cannot write "${outFile}": ${reason}`);
  }
  console.log(
    `OCEL 2.0 log written to ${outFile} (${log.events.length} events, ${log.objects.length} objects).`,
  );
}

main(process.argv.slice(2)).catch((error: unknown) => {
  // Input errors are explained to the user; anything else is a bug, so show the stack.
  console.error(
    error instanceof EventLogInputError ? `Error: ${error.message}` : error,
  );
  process.exitCode = 1;
});
