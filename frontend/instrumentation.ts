export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DEMO_ENABLED === "0") return;

  const { tick } = await import("./lib/demo/loop");
  const run = async () => {
    try {
      await tick();
    } catch (e) {
      console.error("[demo-loop] tick failed:", (e as Error).message);
    }
  };

  console.log("[demo-loop] starting (60s tick, DEMO_ENABLED!=0)");
  setTimeout(run, 8_000); // first pass shortly after boot
  setInterval(run, 60_000);
}
