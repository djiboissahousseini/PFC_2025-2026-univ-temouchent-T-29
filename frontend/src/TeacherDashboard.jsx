// import { useState, useEffect, useRef, useCallback } from "react";
// // ─── CONFIG ────────────────────────────────────────────────────────────────
// const SERVER_IP = "localhost"; // empty = same server
// const BASE = SERVER_IP ? `http://${SERVER_IP}:8000` : "";

// // ─── HELPERS ────────────────────────────────────────────────────────────────
// const api = (path, opts) => fetch(`${BASE}${path}`, opts).then(r => r.json());

// function statusColor(s) {
//   if (s === "present") return "#00ffaa";
//   if (s === "late")    return "#f59e0b";
//   return "#ff4466";
// }
// function statusBg(s) {
//   if (s === "present") return "rgba(0,255,170,.10)";
//   if (s === "late")    return "rgba(245,158,11,.10)";
//   return "rgba(255,68,102,.10)";
// }

// // ─── PDF EXPORT ─────────────────────────────────────────────────────────────
// function exportPDF(session, records) {
//   // Build a printable HTML page and trigger window.print from a new tab
//   const rows = records.map(r => `
//     <tr>
//       <td>${r.student_name}</td>
//       <td>${r.matricule ?? "—"}</td>
//       <td style="color:${statusColor(r.status)};font-weight:700">${r.status.toUpperCase()}</td>
//       <td>${r.timestamp ? new Date(r.timestamp).toLocaleTimeString("fr-FR") : "—"}</td>
//     </tr>`).join("");

//   const html = `<!DOCTYPE html>
// <html lang="fr">
// <head>
//   <meta charset="UTF-8"/>
//   <title>Feuille de présence — ${session.course_name}</title>
//   <style>
//     @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700&display=swap');
//     body { font-family: Syne, sans-serif; margin: 40px; color: #0a0a0a; }
//     h1 { font-size: 22px; margin-bottom: 4px; }
//     .meta { font-size: 13px; color: #555; margin-bottom: 24px; }
//     table { width: 100%; border-collapse: collapse; }
//     th { background: #050a0f; color: #fff; padding: 10px 14px; text-align: left; font-size: 13px; }
//     td { padding: 9px 14px; border-bottom: 1px solid #eee; font-size: 13px; }
//     tr:last-child td { border-bottom: none; }
//     .footer { margin-top: 40px; font-size: 11px; color: #aaa; }
//   </style>
// </head>
// <body>
//   <h1>Feuille de présence — ${session.course_name}</h1>
//   <div class="meta">
//     Groupe&nbsp;: <b>${session.group_name}</b> &nbsp;|&nbsp;
//     Salle&nbsp;: <b>${session.classroom}</b> &nbsp;|&nbsp;
//     Date&nbsp;: <b>${new Date(session.session_date).toLocaleDateString("fr-FR")}</b>
//   </div>
//   <table>
//     <thead><tr><th>Nom</th><th>Matricule</th><th>Statut</th><th>Heure</th></tr></thead>
//     <tbody>${rows}</tbody>
//   </table>
//   <div class="footer">Généré automatiquement — Système de présence par reconnaissance faciale — Université Ain Témouchent</div>
//   <script>window.onload=()=>{ window.print(); }</script>
// </body>
// </html>`;

//   const w = window.open("", "_blank");
//   w.document.write(html);
//   w.document.close();
// }

// // ─── PULSE DOT ──────────────────────────────────────────────────────────────
// function PulseDot({ color }) {
//   return (
//     <span style={{ position:"relative", display:"inline-block", width:10, height:10, marginRight:8 }}>
//       <span style={{
//         position:"absolute", inset:0, borderRadius:"50%",
//         background: color, opacity:.4,
//         animation: "pulse 1.6s ease-out infinite"
//       }}/>
//       <span style={{
//         position:"absolute", inset:2, borderRadius:"50%",
//         background: color
//       }}/>
//     </span>
//   );
// }

// // ─── COUNTER CARD ───────────────────────────────────────────────────────────
// function CountCard({ label, value, color, total }) {
//   const pct = total > 0 ? Math.round((value / total) * 100) : 0;
//   return (
//     <div style={{
//       background: "#0d1117",
//       border: `1px solid ${color}22`,
//       borderRadius: 12,
//       padding: "20px 24px",
//       flex: 1,
//       minWidth: 120,
//       position: "relative",
//       overflow: "hidden",
//     }}>
//       {/* glow bar */}
//       <div style={{
//         position:"absolute", bottom:0, left:0,
//         height: 3,
//         width: `${pct}%`,
//         background: color,
//         borderRadius: "0 2px 2px 0",
//         transition: "width .6s ease",
//         boxShadow: `0 0 12px ${color}`
//       }}/>
//       <div style={{ fontFamily:"'DM Mono', monospace", fontSize:38, fontWeight:700, color, lineHeight:1 }}>
//         {value}
//       </div>
//       <div style={{ fontFamily:"Syne, sans-serif", fontSize:12, color:"#4a5568", marginTop:6, textTransform:"uppercase", letterSpacing:2 }}>
//         {label}
//       </div>
//       <div style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:`${color}88`, marginTop:4 }}>
//         {pct}%
//       </div>
//     </div>
//   );
// }

// // ─── ATTENDANCE ROW ─────────────────────────────────────────────────────────
// function AttendanceRow({ record, index }) {
//   const [visible, setVisible] = useState(false);
//   useEffect(() => {
//     const t = setTimeout(() => setVisible(true), index * 40);
//     return () => clearTimeout(t);
//   }, [index]);

//   return (
//     <div style={{
//       display:"grid", gridTemplateColumns:"1fr 140px 110px 100px",
//       alignItems:"center",
//       padding:"12px 20px",
//       borderBottom:"1px solid #0f1923",
//       background: visible ? "transparent" : "#0d1117",
//       opacity: visible ? 1 : 0,
//       transform: visible ? "translateY(0)" : "translateY(8px)",
//       transition:"all .3s ease",
//     }}>
//       <div style={{ fontFamily:"Syne, sans-serif", fontSize:14, color:"#e2e8f0" }}>
//         {record.student_name}
//       </div>
//       <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:"#4a5568" }}>
//         {record.matricule ?? "—"}
//       </div>
//       <div>
//         <span style={{
//           fontFamily:"'DM Mono', monospace", fontSize:11, fontWeight:700,
//           letterSpacing:1.5, textTransform:"uppercase",
//           color: statusColor(record.status),
//           background: statusBg(record.status),
//           padding:"3px 10px", borderRadius:20,
//         }}>
//           {record.status}
//         </span>
//       </div>
//       <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:"#4a5568", textAlign:"right" }}>
//         {record.timestamp ? new Date(record.timestamp).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" }) : "—"}
//       </div>
//     </div>
//   );
// }

// // ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
// export default function TeacherDashboard() {
//   const [classroom, setClassroom] = useState("A7");
//   const [session, setSession]     = useState(null);
//   const [records, setRecords]     = useState([]);
//   const [loading, setLoading]     = useState(false);
//   const [lastRefresh, setLastRefresh] = useState(null);
//   const [error, setError]         = useState(null);
//   const intervalRef = useRef(null);

//   const classrooms = ["Amphi 1","A7","A8","A9","A10","A14","B5","à distance"];

//   // ── fetch active session + attendance ──────────────────────────────────
//   const fetchData = useCallback(async () => {
//     try {
//       setError(null);
//       const sess = await api(`/attendance/active-session?classroom=${encodeURIComponent(classroom)}`);

//       if (!sess || !sess.session_id) {
//         setSession(null);
//         setRecords([]);
//         return;
//       }

//       setSession(sess);

//       // fetch attendance for this session
//       const att = await api(`/attendance/session/${sess.session_id}`);
//       setRecords(Array.isArray(att) ? att : []);
//       setLastRefresh(new Date());
//     } catch (e) {
//       setError("Impossible de contacter le serveur.");
//     }
//   }, [classroom]);

//   // ── auto-refresh every 10s ─────────────────────────────────────────────
//   useEffect(() => {
//     setLoading(true);
//     fetchData().finally(() => setLoading(false));
//     intervalRef.current = setInterval(fetchData, 10000);
//     return () => clearInterval(intervalRef.current);
//   }, [fetchData]);

//   // ── computed stats ─────────────────────────────────────────────────────
//   const present  = records.filter(r => r.status === "present").length;
//   const late     = records.filter(r => r.status === "late").length;
//   const absent   = records.filter(r => r.status === "absent").length;
//   const total    = records.length;

//   // at-risk: students with status absent OR late
//   const atRisk   = records.filter(r => r.status === "absent" || r.status === "late");

//   return (
//     <>
//       {/* ── global styles ── */}
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
//         body { background:#050a0f; color:#e2e8f0; }
//         @keyframes pulse {
//           0%   { transform:scale(1);   opacity:.5; }
//           70%  { transform:scale(2.4); opacity:0;  }
//           100% { transform:scale(1);   opacity:0;  }
//         }
//         @keyframes spin {
//           to { transform: rotate(360deg); }
//         }
//         ::-webkit-scrollbar { width:4px; }
//         ::-webkit-scrollbar-track { background:#0d1117; }
//         ::-webkit-scrollbar-thumb { background:#1e2d3d; border-radius:2px; }
//       `}</style>

//       <div style={{
//         minHeight:"100vh", background:"#050a0f",
//         fontFamily:"Syne, sans-serif",
//         padding:"32px 24px",
//         maxWidth: 960,
//         margin:"0 auto",
//       }}>

//         {/* ── HEADER ── */}
//         <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:32, flexWrap:"wrap", gap:16 }}>
//           <div>
//             <div style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"#7dd3fc", letterSpacing:4, textTransform:"uppercase", marginBottom:8 }}>
//               Université Ain Témouchent — L3 INFO
//             </div>
//             <h1 style={{ fontSize:28, fontWeight:800, color:"#f0f6fc", lineHeight:1.1 }}>
//               Tableau de bord
//             </h1>
//             <h2 style={{ fontSize:14, fontWeight:400, color:"#4a5568", marginTop:4 }}>
//               Enseignant — Suivi de présence en temps réel
//             </h2>
//           </div>

//           {/* classroom selector */}
//           <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
//             {classrooms.map(c => (
//               <button key={c} onClick={() => setClassroom(c)} style={{
//                 fontFamily:"'DM Mono', monospace", fontSize:11,
//                 padding:"6px 14px", borderRadius:6,
//                 border: classroom === c ? "1px solid #7dd3fc" : "1px solid #1e2d3d",
//                 background: classroom === c ? "rgba(125,211,252,.12)" : "transparent",
//                 color: classroom === c ? "#7dd3fc" : "#4a5568",
//                 cursor:"pointer", transition:"all .2s",
//                 letterSpacing:1,
//               }}>
//                 {c}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* ── SESSION BANNER ── */}
//         {session ? (
//           <div style={{
//             background:"#0d1117",
//             border:"1px solid #1e2d3d",
//             borderRadius:12,
//             padding:"16px 20px",
//             marginBottom:24,
//             display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12,
//           }}>
//             <div style={{ display:"flex", alignItems:"center", gap:12 }}>
//               <PulseDot color="#00ffaa" />
//               <div>
//                 <div style={{ fontFamily:"Syne", fontWeight:700, fontSize:16, color:"#e2e8f0" }}>
//                   {session.course_name}
//                 </div>
//                 <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:"#4a5568", marginTop:2 }}>
//                   {session.group_name} — Salle {session.classroom}
//                   {session.teacher_name && ` — ${session.teacher_name}`}
//                 </div>
//               </div>
//             </div>
//             <div style={{ display:"flex", gap:10, alignItems:"center" }}>
//               {lastRefresh && (
//                 <span style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"#2d3748" }}>
//                   màj {lastRefresh.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
//                 </span>
//               )}
//               <button onClick={fetchData} style={{
//                 fontFamily:"'DM Mono', monospace", fontSize:11,
//                 padding:"6px 14px", borderRadius:6,
//                 border:"1px solid #1e2d3d", background:"transparent",
//                 color:"#4a5568", cursor:"pointer",
//               }}>
//                 ↺ Actualiser
//               </button>
//               <button onClick={() => exportPDF(session, records)} style={{
//                 fontFamily:"Syne", fontWeight:700, fontSize:12,
//                 padding:"7px 18px", borderRadius:6,
//                 border:"none",
//                 background:"linear-gradient(135deg,#7dd3fc,#38bdf8)",
//                 color:"#050a0f", cursor:"pointer",
//                 boxShadow:"0 0 18px rgba(125,211,252,.25)",
//               }}>
//                 ↓ PDF
//               </button>
//             </div>
//           </div>
//         ) : (
//           <div style={{
//             background:"#0d1117", border:"1px solid #1e2d3d",
//             borderRadius:12, padding:"20px", marginBottom:24,
//             display:"flex", alignItems:"center", gap:12,
//           }}>
//             <span style={{ width:10, height:10, borderRadius:"50%", background:"#ff4466", display:"inline-block" }}/>
//             <span style={{ fontFamily:"'DM Mono', monospace", fontSize:13, color:"#4a5568" }}>
//               Aucune session active — salle <b style={{color:"#e2e8f0"}}>{classroom}</b>
//             </span>
//           </div>
//         )}

//         {/* ── STAT CARDS ── */}
//         {session && (
//           <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
//             <CountCard label="Présents"  value={present} color="#00ffaa" total={total} />
//             <CountCard label="En retard" value={late}    color="#f59e0b" total={total} />
//             <CountCard label="Absents"   value={absent}  color="#ff4466" total={total} />
//             <CountCard label="Total"     value={total}   color="#7dd3fc" total={total} />
//           </div>
//         )}

//         {/* ── MAIN CONTENT ── */}
//         {session && (
//           <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:16 }}>

//             {/* LIVE TABLE */}
//             <div style={{
//               background:"#0d1117", border:"1px solid #1e2d3d",
//               borderRadius:12, overflow:"hidden",
//             }}>
//               {/* table header */}
//               <div style={{
//                 display:"grid", gridTemplateColumns:"1fr 140px 110px 100px",
//                 padding:"10px 20px",
//                 borderBottom:"1px solid #1e2d3d",
//                 fontFamily:"'DM Mono', monospace", fontSize:11,
//                 color:"#2d3748", textTransform:"uppercase", letterSpacing:2,
//               }}>
//                 <span>Étudiant</span>
//                 <span>Matricule</span>
//                 <span>Statut</span>
//                 <span style={{textAlign:"right"}}>Heure</span>
//               </div>

//               {loading && records.length === 0 ? (
//                 <div style={{ padding:40, textAlign:"center" }}>
//                   <div style={{
//                     width:24, height:24, border:"2px solid #1e2d3d",
//                     borderTopColor:"#7dd3fc", borderRadius:"50%",
//                     animation:"spin .8s linear infinite",
//                     margin:"0 auto 12px",
//                   }}/>
//                   <span style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:"#2d3748" }}>Chargement…</span>
//                 </div>
//               ) : records.length === 0 ? (
//                 <div style={{ padding:40, textAlign:"center", fontFamily:"'DM Mono', monospace", fontSize:13, color:"#2d3748" }}>
//                   Aucun étudiant enregistré pour cette session
//                 </div>
//               ) : (
//                 <div style={{ maxHeight:400, overflowY:"auto" }}>
//                   {records.map((r, i) => <AttendanceRow key={r.student_id ?? i} record={r} index={i} />)}
//                 </div>
//               )}
//             </div>

//             {/* AT-RISK PANEL */}
//             {atRisk.length > 0 && (
//               <div style={{
//                 background:"#0d1117", border:"1px solid #ff446622",
//                 borderRadius:12, overflow:"hidden",
//               }}>
//                 <div style={{
//                   padding:"12px 20px",
//                   borderBottom:"1px solid #ff446618",
//                   display:"flex", alignItems:"center", gap:10,
//                 }}>
//                   <PulseDot color="#ff4466" />
//                   <span style={{ fontFamily:"Syne", fontWeight:700, fontSize:13, color:"#ff4466", textTransform:"uppercase", letterSpacing:2 }}>
//                     Étudiants à risque ({atRisk.length})
//                   </span>
//                 </div>
//                 <div style={{ padding:"8px 0" }}>
//                   {atRisk.map((r, i) => (
//                     <div key={r.student_id ?? i} style={{
//                       display:"flex", alignItems:"center", justifyContent:"space-between",
//                       padding:"10px 20px",
//                       borderBottom: i < atRisk.length-1 ? "1px solid #0f1923" : "none",
//                     }}>
//                       <div>
//                         <div style={{ fontFamily:"Syne", fontSize:14, color:"#e2e8f0" }}>{r.student_name}</div>
//                         <div style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"#4a5568", marginTop:2 }}>{r.matricule ?? "—"}</div>
//                       </div>
//                       <span style={{
//                         fontFamily:"'DM Mono', monospace", fontSize:11, fontWeight:700,
//                         letterSpacing:1.5, textTransform:"uppercase",
//                         color: statusColor(r.status),
//                         background: statusBg(r.status),
//                         padding:"3px 10px", borderRadius:20,
//                       }}>
//                         {r.status}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//           </div>
//         )}

//         {/* ERROR */}
//         {error && (
//           <div style={{
//             marginTop:16, padding:"12px 16px", borderRadius:8,
//             background:"rgba(255,68,102,.08)", border:"1px solid #ff446622",
//             fontFamily:"'DM Mono', monospace", fontSize:12, color:"#ff4466",
//           }}>
//             {error}
//           </div>
//         )}

//       </div>
//     </>
//   );
// }

import { useState, useEffect, useRef, useCallback } from "react";

const SERVER_IP = "localhost";
const BASE = `http://${SERVER_IP}:8000`;
const api = (path) => fetch(`${BASE}${path}`).then(r => r.json());

const CLASSROOMS = ["Amphi 1","A7","A8","A9","A10","A14","B5","à distance"];

function statusStyle(s) {
  if (s === "present") return { color: "#1a6b3c", background: "#eaf3de" };
  if (s === "late")    return { color: "#854f0b", background: "#faeeda" };
  return                      { color: "#a32d2d", background: "#fcebeb" };
}

function exportPDF(session, records) {
  const rows = records.map(r => `
    <tr>
      <td>${r.student_name}</td>
      <td style="color:#888">${r.matricule ?? "—"}</td>
      <td style="font-weight:600;color:${r.status==="present"?"#1a6b3c":r.status==="late"?"#854f0b":"#a32d2d"}">${r.status}</td>
      <td style="color:#888">${r.timestamp ? new Date(r.timestamp).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "—"}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
    <title>Présence — ${session.course_name}</title>
    <style>body{font-family:system-ui,sans-serif;margin:48px;color:#111}h1{font-size:20px;font-weight:600;margin-bottom:4px}.meta{font-size:13px;color:#666;margin-bottom:32px}table{width:100%;border-collapse:collapse}th{font-size:12px;text-align:left;color:#888;padding:8px 12px;border-bottom:1px solid #e5e5e5;font-weight:500}td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px}.footer{margin-top:48px;font-size:11px;color:#bbb}</style>
    </head><body>
    <h1>${session.course_name}</h1>
    <div class="meta">${session.group_name} &nbsp;·&nbsp; Salle ${session.classroom} &nbsp;·&nbsp; ${new Date(session.session_date).toLocaleDateString("fr-FR")}</div>
    <table><thead><tr><th>Nom</th><th>Matricule</th><th>Statut</th><th>Heure</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="footer">Système de présence — Université Ain Témouchent</div>
    <script>window.onload=()=>window.print()<\/script></body></html>`;
  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
}

export default function TeacherDashboard() {
  const [classroom, setClassroom] = useState("A7");
  const [session,   setSession]   = useState(null);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error,     setError]     = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const sess = await api(`/attendance/active-session?classroom=${encodeURIComponent(classroom)}`);
      if (!sess?.session_id) { setSession(null); setRecords([]); return; }
      setSession(sess);
      const att = await api(`/attendance/session/${sess.session_id}`);
      setRecords(Array.isArray(att) ? att : []);
      setLastRefresh(new Date());
    } catch { setError("Impossible de contacter le serveur."); }
  }, [classroom]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchData, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  const present = records.filter(r => r.status === "present").length;
  const late    = records.filter(r => r.status === "late").length;
  const absent  = records.filter(r => r.status === "absent").length;
  const atRisk  = records.filter(r => r.status !== "present");

  return (
    <div style={{ minHeight:"100vh", background:"#fafafa", fontFamily:"system-ui, -apple-system, sans-serif" }}>

      {/* top bar */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e8e8e8", padding:"0 32px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#111", letterSpacing:"-0.01em" }}>Présence</span>
          <span style={{ fontSize:13, color:"#bbb" }}>/</span>
          <span style={{ fontSize:13, color:"#888" }}>Enseignant</span>
        </div>
        {lastRefresh && (
          <span style={{ fontSize:12, color:"#bbb", fontVariantNumeric:"tabular-nums" }}>
            màj {lastRefresh.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
          </span>
        )}
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"32px 24px" }}>

        {/* classroom tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:32, flexWrap:"wrap" }}>
          {CLASSROOMS.map(c => (
            <button key={c} onClick={() => setClassroom(c)} style={{
              fontSize:12, padding:"5px 12px", borderRadius:6,
              border: classroom === c ? "1px solid #111" : "1px solid #e8e8e8",
              background: classroom === c ? "#111" : "#fff",
              color: classroom === c ? "#fff" : "#888",
              cursor:"pointer", fontFamily:"inherit",
            }}>{c}</button>
          ))}
        </div>

        {/* error */}
        {error && (
          <div style={{ padding:"10px 14px", background:"#fcebeb", borderRadius:8, fontSize:13, color:"#a32d2d", marginBottom:20 }}>
            {error}
          </div>
        )}

        {/* no session */}
        {!loading && !session && !error && (
          <div style={{ padding:"40px 0", textAlign:"center" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#e5e5e5", display:"inline-block", marginBottom:16 }}/>
            <p style={{ fontSize:14, color:"#aaa", margin:0 }}>Aucune session active — salle <b style={{color:"#888",fontWeight:500}}>{classroom}</b></p>
          </div>
        )}

        {/* session active */}
        {session && (
          <>
            {/* session header */}
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:"#1a6b3c", display:"inline-block" }}/>
                  <span style={{ fontSize:11, color:"#1a6b3c", fontWeight:500, letterSpacing:"0.04em" }}>SESSION ACTIVE</span>
                </div>
                <h1 style={{ fontSize:22, fontWeight:600, color:"#111", margin:"0 0 4px", letterSpacing:"-0.02em" }}>
                  {session.course_name}
                </h1>
                <p style={{ fontSize:13, color:"#aaa", margin:0 }}>
                  {session.group_name} · Salle {session.classroom}
                  {session.teacher_name ? ` · ${session.teacher_name}` : ""}
                </p>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={fetchData} style={{
                  fontSize:12, padding:"7px 14px", borderRadius:6,
                  border:"1px solid #e8e8e8", background:"#fff",
                  color:"#888", cursor:"pointer", fontFamily:"inherit",
                }}>Actualiser</button>
                <button onClick={() => exportPDF(session, records)} style={{
                  fontSize:12, padding:"7px 14px", borderRadius:6,
                  border:"1px solid #111", background:"#111",
                  color:"#fff", cursor:"pointer", fontFamily:"inherit",
                }}>Exporter PDF</button>
              </div>
            </div>

            {/* stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, marginBottom:24 }}>
              {[
                { label:"Présents",  value:present, ...statusStyle("present") },
                { label:"En retard", value:late,    ...statusStyle("late")    },
                { label:"Absents",   value:absent,  ...statusStyle("absent")  },
              ].map(s => (
                <div key={s.label} style={{
                  background:"#fff", border:"1px solid #e8e8e8", borderRadius:10,
                  padding:"16px 20px",
                }}>
                  <div style={{ fontSize:28, fontWeight:600, color:s.color, letterSpacing:"-0.03em", lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:12, color:"#aaa", marginTop:6, fontWeight:500 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* attendance table */}
            <div style={{ background:"#fff", border:"1px solid #e8e8e8", borderRadius:10, overflow:"hidden", marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 140px 90px 70px", padding:"10px 20px", borderBottom:"1px solid #f0f0f0" }}>
                {["Étudiant","Matricule","Statut","Heure"].map((h,i) => (
                  <span key={h} style={{ fontSize:11, color:"#bbb", fontWeight:500, letterSpacing:"0.04em", textAlign: i===3 ? "right" : "left" }}>{h.toUpperCase()}</span>
                ))}
              </div>

              {loading ? (
                <div style={{ padding:"32px", textAlign:"center", fontSize:13, color:"#ccc" }}>Chargement…</div>
              ) : records.length === 0 ? (
                <div style={{ padding:"32px", textAlign:"center", fontSize:13, color:"#ccc" }}>Aucun étudiant enregistré</div>
              ) : (
                records.map((r, i) => {
                  const st = statusStyle(r.status);
                  return (
                    <div key={r.student_id ?? i} style={{
                      display:"grid", gridTemplateColumns:"1fr 140px 90px 70px",
                      alignItems:"center", padding:"11px 20px",
                      borderBottom: i < records.length-1 ? "1px solid #f7f7f7" : "none",
                    }}>
                      <span style={{ fontSize:13, color:"#111", fontWeight:500 }}>{r.student_name}</span>
                      <span style={{ fontSize:12, color:"#bbb", fontVariantNumeric:"tabular-nums" }}>{r.matricule ?? "—"}</span>
                      <span>
                        <span style={{
                          fontSize:11, fontWeight:500, padding:"3px 8px", borderRadius:4,
                          background: st.background, color: st.color, letterSpacing:"0.02em",
                        }}>{r.status}</span>
                      </span>
                      <span style={{ fontSize:12, color:"#bbb", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>
                        {r.timestamp ? new Date(r.timestamp).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "—"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* at-risk */}
            {atRisk.length > 0 && (
              <div style={{ background:"#fff", border:"1px solid #e8e8e8", borderRadius:10, overflow:"hidden" }}>
                <div style={{ padding:"12px 20px", borderBottom:"1px solid #f0f0f0", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:11, color:"#a32d2d", fontWeight:500, letterSpacing:"0.04em" }}>À RISQUE</span>
                  <span style={{ fontSize:11, color:"#bbb" }}>{atRisk.length} étudiant{atRisk.length>1?"s":""}</span>
                </div>
                {atRisk.map((r, i) => {
                  const st = statusStyle(r.status);
                  return (
                    <div key={r.student_id ?? i} style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"11px 20px",
                      borderBottom: i < atRisk.length-1 ? "1px solid #f7f7f7" : "none",
                    }}>
                      <div>
                        <div style={{ fontSize:13, color:"#111", fontWeight:500 }}>{r.student_name}</div>
                        <div style={{ fontSize:12, color:"#bbb", marginTop:2 }}>{r.matricule ?? "—"}</div>
                      </div>
                      <span style={{
                        fontSize:11, fontWeight:500, padding:"3px 8px", borderRadius:4,
                        background: st.background, color: st.color,
                      }}>{r.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}