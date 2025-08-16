// src/pages/robots.txt.ts
import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const headers = req.headers || {};
  const host = (headers["x-forwarded-host"] as string) || headers.host || "";
  const forwardedProto = (headers["x-forwarded-proto"] as string) || "";
  const isTls = typeof (req.socket as unknown as { encrypted?: boolean }).encrypted === 'boolean' ? (req.socket as unknown as { encrypted?: boolean }).encrypted : false;
  const proto = forwardedProto || (isTls ? "https" : "http");
  const origin = host ? `${proto}://${host}` : "";
  const body = [
    "User-agent: *",
    "Allow: /",
    origin ? `Sitemap: ${origin}/sitemap.xml` : undefined,
  ].filter(Boolean).join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.write(body);
  res.end();
  return { props: {} };
};

export default function RobotsTxt() { return null; }
