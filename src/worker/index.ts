import type { Env } from "./env";
import { handleRequest } from "./routes";

export default {
  fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    return handleRequest({ request, env, url: new URL(request.url) });
  }
} satisfies ExportedHandler<Env>;
