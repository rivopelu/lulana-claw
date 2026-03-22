import { createLogger, format, transports } from "winston";
import pc from "picocolors";

const { combine, timestamp, printf, errors } = format;

const levelColors: Record<string, (str: string) => string> = {
  info: (s: string) => pc.bgGreen(pc.black(` ${s.toUpperCase()} `)),
  error: (s: string) => pc.bgRed(pc.white(` ${s.toUpperCase()} `)),
  warn: (s: string) => pc.bgYellow(pc.black(` ${s.toUpperCase()} `)),
  debug: (s: string) => pc.bgBlue(pc.white(` ${s.toUpperCase()} `)),
};

const logFormat = printf(({ level, message, timestamp, stack }) => {
  const colorizer = levelColors[level] || ((s: string) => s);
  const coloredLevel = colorizer(level);
  const infoMessage = stack || message;
  return `${pc.gray(String(timestamp))} ${coloredLevel} ${pc.white(String(infoMessage))}`;
});

export const logger = createLogger({
  level: "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    logFormat,
  ),
  transports: [new transports.Console()],
});

export default logger;
