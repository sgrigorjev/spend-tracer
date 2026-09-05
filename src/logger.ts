import { pino, destination } from "pino";
import { config } from "./config.ts";

/**
 * Process-wide logger. Writes structured JSON lines to stdout by default, so
 * logs are captured by whatever supervises the process (systemd journal,
 * Docker, PM2). Set LOG_FILE to write to a file instead, or LOG_PRETTY=true
 * for readable output during local development.
 */
const options = {
  level: config.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: "spend-tracer" },
};

export const logger = config.logFile
  ? pino(options, destination({ dest: config.logFile, mkdir: true }))
  : config.logPretty
    ? pino({ ...options, transport: { target: "pino-pretty" } })
    : pino(options);
