import { useState, useRef, useEffect } from "react";

const SUPABASE_URL = "https://xyezjpubmveizkzqbxue.supabase.co";
const SUPABASE_KEY = "sb_publishable_lmRXMFg_FO5W0J8uHXnANA_Tk2SR8ed";

const GENRES = ["Ballet", "Jazz", "Hip Hop", "Contemporary", "Tap", "Lyrical", "Acrobatics", "Musical Theatre", "Latin", "Ballroom", "Modern", "African"];

// ── Supabase helpers ──────────────────────────────────────────────
const db = {
  async get(table, filters = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filters}&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" }
    });
    return res.json();
  },
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async update(table, id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async uploadFile(path, file) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/mp3s/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type },
      body: file
    });
    return res.json();
  },
  fileUrl(path) {
    return `${SUPABASE_URL}/storage/v1/object/public/mp3s/${path}`;
  }
};

// ── Audio bars ────────────────────────────────────────────────────
function AudioBars({ playing }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 14, marginLeft: 6 }}>
      {[10, 16, 8, 14].map((h, i) => (
        <span key={i} style={{
          display: "block", width: 3, borderRadius: 2, background: "#e8c547",
          height: playing ? `${h}px` : "3px",
          animation: playing ? `bar 0.6s ease-in-out ${i * 0.12}s infinite alternate` : "none",
          transition: "height 0.3s",
        }} />
      ))}
      <style>{`@keyframes bar { to { height: 3px; } }`}</style>
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────────
function Spinner({ color = "#e8c547" }) {
  return <span style={{ display: "inline-block", width: 18, height: 18, border: `2px solid ${color}40`, borderTop: `2px solid ${color}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </span>;
}

export default function App() {
  const [portal, setPortal] = useState("home");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // data
  const [studios, setStudios] = useState([]);
  const [dancers, setDancers] = useState([]);
  const [songs, setSongs] = useState([]);

  // teacher
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherAuth, setTeacherAuth] = useState(null);
  const [teacherError, setTeacherError] = useState("");

  // audio
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);

  // admin tab
  const [adminTab, setAdminTab] = useState("dancers");

  // reg form
  const [regForm, setRegForm] = useState({ firstName: "", lastName: "", age: "", studioCode: "", parentEmail: "" });
  const [regStep, setRegStep] = useState(1);
  const [regDone, setRegDone] = useState(false);

  // upload form
  const [uploadForm, setUploadForm] = useState({ dancerId: "", songName: "", genre: "", type: "Solo", groupName: "", file: null, fileName: "" });
  const [uploadDone, setUploadDone] = useState(false);
  const [uploading, setUploading] = useState(false);

  const notify = (msg, color = "#2d6a4f") => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 4000);
  };

  // ── load data ──
  const loadStudios = async () => { const d = await db.get("studios"); if (Array.isArray(d)) setStudios(d); };
  const loadDancers = async () => { const d = await db.get("dancers"); if (Array.isArray(d)) setDancers(d); };
  const loadSongs = async () => { const d = await db.get("songs"); if (Array.isArray(d)) setSongs(d); };

  useEffect(() => { loadStudios(); }, []);
  useEffect(() => { if (portal === "admin") { loadDancers(); loadSongs(); } }, [portal]);
  useEffect(() => { if (teacherAuth) { loadDancers(); loadSongs(); } }, [teacherAuth]);

  // ── audio ──
  useEffect(() => {
    if (!audioRef.current) return;
    if (playingUrl) { audioRef.current.src = playingUrl; audioRef.current.play().catch(() => {}); }
    else { audioRef.current.pause(); audioRef.current.src = ""; }
  }, [playingUrl]);

  const togglePlay = (url) => setPlayingUrl(prev => prev === url ? null : url);

  // ── studio code validation ──
  const studioFromCode = (code) => studios.find(s => s.code === code.toUpperCase());

  // ── SUBMIT REGISTRATION ──
  const submitReg = async () => {
    const studio = studioFromCode(regForm.studioCode);
    if (!studio) { notify("Invalid studio code. Please check with your studio.", "#c0392b"); return; }
    setLoading(true);
    const result = await db.insert("dancers", {
      first_name: regForm.firstName,
      last_name: regForm.lastName,
      age: parseInt(regForm.age),
      parent_email: regForm.parentEmail,
      studio_code: studio.code,
      studio_name: studio.name,
      status: "pending"
    });
    setLoading(false);
    if (Array.isArray(result) && result[0]) { setRegDone(true); }
    else { notify("Something went wrong. Please try again.", "#c0392b"); }
  };

  // ── SUBMIT SONG UPLOAD ──
  const submitUpload = async () => {
    if (!uploadForm.dancerId || !uploadForm.songName || !uploadForm.genre || !uploadForm.file) {
      notify("Please fill all fields and select an MP3 file", "#c0392b"); return;
    }
    setUploading(true);
    const dancer = studioDancers.find(d => d.id === uploadForm.dancerId);
    const filePath = `${teacherAuth.code}/${dancer.id}_${Date.now()}_${uploadForm.file.name}`;
    const uploaded = await db.uploadFile(filePath, uploadForm.file);
    if (uploaded.error) { notify("File upload failed. Check file size (max 50MB) and try again.", "#c0392b"); setUploading(false); return; }
    const songResult = await db.insert("songs", {
      dancer_id: dancer.id,
      dancer_name: `${dancer.first_name} ${dancer.last_name}`,
      studio_code: teacherAuth.code,
      studio_name: teacherAuth.name,
      song_name: uploadForm.songName,
      genre: uploadForm.genre,
      performance_type: uploadForm.type,
      group_name: uploadForm.groupName || null,
      file_name: uploadForm.file.name,
      file_path: filePath,
    });
    setUploading(false);
    if (Array.isArray(songResult) && songResult[0]) {
      setSongs(prev => [...prev, songResult[0]]);
      setUploadDone(true);
      notify("✓ Song uploaded successfully!");
    } else { notify("Song record failed to save. Please try again.", "#c0392b"); }
  };

  // ── APPROVE DANCER ──
  const approveDancer = async (dancer) => {
    const result = await db.update("dancers", dancer.id, { status: "approved" });
    if (Array.isArray(result) && result[0]) {
      setDancers(prev => prev.map(d => d.id === dancer.id ? { ...d, status: "approved" } : d));
      notify(`✓ ${dancer.first_name} ${dancer.last_name} approved!`);
    }
  };

  // ── EXPORT CSV ──
  const exportCSV = (studioCode) => {
    const rows = songs.filter(s => !studioCode || s.studio_code === studioCode);
    if (rows.length === 0) { notify("No songs to export for this studio yet.", "#e8a020"); return; }
    const header = "Dancer Name,Studio,Song Name,Genre,Type,Group Name,File Name,File URL\n";
    const body = rows.map(r => `"${r.dancer_name}","${r.studio_name}","${r.song_name}","${r.genre}","${r.performance_type}","${r.group_name || ""}","${r.file_name}","${db.fileUrl(r.file_path)}"`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = studioCode ? `${studioCode}_registrations.csv` : "grande_national_all.csv";
    a.click();
    notify("✓ Spreadsheet downloaded!");
  };

  const studioDancers = teacherAuth ? dancers.filter(d => d.studio_code === teacherAuth.code && d.status === "approved") : [];

  // ── styles ──
  const S = {
    app: { minHeight: "100vh", background: "#0a0a0a", fontFamily: "'Georgia', serif", color: "#f0ece0", position: "relative" },
    card: { background: "#141414", border: "1px solid #242424", borderRadius: 16, padding: 28 },
    input: { width: "100%", background: "#1c1c1c", border: "1px solid #2e2e2e", borderRadius: 8, padding: "11px 14px", color: "#f0ece0", fontFamily: "Georgia, serif", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color .2s" },
    btn: (color = "#e8c547") => ({ background: color, color: color === "#e8c547" ? "#0a0a0a" : "#fff", border: "none", borderRadius: 8, padding: "12px 28px", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", cursor: "pointer" }),
    btnGhost: (color = "#e8c547") => ({ background: "transparent", color, border: `1px solid ${color}`, borderRadius: 8, padding: "10px 20px", fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer" }),
    label: { display: "block", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#666", marginBottom: 6 },
    tag: (c) => ({ background: `${c}22`, color: c, borderRadius: 20, padding: "3px 11px", fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap" }),
    back: { background: "transparent", color: "#666", border: "1px solid #222", borderRadius: 8, padding: "8px 18px", fontFamily: "Georgia, serif", fontSize: 13, cursor: "pointer", marginBottom: 28 },
  };

  const resetAndGo = (p) => {
    setPortal(p); setRegDone(false); setRegStep(1);
    setRegForm({ firstName: "", lastName: "", age: "", studioCode: "", parentEmail: "" });
    setTeacherAuth(null); setTeacherCode(""); setTeacherError("");
    setUploadDone(false); setUploadForm({ dancerId: "", songName: "", genre: "", type: "Solo", groupName: "", file: null, fileName: "" });
    setPlayingUrl(null);
  };

  // ════════════════════════════════════════════════════════════════
  // HOME
  // ════════════════════════════════════════════════════════════════
  if (portal === "home") return (
    <div style={S.app}>
      <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "56px 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.4em", color: "#e8c547", textTransform: "uppercase", marginBottom: 20 }}>
            ✦ Grande National Dance Competition ✦
          </div>
          <h1 style={{ fontSize: "clamp(42px,9vw,88px)", fontWeight: "normal", margin: 0, lineHeight: 0.95, letterSpacing: "-0.03em" }}>
            Grande<br /><em style={{ color: "#e8c547" }}>National</em>
          </h1>
          <p style={{ color: "#444", marginTop: 20, fontSize: 15, letterSpacing: "0.05em" }}>
            Competition Management Portal
          </p>
        </div>

        {/* Portals */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 40 }}>
          {[
            { icon: "🎭", title: "Dancer Registration", sub: "Parents — register your child for the competition", key: "register", color: "#e8c547" },
            { icon: "🎵", title: "Music Upload", sub: "Teachers — upload songs for your studio's dancers", key: "teacher", color: "#4ecdc4" },
            { icon: "⚡", title: "Admin Dashboard", sub: "Organizers — manage registrations & exports", key: "admin", color: "#ff6b6b" },
          ].map(p => (
            <button key={p.key} onClick={() => resetAndGo(p.key)}
              style={{ ...S.card, cursor: "pointer", textAlign: "left", border: "1px solid #242424", transition: "all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#242424"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ fontSize: 34, marginBottom: 14 }}>{p.icon}</div>
              <div style={{ fontSize: 17, color: p.color, marginBottom: 8 }}>{p.title}</div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{p.sub}</div>
              <div style={{ marginTop: 18, fontSize: 11, color: p.color, letterSpacing: "0.15em" }}>ENTER →</div>
            </button>
          ))}
        </div>

        {/* Stats bar */}
        <div style={{ ...S.card, display: "flex", gap: 0, padding: 0, overflow: "hidden" }}>
          {[
            { label: "Registered Dancers", value: dancers.length || "—", color: "#e8c547" },
            { label: "Songs Uploaded", value: songs.length || "—", color: "#4ecdc4" },
            { label: "Studios", value: studios.length || "—", color: "#ff6b6b" },
            { label: "Pending Approval", value: dancers.filter(d => d.status === "pending").length || "0", color: "#a8e6cf" },
          ].map((stat, i) => (
            <div key={stat.label} style={{ flex: 1, padding: "20px 24px", borderRight: i < 3 ? "1px solid #1e1e1e" : "none", textAlign: "center" }}>
              <div style={{ fontSize: 30, color: stat.color, fontStyle: "italic" }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: "#444", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
      {notification && <Toast msg={notification.msg} color={notification.color} />}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // REGISTRATION
  // ════════════════════════════════════════════════════════════════
  if (portal === "register") return (
    <div style={S.app}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>
        <button style={S.back} onClick={() => resetAndGo("home")}>← Back</button>
        <div style={{ fontSize: 10, letterSpacing: "0.35em", color: "#e8c547", textTransform: "uppercase", marginBottom: 10 }}>Grande National</div>
        <h2 style={{ fontSize: 30, fontWeight: "normal", margin: "0 0 28px" }}>Dancer Registration</h2>

        {regDone ? (
          <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 22, color: "#e8c547", marginBottom: 14 }}>Registration Submitted!</div>
            <p style={{ color: "#666", lineHeight: 1.7, fontSize: 14 }}>
              Your dancer is <strong style={{ color: "#f0ece0" }}>pending admin approval</strong>.<br />
              Once approved, your studio teacher will upload the performance song.
            </p>
            <button onClick={() => { setRegDone(false); setRegStep(1); setRegForm({ firstName: "", lastName: "", age: "", studioCode: "", parentEmail: "" }); }}
              style={{ ...S.btn(), marginTop: 24 }}>Register Another Dancer</button>
          </div>
        ) : (
          <div style={S.card}>
            {/* progress */}
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              {[1, 2].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: regStep >= i ? "#e8c547" : "#222", transition: "background .3s" }} />)}
            </div>

            {regStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div><label style={S.label}>First Name *</label><input style={S.input} value={regForm.firstName} onChange={e => setRegForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Sofia" /></div>
                  <div><label style={S.label}>Last Name *</label><input style={S.input} value={regForm.lastName} onChange={e => setRegForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Martini" /></div>
                </div>
                <div><label style={S.label}>Age *</label><input style={S.input} type="number" min="3" max="25" value={regForm.age} onChange={e => setRegForm(p => ({ ...p, age: e.target.value }))} placeholder="10" /></div>
                <div><label style={S.label}>Parent / Guardian Email *</label><input style={S.input} type="email" value={regForm.parentEmail} onChange={e => setRegForm(p => ({ ...p, parentEmail: e.target.value }))} placeholder="parent@email.com" /></div>
                <button style={S.btn()} onClick={() => {
                  if (!regForm.firstName || !regForm.lastName || !regForm.age || !regForm.parentEmail) { notify("Please fill in all fields", "#c0392b"); return; }
                  setRegStep(2);
                }}>Next →</button>
              </div>
            )}

            {regStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={S.label}>Studio Code *</label>
                  <input style={S.input} value={regForm.studioCode} onChange={e => setRegForm(p => ({ ...p, studioCode: e.target.value.toUpperCase() }))} placeholder="e.g. LEAP-JOY" />
                  <div style={{ fontSize: 12, color: "#444", marginTop: 6 }}>Ask your studio teacher for this code</div>
                  {regForm.studioCode.length > 3 && (() => {
                    const found = studioFromCode(regForm.studioCode);
                    return found
                      ? <div style={{ marginTop: 8, padding: "8px 12px", background: "#e8c54718", borderRadius: 8, fontSize: 13, color: "#e8c547" }}>✓ {found.name}</div>
                      : <div style={{ marginTop: 8, padding: "8px 12px", background: "#c0392b18", borderRadius: 8, fontSize: 13, color: "#e74c3c" }}>✗ Code not recognised</div>;
                  })()}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={S.btnGhost()} onClick={() => setRegStep(1)}>← Back</button>
                  <button style={{ ...S.btn(), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }} onClick={submitReg} disabled={loading}>
                    {loading ? <><Spinner color="#0a0a0a" /> Submitting...</> : "Submit Registration"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {notification && <Toast msg={notification.msg} color={notification.color} />}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // TEACHER PORTAL
  // ════════════════════════════════════════════════════════════════
  if (portal === "teacher") return (
    <div style={S.app}>
      <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px" }}>
        <button style={S.back} onClick={() => resetAndGo("home")}>← Back</button>
        <div style={{ fontSize: 10, letterSpacing: "0.35em", color: "#4ecdc4", textTransform: "uppercase", marginBottom: 10 }}>Teacher Portal</div>
        <h2 style={{ fontSize: 30, fontWeight: "normal", margin: "0 0 28px" }}>Music Upload</h2>

        {!teacherAuth ? (
          <div style={S.card}>
            <label style={S.label}>Enter Your Studio Code</label>
            <input style={S.input} value={teacherCode} onChange={e => { setTeacherCode(e.target.value.toUpperCase()); setTeacherError(""); }} placeholder="e.g. LEAP-JOY" />
            {teacherError && <div style={{ color: "#e74c3c", fontSize: 13, marginTop: 8 }}>{teacherError}</div>}
            <button style={{ ...S.btn("#4ecdc4"), marginTop: 20, color: "#0a0a0a" }} onClick={async () => {
              setLoading(true);
              await loadStudios();
              setLoading(false);
              const found = studios.find(s => s.code === teacherCode) || studioFromCode(teacherCode);
              if (found) setTeacherAuth({ code: found.code, name: found.name });
              else setTeacherError("Studio code not found. Please check and try again.");
            }}>
              {loading ? <Spinner color="#0a0a0a" /> : "Access Studio →"}
            </button>
          </div>
        ) : (
          <div>
            {/* Studio header */}
            <div style={{ ...S.card, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#4ecdc4", textTransform: "uppercase" }}>Logged in as</div>
                <div style={{ fontSize: 20, marginTop: 4 }}>{teacherAuth.name}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, color: "#e8c547", fontStyle: "italic" }}>
                  {studioDancers.filter(d => songs.some(s => s.dancer_id === d.id)).length}/{studioDancers.length}
                </div>
                <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.1em" }}>Songs uploaded</div>
              </div>
            </div>

            {/* Dancer list */}
            <div style={{ ...S.card, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>Your Approved Dancers</div>
              {studioDancers.length === 0 ? (
                <div style={{ color: "#444", fontSize: 14, fontStyle: "italic" }}>No approved dancers yet — registrations are pending admin approval.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {studioDancers.map(d => {
                    const song = songs.find(s => s.dancer_id === d.id);
                    const url = song?.file_path ? db.fileUrl(song.file_path) : null;
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#1c1c1c", borderRadius: 10, border: "1px solid #222" }}>
                        <div>
                          <div style={{ fontWeight: "bold" }}>{d.first_name} {d.last_name} <span style={{ fontSize: 12, color: "#444" }}>· age {d.age}</span></div>
                          {song && <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>{song.song_name} · {song.genre} · {song.performance_type}</div>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {song && url ? (
                            <>
                              <button onClick={() => togglePlay(url)} style={{ background: "#4ecdc418", border: "none", borderRadius: 6, padding: "6px 12px", color: "#4ecdc4", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center" }}>
                                {playingUrl === url ? "⏸" : "▶"} <AudioBars playing={playingUrl === url} />
                              </button>
                              <span style={S.tag("#4ecdc4")}>✓ Uploaded</span>
                            </>
                          ) : (
                            <span style={S.tag("#e8c547")}>⏳ Needs song</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upload form */}
            {uploadDone ? (
              <div style={{ ...S.card, textAlign: "center", padding: 36 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🎵</div>
                <div style={{ fontSize: 20, color: "#4ecdc4", marginBottom: 8 }}>Song uploaded successfully!</div>
                <p style={{ color: "#555", fontSize: 13 }}>The admin can now review and play this track.</p>
                <button onClick={() => { setUploadDone(false); setUploadForm({ dancerId: "", songName: "", genre: "", type: "Solo", groupName: "", file: null, fileName: "" }); }}
                  style={{ ...S.btn("#4ecdc4"), color: "#0a0a0a", marginTop: 20 }}>Upload Another Song</button>
              </div>
            ) : (
              <div style={S.card}>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 18, letterSpacing: "0.1em", textTransform: "uppercase" }}>Upload a Song</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={S.label}>Dancer *</label>
                    <select style={S.input} value={uploadForm.dancerId} onChange={e => setUploadForm(p => ({ ...p, dancerId: e.target.value }))}>
                      <option value="">Select dancer...</option>
                      {studioDancers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div><label style={S.label}>Song Name *</label><input style={S.input} value={uploadForm.songName} onChange={e => setUploadForm(p => ({ ...p, songName: e.target.value }))} placeholder="Swan Lake Remix" /></div>
                    <div>
                      <label style={S.label}>Genre *</label>
                      <select style={S.input} value={uploadForm.genre} onChange={e => setUploadForm(p => ({ ...p, genre: e.target.value }))}>
                        <option value="">Select...</option>
                        {GENRES.map(g => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Performance Type *</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {["Solo", "Group"].map(t => (
                        <button key={t} onClick={() => setUploadForm(p => ({ ...p, type: t }))}
                          style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${uploadForm.type === t ? "#4ecdc4" : "#2e2e2e"}`, background: uploadForm.type === t ? "#4ecdc418" : "transparent", color: uploadForm.type === t ? "#4ecdc4" : "#555", cursor: "pointer", fontFamily: "Georgia", transition: "all .2s" }}>{t}</button>
                      ))}
                    </div>
                  </div>
                  {uploadForm.type === "Group" && (
                    <div><label style={S.label}>Group Name</label><input style={S.input} value={uploadForm.groupName} onChange={e => setUploadForm(p => ({ ...p, groupName: e.target.value }))} placeholder="e.g. Leap Stars" /></div>
                  )}
                  <div>
                    <label style={S.label}>MP3 File *</label>
                    <div onClick={() => document.getElementById("mp3input").click()}
                      style={{ border: "2px dashed #2e2e2e", borderRadius: 10, padding: 28, textAlign: "center", cursor: "pointer", background: "#1c1c1c", transition: "border-color .2s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#4ecdc4"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "#2e2e2e"}>
                      <input id="mp3input" type="file" accept=".mp3,audio/*" style={{ display: "none" }} onChange={e => {
                        const f = e.target.files[0];
                        if (f) setUploadForm(p => ({ ...p, file: f, fileName: f.name }));
                      }} />
                      {uploadForm.fileName
                        ? <div><div style={{ fontSize: 28 }}>🎵</div><div style={{ color: "#4ecdc4", marginTop: 8, fontSize: 14 }}>{uploadForm.fileName}</div></div>
                        : <div><div style={{ fontSize: 28 }}>📁</div><div style={{ color: "#444", marginTop: 8, fontSize: 13 }}>Click to select MP3 file<br /><span style={{ fontSize: 11, color: "#333" }}>Max 50MB</span></div></div>
                      }
                    </div>
                  </div>
                  <button style={{ ...S.btn("#4ecdc4"), color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }} onClick={submitUpload} disabled={uploading}>
                    {uploading ? <><Spinner color="#0a0a0a" /> Uploading...</> : "Upload Song ↑"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {notification && <Toast msg={notification.msg} color={notification.color} />}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // ADMIN
  // ════════════════════════════════════════════════════════════════
  if (portal === "admin") return (
    <div style={S.app}>
      <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <button style={S.back} onClick={() => resetAndGo("home")}>← Back</button>
            <div style={{ fontSize: 10, letterSpacing: "0.35em", color: "#ff6b6b", textTransform: "uppercase" }}>Admin Dashboard</div>
            <h2 style={{ fontSize: 30, fontWeight: "normal", margin: "8px 0 0" }}>Grande National HQ</h2>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 40 }}>
            <button onClick={() => { loadDancers(); loadSongs(); loadStudios(); notify("✓ Data refreshed"); }} style={S.btnGhost("#666")}>↻ Refresh</button>
            <button onClick={() => exportCSV(null)} style={{ ...S.btn("#ff6b6b") }}>⬇ Export All CSV</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total Dancers", value: dancers.length, color: "#e8c547" },
            { label: "Songs Uploaded", value: songs.length, color: "#4ecdc4" },
            { label: "Pending Approval", value: dancers.filter(d => d.status === "pending").length, color: "#ff6b6b" },
            { label: "Studios", value: studios.length, color: "#a8e6cf" },
          ].map(stat => (
            <div key={stat.label} style={{ ...S.card, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 30, color: stat.color, fontStyle: "italic" }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: "#444", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#141414", padding: 4, borderRadius: 10, border: "1px solid #1e1e1e" }}>
          {[["dancers", "👥 Dancers"], ["songs", "🎵 Songs"], ["studios", "🏫 Studios"]].map(([key, label]) => (
            <button key={key} onClick={() => setAdminTab(key)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: adminTab === key ? "#e8c547" : "transparent", color: adminTab === key ? "#0a0a0a" : "#555", cursor: "pointer", fontFamily: "Georgia", fontSize: 14, transition: "all .2s", fontWeight: adminTab === key ? "bold" : "normal" }}>{label}</button>
          ))}
        </div>

        {/* DANCERS */}
        {adminTab === "dancers" && (
          <div style={S.card}>
            {dancers.length === 0 ? <div style={{ color: "#444", fontStyle: "italic" }}>No registrations yet.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dancers.map(d => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "#1c1c1c", borderRadius: 10, border: "1px solid #222" }}>
                    <div>
                      <div style={{ fontWeight: "bold" }}>{d.first_name} {d.last_name} <span style={{ fontSize: 12, color: "#444" }}>· age {d.age}</span></div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>{d.studio_name} · {d.parent_email}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={S.tag(d.status === "approved" ? "#4ecdc4" : "#e8c547")}>{d.status === "approved" ? "✓ Approved" : "⏳ Pending"}</span>
                      {d.status === "pending" && (
                        <button onClick={() => approveDancer(d)} style={{ background: "#4ecdc418", border: "1px solid #4ecdc4", borderRadius: 6, padding: "5px 14px", color: "#4ecdc4", cursor: "pointer", fontSize: 12, fontFamily: "Georgia" }}>Approve</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SONGS */}
        {adminTab === "songs" && (
          <div style={S.card}>
            {songs.length === 0 ? <div style={{ color: "#444", fontStyle: "italic" }}>No songs uploaded yet.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {songs.map(song => {
                  const url = song.file_path ? db.fileUrl(song.file_path) : null;
                  return (
                    <div key={song.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "#1c1c1c", borderRadius: 10, border: "1px solid #222" }}>
                      <div>
                        <div style={{ fontWeight: "bold" }}>{song.dancer_name}</div>
                        <div style={{ fontSize: 13, color: "#e8c547", marginTop: 2 }}>{song.song_name}</div>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{song.studio_name} · {song.genre} · {song.performance_type}{song.group_name ? ` · ${song.group_name}` : ""}</div>
                      </div>
                      {url && (
                        <button onClick={() => togglePlay(url)} style={{ background: "#e8c54718", border: "none", borderRadius: 6, padding: "7px 16px", color: "#e8c547", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                          {playingUrl === url ? "⏸ Pause" : "▶ Play"}<AudioBars playing={playingUrl === url} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STUDIOS */}
        {adminTab === "studios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {studios.map(studio => {
              const stDancers = dancers.filter(d => d.studio_code === studio.code);
              const stSongs = songs.filter(s => s.studio_code === studio.code);
              return (
                <div key={studio.id} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 18 }}>{studio.name}</div>
                    <div style={{ fontSize: 12, color: "#444", marginTop: 4, letterSpacing: "0.05em" }}>{studio.code}</div>
                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <span style={S.tag("#e8c547")}>{stDancers.length} dancers</span>
                      <span style={S.tag("#4ecdc4")}>{stSongs.length} songs</span>
                    </div>
                  </div>
                  <button onClick={() => exportCSV(studio.code)} style={S.btnGhost()}>⬇ Export CSV</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {notification && <Toast msg={notification.msg} color={notification.color} />}
    </div>
  );
}

function Toast({ msg, color }) {
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, background: color, color: "#fff", padding: "13px 22px", borderRadius: 10, fontFamily: "Georgia", zIndex: 999, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", fontSize: 14, maxWidth: 320 }}>
      {msg}
    </div>
  );
}
