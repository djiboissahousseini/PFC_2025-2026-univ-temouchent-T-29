import { useState, useRef, useEffect, useCallback } from "react";

const SERVER_IP = ""; 
const SESSION_ID = 4; 

// ── Screens ──────────────────────────────────────────────
const SCREENS = { IDLE: "idle", SCANNING: "scanning", RESULT: "result", TEACHER: "teacher" };

// ── Scan ring animation styles ───────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: #050a0f; }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulse-ring {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.04); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scanLine {
    0% { top: 0%; }
    100% { top: 100%; }
  }
  @keyframes glitch {
    0%, 100% { clip-path: inset(0 0 98% 0); transform: translateX(0); }
    20% { clip-path: inset(20% 0 60% 0); transform: translateX(-4px); }
    40% { clip-path: inset(50% 0 30% 0); transform: translateX(4px); }
    60% { clip-path: inset(70% 0 10% 0); transform: translateX(-2px); }
    80% { clip-path: inset(10% 0 80% 0); transform: translateX(2px); }
  }
  @keyframes successPulse {
    0% { box-shadow: 0 0 0 0 rgba(0, 255, 170, 0.5); }
    70% { box-shadow: 0 0 0 30px rgba(0, 255, 170, 0); }
    100% { box-shadow: 0 0 0 0 rgba(0, 255, 170, 0); }
  }
  @keyframes errorShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  @keyframes countdownShrink {
    from { width: 100%; }
    to { width: 0%; }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
`;

export default function App() {
  const [screen, setScreen] = useState(SCREENS.IDLE);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timeoutRef = useRef(null);
  const resetRef = useRef(null);

  // ── Start camera ──
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, []);

  // ── Stop camera ──
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Capture & send ── 
const captureAndSend = useCallback(async () => {
  if (!videoRef.current || loading) return;
  setLoading(true);

  const canvas = document.createElement("canvas");
  canvas.width = videoRef.current.videoWidth;
  canvas.height = videoRef.current.videoHeight;
  canvas.getContext("2d").drawImage(videoRef.current, 0, 0);

  canvas.toBlob(async (blob) => {
    try {
      const formData = new FormData();
      formData.append("file", blob, "capture.jpg");
      formData.append("session_id", SESSION_ID);

      const response = await fetch(`/face/checkin`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      setResult(data);
      setScreen(SCREENS.RESULT);
      stopCamera();
      resetRef.current = setTimeout(() => {  
        setScreen(SCREENS.IDLE);             
        setResult(null);                     
      }, 3000);                              

    } catch (err) {
      setResult({ status: "error", message: "Could not reach server" });
      setScreen(SCREENS.RESULT);
      stopCamera();
      resetRef.current = setTimeout(() => {  
        setScreen(SCREENS.IDLE);             
        setResult(null);                     
      }, 3000);  

    } finally {
      setLoading(false);
    }
  }, "image/jpeg", 0.9);
}, [loading, stopCamera]);


  // ── Screen transitions ──
  useEffect(() => {
    if (screen === SCREENS.SCANNING) {
      startCamera();
      // Auto capture after 2.5s
      timeoutRef.current = setTimeout(() => captureAndSend(), 2500);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [screen, startCamera, captureAndSend]);

  useEffect(() => () => { stopCamera(); clearTimeout(timeoutRef.current); }, [stopCamera]);

  return (
    <>
      <style>{globalStyles}</style>
      <div style={styles.root}>
        {/* Background grid */}
        <div style={styles.grid} />

        {screen === SCREENS.IDLE && <IdleScreen onScan={() => setScreen(SCREENS.SCANNING)} />}
        {screen === SCREENS.SCANNING && <ScanningScreen videoRef={videoRef} loading={loading} />}
        {screen === SCREENS.RESULT && <ResultScreen result={result} />}

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerDot} />
          <span style={styles.footerText}>FACE ATTENDANCE SYSTEM</span>
          <span style={styles.footerDot} />
        </div>
      </div>
    </>
  );
}

// ── IDLE SCREEN ───────────────────────────────────────────
function IdleScreen({ onScan }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ ...styles.screen, animation: "fadeUp 0.6s ease forwards" }}>
      {/* Time */}
      <div style={styles.timeBlock}>
        <div style={styles.timeText}>
          {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
        <div style={styles.dateText}>
          {time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Face icon */}
      <div style={styles.idleFaceWrap} onClick={onScan}>
        <div style={styles.idleRing1} />
        <div style={styles.idleRing2} />
        <div style={styles.idleFaceBox}>
          <FaceIcon size={64} color="#00ffaa" />
        </div>
        <div style={styles.idleCorner("top","left")} />
        <div style={styles.idleCorner("top","right")} />
        <div style={styles.idleCorner("bottom","left")} />
        <div style={styles.idleCorner("bottom","right")} />
      </div>

      <div style={styles.idleLabel}>LOOK AT THE CAMERA</div>
      <div style={styles.idleSub}>TO MARK YOUR ATTENDANCE</div>

      {/* Blinking cursor */}
      <div style={{ ...styles.cursor, animation: "blink 1.2s step-end infinite" }}>_</div>
    </div>
  );
}

// ── SCANNING SCREEN ───────────────────────────────────────
function ScanningScreen({ videoRef, loading }) {
  return (
    <div style={{ ...styles.screen, animation: "fadeUp 0.4s ease forwards" }}>
      <div style={styles.scanLabel}>SCANNING</div>

      <div style={styles.videoWrap}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={styles.video}
        />
        {/* Scan line */}
        <div style={styles.scanLine} />
        {/* Corners */}
        <div style={styles.corner("top","left","#00ffaa")} />
        <div style={styles.corner("top","right","#00ffaa")} />
        <div style={styles.corner("bottom","left","#00ffaa")} />
        <div style={styles.corner("bottom","right","#00ffaa")} />
        {/* Ring overlay */}
        <div style={styles.videoRing} />
      </div>

      {/* Progress bar */}
      <div style={styles.progressBar}>
        <div style={{
          ...styles.progressFill,
          animation: "countdownShrink 2.5s linear forwards"
        }} />
      </div>

      <div style={styles.scanSub}>
        {loading ? "PROCESSING..." : "HOLD STILL"}
      </div>
    </div>
  );
}

// ── RESULT SCREEN ─────────────────────────────────────────
function ResultScreen({ result }) {
  if (!result) return null;

  const isSuccess = result.status === "success";
  const isDuplicate = result.status === "duplicate";
  const isUnknown = result.status === "unknown" || result.status === "error";

  const color = isSuccess ? "#00ffaa" : isDuplicate ? "#f59e0b" : "#ff4466";
  const icon = isSuccess ? "✓" : isDuplicate ? "⚠" : "✗";
  const title = isSuccess ? "WELCOME" : isDuplicate ? "ALREADY IN" : "NOT RECOGNIZED";
  const animName = isSuccess ? "successPulse" : isUnknown ? "errorShake" : "fadeUp";

  return (
    <div style={{ ...styles.screen, animation: "fadeUp 0.4s ease forwards" }}>
      <div style={{
        ...styles.resultBox,
        borderColor: color,
        animation: `${animName} 0.6s ease forwards`,
      }}>
        {/* Big icon */}
        <div style={{ ...styles.resultIcon, color, borderColor: color }}>
          {icon}
        </div>

        <div style={{ ...styles.resultTitle, color }}>{title}</div>

        {result.student && (
          <div style={styles.resultName}>{result.student}</div>
        )}

        {result.similarity && (
          <div style={styles.resultSub}>
            MATCH {(result.similarity * 100).toFixed(1)}%
          </div>
        )}

        <div style={{ ...styles.resultMessage, color: "#64748b" }}>
          {result.message}
        </div>
      </div>

      {/* Auto-dismiss bar */}
      <div style={styles.dismissBar}>
        <div style={{
          height: "100%",
          background: color,
          borderRadius: 4,
          animation: "countdownShrink 3s linear forwards"
        }} />
      </div>
      <div style={{ ...styles.idleSub, marginTop: 8 }}>RETURNING IN 3s</div>
    </div>
  );
}

// ── Face SVG icon ─────────────────────────────────────────
function FaceIcon({ size = 48, color = "#00ffaa" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <circle cx="9" cy="10" r="1" fill={color} />
      <circle cx="15" cy="10" r="1" fill={color} />
    </svg>
  );
}

// ── STYLES ────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    background: "#050a0f",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Syne', sans-serif",
    position: "relative",
    overflow: "hidden",
    padding: "20px",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(0,255,170,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,255,170,0.03) 1px, transparent 1px)
    `,
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  screen: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    width: "100%",
    maxWidth: "420px",
    zIndex: 1,
  },
  timeBlock: {
    textAlign: "center",
    marginBottom: 8,
  },
  timeText: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "clamp(3rem, 12vw, 5rem)",
    fontWeight: 300,
    color: "#e2e8f0",
    letterSpacing: "0.05em",
    lineHeight: 1,
  },
  dateText: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.8rem",
    color: "#475569",
    letterSpacing: "0.2em",
    marginTop: 6,
    textTransform: "uppercase",
  },
  idleFaceWrap: {
    position: "relative",
    width: 180,
    height: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  idleRing1: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "1px solid rgba(0,255,170,0.15)",
    animation: "pulse-ring 3s ease-in-out infinite",
  },
  idleRing2: {
    position: "absolute",
    inset: -20,
    borderRadius: "50%",
    border: "1px solid rgba(0,255,170,0.07)",
    animation: "pulse-ring 3s ease-in-out infinite 1s",
  },
  idleFaceBox: {
    width: 120,
    height: 120,
    borderRadius: "50%",
    background: "rgba(0,255,170,0.05)",
    border: "1px solid rgba(0,255,170,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  idleCorner: (v, h) => ({
    position: "absolute",
    [v]: 8,
    [h]: 8,
    width: 16,
    height: 16,
    borderTop: v === "top" ? "2px solid #00ffaa" : "none",
    borderBottom: v === "bottom" ? "2px solid #00ffaa" : "none",
    borderLeft: h === "left" ? "2px solid #00ffaa" : "none",
    borderRight: h === "right" ? "2px solid #00ffaa" : "none",
  }),
  idleLabel: {
    fontFamily: "'Syne', sans-serif",
    fontSize: "clamp(0.8rem, 3vw, 1.1rem)",
    fontWeight: 800,
    color: "#e2e8f0",
    letterSpacing: "0.3em",
    textAlign: "center",
    width: "100%",
  },
  idleSub: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "clamp(0.6rem, 2vw, 0.7rem)",
    color: "#475569",
    letterSpacing: "0.25em",
    textAlign: "center",
    width: "100%",
  },
  cursor: {
    fontFamily: "'DM Mono', monospace",
    color: "#00ffaa",
    fontSize: "1.2rem",
  },
  scanLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.75rem",
    color: "#00ffaa",
    letterSpacing: "0.4em",
    animation: "blink 1s step-end infinite",
  },
  videoWrap: {
    position: "relative",
    width: "100%",
    maxWidth: 360,
    aspectRatio: "4/3",
    borderRadius: 4,
    overflow: "hidden",
    background: "#0a0f14",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    background: "linear-gradient(90deg, transparent, #00ffaa, transparent)",
    animation: "scanLine 1.5s linear infinite",
    zIndex: 2,
  },
  videoRing: {
    position: "absolute",
    inset: 0,
    border: "1px solid rgba(0,255,170,0.3)",
    borderRadius: 4,
    pointerEvents: "none",
    zIndex: 3,
  },
  corner: (v, h, color) => ({
    position: "absolute",
    [v]: 12,
    [h]: 12,
    width: 24,
    height: 24,
    borderTop: v === "top" ? `2px solid ${color}` : "none",
    borderBottom: v === "bottom" ? `2px solid ${color}` : "none",
    borderLeft: h === "left" ? `2px solid ${color}` : "none",
    borderRight: h === "right" ? `2px solid ${color}` : "none",
    zIndex: 4,
  }),
  progressBar: {
    width: "100%",
    maxWidth: 360,
    height: 3,
    background: "rgba(0,255,170,0.1)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#00ffaa",
    borderRadius: 4,
    transformOrigin: "left",
  },
  scanSub: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.7rem",
    color: "#475569",
    letterSpacing: "0.3em",
  },
  resultBox: {
    width: "100%",
    maxWidth: 360,
    padding: "40px 32px",
    border: "1px solid",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    background: "rgba(5,10,15,0.9)",
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    border: "2px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "2rem",
    fontWeight: 800,
  },
  resultTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: "1.4rem",
    fontWeight: 800,
    letterSpacing: "0.2em",
  },
  resultName: {
    fontFamily: "'Syne', sans-serif",
    fontSize: "1.8rem",
    fontWeight: 700,
    color: "#e2e8f0",
    textAlign: "center",
  },
  resultSub: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.75rem",
    color: "#475569",
    letterSpacing: "0.2em",
  },
  resultMessage: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.7rem",
    letterSpacing: "0.1em",
    textAlign: "center",
    marginTop: 4,
  },
  dismissBar: {
    width: "100%",
    maxWidth: 360,
    height: 3,
    background: "rgba(255,255,255,0.05)",
    borderRadius: 4,
    overflow: "hidden",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  footerText: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.65rem",
    color: "#1e293b",
    letterSpacing: "0.3em",
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: "50%",
    background: "#1e293b",
    display: "inline-block",
  },
};