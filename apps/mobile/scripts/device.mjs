// Repeatable actions against the Android emulator or a connected phone, for the spike and the field test.
//
//   node scripts/device.mjs devices
//   node scripts/device.mjs avd-create                  one-time: an API 36 Pixel-class AVD named "riddles"
//   node scripts/device.mjs emulator [--window]         start it headless (or with a window), detached
//   node scripts/device.mjs wait-boot                   block until Android has finished booting
//   node scripts/device.mjs screenshot out.png
//   node scripts/device.mjs geo <lat> <lng>             emulator only: set the GPS fix
//   node scripts/device.mjs airplane on|off
//   node scripts/device.mjs open dev/map                open riddles://dev/map in the app
//   node scripts/device.mjs install <apk>
//   node scripts/device.mjs logcat [filter]             recent app log lines
import { spawn, spawnSync } from "node:child_process";
import { openSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { env, requireToolchain, runTool, tools } from "./android-env.mjs";

const AVD_NAME = "riddles";
const SYSTEM_IMAGE = "system-images;android-36;google_apis;x86_64";
const APP_ID = "app.riddles.mobile";
const SCHEME = "riddles";

requireToolchain();
const [command, ...args] = process.argv.slice(2);

const run = (file, cmdArgs, options = {}) => {
  const result = runTool(file, cmdArgs, { stdio: "inherit", ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
};
const adb = (...cmdArgs) => run(tools.adb, cmdArgs);
const adbOut = (...cmdArgs) => runTool(tools.adb, cmdArgs, { encoding: "utf8" }).stdout ?? "";
const sleep = (ms) => runTool(process.execPath, ["-e", `setTimeout(() => {}, ${ms})`]);

switch (command) {
  case "devices":
    adb("devices", "-l");
    break;

  case "avd-create":
    // stdin answers the "create a custom hardware profile?" prompt.
    run(
      tools.avdmanager,
      ["create", "avd", "-n", AVD_NAME, "-k", SYSTEM_IMAGE, "-d", "pixel_7", "--force"],
      {
        input: "no\n",
        stdio: ["pipe", "inherit", "inherit"],
      },
    );
    break;

  case "emulator": {
    const headless = !args.includes("--window");
    // --gpu host uses the machine's GPU (also headless); swiftshader_indirect is pure software and
    // does not render MapLibre's text.
    const gpuIndex = args.indexOf("--gpu");
    const gpu = gpuIndex >= 0 ? (args[gpuIndex + 1] ?? "host") : "host";
    const flags = [
      "-avd",
      AVD_NAME,
      "-no-audio",
      "-no-boot-anim",
      "-no-snapshot",
      "-gpu",
      gpu,
      ...(headless ? ["-no-window"] : []),
    ];
    const log = openSync("emulator.log", "a");
    // On Windows the emulator launcher starts QEMU as its own console process, which would open a
    // terminal window; Start-Process -WindowStyle Hidden gives it a hidden console to inherit.
    if (process.platform === "win32") {
      // PowerShell runs synchronously so a launch error is visible; Start-Process returns as soon
      // as the emulator process exists, and that process outlives this script. (A detached,
      // output-less PowerShell was killed before it got that far.)
      const logPath = resolve("emulator.log");
      const errPath = resolve("emulator.err.log");
      const result = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `Start-Process -FilePath '${tools.emulator}' -ArgumentList '${flags.join(" ")}' -WindowStyle Hidden -RedirectStandardOutput '${logPath}' -RedirectStandardError '${errPath}'`,
        ],
        { env, stdio: "inherit" },
      );
      if (result.status !== 0) process.exit(result.status ?? 1);
    } else {
      const child = spawn(tools.emulator, flags, {
        env,
        detached: true,
        stdio: ["ignore", log, log],
      });
      child.unref();
    }
    console.log(
      `emulator "${AVD_NAME}" starting (gpu ${gpu}, ${headless ? "headless" : "window"}); log: emulator.log`,
    );
    break;
  }

  case "wait-boot": {
    adb("wait-for-device");
    const started = Date.now();
    while (adbOut("shell", "getprop", "sys.boot_completed").trim() !== "1") {
      if (Date.now() - started > 5 * 60_000) {
        console.error("device did not finish booting within 5 minutes");
        process.exit(1);
      }
      sleep(3000);
    }
    console.log("booted");
    break;
  }

  case "screenshot": {
    const target = args[0] ?? "screenshot.png";
    const result = runTool(tools.adb, ["exec-out", "screencap", "-p"], {
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
    writeFileSync(target, result.stdout);
    console.log(`${target} (${result.stdout.length} bytes)`);
    break;
  }

  case "geo": {
    const [lat, lng] = args;
    if (!lat || !lng) {
      console.error("usage: geo <lat> <lng>");
      process.exit(2);
    }
    adb("emu", "geo", "fix", lng, lat);
    break;
  }

  case "airplane":
    adb("shell", "cmd", "connectivity", "airplane-mode", args[0] === "on" ? "enable" : "disable");
    break;

  case "open":
    adb("shell", "input", "keyevent", "KEYCODE_WAKEUP");
    adb("shell", "wm", "dismiss-keyguard");
    adb(
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      `${SCHEME}://${args[0] ?? ""}`,
      APP_ID,
    );
    break;

  case "install":
    if (!args[0]) {
      console.error("usage: install <apk>");
      process.exit(2);
    }
    adb("install", "-r", args[0]);
    break;

  case "logcat": {
    const pid = adbOut("shell", "pidof", APP_ID).trim();
    const filter = args[0] ? ["-e", args[0]] : [];
    adb("logcat", "-d", "-T", "400", ...(pid ? ["--pid", pid] : []), ...filter);
    break;
  }

  default:
    console.error(
      "commands: devices, avd-create, emulator [--window], wait-boot, screenshot <file>, geo <lat> <lng>, airplane on|off, open <path>, install <apk>, logcat [filter]",
    );
    process.exit(2);
}
