/**
 * Serves MediaPipe Face Landmarker locally (no CDN at runtime):
 * - copies the WASM runtime from node_modules/@mediapipe/tasks-vision/wasm to public/mediapipe/wasm
 *   (derived from the installed package, so it is git-ignored);
 * - downloads public/mediapipe/face_landmarker.task when it is missing (the model is committed).
 *
 * Runs on postinstall, predev and prebuild.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = path.join(root, "public", "mediapipe", "wasm");
const model = path.join(root, "public", "mediapipe", "face_landmarker.task");
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

if (!existsSync(source)) {
  console.warn("[mediapipe] @mediapipe/tasks-vision is not installed; skipping WASM copy.");
} else {
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(source)) {
    const from = path.join(source, file);
    const to = path.join(target, file);
    if (!existsSync(to) || statSync(to).size !== statSync(from).size) {
      copyFileSync(from, to);
    }
  }
}

if (!existsSync(model)) {
  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    mkdirSync(path.dirname(model), { recursive: true });
    writeFileSync(model, Buffer.from(await response.arrayBuffer()));
    console.log("[mediapipe] downloaded face_landmarker.task");
  } catch (error) {
    console.warn(`[mediapipe] could not download the face landmarker model: ${error instanceof Error ? error.message : error}`);
  }
}
