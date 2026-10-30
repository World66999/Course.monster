import http from "node:http";
import https from "node:https";

/**
 * HTTP transport for the Bot API with persistent connections.
 *
 * From this server a Telegram round trip is ~0.2 s, but a NEW connection adds
 * the TCP + TLS handshake on top (~0.6 s per call in total). `fetch` drops an
 * idle connection after ~4 s because api.telegram.org sends no Keep-Alive
 * timeout hint, and with this bot's sparse traffic that meant nearly every tap
 * paid for a fresh handshake. These agents keep sockets open (Telegram holds
 * idle connections for minutes) and use IPv4, whose route from here is
 * consistently faster than IPv6.
 */

const agentOptions = { keepAlive: true, keepAliveMsecs: 30_000, maxSockets: 32, maxFreeSockets: 8, family: 4 } as const;

/**
 * One pool per process. Next.js bundles instrumentation.ts and the route
 * handlers separately, so each would otherwise get its own copy of this module
 * and the boot-time warm-up would warm a pool no request ever uses.
 */
const pools = ((globalThis as { __telegramPools?: { http: http.Agent; https: https.Agent } }).__telegramPools ??= {
  http: new http.Agent(agentOptions),
  https: new https.Agent(agentOptions),
});
const httpsAgent = pools.https;
const httpAgent = pools.http;

export interface RawResponse {
  status: number;
  body: string;
}

export class TransportError extends Error {
  constructor(
    message: string,
    readonly timedOut: boolean
  ) {
    super(message);
    this.name = "TransportError";
  }
}

function once(url: URL, json: string, timeoutMs: number): Promise<{ res: RawResponse; reused: boolean }> {
  const mod = url.protocol === "http:" ? http : https;
  const agent = url.protocol === "http:" ? httpAgent : httpsAgent;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      url,
      {
        method: "POST",
        agent,
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(json) },
        signal: AbortSignal.timeout(timeoutMs),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ res: { status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }, reused: req.reusedSocket }));
        res.on("error", (err) => reject(Object.assign(err, { reused: req.reusedSocket })));
      }
    );
    req.on("error", (err) => reject(Object.assign(err, { reused: req.reusedSocket })));
    req.end(json);
  });
}

/**
 * POSTs JSON and returns the raw status and body. A request that fails on a
 * REUSED socket before any response arrived is retried once on a fresh one:
 * that is the server having closed an idle connection, so the request was
 * never processed and repeating it cannot duplicate a message.
 */
export async function postJson(url: string, payload: unknown, timeoutMs: number): Promise<RawResponse> {
  const target = new URL(url);
  const json = JSON.stringify(payload);
  for (let attempt = 0; ; attempt++) {
    try {
      return (await once(target, json, timeoutMs)).res;
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { reused?: boolean };
      const staleSocket = e.reused === true && (e.code === "ECONNRESET" || e.code === "EPIPE");
      if (staleSocket && attempt === 0) continue;
      const timedOut = e.name === "AbortError" || e.name === "TimeoutError";
      throw new TransportError(timedOut ? "timeout" : (e.code ?? e.message ?? "network error"), timedOut);
    }
  }
}
