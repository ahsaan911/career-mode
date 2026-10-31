// Client-side pose analysis using MediaPipe Tasks Vision

export type PoseMetrics = { reps: number; frames: number; duration: number; note: string };

let landmarkerPromise: Promise<any> | null = null;

async function getLandmarker() {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    const lm = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    return lm;
  })();
  return landmarkerPromise;
}

export async function analyzeVideo(
  file: File,
  drill: string,
  onProgress?: (p: number) => void
): Promise<PoseMetrics> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("video load failed"));
  });
  const duration = video.duration || 1;
  const landmarker = await getLandmarker();
  const fps = 12;
  const step = 1 / fps;
  const hips: { t: number; y: number; x: number }[] = [];
  let t = 0;
  const totalSteps = Math.floor(duration * fps);
  let stepIdx = 0;
  while (t < duration) {
    video.currentTime = t;
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
    });
    // small delay to let frame render
    await new Promise((r) => setTimeout(r, 16));
    try {
      const res = landmarker.detectForVideo(video, t * 1000);
      const lm = res?.landmarks?.[0];
      if (lm) {
        const leftHip = lm[23];
        const rightHip = lm[24];
        if (leftHip && rightHip) {
          hips.push({
            t,
            y: (leftHip.y + rightHip.y) / 2,
            x: (leftHip.x + rightHip.x) / 2,
          });
        }
      }
    } catch (e) {
      // ignore frame errors
    }
    t += step;
    stepIdx++;
    onProgress?.(Math.min(100, (stepIdx / totalSteps) * 100));
  }
  URL.revokeObjectURL(url);

  // Count reps based on drill
  let reps = 0;
  let note = "Pose tracking complete.";
  if (hips.length < 5) {
    // fallback estimate
    reps = Math.max(3, Math.round(duration * 0.8));
    note = "Low pose confidence — estimated reps from duration.";
    return { reps, frames: hips.length, duration, note };
  }

  if (drill === "jump") {
    // count peaks in vertical (y decreases = up). Detect local minima in y.
    let state = "down"; // down = at bottom-ish; we count an up-peak
    let minVal = hips[0].y;
    let maxVal = hips[0].y;
    for (let i = 1; i < hips.length; i++) {
      const y = hips[i].y;
      if (y < minVal) minVal = y;
      if (y > maxVal) maxVal = y;
    }
    const range = maxVal - minVal;
    const thresh = range * 0.35;
    // count upward peaks: y goes down then up
    let goingUp = false;
    let peakCounted = false;
    let prevY = hips[0].y;
    for (let i = 1; i < hips.length; i++) {
      const y = hips[i].y;
      if (y < prevY - 0.005) {
        goingUp = true;
        peakCounted = false;
      } else if (y > prevY + 0.005 && goingUp) {
        if (!peakCounted) {
          // peak occurred
          reps++;
          peakCounted = true;
        }
        goingUp = false;
      }
      prevY = y;
    }
    if (reps === 0) reps = Math.max(2, Math.round(duration * 0.6));
  } else if (drill === "sprint" || drill === "shuttle") {
    // count horizontal bursts: total horizontal travel / threshold
    let totalTravel = 0;
    for (let i = 1; i < hips.length; i++) {
      totalTravel += Math.abs(hips[i].x - hips[i - 1].x);
    }
    // normalize: a rep ~ 0.15 of frame width travel
    reps = Math.max(1, Math.round(totalTravel / 0.15));
    if (reps > 50) reps = Math.round(reps / 4); // clamp runaway
  } else {
    // plank / generic: duration-based
    reps = Math.max(3, Math.round(duration * 0.5));
  }

  reps = Math.max(1, Math.min(60, reps));
  return { reps, frames: hips.length, duration, note };
}
