"use client";

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";

import {
  POSES,
  QUALITY_CHECKS,
  advanceSequence,
  blurScore,
  boundingBox,
  brightnessScore,
  buildReport,
  centeringScore,
  distanceScore,
  eyesOpenScore,
  headPose,
  initialSequence,
  meanLuma,
  qualityChecks,
  type FrameMetrics,
  type LivenessReport,
  type QualityCheck,
  type SequenceState,
} from "./liveness";

export interface ScanResult {
  capture: Blob;
  previewUrl: string;
  report: LivenessReport;
}

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/face_landmarker.task";
const TIME_LIMIT_MS = 90_000;

let landmarkerPromise: Promise<FaceLandmarker> | null = null;
let consoleFiltered = false;

/** The WASM runtime reports informational lines (e.g. "INFO: Created TensorFlow Lite XNNPACK delegate") on console.error. */
function filterRuntimeInfoLogs() {
  if (consoleFiltered || typeof console === "undefined") {
    return;
  }
  consoleFiltered = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && /^(INFO|I\d{4}|W\d{4}):? /.test(args[0])) {
      return;
    }
    original(...args);
  };
}

/** Loads the Face Landmarker once per page (WASM and model served locally from /mediapipe). */
function loadLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    filterRuntimeInfoLogs();
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const options = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: "VIDEO" as const,
        numFaces: 2,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
      try {
        return await FaceLandmarker.createFromOptions(fileset, options("GPU"));
      } catch {
        return FaceLandmarker.createFromOptions(fileset, options("CPU"));
      }
    })().catch((error: unknown) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

type Phase = "idle" | "loading" | "running" | "done" | "error";

const NO_CHECKS: Record<QualityCheck, boolean> = { oneFaceDetected: false, eyesOpen: false, centered: false, correctDistance: false, goodLighting: false, sharpImage: false };

/**
 * Guided liveness scanner: the six live quality checks and the five-pose sequence. Produces a still capture
 * (JPEG, taken on the straight pose) and a report; `onResult(null)` when a new scan starts.
 */
export function FaceLivenessScanner({ onResult, disabled }: { onResult: (result: ScanResult | null) => void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const sampleCanvas = useRef<HTMLCanvasElement | null>(null);
  const sequenceRef = useRef<SequenceState>(initialSequence());
  const captureRef = useRef<Blob | null>(null);
  const lastMetricsRef = useRef<FrameMetrics | null>(null);
  const startedAtRef = useRef(0);
  const lastTimestampRef = useRef(-1);
  const onResultRef = useRef(onResult);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<QualityCheck, boolean>>(NO_CHECKS);
  const [poseIndex, setPoseIndex] = useState(0);
  const [completed, setCompleted] = useState<SequenceState["completed"]>(initialSequence().completed);
  const [result, setResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const stopCamera = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => () => stopCamera(), []);

  useEffect(() => () => {
    if (result) {
      URL.revokeObjectURL(result.previewUrl);
    }
  }, [result]);

  const grabFrame = (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      return Promise.resolve(null);
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9));
  };

  const measure = (landmarker: FaceLandmarker, video: HTMLVideoElement, now: number): FrameMetrics => {
    const detection = landmarker.detectForVideo(video, now);
    const faces = detection.faceLandmarks.length;
    const metrics: FrameMetrics = { faces, eyesOpenScore: 0, centeringScore: 0, distanceScore: 0, brightnessScore: 0, blurScore: 0, yaw: 0.5, pitch: 0.5 };
    if (faces === 0) {
      return metrics;
    }
    const landmarks = detection.faceLandmarks[0];
    const box = boundingBox(landmarks);
    const categories = detection.faceBlendshapes[0]?.categories ?? [];
    const blend = (name: string) => categories.find((category) => category.categoryName === name)?.score ?? 0;
    metrics.eyesOpenScore = eyesOpenScore(blend("eyeBlinkLeft"), blend("eyeBlinkRight"));
    metrics.centeringScore = centeringScore(box);
    metrics.distanceScore = distanceScore(box);
    const pose = headPose(landmarks);
    metrics.yaw = pose.yaw;
    metrics.pitch = pose.pitch;

    // Brightness and sharpness on the face region, sampled at a small size.
    const canvas = (sampleCanvas.current ??= document.createElement("canvas"));
    const sourceX = Math.max(0, box.minX) * video.videoWidth;
    const sourceY = Math.max(0, box.minY) * video.videoHeight;
    const sourceW = Math.max(1, (Math.min(1, box.maxX) - Math.max(0, box.minX)) * video.videoWidth);
    const sourceH = Math.max(1, (Math.min(1, box.maxY) - Math.max(0, box.minY)) * video.videoHeight);
    canvas.width = 96;
    canvas.height = Math.max(3, Math.round((96 * sourceH) / sourceW));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      metrics.brightnessScore = brightnessScore(meanLuma(pixels));
      metrics.blurScore = blurScore(pixels, canvas.width, canvas.height);
    }
    return metrics;
  };

  const finish = async (passedSequence: boolean) => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    const captureResolution = video && video.videoWidth > 0 ? `${video.videoWidth}x${video.videoHeight}` : undefined;
    // A failed scan still records what the camera saw.
    const capture = captureRef.current ?? (await grabFrame());
    stopCamera();
    const report = buildReport(sequenceRef.current, lastMetricsRef.current, {
      captureDevice: track?.label || undefined,
      captureResolution,
      captureDurationMs: Math.round(performance.now() - startedAtRef.current),
    });
    if (!passedSequence) {
      report.status = "failed";
    }
    if (!capture) {
      setPhase("done");
      setError("The scan did not confirm liveness. Run it again before completing verification.");
      return;
    }
    const scan: ScanResult = { capture, previewUrl: URL.createObjectURL(capture), report };
    setResult(scan);
    setPhase("done");
    onResultRef.current(scan);
  };

  const start = async () => {
    setError(null);
    setResult(null);
    onResultRef.current(null);
    setChecks(NO_CHECKS);
    setPoseIndex(0);
    setCompleted(initialSequence().completed);
    sequenceRef.current = initialSequence();
    captureRef.current = null;
    lastMetricsRef.current = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("error");
      setError("This browser cannot open a camera here. Use a current browser over HTTPS (or localhost).");
      return;
    }

    setPhase("loading");
    let landmarker: FaceLandmarker;
    try {
      const [loaded, stream] = await Promise.all([
        loadLandmarker(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
      ]);
      landmarker = loaded;
      streamRef.current = stream;
    } catch (exception) {
      stopCamera();
      setPhase("error");
      const name = exception instanceof DOMException ? exception.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera access was refused. Allow the camera for this site and run the scan again."
          : name === "NotFoundError"
            ? "No camera was found on this machine. The same scan is on the customer's profile and can be run from a desk with a camera."
            : "The face scanner could not start. Check the camera and run the scan again.",
      );
      return;
    }

    const video = videoRef.current;
    if (!video || !streamRef.current) {
      stopCamera();
      setPhase("idle");
      return;
    }
    video.srcObject = streamRef.current;
    await video.play().catch(() => undefined);
    startedAtRef.current = performance.now();
    lastTimestampRef.current = -1;
    setPhase("running");

    let lastUiUpdate = 0;
    let shownPose = 0;
    const loop = () => {
      const now = performance.now();
      if (!streamRef.current) {
        return;
      }
      if (now - startedAtRef.current > TIME_LIMIT_MS) {
        void finish(false);
        return;
      }
      if (video.readyState >= 2 && video.videoWidth > 0 && now > lastTimestampRef.current) {
        lastTimestampRef.current = now;
        try {
          const metrics = measure(landmarker, video, now);
          lastMetricsRef.current = metrics;
          const step = advanceSequence(sequenceRef.current, metrics);
          sequenceRef.current = step.state;
          if (step.capture) {
            void grabFrame().then((blob) => {
              captureRef.current = blob;
            });
          }
          if (now - lastUiUpdate > 120 || step.state.poseIndex !== shownPose) {
            lastUiUpdate = now;
            shownPose = step.state.poseIndex;
            setChecks(qualityChecks(metrics));
            setPoseIndex(step.state.poseIndex);
            setCompleted(step.state.completed);
          }
          if (step.finished) {
            // Give the capture blob a moment to resolve.
            const wait = () => (captureRef.current ? void finish(true) : setTimeout(wait, 50));
            wait();
            return;
          }
        } catch {
          // A dropped frame is not fatal.
        }
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
  };

  const cancel = () => {
    stopCamera();
    setPhase("idle");
  };

  const running = phase === "running" || phase === "loading";
  const instruction = phase === "running" ? POSES[Math.min(poseIndex, POSES.length - 1)].instruction : null;
  const failed = result?.report.status === "failed";

  return (
    <div className="mf-face-scanner">
      <div className="mf-face-stage">
        <video ref={videoRef} muted playsInline className={running ? "" : "d-none"} aria-label="Camera preview" />
        {running && <div className="mf-face-oval" aria-hidden="true" />}
        {!running && result && (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL of the capture
          <img src={result.previewUrl} alt="Liveness capture" />
        )}
        {!running && !result && (
          <div className="mf-face-placeholder">
            <i className="icon-camera" />
            <span>Camera is off</span>
          </div>
        )}
        {phase === "loading" && <div className="mf-face-banner">Starting the camera and face scanner…</div>}
        {instruction && <div className="mf-face-banner mf-face-instruction" aria-live="polite">{instruction}</div>}
      </div>

      <div className="mf-face-side">
        <div className="mf-face-group-title">Checks</div>
        <ul className="mf-face-checks">
          {QUALITY_CHECKS.map((check) => {
            const ok = result ? result.report.checks[check.key] : checks[check.key];
            return (
              <li key={check.key} className={ok ? "ok" : ""}>
                <i className={ok ? "fa fa-check-circle" : "fa fa-circle-o"} /> {check.label}
              </li>
            );
          })}
        </ul>
        <div className="mf-face-group-title">Pose sequence</div>
        <ol className="mf-face-poses">
          {POSES.map((pose, index) => {
            const done = result ? result.report.checks[pose.key] : completed[pose.key];
            return (
              <li key={pose.key} className={`${done ? "ok" : ""} ${phase === "running" && index === poseIndex ? "current" : ""}`}>
                <i className={done ? "fa fa-check-circle" : "fa fa-circle-o"} /> {pose.instruction}
              </li>
            );
          })}
        </ol>

        {failed && <div className="field-error mb-2">The scan did not confirm liveness. Run it again before completing verification.</div>}
        {error && <div className="field-error mb-2">{error}</div>}
        {result && result.report.status === "passed" && (
          <div className="mf-face-passed mb-2">
            <i className="fa fa-check-circle" /> Liveness confirmed · quality {result.report.qualityScore}/100
          </div>
        )}

        <div className="mf-face-actions">
          {running ? (
            <button type="button" className="btn btn-outline-secondary" onClick={cancel}>
              Stop
            </button>
          ) : (
            <button type="button" className="btn btn-info" onClick={() => void start()} disabled={disabled}>
              <i className="icon-camera" /> {result || error ? "Run the scan again" : "Start face scan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
