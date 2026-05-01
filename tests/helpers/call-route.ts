type RouteHandler<P extends Record<string, string> = Record<string, string>> = (
  request: Request,
  context: { params: Promise<P> }
) => Promise<Response> | Response;

type CallOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  url?: string;
};

export async function callRoute<P extends Record<string, string>>(
  handler: RouteHandler<P>,
  options: CallOptions = {},
  params: P = {} as P
): Promise<Response> {
  const method = options.method ?? "GET";

  const init: RequestInit = { method };

  if (options.formData) {
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
  }

  const request = new Request(options.url ?? "http://localhost:3000/test", init);

  // Next.js 15+ passes params as Promise<Params>
  return handler(request, { params: Promise.resolve(params) });
}

export async function callRouteJSON<T = unknown, P extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<P>,
  options: CallOptions = {},
  params: P = {} as P
): Promise<{ status: number; data: T }> {
  const response = await callRoute(handler, options, params);
  const data = (await response.json()) as T;
  return { status: response.status, data };
}
