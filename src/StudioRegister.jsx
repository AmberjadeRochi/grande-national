import { useState } from "react";
import { db, S, Spinner } from "./App.jsx";

export default function StudioRegister({ onBack, onSuccess, notify }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    studio_name:"", studio_code:"", studio_address:"", studio_contact_nr:"",
    studio_email:"", studio_owner_name:"", studio_owner_email:"",
    studio_owner_contact_nr:"", password:"", confirm_password:""
  });

  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const generateCode = (name) => {
    return name.toUpperCase().replace(/[^A-Z0-9]/g," ").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,6) + "-" + Math.floor(100+Math.random()*900);
  };

  const submit = async () => {
    if (!form.studio_name || !form.studio_email || !form.password) { notify("Please fill in all required fields","#c0392b"); return; }
    if (form.password !== form.confirm_password) { notify("Passwords do not match","#c0392b"); return; }
    if (form.password.length < 6) { notify("Password must be at least 6 characters","#c0392b"); return; }
    setLoading(true);
    try {
      const code = form.studio_code || generateCode(form.studio_name);
      await db.insert("studios", {
        studio_name: form.studio_name,
        studio_code: code,
        studio_address: form.studio_address,
        studio_contact_nr: form.studio_contact_nr,
        studio_email: form.studio_email,
        studio_owner_name: form.studio_owner_name,
        studio_owner_email: form.studio_owner_email,
        studio_owner_contact_nr: form.studio_owner_contact_nr,
        password_hash: btoa(form.password),
        status: "pending"
      });
      onSuccess(code);
    } catch(e) {
      notify("Registration failed: " + (e.message.includes("duplicate") ? "Email or studio code already exists" : e.message), "#c0392b");
    }
    setLoading(false);
  };

  const steps = ["Studio Details", "Owner Details", "Account Setup"];

  return (
    <div style={S.app}>
      <div style={{ maxWidth:600, margin:"0 auto", padding:"48px 24px" }}>
        <button style={S.back} onClick={onBack}>← Back</button>
        <div style={{ fontSize:10, letterSpacing:"0.4em", color:"#a78bfa", textTransform:"uppercase", marginBottom:10 }}>Grande National</div>
        <h2 style={{ fontSize:30, fontWeight:"normal", margin:"0 0 8px" }}>Studio Registration</h2>
        <p style={{ color:"#555", fontSize:13, marginBottom:28 }}>Register your dance studio to participate. Admin approval required before login.</p>

        {/* Progress */}
        <div style={{ display:"flex", gap:8, marginBottom:32 }}>
          {steps.map((s,i) => (
            <div key={s} style={{ flex:1, textAlign:"center" }}>
              <div style={{ height:3, borderRadius:2, background:step>i?"#a78bfa":"#222", marginBottom:6, transition:"background .3s" }} />
              <div style={{ fontSize:10, color:step>i?"#a78bfa":"#333", textTransform:"uppercase", letterSpacing:"0.08em" }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={S.card}>
          {step === 1 && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div><label style={S.label}>Studio Name *</label><input style={S.input} value={form.studio_name} onChange={e=>{set("studio_name",e.target.value); if(!form.studio_code) set("studio_code",generateCode(e.target.value));}} placeholder="Leap for Joy Dance Studio" /></div>
              <div>
                <label style={S.label}>Studio Code * <span style={{color:"#444",textTransform:"none",letterSpacing:0}}>(auto-generated, can edit)</span></label>
                <input style={S.input} value={form.studio_code} onChange={e=>set("studio_code",e.target.value.toUpperCase())} placeholder="LFJ-123" />
                <div style={{fontSize:11,color:"#444",marginTop:4}}>This is the code your dancers will use to register</div>
              </div>
              <div><label style={S.label}>Studio Address</label><input style={S.input} value={form.studio_address} onChange={e=>set("studio_address",e.target.value)} placeholder="123 Dance Street, City" /></div>
              <div><label style={S.label}>Studio Contact Number</label><input style={S.input} value={form.studio_contact_nr} onChange={e=>set("studio_contact_nr",e.target.value)} placeholder="011 000 0000" /></div>
              <div><label style={S.label}>Studio Email Address *</label><input style={S.input} type="email" value={form.studio_email} onChange={e=>set("studio_email",e.target.value)} placeholder="studio@email.com" /></div>
              <button style={S.btn("#a78bfa")} onClick={() => { if(!form.studio_name||!form.studio_email){notify("Studio name and email are required","#c0392b");return;} setStep(2); }}>Next →</button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div><label style={S.label}>Studio Owner / Principal Name *</label><input style={S.input} value={form.studio_owner_name} onChange={e=>set("studio_owner_name",e.target.value)} placeholder="Jane Smith" /></div>
              <div><label style={S.label}>Owner Email Address</label><input style={S.input} type="email" value={form.studio_owner_email} onChange={e=>set("studio_owner_email",e.target.value)} placeholder="owner@email.com" /></div>
              <div><label style={S.label}>Owner Contact Number</label><input style={S.input} value={form.studio_owner_contact_nr} onChange={e=>set("studio_owner_contact_nr",e.target.value)} placeholder="082 000 0000" /></div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={S.ghost()} onClick={()=>setStep(1)}>← Back</button>
                <button style={{ ...S.btn("#a78bfa"), flex:1 }} onClick={()=>{ if(!form.studio_owner_name){notify("Owner name is required","#c0392b");return;} setStep(3); }}>Next →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ padding:"12px 16px", background:"#1a1200", border:"1px solid #3a2e00", borderRadius:8, fontSize:13, color:"#a08c40" }}>
                Your studio code will be: <strong style={{color:"#e8c547"}}>{form.studio_code}</strong><br/>
                <span style={{fontSize:11}}>Share this with your dancers so they can register under your studio.</span>
              </div>
              <div><label style={S.label}>Set Password *</label><input style={S.input} type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="Min. 6 characters" /></div>
              <div><label style={S.label}>Confirm Password *</label><input style={S.input} type="password" value={form.confirm_password} onChange={e=>set("confirm_password",e.target.value)} placeholder="Repeat password" /></div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={S.ghost()} onClick={()=>setStep(2)}>← Back</button>
                <button style={{ ...S.btn("#a78bfa"), flex:1 }} onClick={submit} disabled={loading}>
                  {loading ? <Spinner color="#0a0a0a" /> : "Submit Registration"}
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
