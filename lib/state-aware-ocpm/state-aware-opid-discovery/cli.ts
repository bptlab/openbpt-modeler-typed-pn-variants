/**
 * Command-line runner (Node), from the repository root:
 *
 *   npx ts-node state-aware-opid-discovery/cli.ts <log.ocel.xml> [--out=<file>]
 *
 * or `npm run discover-opid -- <log.ocel.xml> [--out=<file>]` (in PowerShell, quote the
 * separator: `'--'`).
 *
 * Options:
 *   --out=<file>  where to write the OPID (default: <log name>.opid.xml in the current
 *                 directory)
 */
import { readFileSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import { discoverOpid, DiscoveryInputError } from "./index";
import { formatDiscoverySummary } from "./output/formatSummary";

const USAGE =
  "Usage: npx ts-node state-aware-opid-discovery/cli.ts <log.ocel.xml> [--out=<file>]";

interface CliArguments {
  file: string;
  out?: string;
}

function parseArguments(args: readonly string[]): CliArguments {
  const positional: string[] = [];
  let out: string | undefined;
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
    } else if (arg.startsWith("--out=") && arg.length > "--out=".length) {
      out = arg.slice("--out=".length);
    } else {
      throw new DiscoveryInputError(`Unknown option "${arg}".\n${USAGE}`);
    }
  }
  const [file, ...extra] = positional;
  if (!file) {
    throw new DiscoveryInputError(`The log file is required.\n${USAGE}`);
  }
  if (extra.length > 0) {
    throw new DiscoveryInputError(
      `Unexpected argument "${extra[0]}".\n${USAGE}`,
    );
  }
  return { file, out };
}

/** `Simple_link.ocel.xml` → `Simple_link.opid.xml` */
function defaultOutputName(file: string): string {
  const name = basename(file)
    .replace(/\.ocel\.xml$/i, "")
    .replace(/\.xml$/i, "");
  return `${name}.opid.xml`;
}

async function main(args: readonly string[]): Promise<void> {
  const { file, out } = parseArguments(args);

  let ocelXml: string;
  try {
    ocelXml = readFileSync(file, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DiscoveryInputError(`Cannot read "${file}": ${reason}`);
  }

  const { net, xml, warnings } = await discoverOpid(ocelXml);
  console.log(formatDiscoverySummary(net));
  for (const warning of warnings) {
    console.log(`Warning: ${warning}`);
  }

  const outFile = resolve(out ?? defaultOutputName(file));
  try {
    writeFileSync(outFile, xml, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DiscoveryInputError(`Cannot write "${outFile}": ${reason}`);
  }
  console.log(`OPID written to ${outFile}.`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  // Input errors are explained to the user; anything else is a bug, so show the stack.
  console.error(
    error instanceof DiscoveryInputError ? `Error: ${error.message}` : error,
  );
  process.exitCode = 1;
});
