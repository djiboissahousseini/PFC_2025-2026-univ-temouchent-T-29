import { useState, useRef, useEffect, useCallback } from "react";

const SERVER_IP = "";
const CLASSROOM = "A7"; // ← change this per tablet

// ── App modes ─────────────────────────────────────────────
// WAITING   : no session active, waiting for teacher to scan
// T_SCANNING: scanning teacher face to start session
// T_RESULT  : teacher scan result (success/fail)
// STUDENT   : session active, students checking in
// S_SCANNING: scanning student face
// S_RESULT  : student scan result
const MODE = {
  SPLASH:    "splash",
  WAITING:   "waiting",
  T_SCANNING:"t_scanning",
  T_RESULT:  "t_result",
  STUDENT:   "student",
  S_SCANNING:"s_scanning",
  S_RESULT:  "s_result",
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #050a0f; }

  @keyframes pulse-ring {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.05); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scanLine {
    0%   { top: 0%; }
    100% { top: 100%; }
  }
  @keyframes successPulse {
    0%   { box-shadow: 0 0 0 0   rgba(0,255,170,0.5); }
    70%  { box-shadow: 0 0 0 30px rgba(0,255,170,0);   }
    100% { box-shadow: 0 0 0 0   rgba(0,255,170,0);    }
  }
  @keyframes errorShake {
    0%,100% { transform: translateX(0);  }
    20%     { transform: translateX(-8px); }
    40%     { transform: translateX(8px);  }
    60%     { transform: translateX(-4px); }
    80%     { transform: translateX(4px);  }
  }
  @keyframes shrink {
    from { width: 100%; }
    to   { width: 0%;   }
  }
  @keyframes blink {
    0%,100% { opacity:1; }
    50%     { opacity:0; }
  }
  @keyframes teacherPulse {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50%      { opacity: 0.8; transform: scale(1.06); }
  }
`;

// ── Voice feedback ───────────────────────────────────────
const speak = (text) => {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.9;
  utterance.pitch = 1.2;

  const voices = window.speechSynthesis.getVoices();
  const julie = voices.find(v => v.name === "Microsoft Julie - French (France)");
  if (julie) utterance.voice = julie;

  window.speechSynthesis.speak(utterance);
};

// ── Camera helpers ────────────────────────────────────────
function useCamera() {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) { console.error("Camera error:", e); }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  return { videoRef, startCamera, stopCamera };
}

// ─────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode]               = useState(MODE.SPLASH);
  const [activeSession, setActiveSession] = useState(null);
  const [scanResult, setScanResult]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const { videoRef, startCamera, stopCamera } = useCamera();
  const autoRef   = useRef(null);
  const resetRef  = useRef(null);
  const pollRef   = useRef(null);

  // ── Check if a session is already active for this classroom ──
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_IP}/attendance/active-session?classroom=${encodeURIComponent(CLASSROOM)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        setMode(MODE.STUDENT);    // session exists → student checkin mode
      } else {
        setActiveSession(null);
        setMode(MODE.WAITING);    // no session → wait for tap to unlock speech first
      }
    } catch {
      setActiveSession(null);
      setMode(MODE.WAITING);
    }
  }, []);

  // Called when teacher taps the waiting screen — unlocks speech then starts scan
  const handleUnlock = useCallback(() => {
    const u = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(u);
    setMode(MODE.T_SCANNING);
  }, []);

  // Run once on mount to decide starting mode
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // ── Capture blob from video ──
  const captureBlob = useCallback(() => new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width  = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  }), [videoRef]);

  // ── Teacher scan ──
  const startTeacherScan = useCallback(() => {
    setMode(MODE.T_SCANNING);
  }, []);

  const captureTeacher = useCallback(async () => {
    if (!videoRef.current || loading) return;
    setLoading(true);
    const blob = await captureBlob();
    const form = new FormData();
    form.append("file", blob, "capture.jpg");
    form.append("classroom", CLASSROOM);
    try {
      const res  = await fetch(`${SERVER_IP}/teacher/face-login`, { method: "POST", body: form });
      const data = await res.json();
      setScanResult({ type: "teacher", ...data });
      setMode(MODE.T_RESULT);
      stopCamera();
      if (res.ok && (data.status === "success" || data.status === "already_active")) {
        speak(`Bonjour ${data.teacher}, session démarrée`);
        setActiveSession({ course_name: data.course, group_name: data.group, classroom: data.classroom });
        // After 3s show student mode
        resetRef.current = setTimeout(() => {
          setScanResult(null);
          setMode(MODE.STUDENT);
        }, 3000);
      } else {
        speak("Enseignant non reconnu, veuillez réessayer");
        // Failed — retry teacher scan after 3s
        resetRef.current = setTimeout(() => {
          setScanResult(null);
          setMode(MODE.T_SCANNING);
        }, 3000);
      }
    } catch {
      setScanResult({ type: "teacher", status: "error", message: "Could not reach server" });
      speak("Erreur de connexion");
      setMode(MODE.T_RESULT);
      stopCamera();
      resetRef.current = setTimeout(() => { setScanResult(null); setMode(MODE.T_SCANNING); }, 3000);
    } finally {
      setLoading(false);
    }
  }, [loading, stopCamera, captureBlob, videoRef]);

  // ── Student scan ──
  const startStudentScan = useCallback(() => {
    setMode(MODE.S_SCANNING);
  }, []);

  const captureStudent = useCallback(async () => {
    if (!videoRef.current || loading) return;
    setLoading(true);
    const blob = await captureBlob();
    const form = new FormData();
    form.append("file", blob, "capture.jpg");
    form.append("classroom", CLASSROOM);
    try {
      const res  = await fetch(`${SERVER_IP}/face/checkin`, { method: "POST", body: form });
      const data = await res.json();
      setScanResult({ type: "student", ...data });
      setMode(MODE.S_RESULT);
      stopCamera();
      // Voice feedback
      if (data.status === "success") {
        if (data.attendance_status === "late") {
          speak(`Bienvenue ${data.student}, vous êtes en retard`);
        } else {
          speak(`Bienvenue ${data.student}`);
        }
      } else if (data.status === "duplicate") {
        speak(`${data.student}, vous êtes déjà enregistré`);
      } else if (data.status === "no_session") {
        speak("Aucune session active");
      } else {
        speak("Visage non reconnu");
      }
      // If session was closed (no_session), refresh state
      if (data.status === "no_session") {
        resetRef.current = setTimeout(() => {
          setScanResult(null);
          checkSession();
        }, 3000);
      } else {
        resetRef.current = setTimeout(() => {
          setScanResult(null);
          setMode(MODE.STUDENT);
        }, 3000);
      }
    } catch {
      setScanResult({ type: "student", status: "error", message: "Could not reach server" });
      setMode(MODE.S_RESULT);
      stopCamera();
      resetRef.current = setTimeout(() => { setScanResult(null); setMode(MODE.STUDENT); }, 3000);
    } finally {
      setLoading(false);
    }
  }, [loading, stopCamera, checkSession, captureBlob, videoRef]);

  // ── Start camera when entering a scanning mode ──
  // Use refs to avoid stale closure without re-triggering the effect
  const captureTeacherRef = useRef(captureTeacher);
  const captureStudentRef = useRef(captureStudent);
  useEffect(() => { captureTeacherRef.current = captureTeacher; }, [captureTeacher]);
  useEffect(() => { captureStudentRef.current = captureStudent; }, [captureStudent]);

  useEffect(() => {
    if (mode === MODE.T_SCANNING) {
      startCamera();
      autoRef.current = setTimeout(() => captureTeacherRef.current(), 2500);
    }
    if (mode === MODE.S_SCANNING) {
      startCamera();
      autoRef.current = setTimeout(() => captureStudentRef.current(), 2500);
    }
    return () => clearTimeout(autoRef.current);
  }, [mode, startCamera]);

  useEffect(() => () => { stopCamera(); clearTimeout(autoRef.current); clearTimeout(resetRef.current); }, [stopCamera]);

  return (
    <>
      <style>{globalStyles}</style>
      <div style={S.root}>
        <div style={S.grid} />

        {mode === MODE.WAITING   && <WaitingScreen onUnlock={handleUnlock} />}
        {mode === MODE.T_SCANNING && <ScanningScreen videoRef={videoRef} loading={loading} label="SCANNING TEACHER" color="#7dd3fc" />}
        {mode === MODE.T_RESULT  && <ResultScreen    result={scanResult} />}
        {mode === MODE.STUDENT   && <StudentIdleScreen session={activeSession} onScan={startStudentScan} />}
        {mode === MODE.S_SCANNING && <ScanningScreen videoRef={videoRef} loading={loading} label="SCANNING STUDENT" color="#00ffaa" />}
        {mode === MODE.S_RESULT  && <ResultScreen    result={scanResult} />}

        <div style={S.footer}>
          <span style={S.footerDot} />
          <span style={S.footerText}>FACE ATTENDANCE SYSTEM · {CLASSROOM}</span>
          <span style={S.footerDot} />
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// WAITING SCREEN — unlocks speech synthesis on tap before camera auto-starts
// ─────────────────────────────────────────────────────────
function WaitingScreen({ onUnlock }) {
  return (
    <div
      style={{ ...S.screen, animation: "fadeUp 0.5s ease forwards", cursor: "pointer", userSelect: "none" }}
      onClick={onUnlock}
      onTouchStart={onUnlock}
    >
      <div style={S.statusPill("#334155", "#1e293b")}>
        <div style={{ ...S.statusDot, background: "#475569", animation: "blink 1s step-end infinite" }} />
        <span style={S.statusText}>APPUYEZ POUR DÉMARRER</span>
      </div>
      <div style={{ ...S.subLabel, marginTop: 8 }}>TOUCHEZ L'ÉCRAN UNE FOIS</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// STUDENT IDLE SCREEN — session active, students check in
// ─────────────────────────────────────────────────────────
function StudentIdleScreen({ session, onScan }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ ...S.screen, animation: "fadeUp 0.5s ease forwards" }}>
      <div style={S.timeBlock}>
        <div style={S.timeText}>
          {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
        <div style={S.dateText}>
          {time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Session info — horizontal strip */}
      {session && (
        <div style={S.sessionStrip}>
          <div style={S.chip}>
            <span style={S.chipLabel}>COURSE</span>
            <span style={S.chipValue}>{session.course_name}</span>
          </div>
          <div style={S.chipSep} />
          <div style={S.chip}>
            <span style={S.chipLabel}>GROUP</span>
            <span style={S.chipValue}>{session.group_name}</span>
          </div>
          <div style={S.chipSep} />
          <div style={S.chip}>
            <span style={S.chipLabel}>ROOM</span>
            <span style={S.chipValue}>{session.classroom}</span>
          </div>
        </div>
      )}

      {/* Student face button — green */}
      <div style={S.faceWrap("#00ffaa")} onClick={onScan}>
        <div style={{ ...S.ring1, borderColor: "rgba(0,255,170,0.18)", animation: "pulse-ring 3s ease-in-out infinite" }} />
        <div style={{ ...S.ring2, borderColor: "rgba(0,255,170,0.07)", animation: "pulse-ring 3s ease-in-out infinite 1s" }} />
        <div style={{ ...S.faceBox, background: "rgba(0,255,170,0.05)", borderColor: "rgba(0,255,170,0.2)" }}>
          <FaceIcon size={64} color="#00ffaa" />
        </div>
        {["top","bottom"].map(v => ["left","right"].map(h => (
          <div key={v+h} style={S.corner(v, h, "#00ffaa")} />
        )))}
      </div>

      <div style={{ ...S.mainLabel, color: "#e2e8f0" }}>LOOK AT THE CAMERA</div>
      <div style={S.subLabel}>TO MARK YOUR ATTENDANCE</div>
      <div style={{ ...S.cursor, animation: "blink 1.2s step-end infinite" }}>_</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SCANNING SCREEN (shared for teacher & student)
// ─────────────────────────────────────────────────────────
function ScanningScreen({ videoRef, loading, label, color }) {
  return (
    <div style={{ ...S.screen, animation: "fadeUp 0.4s ease forwards" }}>
      <div style={{ ...S.scanLabel, color, animation: "blink 1s step-end infinite" }}>{label}</div>

      <div style={S.videoWrap}>
        <video ref={videoRef} autoPlay playsInline muted style={S.video} />
        <div style={{ ...S.scanLine, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        {["top","bottom"].map(v => ["left","right"].map(h => (
          <div key={v+h} style={S.corner(v, h, color)} />
        )))}
        <div style={{ ...S.videoRing, borderColor: `rgba(${color === "#00ffaa" ? "0,255,170" : "125,211,252"},0.3)` }} />
      </div>

      <div style={S.progressBar}>
        <div style={{ ...S.progressFill, background: color, animation: "shrink 2.5s linear forwards" }} />
      </div>
      <div style={S.scanSub}>{loading ? "PROCESSING..." : "HOLD STILL"}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RESULT SCREEN (shared for teacher & student)
// ─────────────────────────────────────────────────────────
function ResultScreen({ result }) {
  if (!result) return null;

  const isTeacher  = result.type === "teacher";
  const isSuccess  = result.status === "success" || result.status === "already_active";
  const isDuplicate = result.status === "duplicate";
  const isNoSession = result.status === "no_session";
  const isUnknown  = !isSuccess && !isDuplicate && !isNoSession;

  const color = isSuccess ? (isTeacher ? "#7dd3fc" : "#00ffaa") : isDuplicate ? "#f59e0b" : "#ff4466";
  const icon  = isSuccess ? "✓" : isDuplicate ? "⚠" : "✗";
  const title = isSuccess
    ? (isTeacher ? "SESSION STARTED" : "WELCOME")
    : isDuplicate ? "ALREADY IN"
    : isNoSession ? "NO SESSION"
    : isTeacher   ? "NOT RECOGNIZED"
    : "UNKNOWN FACE";

  const anim = isSuccess ? "successPulse" : isUnknown ? "errorShake" : "fadeUp";

  return (
    <div style={{ ...S.screen, animation: "fadeUp 0.4s ease forwards" }}>
      <div style={{ ...S.resultBox, borderColor: color, animation: `${anim} 0.6s ease forwards` }}>

        <div style={{ ...S.resultIcon, color, borderColor: color }}>{icon}</div>
        <div style={{ ...S.resultTitle, color }}>{title}</div>

        {/* Teacher name or student name */}
        {(result.teacher || result.student) && (
          <div style={S.resultName}>{result.teacher || result.student}</div>
        )}

        {/* Session info strip */}
        {(result.course || result.group || result.classroom) && (
          <div style={{ ...S.sessionStrip, marginTop: 4 }}>
            {result.course && (
              <div style={S.chip}>
                <span style={S.chipLabel}>COURSE</span>
                <span style={{ ...S.chipValue, color: "#e2e8f0" }}>{result.course}</span>
              </div>
            )}
            {result.group && (<>
              <div style={S.chipSep} />
              <div style={S.chip}>
                <span style={S.chipLabel}>GROUP</span>
                <span style={{ ...S.chipValue, color: "#e2e8f0" }}>{result.group}</span>
              </div>
            </>)}
            {result.classroom && (<>
              <div style={S.chipSep} />
              <div style={S.chip}>
                <span style={S.chipLabel}>ROOM</span>
                <span style={{ ...S.chipValue, color: "#e2e8f0" }}>{result.classroom}</span>
              </div>
            </>)}
          </div>
        )}

        {/* Attendance status badge (students only) */}
        {result.attendance_status && (
          <div style={{
            ...S.badge,
            background: result.attendance_status === "present" ? "rgba(0,255,170,0.1)" : "rgba(245,158,11,0.1)",
            color:       result.attendance_status === "present" ? "#00ffaa"             : "#f59e0b",
            borderColor: result.attendance_status === "present" ? "#00ffaa"             : "#f59e0b",
          }}>
            {result.attendance_status.toUpperCase()}
          </div>
        )}

        {result.similarity && (
          <div style={S.matchPct}>MATCH {(result.similarity * 100).toFixed(1)}%</div>
        )}

        <div style={S.resultMsg}>{result.message}</div>
      </div>

      {/* Auto-dismiss bar */}
      <div style={S.dismissBar}>
        <div style={{ height: "100%", background: color, borderRadius: 4, animation: "shrink 3s linear forwards" }} />
      </div>
      <div style={S.subLabel}>RETURNING IN 3s</div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────
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
function TeacherIcon({ size = 48, color = "#7dd3fc" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      <path d="M17 11l3-2-3-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── STYLES ────────────────────────────────────────────────
const S = {
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
    position: "absolute", inset: 0,
    backgroundImage: `
      linear-gradient(rgba(0,255,170,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,255,170,0.025) 1px, transparent 1px)`,
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  screen: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "18px", width: "100%", maxWidth: "420px", zIndex: 1,
  },
  timeBlock: { textAlign: "center" },
  timeText: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "clamp(3rem, 12vw, 5rem)",
    fontWeight: 300, color: "#e2e8f0",
    letterSpacing: "0.05em", lineHeight: 1,
  },
  dateText: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.78rem", color: "#475569",
    letterSpacing: "0.2em", marginTop: 6, textTransform: "uppercase",
  },

  // Status pill
  statusPill: (bg, border) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 14px", borderRadius: 20,
    border: `1px solid ${border}`, background: bg,
  }),
  statusDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  statusText: {
    fontFamily: "'DM Mono', monospace", fontSize: "0.6rem",
    color: "#475569", letterSpacing: "0.2em",
  },

  // Face button
  faceWrap: (color) => ({
    position: "relative", width: 180, height: 180,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  }),
  ring1: {
    position: "absolute", inset: 0,
    borderRadius: "50%", border: "1px solid",
  },
  ring2: {
    position: "absolute", inset: -22,
    borderRadius: "50%", border: "1px solid",
  },
  faceBox: {
    width: 120, height: 120, borderRadius: "50%",
    border: "1px solid",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  corner: (v, h, color) => ({
    position: "absolute", [v]: 6, [h]: 6, width: 16, height: 16,
    borderTop:    v === "top"    ? `2px solid ${color}` : "none",
    borderBottom: v === "bottom" ? `2px solid ${color}` : "none",
    borderLeft:   h === "left"   ? `2px solid ${color}` : "none",
    borderRight:  h === "right"  ? `2px solid ${color}` : "none",
  }),

  mainLabel: {
    fontFamily: "'Syne', sans-serif",
    fontSize: "clamp(0.8rem, 3vw, 1rem)",
    fontWeight: 800, letterSpacing: "0.28em", textAlign: "center",
  },
  subLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "clamp(0.58rem, 2vw, 0.68rem)",
    color: "#475569", letterSpacing: "0.22em", textAlign: "center",
  },
  cursor: {
    fontFamily: "'DM Mono', monospace", color: "#00ffaa", fontSize: "1.2rem",
  },

  // Session strip
  sessionStrip: {
    width: "100%", display: "flex", flexDirection: "row",
    alignItems: "stretch",
    border: "1px solid rgba(0,255,170,0.13)",
    borderRadius: 8, background: "rgba(0,255,170,0.03)", overflow: "hidden",
  },
  chip: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 4, padding: "10px 6px",
  },
  chipLabel: {
    fontFamily: "'DM Mono', monospace", fontSize: "0.52rem",
    color: "#334155", letterSpacing: "0.2em",
  },
  chipValue: {
    fontFamily: "'Syne', sans-serif", fontSize: "0.82rem",
    fontWeight: 800, color: "#00ffaa",
    letterSpacing: "0.04em", textAlign: "center",
  },
  chipSep: {
    width: 1, background: "rgba(0,255,170,0.09)",
    alignSelf: "stretch", margin: "8px 0",
  },

  // Scanning
  scanLabel: {
    fontFamily: "'DM Mono', monospace", fontSize: "0.72rem", letterSpacing: "0.4em",
  },
  videoWrap: {
    position: "relative", width: "100%", maxWidth: 360,
    aspectRatio: "4/3", borderRadius: 4,
    overflow: "hidden", background: "#0a0f14",
  },
  video: {
    width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)",
  },
  scanLine: {
    position: "absolute", left: 0, right: 0, height: 2,
    animation: "scanLine 1.5s linear infinite", zIndex: 2,
  },
  videoRing: {
    position: "absolute", inset: 0, border: "1px solid",
    borderRadius: 4, pointerEvents: "none", zIndex: 3,
  },
  progressBar: {
    width: "100%", maxWidth: 360, height: 3,
    background: "rgba(0,255,170,0.08)", borderRadius: 4, overflow: "hidden",
  },
  progressFill: {
    height: "100%", borderRadius: 4, transformOrigin: "left",
  },
  scanSub: {
    fontFamily: "'DM Mono', monospace", fontSize: "0.68rem",
    color: "#475569", letterSpacing: "0.3em",
  },

  // Result
  resultBox: {
    width: "100%", maxWidth: 360, padding: "32px 28px",
    border: "1px solid", borderRadius: 8,
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 10, background: "rgba(5,10,15,0.92)",
  },
  resultIcon: {
    width: 80, height: 80, borderRadius: "50%", border: "2px solid",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "2rem", fontWeight: 800,
  },
  resultTitle: {
    fontFamily: "'Syne', sans-serif", fontSize: "1.3rem",
    fontWeight: 800, letterSpacing: "0.2em",
  },
  resultName: {
    fontFamily: "'Syne', sans-serif", fontSize: "1.7rem",
    fontWeight: 700, color: "#e2e8f0", textAlign: "center",
  },
  badge: {
    fontFamily: "'DM Mono', monospace", fontSize: "0.62rem",
    letterSpacing: "0.25em", padding: "4px 14px",
    borderRadius: 20, border: "1px solid",
  },
  matchPct: {
    fontFamily: "'DM Mono', monospace", fontSize: "0.72rem",
    color: "#475569", letterSpacing: "0.2em",
  },
  resultMsg: {
    fontFamily: "'DM Mono', monospace", fontSize: "0.67rem",
    color: "#64748b", letterSpacing: "0.1em", textAlign: "center",
  },
  dismissBar: {
    width: "100%", maxWidth: 360, height: 3,
    background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden",
  },

  // Footer
  footer: {
    position: "absolute", bottom: 18,
    display: "flex", alignItems: "center", gap: 10,
  },
  footerText: {
    fontFamily: "'DM Mono', monospace", fontSize: "0.6rem",
    color: "#1e293b", letterSpacing: "0.28em",
  },
  footerDot: {
    width: 3, height: 3, borderRadius: "50%",
    background: "#1e293b", display: "inline-block",
  },
};