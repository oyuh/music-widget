// src/pages/robots.txt.ts
import type { GetServerSideProps } from "next";
import { getRequestId, logInfo } from "@/utils/serverLog";

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const requestId = getRequestId({ headers: req.headers });
  const t0 = Date.now();
  const headers = req.headers || {};
  const host = (headers["x-forwarded-host"] as string) || headers.host || "";
  const forwardedProto = (headers["x-forwarded-proto"] as string) || "";
  const isTls = typeof (req.socket as unknown as { encrypted?: boolean }).encrypted === 'boolean' ? (req.socket as unknown as { encrypted?: boolean }).encrypted : false;
  const proto = forwardedProto || (isTls ? "https" : "http");
  const origin = host ? `${proto}://${host}` : "";

  logInfo("page.robots.start", {
    requestId,
    path: req.url || "",
    host: String(host),
    proto: String(proto),
  });
  const body = [
    "User-agent: *",
    "Allow: /",
    origin ? `Sitemap: ${origin}/sitemap.xml` : undefined,
  ].filter(Boolean).join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.write(body);
  res.end();

  logInfo("page.robots.end", {
    requestId,
    status: 200,
    durationMs: Date.now() - t0,
    hasSitemapLine: Boolean(origin),
  });
  return { props: {} };
};

export default function RobotsTxt() { return null; }
