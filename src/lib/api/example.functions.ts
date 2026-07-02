import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getGreeting = createServerFn({ method: "POST" })
  .validator((data: { name: string }) => z.object({ name: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { getServerConfig } = await import("../config.server");
    const config = getServerConfig();
    return {
      greeting: `Hello, ${data.name}!`,
      mode: config.nodeEnv ?? "unknown",
    };
  });
