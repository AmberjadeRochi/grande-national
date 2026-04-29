import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://xyezjpubmveizkzqbxue.supabase.co";
const SUPABASE_KEY = "sb_publishable_lmRXMFg_FO5W0J8uHXnANA_Tk2SR8ed";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
export const GENRES = ["Contemporary","Lyrical","Ballet","Repertoire","Jazz","Acrobatics","Hip-Hop","Open"];
export const AGE_GROUPS = [
  "Petite (6 & under)",
  "Mini (7–9)",
  "Children (10–12)",
  "Junior (13–15)",
  "Senior (16 & older)",
];
export const PRICING = { registration: 300, solo: 300, duo: 200, small_group: 180, large_group: 180 };

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export function calcAge(dob) {
  const today = new Date(), birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}
export function calcAgeGroup(age) {
  if (age <= 6) return "Petite (6 & under)";
  if (age <= 9) return "Mini (7–9)";
  if (age <= 12) return "Children (10–12)";
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

// ─── SHARED UI ───────────────────────────────────────────────────────────────
export function Spinner({ color = "#8a7a4a", size = 18 }) {
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
          <span key={i} style={{ display:"block", width:3, borderRadius:2, background:"#8a7a4a", height:playing?`${h}px`:"3px", animation:playing?`bar .6s ease-in-out ${i*.12}s infinite alternate`:"none", transition:"height .3s" }} />
        ))}
      </span>
    </>
  );
}
// ─── GOOGLE FONTS ────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// ─── BRAND COLOURS ───────────────────────────────────────────────────────────
export const C = {
  bg:       "#080806",
  surface:  "#111110",
  border:   "#2a2820",
  accent:   "#c4713a",   // burnt orange
  rose:     "#b05060",   // dusty rose
  gold:     "#8a7a4a",   // olive gold
  text:     "#f0ebe0",
  muted:    "#6a6456",
  charcoal: "#3a3830",
};

export const S = {
  app: { minHeight:"100vh", background:C.bg, fontFamily:"'Cormorant Garamond', Georgia, serif", color:C.text },
  card: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, padding:28 },
  input: { width:"100%", background:"#0f0f0d", border:`1px solid ${C.border}`, borderRadius:4, padding:"11px 14px", color:C.text, fontFamily:"'Montserrat', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box", letterSpacing:"0.03em" },
  select: { width:"100%", background:"#0f0f0d", border:`1px solid ${C.border}`, borderRadius:4, padding:"11px 14px", color:C.text, fontFamily:"'Montserrat', sans-serif", fontSize:14, outline:"none", boxSizing:"border-box" },
  btn: (color="#c4713a") => ({ background:color, color:"#fff", border:"none", borderRadius:4, padding:"12px 32px", fontFamily:"'Montserrat', sans-serif", fontSize:13, fontWeight:"500", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, letterSpacing:"0.08em", textTransform:"uppercase" }),
  ghost: (color="#c4713a") => ({ background:"transparent", color, border:`1px solid ${color}`, borderRadius:4, padding:"10px 22px", fontFamily:"'Montserrat', sans-serif", fontSize:13, cursor:"pointer", letterSpacing:"0.08em", textTransform:"uppercase" }),
  label: { display:"block", fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", color:C.muted, marginBottom:8, fontFamily:"'Montserrat', sans-serif" },
  tag: (c) => ({ background:`${c}18`, color:c, borderRadius:2, padding:"3px 11px", fontSize:11, fontWeight:"500", whiteSpace:"nowrap", display:"inline-block", fontFamily:"'Montserrat', sans-serif", letterSpacing:"0.05em" }),
  back: { background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:4, padding:"8px 18px", fontFamily:"'Montserrat', sans-serif", fontSize:12, cursor:"pointer", marginBottom:28, letterSpacing:"0.08em", textTransform:"uppercase" },
  disclaimer: { marginTop:24, padding:"12px 16px", background:"#110e08", border:`1px solid ${C.gold}44`, borderRadius:4, fontSize:12, color:C.gold, lineHeight:1.7, fontFamily:"'Montserrat', sans-serif" },
};

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import StudioRegister from "./StudioRegister.jsx";
import StudioPortal from "./StudioPortal.jsx";
import AdminDashboard from "./AdminDashboard.jsx";

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [portal, setPortal] = useState("home");
  const [studioSession, setStudioSession] = useState(null);
  const [stats, setStats] = useState({ studios:0, dancers:0, solos:0, groups:0 });
  const [notification, setNotification] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  const notify = useCallback((msg, color="#1a6b3a") => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("studioSession");
    if (saved) { try { setStudioSession(JSON.parse(saved)); } catch(e) {} }
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [{ count: s }, { count: d }, { count: so }, { count: g }] = await Promise.all([
        supabase.from("studios").select("*", { count:"exact", head:true }).eq("status","approved"),
        supabase.from("dancers").select("*", { count:"exact", head:true }),
        supabase.from("solo_entries").select("*", { count:"exact", head:true }),
        supabase.from("group_entries").select("*", { count:"exact", head:true }),
      ]);
      setStats({ studios: s||0, dancers: d||0, solos: so||0, groups: g||0 });
    } catch(e) { console.error("Stats error:", e); }
  };

  const loginStudio = (studio) => {
    setStudioSession(studio);
    sessionStorage.setItem("studioSession", JSON.stringify(studio));
    setShowLogin(false);
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

  return (
    <div style={S.app}>
      {/* Top bar */}
      <div style={{ background:C.charcoal, padding:"14px 40px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:13, letterSpacing:"0.3em", color:C.text, textTransform:"uppercase", opacity:.8 }}>Dance Narrative</div>
        <div style={{ fontFamily:"'Montserrat', sans-serif", fontSize:11, letterSpacing:"0.2em", color:C.muted, textTransform:"uppercase" }}>Grande National Competition Portal</div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"80px 24px 56px" }}>
        <div style={{ textAlign:"center", marginBottom:80 }}>
          {/* DN monogram */}
          <div style={{ width:90, height:90, borderRadius:"50%", border:`1px solid ${C.gold}66`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 32px", position:"relative" }}>
            <span style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:38, fontWeight:300, color:C.text, letterSpacing:"-0.05em", fontStyle:"italic" }}>GN</span>
          </div>
          <div style={{ fontSize:10, letterSpacing:"0.5em", color:C.gold, textTransform:"uppercase", marginBottom:20, fontFamily:"'Montserrat', sans-serif" }}>Dance Narrative Presents</div>
          <h1 style={{ fontSize:"clamp(48px,9vw,90px)", fontWeight:300, margin:0, lineHeight:.95, letterSpacing:"0.05em", textTransform:"uppercase", fontFamily:"'Cormorant Garamond', serif" }}>
            Grande<br /><span style={{ color:C.accent, fontStyle:"italic" }}>National</span>
          </h1>
          <p style={{ color:C.muted, marginTop:20, fontSize:11, letterSpacing:"0.25em", textTransform:"uppercase", fontFamily:"'Montserrat', sans-serif" }}>Competition Management Portal</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16, marginBottom:40 }}>
          {[
            { icon:"🏫", title:"Studio Registration", sub:"New studios — register your dance school to participate", key:"studio-register", color:"#c4713a" },
            { icon:"🎵", title:"Studio Portal", sub:"Registered studios — manage dancers, entries & music", key:"studio-login", color:"#8a7a4a" },
          ].map(p => (
            <button key={p.key} onClick={() => {
              if (p.key === "studio-login") {
                if (studioSession) setPortal("studio");
                else setShowLogin(true);
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
        <div style={{ textAlign:"center", marginTop:16 }}>
          <button onClick={()=>setPortal("admin")} style={{ background:"none", border:"none", color:"#333", fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:"0.1em" }}>Admin Access</button>
        </div>
        <div style={S.disclaimer}>⚠️ <strong>Please wait for your final invoice before making payment.</strong> All fees displayed are estimates only.</div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={loginStudio} notify={notify} />}
      {notification && <Toast msg={notification.msg} color={notification.color} />}
    </div>
  );
}

function LoginModal({ onClose, onLogin, notify }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [pwError, setPwError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setPwError("Please enter your email and password."); return; }
    setLoading(true); setPwError("");
    try {
      const { data, error } = await supabase
        .from("studios")
        .select("*")
        .eq("studio_email", email.trim().toLowerCase())
        .eq("status", "approved")
        .single();
      if (error || !data) { setPwError("Studio not found or not yet approved by admin."); setLoading(false); return; }
      const encoded = btoa(unescape(encodeURIComponent(password)));
      if (data.password_hash !== encoded) { setPwError("Incorrect password — please try again."); setLoading(false); return; }
      onLogin(data);
    } catch(e) { setPwError("Login error: " + e.message); }
    setLoading(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:24 }}>
      <div style={{ ...S.card, width:"100%", maxWidth:420 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div style={{ fontSize:18, color:"#c4713a" }}>{forgot?"Reset Password":"Studio Login"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        {resetSent ? (
          <div style={{ textAlign:"center", color:"#888", fontSize:14, lineHeight:1.7 }}>
            Please contact the competition admin to reset your password.<br/>
            <button onClick={()=>{setForgot(false);setResetSent(false);}} style={{ ...S.ghost("#c4713a"), marginTop:16 }}>← Back to Login</button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={S.label}>Studio Email</label>
              <input style={S.input} type="email" value={email} onChange={e=>{setEmail(e.target.value);setPwError("");}} placeholder="info@yourstudio.co.za" />
            </div>
            {!forgot && (
              <div>
                <label style={S.label}>Password</label>
                <div style={{position:"relative"}}>
                  <input style={{...S.input, paddingRight:44}} type={showPw?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setPwError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••••" />
                  <button onClick={()=>setShowPw(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:16,padding:0}}>
                    {showPw?"🙈":"👁️"}
                  </button>
                </div>
              </div>
            )}
            {pwError && <div style={{padding:"8px 12px",background:"#c0392b18",border:"1px solid #c0392b44",borderRadius:8,fontSize:13,color:"#e74c3c"}}>{pwError}</div>}
            <button style={S.btn("#c4713a")} onClick={forgot?()=>setResetSent(true):handleLogin} disabled={loading}>
              {loading?<Spinner color="#0a0a0a"/>:forgot?"Send Reset Request":"Login →"}
            </button>
            <button onClick={()=>setForgot(!forgot)} style={{ background:"none", border:"none", color:"#555", fontSize:13, cursor:"pointer", fontFamily:"Georgia,serif" }}>
              {forgot?"← Back to login":"Forgot password?"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
