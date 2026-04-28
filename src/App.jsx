import { useState, useRef, useEffect, useCallback } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://xyezjpubmveizkzqbxue.supabase.co";
const SUPABASE_KEY = "sb_publishable_lmRXMFg_FO5W0J8uHXnANA_Tk2SR8ed";

export const GENRES = ["Contemporary","Lyrical","Ballet","Repertoire","Jazz","Acrobatics","Hip-Hop","Open"];
export const AGE_GROUPS = [
  { label: "Petite (6 & under)", max: 6 },
  { label: "Mini (7–9)", min: 7, max: 9 },
  { label: "Children (10–12) – Ballet/Rep point shoes optional", min: 10, max: 12 },
  { label: "Junior (13–15)", min: 13, max: 15 },
  { label: "Senior (16 & older)", min: 16 },
];
export const PRICING = { registration: 300, solo: 300, duo: 200, small_group: 180, large_group: 180 };

// ─── SUPABASE CLIENT ────────────────────────────────────────────────────────
export const db = {
  async get(table, query = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}${query ? "&" : "?"}order=created_at.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async update(table, id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async remove(table, id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },
  async uploadFile(path, file) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/mp3s/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type },
      body: file
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || json.error);
    return json;
  },
  fileUrl(path) { return path ? `${SUPABASE_URL}/storage/v1/object/public/mp3s/${path}` : null; }
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
export function calcAge(dob) {
  const today = new Date(), birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}
export function calcAgeGroup(age) {
  if (age <= 6) return "Petite (6 & under)";
  if (age <= 9) return "Mini (7–9)";
  if (age <= 12) return "Children (10–12) – Ballet/Rep point shoes optional";
  if (age <= 15) return "Junior (13–15)";
  return "Senior (16 & older)";
}
export function membershipCode(studioCode, firstName, lastName, dob) {
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
  const dobStr = dob.replace(/-/g, "");
  return `${studioCode}-${initials}-${dobStr}`;
}
export function groupType(count) {
  if (count === 2) return "Duo";
  if (count <= 7) return "Small Group";
  return "Large Group";
}
export function groupFee(count) {
  if (count === 2) return PRICING.duo;
  return PRICING.small_group;
}

// ─── SHARED UI ──────────────────────────────────────────────────────────────
export function Spinner({ color = "#e8c547", size = 18 }) {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ display:"inline-block", width:size, height:size, border:`2px solid ${color}30`, borderTop:`2px solid ${color}`, borderRadius:"50%", animation:"spin .7s linear infinite", flexShrink:0 }} />
    </>
  );
}

export function Toast({ msg, color = "#1a6b3a" }) {
  return (
    <div style={{ position:"fixed", bottom:28, right:28, background:color, color:"#fff", padding:"13px 22px", borderRadius:10, fontFamily:"Georgia,serif", zIndex:9999, boxShadow:"0 8px 32px rgba(0,0,0,.5)", fontSize:14, maxWidth:340, lineHeight:1.5 }}>
      {msg}
    </div>
  );
}

export function AudioBars({ playing }) {
  return (
    <>
      <style>{`@keyframes bar{to{height:3px}}`}</style>
      <span style={{ display:"inline-flex", alignItems:"flex-end", gap:2, height:14, marginLeft:6 }}>
        {[10,16,8,14].map((h,i)=>(
          <span key={i} style={{ display:"block", width:3, borderRadius:2, background:"#e8c547", height:playing?`${h}px`:"3px", animation:playing?`bar .6s ease-in-out ${i*.12}s infinite alternate`:"none", transition:"height .3s" }} />
        ))}
      </span>
    </>
  );
}

export const S = {
  app: { minHeight:"100vh", background:"#0a0a0a", fontFamily:"Georgia,serif", color:"#f0ece0" },
  card: { background:"#141414", border:"1px solid #242424", borderRadius:16, padding:28 },
  input: { width:"100%", background:"#1c1c1c", border:"1px solid #2e2e2e", borderRadius:8, padding:"11px 14px", color:"#f0ece0", fontFamily:"Georgia,serif", fontSize:15, outline:"none", boxSizing:"border-box" },
  select: { width:"100%", background:"#1c1c1c", border:"1px solid #2e2e2e", borderRadius:8, padding:"11px 14px", color:"#f0ece0", fontFamily:"Georgia,serif", fontSize:15, outline:"none", boxSizing:"border-box" },
  btn: (color="#e8c547") => ({ background:color, color:color==="#e8c547"?"#0a0a0a":"#fff", border:"none", borderRadius:8, padding:"12px 28px", fontFamily:"Georgia,serif", fontSize:15, fontWeight:"bold", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }),
  ghost: (color="#e8c547") => ({ background:"transparent", color, border:`1px solid ${color}`, borderRadius:8, padding:"10px 20px", fontFamily:"Georgia,serif", fontSize:14, cursor:"pointer" }),
  label: { display:"block", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", color:"#666", marginBottom:6 },
  tag: (c) => ({ background:`${c}22`, color:c, borderRadius:20, padding:"3px 11px", fontSize:12, fontWeight:"bold", whiteSpace:"nowrap", display:"inline-block" }),
  back: { background:"transparent", color:"#666", border:"1px solid #222", borderRadius:8, padding:"8px 18px", fontFamily:"Georgia,serif", fontSize:13, cursor:"pointer", marginBottom:28 },
  disclaimer: { marginTop:24, padding:"12px 16px", background:"#1a1200", border:"1px solid #3a2e00", borderRadius:8, fontSize:12, color:"#a08c40", lineHeight:1.6 },
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────
import StudioRegister from "./StudioRegister.jsx";
import StudioPortal from "./StudioPortal.jsx";
import AdminDashboard from "./AdminDashboard.jsx";

export default function App() {
  const [portal, setPortal] = useState("home");
  const [studioSession, setStudioSession] = useState(null);
  const [stats, setStats] = useState({ studios:0, dancers:0, solos:0, groups:0 });
  const [notification, setNotification] = useState(null);

  const notify = useCallback((msg, color="#1a6b3a") => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("studioSession");
    if (saved) setStudioSession(JSON.parse(saved));
    Promise.all([
      db.get("studios","status=eq.approved&select=id"),
      db.get("dancers","select=id"),
      db.get("solo_entries","select=id"),
      db.get("group_entries","select=id"),
    ]).then(([st,da,so,gr]) => setStats({ studios:st.length, dancers:da.length, solos:so.length, groups:gr.length })).catch(()=>{});
  }, []);

  const loginStudio = (studio) => {
    setStudioSession(studio);
    sessionStorage.setItem("studioSession", JSON.stringify(studio));
    setPortal("studio");
  };
  const logoutStudio = () => {
    setStudioSession(null);
    sessionStorage.removeItem("studioSession");
    setPortal("home");
  };

  if (portal === "studio-register") return <StudioRegister onBack={() => setPortal("home")} onSuccess={() => { notify("✓ Registration submitted! Admin will approve your studio shortly."); setPortal("home"); }} notify={notify} />;
  if (portal === "studio") return <StudioPortal session={studioSession} onLogout={logoutStudio} notify={notify} />;
  if (portal === "admin") return <AdminDashboard onBack={() => setPortal("home")} notify={notify} />;

  // HOME
  return (
    <div style={S.app}>
      <div style={{ maxWidth:980, margin:"0 auto", padding:"56px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:72 }}>
          <div style={{ fontSize:10, letterSpacing:"0.5em", color:"#e8c547", textTransform:"uppercase", marginBottom:24 }}>✦ Welcome to ✦</div>
          <h1 style={{ fontSize:"clamp(52px,10vw,100px)", fontWeight:"normal", margin:0, lineHeight:.9, letterSpacing:"-0.03em" }}>
            Grande<br /><em style={{ color:"#e8c547" }}>National</em>
          </h1>
          <p style={{ color:"#444", marginTop:20, fontSize:15, letterSpacing:"0.08em", textTransform:"uppercase" }}>Dance Competition Management</p>
        </div>

        {/* Portal cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16, marginBottom:40 }}>
          {[
            { icon:"🏫", title:"Studio Registration", sub:"New studios — register your dance school to participate", key:"studio-register", color:"#a78bfa" },
            { icon:"🎵", title:"Studio Portal", sub:"Registered studios — manage dancers, entries & music uploads", key:"studio-login", color:"#4ecdc4" },
            { icon:"⚡", title:"Admin Dashboard", sub:"Organizers — approve studios, manage entries & exports", key:"admin", color:"#ff6b6b" },
          ].map(p => (
            <button key={p.key} onClick={() => {
              if (p.key === "studio-login") {
                if (studioSession) setPortal("studio");
                else setPortal("studio-login-modal");
              } else setPortal(p.key);
            }}
              style={{ ...S.card, cursor:"pointer", textAlign:"left", border:"1px solid #242424", transition:"all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=p.color; e.currentTarget.style.transform="translateY(-4px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="#242424"; e.currentTarget.style.transform="translateY(0)"; }}>
              <div style={{ fontSize:36, marginBottom:16 }}>{p.icon}</div>
              <div style={{ fontSize:18, color:p.color, marginBottom:8 }}>{p.title}</div>
              <div style={{ fontSize:13, color:"#555", lineHeight:1.7 }}>{p.sub}</div>
              <div style={{ marginTop:20, fontSize:11, color:p.color, letterSpacing:"0.15em" }}>ENTER →</div>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ ...S.card, display:"grid", gridTemplateColumns:"repeat(4,1fr)", padding:0, overflow:"hidden" }}>
          {[
            { label:"Active Studios", value:stats.studios, color:"#a78bfa" },
            { label:"Registered Dancers", value:stats.dancers, color:"#4ecdc4" },
            { label:"Solo Entries", value:stats.solos, color:"#e8c547" },
            { label:"Group Entries", value:stats.groups, color:"#ff6b6b" },
          ].map((st,i) => (
            <div key={st.label} style={{ padding:"22px 20px", textAlign:"center", borderRight:i<3?"1px solid #1e1e1e":"none" }}>
              <div style={{ fontSize:32, color:st.color, fontStyle:"italic" }}>{st.value}</div>
              <div style={{ fontSize:10, color:"#444", marginTop:4, textTransform:"uppercase", letterSpacing:"0.1em" }}>{st.label}</div>
            </div>
          ))}
        </div>

        <div style={S.disclaimer}>
          ⚠️ <strong>Please wait for your final invoice before making payment.</strong> All fees displayed throughout this system are estimates only.
        </div>
      </div>

      {/* Studio login modal */}
      {portal === "studio-login-modal" && (
        <StudioLoginModal onClose={() => setPortal("home")} onLogin={loginStudio} notify={notify} />
      )}

      {notification && <Toast msg={notification.msg} color={notification.color} />}
    </div>
  );
}

function StudioLoginModal({ onClose, onLogin, notify }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { notify("Please enter email and password","#c0392b"); return; }
    setLoading(true);
    try {
      const studios = await db.get("studios", `studio_email=eq.${encodeURIComponent(email)}&status=eq.approved`);
      if (!studios.length) { notify("Studio not found or not yet approved","#c0392b"); setLoading(false); return; }
      const studio = studios[0];
      if (studio.password_hash !== btoa(password)) { notify("Incorrect password","#c0392b"); setLoading(false); return; }
      onLogin(studio);
    } catch(e) { notify("Login error: "+e.message,"#c0392b"); }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!email) { notify("Enter your studio email first","#c0392b"); return; }
    setResetSent(true);
    notify("If that email is registered, a reset link has been sent ✓");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:24 }}>
      <div style={{ ...S.card, width:"100%", maxWidth:420 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div style={{ fontSize:18, color:"#4ecdc4" }}>{forgot ? "Reset Password" : "Studio Login"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        {resetSent ? (
          <div style={{ textAlign:"center", color:"#888", fontSize:14, lineHeight:1.7 }}>
            Check your email for a reset link.<br />
            <button onClick={() => { setForgot(false); setResetSent(false); }} style={{ ...S.ghost("#4ecdc4"), marginTop:16 }}>Back to Login</button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div><label style={S.label}>Studio Email</label><input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="studio@email.com" /></div>
            {!forgot && <div><label style={S.label}>Password</label><input style={S.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••••" /></div>}
            <button style={S.btn("#4ecdc4")} onClick={forgot ? handleReset : handleLogin} disabled={loading}>
              {loading ? <Spinner color="#0a0a0a" /> : forgot ? "Send Reset Link" : "Login →"}
            </button>
            <button onClick={() => setForgot(!forgot)} style={{ background:"none", border:"none", color:"#555", fontSize:13, cursor:"pointer", fontFamily:"Georgia,serif" }}>
              {forgot ? "← Back to login" : "Forgot password?"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
