const service = require("../lib/freebies");
function makeHandler(deps = {}) {
  return async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const reply = (status, message) => {
      res.statusCode = status;
      res.end(JSON.stringify({ message }));
    };
    const env = deps.env || process.env;
    try {
      if (req.method === "GET") {
        if (
          !env.CRON_SECRET ||
          req.headers.authorization !== `Bearer ${env.CRON_SECRET}`
        )
          return reply(401, "Unauthorized");
        await (deps.followups || service.followups)(env);
        return reply(200, "Follow-ups processed.");
      }
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return reply(405, "Method not allowed");
      }
      if (req.headers.origin !== service.settings(env).origin)
        return reply(403, "Please use the signup form on our website.");
      let body = req.body;
      if (!body) {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 4096)
            return reply(413, "Request too large");
        }
        body = JSON.parse(raw);
      }
      if (typeof body === "string") body = JSON.parse(body);
      if (
        !body ||
        typeof body !== "object" ||
        JSON.stringify(body).length > 4096
      )
        return reply(400, "Invalid request");
      if (body.action === "confirm") {
        await (deps.confirm || service.confirm)(body.token, env);
        return reply(200, "Your worksheet is on its way. Check your inbox!");
      }
      if (body.action === "unsubscribe") {
        await (deps.unsubscribe || service.unsubscribe)(body.token, env);
        return reply(200, "You’re unsubscribed from freebie follow-ups.");
      }
      const ip = env.VERCEL
        ? String(req.headers["x-vercel-forwarded-for"] || "unknown").split(
            ",",
          )[0]
        : req.socket?.remoteAddress || "local";
      await (deps.subscribe || service.subscribe)(body, ip, env);
      return reply(200, "Check your inbox to confirm your email.");
    } catch (e) {
      if (e.status === 429) res.setHeader("Retry-After", "3600");
      return reply(
        e instanceof SyntaxError ? 400 : e.status || 503,
        e.status
          ? e.message
          : "Signup is temporarily unavailable. Please try again shortly.",
      );
    }
  };
}
module.exports = makeHandler();
module.exports.makeHandler = makeHandler;
module.exports.config = { api: { bodyParser: false }, maxDuration: 60 };
