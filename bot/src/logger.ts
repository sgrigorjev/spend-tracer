import process from "node:process";
import { pino, destination } from "pino";
import { config } from "./config.ts";

/** True when a module specifier can be resolved from this file. */
function isResolvable(specifier: string): boolean {
  try {
    import.meta.resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

const options = {
  level: config.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: "spend-tracer" },
};

// pino-pretty is a devDependency, so a production install (npm ci --omit=dev)
// does not have it. Fall back to JSON logs instead of crashing when LOG_PRETTY
// is set in an environment without the package.
const pretty = !config.logFile && config.logPretty && isResolvable("pino-pretty");
if (!config.logFile && config.logPretty && !pretty) {
  process.emitWarning("LOG_PRETTY=true but pino-pretty is not installed; using JSON logs");
}

/**
 * Process-wide logger. Writes structured JSON lines to stdout by default, so
 * logs are captured by whatever supervises the process (systemd journal,
 * Docker, PM2). Set LOG_FILE to write to a file instead, or LOG_PRETTY=true
 * for readable output during local development.
 */
export const logger = config.logFile
  ? pino(options, destination({ dest: config.logFile, mkdir: true }))
  : pretty
    ? pino({ ...options, transport: { target: "pino-pretty" } })
    : pino(options);
