// `npm run expo:local`: starts Expo against the backend running on THIS computer
// (the `papers` app, `npm run dev`). Only the Expo process started here is
// affected: nothing is written to disk, to .env files, or to the global
// environment. Plain `npx expo start` always uses the live Vercel server.
//
//   npm run expo:local                 -> expo start
//   npm run expo:local -- --android    -> extra arguments go to Expo
//
// Optional overrides (set in the shell that runs this command):
//   TUITIONAPP_LOCAL_PORT=3001         backend port (default 3000)
//   TUITIONAPP_LAN_IP=192.168.1.20     computer's address, if it has several networks
//   TUITIONAPP_LOCAL_TARGET=emulator   force the Android emulator URL (or `device`)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";
import net from "node:net";

const port = Number(process.env.TUITIONAPP_LOCAL_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`TUITIONAPP_LOCAL_PORT must be a port number, got "${process.env.TUITIONAPP_LOCAL_PORT}".`);
  process.exit(1);
}
const target = process.env.TUITIONAPP_LOCAL_TARGET;
if (target && target !== "emulator" && target !== "device") {
  console.error('TUITIONAPP_LOCAL_TARGET must be "emulator" or "device".');
  process.exit(1);
}

const VIRTUAL = /vethernet|virtualbox|vmware|vmnet|wsl|docker|hyper-v|loopback|tailscale|zerotier|vpn|bluetooth|tap/i;
const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

/** This computer's usable LAN IPv4 address: private range, real adapter first. */
function lanIp() {
  if (process.env.TUITIONAPP_LAN_IP) return process.env.TUITIONAPP_LAN_IP;
  const found = Object.entries(networkInterfaces()).flatMap(([name, nets]) =>
    (nets ?? [])
      .filter((n) => n.family === "IPv4" && !n.internal && !n.address.startsWith("169.254."))
      .map((n) => ({ name, ip: n.address })),
  );
  const rank = (c) => (VIRTUAL.test(c.name) ? 2 : 0) + (isPrivate(c.ip) ? 0 : 1);
  found.sort((a, b) => rank(a) - rank(b));
  return found[0]?.ip;
}

const ip = lanIp();
const urls = {
  emulator: `http://10.0.2.2:${port}`,
  device: ip ? `http://${ip}:${port}` : undefined,
  loopback: `http://localhost:${port}`,
};

console.log("TUITIONAPP BACKEND: LOCAL");
console.log(`  Android emulator:       ${urls.emulator}`);
console.log(`  Physical Android phone: ${urls.device ?? "no LAN address found, set TUITIONAPP_LAN_IP"}`);
console.log(`  iOS simulator / web:    ${urls.loopback}`);
if (target) console.log(`  Forced target:          ${target}`);

// Warn (don't block) when the backend isn't up yet.
const probe = net.connect({ port, host: "127.0.0.1" });
probe.setTimeout(1000);
probe.on("connect", () => probe.destroy());
const warn = () => {
  probe.destroy();
  console.warn(`  Warning: nothing is listening on port ${port}. Start the backend: cd ../papers && npm run dev`);
};
probe.on("error", warn);
probe.on("timeout", warn);

const expoCli = createRequire(import.meta.url).resolve("expo/bin/cli");
const args = process.argv.slice(2);
const child = spawn(process.execPath, [expoCli, ...(args[0] && !args[0].startsWith("-") ? [] : ["start"]), ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    TUITIONAPP_BACKEND: "local",
    TUITIONAPP_LOCAL_EMULATOR_URL: urls.emulator,
    TUITIONAPP_LOCAL_DEVICE_URL: urls.device ?? "",
    TUITIONAPP_LOCAL_LOOPBACK_URL: urls.loopback,
    TUITIONAPP_LOCAL_TARGET: target ?? "",
  },
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
