/**
 * Pure liveness logic for the MediaPipe Face Landmarker scanner (CUSTOMER_MODULE_SPEC §7.2):
 * per-frame quality scores, the six quality checks, the five-pose sequence and the report sent to
 * POST /customers/{id}/face-verify.
 */
import type { ScanCheckName } from "../types";

export const SCANNER_VERSION = "mf-liveness-1.0/mediapipe-tasks-vision-1.0.1";

export const QUALITY_CHECKS = [
  { key: "oneFaceDetected", label: "One face detected" },
  { key: "eyesOpen", label: "Eyes open" },
  { key: "centered", label: "Centred in frame" },
  { key: "correctDistance", label: "Correct distance" },
  { key: "goodLighting", label: "Good lighting" },
  { key: "sharpImage", label: "Sharp image" },
] as const;

export const POSES = [
  { key: "poseStraight", instruction: "Look straight at the camera" },
  { key: "poseLeft", instruction: "Slowly turn your head to the left" },
  { key: "poseRight", instruction: "Slowly turn your head to the right" },
  { key: "poseUp", instruction: "Tilt your head up" },
  { key: "poseDown", instruction: "Tilt your head down" },
] as const;

export type QualityCheck = (typeof QUALITY_CHECKS)[number]["key"];
export type PoseKey = (typeof POSES)[number]["key"];

export interface Point {
  x: number;
  y: number;
}

/** Everything measured on one video frame. */
export interface FrameMetrics {
  faces: number;
  eyesOpenScore: number;
  centeringScore: number;
  distanceScore: number;
  brightnessScore: number;
  blurScore: number;
  /** 0.5 = facing the camera; larger = turned to the subject's left. */
  yaw: number;
  /** Nose height between forehead (0) and chin (1). */
  pitch: number;
}

export interface LivenessReport {
  status: "passed" | "failed";
  qualityScore: number;
  brightnessScore: number;
  blurScore: number;
  distanceScore: number;
  centeringScore: number;
  eyesOpenScore: number;
  scannerVersion: string;
  livenessPassed: boolean;
  poseSequenceCompleted: boolean;
  checks: Record<ScanCheckName, boolean>;
  captureDevice?: string;
  captureResolution?: string;
  captureDurationMs?: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const score = (value: number) => Math.round(clamp01(value) * 100);

/** Mean eye-blink blendshape (0 open … 1 closed) → 0–100. */
export function eyesOpenScore(blinkLeft: number, blinkRight: number): number {
  const blink = (blinkLeft + blinkRight) / 2;
  return score(1 - (blink - 0.15) / 0.45);
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundingBox(points: Point[]): Box {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Face centre distance from the frame centre → 0–100. */
export function centeringScore(box: Box): number {
  const offset = Math.hypot((box.minX + box.maxX) / 2 - 0.5, (box.minY + box.maxY) / 2 - 0.5);
  return score(1 - (offset - 0.06) / 0.2);
}

/** Face width as a share of the frame width: ideal 0.28–0.6 → 0–100. */
export function distanceScore(box: Box): number {
  const width = box.maxX - box.minX;
  if (width < 0.28) {
    return score((width - 0.12) / 0.16);
  }
  if (width > 0.6) {
    return score((0.8 - width) / 0.2);
  }
  return 100;
}

/** Mean luma (0–255) of the face region: ideal 80–190 → 0–100. */
export function brightnessScore(meanLuma: number): number {
  if (meanLuma < 80) {
    return score((meanLuma - 30) / 50);
  }
  if (meanLuma > 190) {
    return score((240 - meanLuma) / 50);
  }
  return 100;
}

/** Mean luma of RGBA pixels. */
export function meanLuma(rgba: ArrayLike<number>): number {
  let total = 0;
  const count = Math.floor(rgba.length / 4);
  for (let index = 0; index < count * 4; index += 4) {
    total += 0.299 * rgba[index] + 0.587 * rgba[index + 1] + 0.114 * rgba[index + 2];
  }
  return count === 0 ? 0 : total / count;
}

/** Variance of the Laplacian of an RGBA image (higher = sharper) → 0–100. */
export function blurScore(rgba: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3) {
    return 0;
  }
  const gray = new Float32Array(width * height);
  for (let index = 0; index < width * height; index++) {
    gray[index] = 0.299 * rgba[index * 4] + 0.587 * rgba[index * 4 + 1] + 0.114 * rgba[index * 4 + 2];
  }
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const laplacian = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += laplacian;
      sumSquares += laplacian * laplacian;
      count++;
    }
  }
  const mean = sum / count;
  const variance = sumSquares / count - mean * mean;
  return score(variance / 120);
}

/** Landmark indices (MediaPipe face mesh): nose tip, forehead, chin, the two cheek edges. */
export const LANDMARKS = { nose: 1, forehead: 10, chin: 152, rightCheek: 234, leftCheek: 454 } as const;

export function headPose(landmarks: Point[]): { yaw: number; pitch: number } {
  const nose = landmarks[LANDMARKS.nose];
  const right = landmarks[LANDMARKS.rightCheek];
  const left = landmarks[LANDMARKS.leftCheek];
  const top = landmarks[LANDMARKS.forehead];
  const chin = landmarks[LANDMARKS.chin];
  if (!nose || !right || !left || !top || !chin) {
    return { yaw: 0.5, pitch: 0.5 };
  }
  const width = left.x - right.x;
  const height = chin.y - top.y;
  return {
    yaw: Math.abs(width) < 1e-6 ? 0.5 : (nose.x - right.x) / width,
    pitch: Math.abs(height) < 1e-6 ? 0.5 : (nose.y - top.y) / height,
  };
}

export const THRESHOLDS = { eyesOpen: 50, centered: 50, correctDistance: 50, goodLighting: 50, sharpImage: 40 } as const;

export function qualityChecks(metrics: FrameMetrics): Record<QualityCheck, boolean> {
  return {
    oneFaceDetected: metrics.faces === 1,
    eyesOpen: metrics.faces === 1 && metrics.eyesOpenScore >= THRESHOLDS.eyesOpen,
    centered: metrics.faces === 1 && metrics.centeringScore >= THRESHOLDS.centered,
    correctDistance: metrics.faces === 1 && metrics.distanceScore >= THRESHOLDS.correctDistance,
    goodLighting: metrics.faces >= 1 && metrics.brightnessScore >= THRESHOLDS.goodLighting,
    sharpImage: metrics.faces >= 1 && metrics.blurScore >= THRESHOLDS.sharpImage,
  };
}

/** Frames a pose must be held before it counts. */
export const HOLD_FRAMES = { poseStraight: 12, other: 6 } as const;
const YAW_TURN = 0.17;
const PITCH_TILT = 0.06;

export interface SequenceState {
  poseIndex: number;
  held: number;
  baselineYaw: number;
  baselinePitch: number;
  completed: Record<PoseKey, boolean>;
  /** Metrics of the frame the still capture was taken on (the straight pose). */
  captureMetrics: FrameMetrics | null;
}

export function initialSequence(): SequenceState {
  return {
    poseIndex: 0,
    held: 0,
    baselineYaw: 0.5,
    baselinePitch: 0.55,
    completed: { poseStraight: false, poseLeft: false, poseRight: false, poseUp: false, poseDown: false },
    captureMetrics: null,
  };
}

/** Whether the frame shows the pose the sequence is waiting for. */
export function poseMatches(pose: PoseKey, metrics: FrameMetrics, state: SequenceState): boolean {
  if (metrics.faces !== 1) {
    return false;
  }
  switch (pose) {
    case "poseStraight": {
      const checks = qualityChecks(metrics);
      return Math.abs(metrics.yaw - 0.5) < 0.1 && Object.values(checks).every(Boolean);
    }
    case "poseLeft":
      return metrics.yaw > state.baselineYaw + YAW_TURN;
    case "poseRight":
      return metrics.yaw < state.baselineYaw - YAW_TURN;
    case "poseUp":
      return metrics.pitch < state.baselinePitch - PITCH_TILT;
    case "poseDown":
      return metrics.pitch > state.baselinePitch + PITCH_TILT;
  }
}

export interface SequenceStep {
  state: SequenceState;
  /** True on the frame the straight pose completes: take the still capture now. */
  capture: boolean;
  finished: boolean;
}

/** Advances the guided pose sequence by one frame. */
export function advanceSequence(state: SequenceState, metrics: FrameMetrics): SequenceStep {
  if (state.poseIndex >= POSES.length) {
    return { state, capture: false, finished: true };
  }
  const pose = POSES[state.poseIndex].key;
  if (!poseMatches(pose, metrics, state)) {
    return { state: { ...state, held: 0 }, capture: false, finished: false };
  }
  const held = state.held + 1;
  const needed = pose === "poseStraight" ? HOLD_FRAMES.poseStraight : HOLD_FRAMES.other;
  if (held < needed) {
    return { state: { ...state, held }, capture: false, finished: false };
  }
  const next: SequenceState = {
    ...state,
    held: 0,
    poseIndex: state.poseIndex + 1,
    completed: { ...state.completed, [pose]: true },
  };
  let capture = false;
  if (pose === "poseStraight") {
    next.baselineYaw = metrics.yaw;
    next.baselinePitch = metrics.pitch;
    next.captureMetrics = metrics;
    capture = true;
  }
  return { state: next, capture, finished: next.poseIndex >= POSES.length };
}

/** Builds the report from the sequence and the capture-frame metrics (or the last frame when there was none). */
export function buildReport(state: SequenceState, lastMetrics: FrameMetrics | null, extra: Pick<LivenessReport, "captureDevice" | "captureResolution" | "captureDurationMs"> = {}): LivenessReport {
  const metrics = state.captureMetrics ?? lastMetrics ?? { faces: 0, eyesOpenScore: 0, centeringScore: 0, distanceScore: 0, brightnessScore: 0, blurScore: 0, yaw: 0.5, pitch: 0.5 };
  const quality = qualityChecks(metrics);
  const poseSequenceCompleted = POSES.every((pose) => state.completed[pose.key]);
  const qualityPassed = Object.values(quality).every(Boolean);
  const livenessPassed = poseSequenceCompleted;
  const scores = [metrics.brightnessScore, metrics.blurScore, metrics.distanceScore, metrics.centeringScore, metrics.eyesOpenScore].map((value) => Math.round(Math.min(100, Math.max(0, value))));
  const [brightness, blur, distance, centering, eyes] = scores;

  return {
    status: livenessPassed && qualityPassed ? "passed" : "failed",
    qualityScore: Math.round(scores.reduce((total, value) => total + value, 0) / scores.length),
    brightnessScore: brightness,
    blurScore: blur,
    distanceScore: distance,
    centeringScore: centering,
    eyesOpenScore: eyes,
    scannerVersion: SCANNER_VERSION,
    livenessPassed,
    poseSequenceCompleted,
    checks: { ...quality, ...state.completed },
    ...extra,
  };
}

/** Multipart body for POST /customers/{id}/face-verify. */
export function faceVerifyForm(capture: Blob, report: LivenessReport): FormData {
  const body = new FormData();
  body.append("capture", capture, capture.type === "image/png" ? "capture.png" : "capture.jpg");
  body.append("status", report.status);
  for (const key of ["qualityScore", "brightnessScore", "blurScore", "distanceScore", "centeringScore", "eyesOpenScore"] as const) {
    body.append(key, String(report[key]));
  }
  body.append("scannerVersion", report.scannerVersion);
  body.append("livenessPassed", report.livenessPassed ? "1" : "0");
  body.append("poseSequenceCompleted", report.poseSequenceCompleted ? "1" : "0");
  for (const [name, value] of Object.entries(report.checks)) {
    body.append(`checks[${name}]`, value ? "1" : "0");
  }
  if (report.captureDevice) {
    body.append("captureDevice", report.captureDevice.slice(0, 191));
  }
  if (report.captureResolution && /^\d{2,5}x\d{2,5}$/.test(report.captureResolution)) {
    body.append("captureResolution", report.captureResolution);
  }
  if (report.captureDurationMs !== undefined) {
    body.append("captureDurationMs", String(Math.min(3_600_000, Math.max(0, Math.round(report.captureDurationMs)))));
  }
  return body;
}
