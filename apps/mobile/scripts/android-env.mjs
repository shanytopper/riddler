// The Android toolchain locations on this machine and an environment for child processes.
// Nothing is persisted in the user's environment; an existing variable always wins.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const windows = process.platform === "win32";
const local = process.env.LOCALAPPDATA ?? join(process.env.HOME ?? "", "AppData", "Local");

export const javaHome = process.env.JAVA_HOME ?? join(local, "Programs", "jdk-17");
export const androidHome =
  process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(local, "Android", "Sdk");

const exe = (name) => (windows ? `${name}.exe` : name);
const bat = (name) => (windows ? `${name}.bat` : name);

export const tools = {
  adb: join(androidHome, "platform-tools", exe("adb")),
  emulator: join(androidHome, "emulator", exe("emulator")),
  avdmanager: join(androidHome, "cmdline-tools", "latest", "bin", bat("avdmanager")),
  sdkmanager: join(androidHome, "cmdline-tools", "latest", "bin", bat("sdkmanager")),
};

export function requireToolchain() {
  for (const [name, dir] of [
    ["JDK", javaHome],
    ["Android SDK", androidHome],
  ]) {
    if (!existsSync(dir)) {
      console.error(`${name} not found at ${dir}; see docs/spike-offline-map.md.`);
      process.exit(2);
    }
  }
}

export const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  PATH: [
    join(javaHome, "bin"),
    join(androidHome, "platform-tools"),
    join(androidHome, "emulator"),
    join(androidHome, "cmdline-tools", "latest", "bin"),
    process.env.PATH ?? "",
  ].join(delimiter),
};

const quote = (arg) => (/[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg);

/**
 * Runs a tool synchronously. Executables are spawned directly; .bat/.cmd launchers need a shell,
 * which gets one pre-joined command line (Node warns about argument arrays combined with a shell).
 */
export function runTool(file, args, options = {}) {
  const needsShell = /\.(bat|cmd)$/i.test(file) || options.shell === true;
  const { shell: _ignored, ...rest } = options;
  return needsShell
    ? spawnSync([file, ...args].map(quote).join(" "), { env, shell: true, ...rest })
    : spawnSync(file, args, { env, ...rest });
}
