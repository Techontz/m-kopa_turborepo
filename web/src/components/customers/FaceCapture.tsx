"use client";

import { useEffect, useRef, useState } from "react";

import { notifyError, notifySuccess } from "@/components/ui/notify";
import { api } from "@/lib/api";

const FRAME_COUNT = 5;
const FRAME_INTERVAL_MS = 350;

interface FaceCaptureProps {
  customerId: number;
  verifiedAt: string | null;
  photoUrl: string | null;
  onVerified: () => void;
}

/**
 * Live face liveness capture (Documents §4): camera only, no passport photo upload. Several frames are
 * captured from the video stream and sent to the Face connector, which must pass before KYC can complete.
 */
export function FaceCapture({ customerId, verifiedAt, photoUrl, onVerified }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Kivinjari hiki hakiruhusu kamera. Tumia Chrome / Safari kwenye HTTPS au localhost.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Imeshindikana kufungua kamera. Ruhusu matumizi ya kamera kisha jaribu tena.");
    }
  };

  const captureFrames = async (): Promise<string[]> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      throw new Error("Camera is not ready yet");
    }
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = Math.round((480 * video.videoHeight) / video.videoWidth);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not supported");
    }
    const frames: string[] = [];
    for (let index = 0; index < FRAME_COUNT; index++) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.85));
      setProgress(index + 1);
      await new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS));
    }
    return frames;
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const frames = await captureFrames();
      await api.post(`customers/${customerId}/face`, { frames });
      stopCamera();
      notifySuccess("Face Verified successfully");
      onVerified();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Face verification failed");
      notifyError(exception);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row">
      <div className="col-md-6">
        <div style={{ background: "#111", borderRadius: 6, overflow: "hidden", aspectRatio: "4 / 3", position: "relative" }}>
          {cameraOn ? (
            <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Face" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div className="text-center text-light" style={{ paddingTop: "30%" }}>
              <i className="icon-camera" style={{ fontSize: 40 }} />
              <p className="m-t-20">Kamera haijawashwa</p>
            </div>
          )}
          {cameraOn && (
            <div style={{ position: "absolute", inset: "12% 25%", border: "3px dashed rgba(255,255,255,.7)", borderRadius: "50%" }} />
          )}
        </div>
      </div>
      <div className="col-md-6">
        <h6>Uthibitisho wa Uso (Liveness)</h6>
        <ul className="list-unstyled">
          <li><i className="icon-check text-success" /> Mteja aangalie kamera moja kwa moja, uso ndani ya duara.</li>
          <li><i className="icon-check text-success" /> Asitumie picha ya pasipoti wala picha iliyochapishwa.</li>
          <li><i className="icon-check text-success" /> Mfumo utachukua picha {FRAME_COUNT} mfululizo na kuthibitisha ni mtu halisi.</li>
        </ul>
        {verifiedAt && (
          <p>
            <span className="badge badge-success">Face Verified</span> {verifiedAt}
          </p>
        )}
        {error && <div className="alert alert-danger py-2">{error}</div>}
        {busy && <p>Inachukua picha... {progress}/{FRAME_COUNT}</p>}
        <div className="m-t-20">
          {!cameraOn ? (
            <button type="button" className="btn btn-info" onClick={startCamera}>
              <i className="icon-camera" /> {verifiedAt ? "Rudia Uthibitisho" : "Washa Kamera"}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-primary mr-2" onClick={verify} disabled={busy}>
                <i className="icon-user-following" /> {busy ? "Inathibitisha..." : "Thibitisha Uso"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={stopCamera} disabled={busy}>Zima Kamera</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
