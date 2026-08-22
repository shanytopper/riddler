// Runs a command with JAVA_HOME, ANDROID_HOME, and PATH set for this machine's Android toolchain.
//
//   node scripts/with-android-env.mjs expo run:android
//   node scripts/with-android-env.mjs adb devices
import { requireToolchain, runTool } from "./android-env.mjs";

requireToolchain();
const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: node scripts/with-android-env.mjs <command> [args...]");
  process.exit(2);
}
// A shell resolves npm's .cmd shims (expo, etc.) the same way a terminal would.
const result = runTool(command, args, { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
