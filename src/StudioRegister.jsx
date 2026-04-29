import { useState, useEffect } from "react";
import { supabase, S, Spinner, C } from "./App.jsx";

// EmailJS config - fill in your IDs from emailjs.com
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_STUDIO = "YOUR_TEMPLATE_ID";
const EMAILJS_TEMPLATE_ADMIN = "YOUR_ADMIN_TEMPLATE_ID";
const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";
const ADMIN_EMAILS = ["marcel@amberjade.co.za", "rochelle@amberjade.co.za"];

async function sendEmail(templateId, params) {
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: params
      })
    });
  } catch(e) { console.log("Email error:", e); }
}

function generateCode(name) {
  const words = name.toUpperCase().replace(/[^A-Z0-9\s]/g,"").trim().split(/\s+/).filter(Boolean);
  const initials = words.map(w=>w[0]).join("").slice(0,4);
  return initials + "-" + Math.floor(100+Math.random()*900);
}

export default function StudioRegister({ onBack, onSuccess, notify }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [form, setForm] = useState({
    studio_name:"", studio_code:"", studio_address:"",
    studio_contact_nr:"", studio_email:"", studio_owner_name:"",
    studio_owner_email:"", studio_owner_contact_nr:"",
    password:"", confirm_password:""
  });
  const set = (k,v) => { setForm(p=>({...p,[k]:v})); setError(''); };

  useEffect(() => {
    supabase.from("app_settings")
      .select("value")
      .eq("key", "submissions_locked")
      .single()
      .then(({ data }) => { if (data?.value === "true") setLocked(true); })
      .catch(() => {});
  }, []);

  const handleNameChange = (val) => {
    set("studio_name", val);
    if (val.length >= 2) set("studio_code", generateCode(val));
  };

  const submit = async () => {
    if (locked) {
      setError("Studio registrations are currently closed. Please contact the competition organiser.");
      return;
    }
    if (!form.studio_name||!form.studio_email||!form.password) { setError("Please fill in all required fields."); return; }
    if (form.password !== form.confirm_password) { setError("Passwords do not match. Please try again."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters and include a number or special character."); return; }
    if (!/[0-9!@#$%^&*]/.test(form.password)) { setError("Password must include at least one number or special character (e.g. ! @ # $ %)."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("studios").insert({
        studio_name: form.studio_name.trim(),
        studio_code: form.studio_code.trim(),
        studio_address: form.studio_address.trim(),
        studio_contact_nr: form.studio_contact_nr.trim(),
        studio_email: form.studio_email.trim().toLowerCase(),
        studio_owner_name: form.studio_owner_name.trim(),
        studio_owner_email: form.studio_owner_email.trim().toLowerCase(),
        studio_owner_contact_nr: form.studio_owner_contact_nr.trim(),
        password_hash: btoa(unescape(encodeURIComponent(form.password))),
        status: "pending"
      });
      if (error) {
        if (error.code === "23505") setError("A studio with this email or code already exists. Please use a different email.");
        else setError("Registration failed: " + error.message);
      } else {
        setSubmitted(true);
      // Email to studio
      sendEmail(EMAILJS_TEMPLATE_STUDIO, {
        to_email: form.studio_email,
        to_name: form.studio_owner_name || form.studio_name,
        studio_name: form.studio_name,
        studio_code: finalCode,
        studio_email: form.studio_email,
        message: "Your studio registration has been submitted successfully. Once approved by admin you can log in using your studio email and the password you set during registration."
      });
      // Email to admins
      for (const adminEmail of ADMIN_EMAILS) {
        sendEmail(EMAILJS_TEMPLATE_ADMIN, {
          to_email: adminEmail,
          to_name: "Grande National Admin",
          studio_name: form.studio_name,
          studio_code: finalCode,
          studio_email: form.studio_email,
          studio_owner: form.studio_owner_name,
          studio_contact: form.studio_contact_nr,
          message: `New studio registration received from ${form.studio_name}. Please log into the admin dashboard to review and approve.`
        });
      }
      }
    } catch(e) { notify("Error: "+e.message,"#c0392b"); }
    setLoading(false);
  };

  if (submitted) return (
    <div style={S.app}>
      <div style={{ maxWidth:560, margin:"0 auto", padding:"80px 24px", textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:20 }}>✓</div>
        <div style={{ fontSize:28, color:"#F27C20", marginBottom:16 }}>Registration Submitted!</div>
        <p style={{ color:"#ffffff", lineHeight:1.8, fontSize:14 }}>
          Thank you for registering <strong style={{color:"#f0ece0"}}>{form.studio_name}</strong>.<br/>
          Your studio login code is: <strong style={{color:"#F27C20"}}>{form.studio_code}</strong><br/><br/>
          An admin will review and approve your registration.<br/>
          Once approved, log in with your studio email and password.
        </p>
        <button style={{...S.btn("#F27C20"), margin:"24px auto 0"}} onClick={onBack}>← Back to Home</button>
      </div>
    </div>
  );

  const steps = ["Studio Details","Owner Details","Set Password"];
  return (
    <div style={S.app}>
      <div style={{ maxWidth:600, margin:"0 auto", padding:"48px 24px" }}>
        <button style={S.back} onClick={onBack}>← Back</button>
        <div style={{ fontSize:10, letterSpacing:"0.4em", color:"#F27C20", textTransform:"uppercase", marginBottom:10 }}>Grande National</div>
        <h2 style={{ fontSize:30, fontWeight:"normal", margin:"0 0 8px" }}>Studio Registration</h2>
        <p style={{ color:"#ffffff", fontSize:13, marginBottom:28 }}>Register your dance studio. Admin approval required before login.</p>
        <div style={{ display:"flex", gap:8, marginBottom:32 }}>
          {steps.map((s,i)=>(
            <div key={s} style={{ flex:1, textAlign:"center" }}>
              <div style={{ height:3, borderRadius:2, background:step>i?"#F27C20":"#222", marginBottom:6 }} />
              <div style={{ fontSize:10, color:step>i?"#F27C20":"#333", textTransform:"uppercase", letterSpacing:"0.08em" }}>{s}</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          {step===1 && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {locked && (
              <div style={{padding:"14px 16px",background:"#2a0808",border:"1px solid #c0392b",borderRadius:6,fontSize:13,color:"#ff6b6b",fontFamily:"'Montserrat',sans-serif",lineHeight:1.6}}>
                🔒 <strong>Studio registrations are currently closed.</strong><br/>
                Please contact the competition organiser for assistance.
              </div>
            )}
              {error && <div style={{padding:"10px 14px",background:"#2a0a0a",border:"1px solid #c0392b88",borderRadius:6,fontSize:13,color:"#ff6b6b",fontFamily:"'Montserrat',sans-serif",lineHeight:1.5}}>⚠️ {error}</div>}
              <div><label style={S.label}>Studio Name *</label><input style={S.input} value={form.studio_name} onChange={e=>handleNameChange(e.target.value)} placeholder="e.g. Sunshine Dance Academy" /></div>
              <div>
                <label style={S.label}>Studio Code * <span style={{color:"#ffffff",textTransform:"none",letterSpacing:0,fontSize:10}}>(auto-generated — you can edit)</span></label>
                <input style={S.input} value={form.studio_code} onChange={e=>set("studio_code",e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,""))} placeholder="e.g. SDA-456" />
                <div style={{fontSize:11,color:"#ffffff",marginTop:4}}>Teachers use this to log into the studio portal</div>
              </div>
              <div><label style={S.label}>Studio Address *</label><input style={S.input} value={form.studio_address} onChange={e=>set("studio_address",e.target.value)} placeholder="123 Dance Street, City" /></div>
              <div><label style={S.label}>Studio Contact Number *</label><input style={S.input} value={form.studio_contact_nr} onChange={e=>set("studio_contact_nr",e.target.value)} placeholder="011 000 0000" /></div>
              <div><label style={S.label}>Studio Email Address *</label><input style={S.input} type="email" value={form.studio_email} onChange={e=>set("studio_email",e.target.value)} placeholder="info@yourstudio.co.za" /></div>
              <button style={S.btn("#F27C20")} onClick={()=>{ if(!form.studio_name||!form.studio_email||!form.studio_code||!form.studio_address||!form.studio_contact_nr){setError("All fields on this page are required.");return;} setStep(2); }}>Next →</button>
            </div>
          )}
          {step===2 && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {locked && (
              <div style={{padding:"14px 16px",background:"#2a0808",border:"1px solid #c0392b",borderRadius:6,fontSize:13,color:"#ff6b6b",fontFamily:"'Montserrat',sans-serif",lineHeight:1.6}}>
                🔒 <strong>Studio registrations are currently closed.</strong><br/>
                Please contact the competition organiser for assistance.
              </div>
            )}
              {error && <div style={{padding:"10px 14px",background:"#2a0a0a",border:"1px solid #c0392b88",borderRadius:6,fontSize:13,color:"#ff6b6b",fontFamily:"'Montserrat',sans-serif",lineHeight:1.5}}>⚠️ {error}</div>}
              <div><label style={S.label}>Studio Owner / Principal Name *</label><input style={S.input} value={form.studio_owner_name} onChange={e=>set("studio_owner_name",e.target.value)} placeholder="Full Name" /></div>
              <div><label style={S.label}>Owner Email Address *</label><input style={S.input} type="email" value={form.studio_owner_email} onChange={e=>set("studio_owner_email",e.target.value)} placeholder="owner@yourstudio.co.za" /></div>
              <div><label style={S.label}>Owner Contact Number *</label><input style={S.input} value={form.studio_owner_contact_nr} onChange={e=>set("studio_owner_contact_nr",e.target.value)} placeholder="082 000 0000" /></div>
              <div style={{display:"flex",gap:10}}>
                <button style={S.ghost()} onClick={()=>setStep(1)}>← Back</button>
                <button style={{...S.btn("#F27C20"),flex:1}} onClick={()=>{ if(!form.studio_owner_name||!form.studio_owner_email||!form.studio_owner_contact_nr){setError("All fields on this page are required.");return;} setStep(3); }}>Next →</button>
              </div>
            </div>
          )}
          {step===3 && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {locked && (
              <div style={{padding:"14px 16px",background:"#2a0808",border:"1px solid #c0392b",borderRadius:6,fontSize:13,color:"#ff6b6b",fontFamily:"'Montserrat',sans-serif",lineHeight:1.6}}>
                🔒 <strong>Studio registrations are currently closed.</strong><br/>
                Please contact the competition organiser for assistance.
              </div>
            )}
              {error && <div style={{padding:"10px 14px",background:"#2a0a0a",border:"1px solid #c0392b88",borderRadius:6,fontSize:13,color:"#ff6b6b",fontFamily:"'Montserrat',sans-serif",lineHeight:1.5}}>⚠️ {error}</div>}
              <div style={{fontSize:12,color:"#888",fontFamily:"'Montserrat',sans-serif",lineHeight:1.6}}>Password must be at least 8 characters and include a number or special character.</div>
              <div style={{padding:"12px 16px",background:"#1a1200",border:"1px solid #3a2e00",borderRadius:8,fontSize:13,color:"#a08c40"}}>
                Studio: <strong style={{color:"#f0ece0"}}>{form.studio_name}</strong><br/>
                Login code: <strong style={{color:"#F27C20"}}>{form.studio_code}</strong>
              </div>
              <div><label style={S.label}>Set Password *</label><input style={S.input} type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="Minimum 6 characters" /></div>
              <div><label style={S.label}>Confirm Password *</label><input style={S.input} type="password" value={form.confirm_password} onChange={e=>set("confirm_password",e.target.value)} placeholder="Repeat password" onKeyDown={e=>e.key==="Enter"&&submit()} /></div>
              <div style={{display:"flex",gap:10}}>
                <button style={S.ghost()} onClick={()=>setStep(2)}>← Back</button>
                <button style={{...S.btn("#F27C20"),flex:1}} onClick={submit} disabled={loading}>
                  {loading?<Spinner color="#0a0a0a"/>:"Submit Registration"}
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={S.disclaimer}>⚠️ Please wait for your final invoice before making payment. All fees displayed are estimates only.</div>
      </div>
    </div>
  );
}
