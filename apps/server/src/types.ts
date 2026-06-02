/** Hono context variables shared across middleware and handlers. */
export type AppEnv = {
  Variables: {
    reqId: string;
  };
};
