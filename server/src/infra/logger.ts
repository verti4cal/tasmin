/** Minimal logging contract so infra modules don't depend on Fastify's logger type. */
export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}
