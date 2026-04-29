import { useState, useEffect, useRef } from "react";
import { supabase, S, Spinner, AudioBars, GENRES, AGE_GROUPS, PRICING, calcAge, calcAgeGroup, membershipCode, groupType, groupFee, C } from "./App.jsx";
import * as XLSX from "xlsx";

export default function StudioPortal({ session, onLogout, notify }) {
  const [tab, setTab] = useState("dancers");
  const [dancers, setDancers] = useState([]);
  const [solos, setSolos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);

  // modals
  const [showAddDancer, setShowAddDancer] = useState(false);
  const [showAddSolo, setShowAddSolo] = useState(null); // dancer object
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showEditDancer, setShowEditDancer] = useState(null);
  const [showEditSolo, setShowEditSolo] = useState(null);
  const [showEditGroup, setShowEditGroup] = useState(null);
  const [showGroupMembers, setShowGroupMembers] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.from("dancers").select("*").eq("studio_code", session.studio_code).order("last_name"),
        supabase.from("solo_entries").select("*").eq("studio_code", session.studio_code).order("created_at"),
        supabase.from("group_entries").select("*").eq("studio_code", session.studio_code).order("created_at"),
        supabase.from("group_members").select("*"),
      ]);
      if (r1.error) throw r1.error;
      setDancers(r1.data||[]); setSolos(r2.data||[]); setGroups(r3.data||[]); setGroupMembers(r4.data||[]);
    } catch(e) { notify("Load error: "+e.message, "#c0392b"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!audioRef.current) return;
    if (playingUrl) { audioRef.current.src = playingUrl; audioRef.current.play().catch(()=>{}); }
    else { audioRef.current.pause(); audioRef.current.src=""; }
  }, [playingUrl]);

  // ── Invoice calculation ──
  const invoice = () => {
    const regFees = dancers.length * PRICING.registration;
    const soloFees = solos.length * PRICING.solo;
    const groupFees = groups.reduce((acc, g) => acc + g.total_fee, 0);
    return { regFees, soloFees, groupFees, total: regFees + soloFees + groupFees };
  };

  // ── Excel import ──
  const handleExcelImport = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      let added = 0;
      for (const row of rows) {
        const firstName = row["Name"] || row["First Name"] || "";
        const lastName = row["Surname"] || row["Last Name"] || "";
        const dob = row["DOB"] || row["Date of Birth"] || "";
        if (!firstName || !lastName || !dob) continue;
        const dobStr = typeof dob === "number"
          ? new Date(Math.round((dob - 25569) * 86400 * 1000)).toISOString().split("T")[0]
          : dob.toString().trim();
        const age = calcAge(dobStr);
        const code = membershipCode(session.studio_code, firstName, lastName, dobStr);
        const existing = dancers.find(d => d.membership_code === code);
        if (existing) continue;
        await supabase.from("dancers").insert({
          first_name: firstName, last_name: lastName,
          date_of_birth: dobStr, gender: row["Gender"] || "Female",
          age, age_group: calcAgeGroup(age),
          studio_code: session.studio_code, studio_name: session.studio_name,
          membership_code: code, registration_fee: PRICING.registration
        });
        added++;
      }
      await load();
      notify(`✓ ${added} dancers imported from Excel!`);
    } catch(e) { notify("Import error: "+e.message, "#c0392b"); }
  };

  // ── Download template ──
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Name","Surname","DOB (YYYY-MM-DD)","Gender"],
      ["Sofia","Martini","2014-03-12","Female"],
      ["Luca","Rossi","2012-07-22","Male"],
    ]);
    ws["!cols"] = [{wch:15},{wch:15},{wch:18},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws, "Dancers");
    XLSX.writeFile(wb, "GrandeNational_DancerTemplate.xlsx");
  };

  const inv = invoice();

  return (
    <div style={S.app}>
      <audio ref={audioRef} onEnded={()=>setPlayingUrl(null)} />

      {/* Header */}
      <div style={{ background:"#0f0f0f", borderBottom:"1px solid #1e1e1e", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.3em", color:"#F27C20", textTransform:"uppercase" }}>Studio Portal</div>
          <div style={{ fontSize:18, marginTop:2 }}>{session.studio_name} <span style={{ fontSize:12, color:"#444" }}>· {session.studio_code}</span></div>
        </div>
        <button style={S.ghost("#666")} onClick={onLogout}>Logout</button>
      </div>

      <div style={{ maxWidth:980, margin:"0 auto", padding:"32px 24px" }}>
        {/* Invoice summary */}
        <div style={{ ...S.card, marginBottom:24, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:0, padding:0, overflow:"hidden" }}>
          {[
            { label:"Dancers", value:dancers.length, sub:`R${inv.regFees} reg fees`, color:"#F27C20" },
            { label:"Solo Entries", value:solos.length, sub:`R${inv.soloFees}`, color:"#F27C20" },
            { label:"Group Entries", value:groups.length, sub:`R${inv.groupFees}`, color:"#F27C20" },
            { label:"Estimated Total", value:`R${inv.total}`, sub:"excl. final invoice", color:"#F27C20" },
          ].map((st,i,arr)=>(
            <div key={st.label} style={{ padding:"18px 20px", textAlign:"center", borderRight:i<arr.length-1?"1px solid #1e1e1e":"none" }}>
              <div style={{ fontSize:26, color:st.color, fontStyle:"italic" }}>{st.value}</div>
              <div style={{ fontSize:10, color:"#444", textTransform:"uppercase", letterSpacing:"0.1em", marginTop:2 }}>{st.label}</div>
              <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{st.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:24, background:"#141414", padding:4, borderRadius:10, border:"1px solid #1e1e1e" }}>
          {[["dancers","👥 Dancers"],["solos","🎭 Solos"],["groups","👯 Groups & Duos"]].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", background:tab===key?"#F27C20":"transparent", color:tab===key?"#0a0a0a":"#555", cursor:"pointer", fontFamily:"Georgia,serif", fontSize:14, fontWeight:tab===key?"bold":"normal", transition:"all .2s" }}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#444" }}><Spinner /><div style={{marginTop:12}}>Loading...</div></div>
        ) : (
          <>
            {/* ── DANCERS TAB ── */}
            {tab === "dancers" && (
              <div>
                <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                  <button style={S.btn("#F27C20")} onClick={()=>setShowAddDancer(true)}>+ Add Dancer</button>
                  <button style={S.ghost("#F27C20")} onClick={downloadTemplate}>⬇ Download Excel Template</button>
                  <label style={{ ...S.ghost("#F27C20"), cursor:"pointer" }}>
                    📥 Import Excel
                    <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{ if(e.target.files[0]) handleExcelImport(e.target.files[0]); e.target.value=""; }} />
                  </label>
                </div>
                {dancers.length === 0 ? (
                  <div style={{ ...S.card, textAlign:"center", color:"#444", padding:48, fontStyle:"italic" }}>No dancers yet. Add dancers one by one or import from Excel.</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {dancers.map(d => {
                      const dSolos = solos.filter(s=>s.dancer_id===d.id);
                      const dGroups = groupMembers.filter(m=>m.dancer_id===d.id);
                      return (
                        <div key={d.id} style={{ ...S.card, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:"bold", fontSize:16 }}>{d.first_name} {d.last_name}</div>
                            <div style={{ fontSize:12, color:"#666", marginTop:3 }}>
                              {d.membership_code} · {d.gender} · Age {d.age} · {d.age_group}
                            </div>
                            <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                              <span style={S.tag("#F27C20")}>{dSolos.length} solo{dSolos.length!==1?"s":""}</span>
                              <span style={S.tag("#F27C20")}>{dGroups.length} group entry/ies</span>
                              <span style={S.tag("#F27C20")}>R{d.registration_fee} reg</span>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                            <button onClick={()=>setShowAddSolo(d)} style={S.ghost("#F27C20")}>+ Solo</button>
                            <button onClick={()=>setShowEditDancer(d)} style={S.ghost("#666")}>Edit</button>
                            <button onClick={async()=>{ if(!confirm(`Delete ${d.first_name}? This removes all their entries.`)) return; await supabase.from("dancers").delete().eq("id",d.id); await load(); notify(`${d.first_name} removed`); }} style={S.ghost("#F27C20")}>✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── SOLOS TAB ── */}
            {tab === "solos" && (
              <div>
                <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                  {dancers.length > 0 && <button style={S.btn("#F27C20")} onClick={()=>setShowAddSolo(dancers[0])}>+ Add Solo Entry</button>}
                </div>
                {solos.length === 0 ? (
                  <div style={{ ...S.card, textAlign:"center", color:"#444", padding:48, fontStyle:"italic" }}>No solo entries yet. Go to Dancers tab to add solos per dancer.</div>
                ) : (
                  <div>
                    {GENRES.map(genre => {
                      const genreSolos = solos.filter(s=>s.genre===genre);
                      if (!genreSolos.length) return null;
                      return (
                        <div key={genre} style={{ marginBottom:24 }}>
                          <div style={{ fontSize:11, letterSpacing:"0.15em", color:"#F27C20", textTransform:"uppercase", marginBottom:10 }}>{genre} ({genreSolos.length})</div>
                          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                            {genreSolos.map(s => {
                              const url = (s.file_path ? `https://xyezjpubmveizkzqbxue.supabase.co/storage/v1/object/public/mp3s/${s.file_path}` : null);
                              return (
                                <div key={s.id} style={{ ...S.card, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                                  <div>
                                    <div style={{fontWeight:"bold"}}>{s.dancer_name}</div>
                                    <div style={{fontSize:12,color:"#888",marginTop:2}}>"{s.song_title}" · {s.age_group} · R{s.fee}</div>
                                  </div>
                                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                    {url && <button onClick={()=>setPlayingUrl(p=>p===url?null:url)} style={{background:"#F27C2018",border:"none",borderRadius:6,padding:"6px 12px",color:"#F27C20",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center"}}>
                                      {playingUrl===url?"⏸":"▶"}<AudioBars playing={playingUrl===url}/>
                                    </button>}
                                    <button onClick={()=>setShowEditSolo(s)} style={S.ghost("#666")}>Edit</button>
                                    <button onClick={async()=>{ if(!confirm("Delete this solo entry?")) return; await supabase.from("solo_entries").delete().eq("id",s.id); await load(); notify("Solo removed"); }} style={S.ghost("#F27C20")}>✕</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── GROUPS TAB ── */}
            {tab === "groups" && (
              <div>
                <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                  <button style={S.btn("#F27C20")} onClick={()=>setShowAddGroup(true)}>+ Add Group / Duo</button>
                </div>
                {groups.length === 0 ? (
                  <div style={{ ...S.card, textAlign:"center", color:"#444", padding:48, fontStyle:"italic" }}>No group or duo entries yet.</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {groups.map(g => {
                      const members = groupMembers.filter(m=>m.group_entry_id===g.id);
                      const url = (g.file_path ? `https://xyezjpubmveizkzqbxue.supabase.co/storage/v1/object/public/mp3s/${g.file_path}` : null);
                      return (
                        <div key={g.id} style={S.card}>
                          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                            <div style={{flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                                <div style={{fontWeight:"bold",fontSize:16}}>{g.group_name}</div>
                                <span style={S.tag("#F27C20")}>{g.group_type}</span>
                                <span style={S.tag("#F27C20")}>{g.genre}</span>
                              </div>
                              <div style={{fontSize:12,color:"#888",marginTop:4}}>"{g.song_title}" · {g.age_group} · {g.member_count} dancers · R{g.total_fee} total</div>
                              <button onClick={()=>setShowGroupMembers(g)} style={{...S.ghost("#F27C20"),padding:"4px 12px",fontSize:12,marginTop:10}}>
                                👥 View {members.length} member{members.length!==1?"s":""}
                              </button>
                            </div>
                            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                              {url && <button onClick={()=>setPlayingUrl(p=>p===url?null:url)} style={{background:"#F27C2018",border:"none",borderRadius:6,padding:"6px 12px",color:"#F27C20",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center"}}>
                                {playingUrl===url?"⏸":"▶"}<AudioBars playing={playingUrl===url}/>
                              </button>}
                              <button onClick={()=>setShowEditGroup(g)} style={S.ghost("#666")}>Edit</button>
                              <button onClick={async()=>{ if(!confirm(`Delete group "${g.group_name}"?`)) return; await supabase.from("group_entries").delete().eq("id",g.id); await load(); notify("Group removed"); }} style={S.ghost("#F27C20")}>✕</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div style={S.disclaimer}>⚠️ Please wait for your final invoice before making payment. All fees displayed are estimates only.</div>
      </div>

      {/* Modals */}
      {showAddDancer && <AddDancerModal session={session} onClose={()=>setShowAddDancer(false)} onSave={async()=>{ await load(); setShowAddDancer(false); notify("✓ Dancer added!"); }} notify={notify} />}
      {showEditDancer && <EditDancerModal dancer={showEditDancer} onClose={()=>setShowEditDancer(null)} onSave={async()=>{ await load(); setShowEditDancer(null); notify("✓ Dancer updated!"); }} notify={notify} />}
      {showAddSolo && <AddSoloModal dancer={showAddSolo} dancers={dancers} session={session} onClose={()=>setShowAddSolo(null)} onSave={async()=>{ await load(); setShowAddSolo(null); notify("✓ Solo entry added!"); }} notify={notify} />}
      {showEditSolo && <EditSoloModal solo={showEditSolo} onClose={()=>setShowEditSolo(null)} onSave={async()=>{ await load(); setShowEditSolo(null); notify("✓ Solo updated!"); }} notify={notify} />}
      {showAddGroup && <AddGroupModal dancers={dancers} session={session} onClose={()=>setShowAddGroup(false)} onSave={async()=>{ await load(); setShowAddGroup(false); notify("✓ Group entry added!"); }} notify={notify} />}
      {showEditGroup && <EditGroupModal group={showEditGroup} dancers={dancers} groupMembers={groupMembers.filter(m=>m.group_entry_id===showEditGroup.id)} onClose={()=>setShowEditGroup(null)} onSave={async()=>{ await load(); setShowEditGroup(null); notify("✓ Group updated!"); }} notify={notify} />}
      {showGroupMembers && <GroupMembersModal group={showGroupMembers} members={groupMembers.filter(m=>m.group_entry_id===showGroupMembers.id)} onClose={()=>setShowGroupMembers(null)} />}
    </div>
  );
}

// ── ADD DANCER MODAL ──────────────────────────────────────────────
function AddDancerModal({ session, onClose, onSave, notify }) {
  const [form, setForm] = useState({ first_name:"", last_name:"", date_of_birth:"", gender:"Female" });
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const age = form.date_of_birth ? calcAge(form.date_of_birth) : null;
  const ageGroup = age !== null ? calcAgeGroup(age) : "";

  const save = async () => {
    if (!form.first_name.trim()||!form.last_name.trim()||!form.date_of_birth||!form.gender) { notify("All fields are required","#c0392b"); return; }
    setLoading(true);
    try {
      const code = membershipCode(session.studio_code, form.first_name, form.last_name, form.date_of_birth);
      const {error} = await supabase.from("dancers").insert({ ...form, age, age_group:ageGroup, studio_code:session.studio_code, studio_name:session.studio_name, membership_code:code, registration_fee:PRICING.registration }); if(error) throw error;
      onSave();
    } catch(e) { notify(e.message.includes("duplicate")?"Dancer already exists":e.message,"#c0392b"); }
    setLoading(false);
  };

  return (
    <Modal title="Add Dancer" onClose={onClose} color="#F27C20">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={S.label}>First Name *</label><input style={S.input} value={form.first_name} onChange={e=>set("first_name",e.target.value)} placeholder="Sofia" /></div>
          <div><label style={S.label}>Last Name *</label><input style={S.input} value={form.last_name} onChange={e=>set("last_name",e.target.value)} placeholder="Martini" /></div>
        </div>
        <div><label style={S.label}>Date of Birth *</label><input style={S.input} type="date" value={form.date_of_birth} onChange={e=>set("date_of_birth",e.target.value)} /></div>
        {age !== null && <div style={{padding:"8px 12px",background:"#F27C2018",borderRadius:8,fontSize:13,color:"#F27C20"}}>Age: {age} · {ageGroup}</div>}
        <div><label style={S.label}>Gender *</label>
          <select style={S.select} value={form.gender} onChange={e=>set("gender",e.target.value)}>
            <option>Female</option><option>Male</option>
          </select>
        </div>
        <div style={{padding:"8px 12px",background:"#1a1200",borderRadius:8,fontSize:12,color:"#a08c40"}}>Registration fee: R{PRICING.registration} (once-off per dancer)</div>
        <button style={S.btn("#F27C20")} onClick={save} disabled={loading}>{loading?<Spinner color="#0a0a0a"/>:"Add Dancer"}</button>
      </div>
    </Modal>
  );
}

// ── EDIT DANCER MODAL ──
function EditDancerModal({ dancer, onClose, onSave, notify }) {
  const [form, setForm] = useState({ first_name:dancer.first_name, last_name:dancer.last_name, date_of_birth:dancer.date_of_birth, gender:dancer.gender });
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const age = form.date_of_birth ? calcAge(form.date_of_birth) : dancer.age;
  const ageGroup = calcAgeGroup(age);

  const save = async () => {
    setLoading(true);
    try { const {error} = await supabase.from("dancers").update({ ...form, age, age_group:ageGroup }).eq("id",dancer.id); if(error) throw error; onSave(); }
    catch(e) { notify(e.message,"#c0392b"); }
    setLoading(false);
  };

  return (
    <Modal title="Edit Dancer" onClose={onClose} color="#F27C20">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={S.label}>First Name</label><input style={S.input} value={form.first_name} onChange={e=>set("first_name",e.target.value)} /></div>
          <div><label style={S.label}>Last Name</label><input style={S.input} value={form.last_name} onChange={e=>set("last_name",e.target.value)} /></div>
        </div>
        <div><label style={S.label}>Date of Birth</label><input style={S.input} type="date" value={form.date_of_birth} onChange={e=>set("date_of_birth",e.target.value)} /></div>
        {age !== null && <div style={{padding:"8px 12px",background:"#F27C2018",borderRadius:8,fontSize:13,color:"#F27C20"}}>Age: {age} · {ageGroup}</div>}
        <div><label style={S.label}>Gender</label>
          <select style={S.select} value={form.gender} onChange={e=>set("gender",e.target.value)}>
            <option>Female</option><option>Male</option>
          </select>
        </div>
        <button style={S.btn("#F27C20")} onClick={save} disabled={loading}>{loading?<Spinner color="#0a0a0a"/>:"Save Changes"}</button>
      </div>
    </Modal>
  );
}

// ── ADD SOLO MODAL ──
function AddSoloModal({ dancer: initialDancer, dancers, session, onClose, onSave, notify }) {
  const [selectedDancerId, setSelectedDancerId] = useState(initialDancer?.id || "");
  const [form, setForm] = useState({ genre:"Contemporary", song_title:"", file:null, fileName:"" });
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const dancer = dancers.find(d=>d.id===selectedDancerId) || initialDancer;

  const save = async () => {
    if (!dancer||!form.genre||!form.song_title.trim()||!form.file) { notify("All fields are required — please fill in dancer, genre, song title and upload a music file","#c0392b"); return; }
    setLoading(true);
    try {
      const path = `${session.studio_code}/solos/${dancer.id}_${form.genre}_${Date.now()}_${form.file.name}`;
      const {error:ue} = await supabase.storage.from("mp3s").upload(path, form.file, {upsert:true, contentType: form.file.type});
      if(ue) { throw new Error("File upload failed: " + ue.message + ". Please check the storage bucket is set to public in Supabase."); }
      const {error:ie} = await supabase.from("solo_entries").insert({
        dancer_id:dancer.id, dancer_name:`${dancer.first_name} ${dancer.last_name}`,
        membership_code:dancer.membership_code, studio_code:session.studio_code,
        studio_name:session.studio_name, genre:form.genre, song_title:form.song_title,
        age_group:dancer.age_group, file_name:form.file.name, file_path:path, fee:PRICING.solo
      });
      onSave();
    } catch(e) { notify(e.message,"#c0392b"); }
    setLoading(false);
  };

  return (
    <Modal title="Add Solo Entry" onClose={onClose} color="#F27C20">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={S.label}>Dancer *</label>
          <select style={S.select} value={selectedDancerId} onChange={e=>setSelectedDancerId(e.target.value)}>
            <option value="">Select dancer...</option>
            {dancers.map(d=><option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
          </select>
        </div>
        {dancer && <div style={{padding:"8px 12px",background:"#F27C2018",borderRadius:8,fontSize:12,color:"#F27C20"}}>Age group: {dancer.age_group.replace(" – Ballet/Rep point shoes optional","").replace(" – Ballet/Rep Pointe shoes optional","")}</div>}
        <div><label style={S.label}>Genre *</label>
          <select style={S.select} value={form.genre} onChange={e=>set("genre",e.target.value)}>
            {GENRES.map(g=><option key={g}>{g}</option>)}
          </select>
        </div>
        <div><label style={S.label}>Song Title *</label><input style={S.input} value={form.song_title} onChange={e=>set("song_title",e.target.value)} placeholder="e.g. Swan Lake Remix" /></div>
        <div>
          <label style={S.label}>MP3 / Music File *</label>
          <div onClick={()=>document.getElementById("soloFile").click()} style={{border:"2px dashed #2e2e2e",borderRadius:10,padding:20,textAlign:"center",cursor:"pointer",background:"#1c1c1c"}}>
            <input id="soloFile" type="file" accept=".mp3,.wav,.m4a,audio/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)set("file",f);set("fileName",f?.name||"");}} />
            {form.fileName?<div style={{color:"#F27C20"}}>🎵 {form.fileName}</div>:<div style={{color:"#444",fontSize:13}}>📁 Click to select music file (MP3, WAV, M4A)</div>}
          </div>
        </div>
        <div style={{padding:"12px 14px",background:"#1a1200",border:"1px solid #3a2e00",borderRadius:8,fontSize:12,color:"#a08c40",lineHeight:1.8}}>
          <div>Fee: <strong>R{PRICING.solo}</strong> per solo entry</div>
          {dancer && (form.genre==="Ballet"||form.genre==="Repertoire") && dancer.age_group==="Children (10–12)" && (
            <div style={{marginTop:4,color:"#F27C20"}}>🩰 Ages 10–12 Ballet/Repertoire — Pointe shoes optional</div>
          )}
          <div style={{marginTop:4,fontSize:11,color:"#666"}}>*Please wait for final invoice before making payment</div>
        </div>
        <button style={S.btn("#F27C20")} onClick={save} disabled={loading}>{loading?<Spinner color="#0a0a0a"/>:"Add Solo Entry"}</button>
      </div>
    </Modal>
  );
}

// ── EDIT SOLO MODAL ──
function EditSoloModal({ solo, onClose, onSave, notify }) {
  const [form, setForm] = useState({ genre:solo.genre, song_title:solo.song_title, file:null, fileName:"" });
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const save = async () => {
    setLoading(true);
    try {
      const updates = { genre:form.genre, song_title:form.song_title };
      if (form.file) {
        const path = `${solo.studio_code}/solos/${solo.dancer_id}_${form.genre}_${Date.now()}_${form.file.name}`;
        await supabase.storage.from("mp3s").upload(path, form.file, {upsert:true});
        updates.file_name = form.file.name;
        updates.file_path = path;
      }
      const {error:ue} = await supabase.from("solo_entries").update(updates).eq("id",solo.id); if(ue) throw ue;
      onSave();
    } catch(e) { notify(e.message,"#c0392b"); }
    setLoading(false);
  };

  return (
    <Modal title="Edit Solo Entry" onClose={onClose} color="#F27C20">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{padding:"8px 12px",background:"#F27C2018",borderRadius:8,fontSize:13,color:"#F27C20"}}>Dancer: {solo.dancer_name}</div>
        <div><label style={S.label}>Genre</label>
          <select style={S.select} value={form.genre} onChange={e=>set("genre",e.target.value)}>
            {GENRES.map(g=><option key={g}>{g}</option>)}
          </select>
        </div>
        <div><label style={S.label}>Song Title</label><input style={S.input} value={form.song_title} onChange={e=>set("song_title",e.target.value)} /></div>
        <div>
          <label style={S.label}>Replace Music File (optional)</label>
          <div onClick={()=>document.getElementById("editSoloFile").click()} style={{border:"2px dashed #2e2e2e",borderRadius:10,padding:20,textAlign:"center",cursor:"pointer",background:"#1c1c1c"}}>
            <input id="editSoloFile" type="file" accept=".mp3,.wav,.m4a,audio/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){set("file",f);set("fileName",f.name);}}} />
            {form.fileName?<div style={{color:"#F27C20"}}>🎵 {form.fileName}</div>:<div style={{color:"#444",fontSize:13}}>Current: {solo.file_name}<br/><span style={{fontSize:11}}>Click to replace</span></div>}
          </div>
        </div>
        <button style={S.btn("#F27C20")} onClick={save} disabled={loading}>{loading?<Spinner color="#0a0a0a"/>:"Save Changes"}</button>
      </div>
    </Modal>
  );
}

// ── ADD GROUP MODAL ──
function AddGroupModal({ dancers, session, onClose, onSave, notify }) {
  const [form, setForm] = useState({ group_name:"", genre:"Contemporary", song_title:"", age_group:"Mini (7–9)", file:null, fileName:"" });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const memberCount = selectedMembers.length;
  const gType = memberCount >= 2 ? groupType(memberCount) : "";
  const feePerPerson = memberCount >= 2 ? groupFee(memberCount) : 0;
  const totalFee = feePerPerson * memberCount;

  const toggleMember = (d) => {
    setSelectedMembers(prev => prev.find(m=>m.id===d.id) ? prev.filter(m=>m.id!==d.id) : [...prev,d]);
  };

  const save = async () => {
    if (!form.group_name.trim()||!form.genre||!form.song_title.trim()||!form.age_group||selectedMembers.length<2||!form.file) { notify("All fields are required — fill in group name, genre, song title, age group, select 2+ dancers and upload music","#c0392b"); return; }
    setLoading(true);
    try {
      const path = `${session.studio_code}/groups/${form.group_name.replace(/\s/g,"_")}_${Date.now()}_${form.file.name}`;
      const {error:gue} = await supabase.storage.from("mp3s").upload(path, form.file, {upsert:true});
      if(gue) throw gue;
      const {data:entryArr, error:gie} = await supabase.from("group_entries").insert({
        studio_code:session.studio_code, studio_name:session.studio_name,
        group_name:form.group_name, group_type:gType, genre:form.genre,
        song_title:form.song_title, age_group:form.age_group,
        member_count:memberCount, fee_per_person:feePerPerson,
        total_fee:totalFee, file_name:form.file.name, file_path:path
      }).select(); if(gie) throw gie; const entry=entryArr[0];
      for (const d of selectedMembers) {
        await supabase.from("group_members").insert({ group_entry_id:entry.id, dancer_id:d.id, dancer_name:`${d.first_name} ${d.last_name}`, membership_code:d.membership_code });
      }
      onSave();
    } catch(e) { notify(e.message,"#c0392b"); }
    setLoading(false);
  };

  return (
    <Modal title="Add Group / Duo Entry" onClose={onClose} color="#F27C20">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={S.label}>Group / Duo Name *</label><input style={S.input} value={form.group_name} onChange={e=>set("group_name",e.target.value)} placeholder="e.g. Leap Stars" /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={S.label}>Genre *</label>
            <select style={S.select} value={form.genre} onChange={e=>set("genre",e.target.value)}>
              {GENRES.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Age Group *</label>
            <select style={S.select} value={form.age_group} onChange={e=>set("age_group",e.target.value)}>
              <option value="">Select age group...</option>
              {AGE_GROUPS.map(ag=><option key={ag} value={ag}>{ag}</option>)}
            </select>
          </div>
        </div>
        <div><label style={S.label}>Song Title *</label><input style={S.input} value={form.song_title} onChange={e=>set("song_title",e.target.value)} placeholder="e.g. Hip Hop Groove" /></div>
        <div>
          <label style={S.label}>Select Dancers * (click to select)</label>
          <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
            {dancers.map(d=>{
              const sel = !!selectedMembers.find(m=>m.id===d.id);
              return (
                <div key={d.id} onClick={()=>toggleMember(d)} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${sel?"#F27C20":"#2e2e2e"}`,background:sel?"#F27C2018":"#1c1c1c",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>{d.first_name} {d.last_name} <span style={{fontSize:11,color:"#555"}}>· {d.age_group}</span></span>
                  {sel&&<span style={{color:"#F27C20"}}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
        {memberCount >= 2 && (
          <div style={{padding:"10px 14px",background:"#F27C2018",borderRadius:8,fontSize:13,color:"#F27C20"}}>
            {memberCount} dancers · {gType} · R{feePerPerson}pp · <strong>Total: R{totalFee}</strong>
          </div>
        )}
        <div>
          <label style={S.label}>Music File *</label>
          <div onClick={()=>document.getElementById("groupFile").click()} style={{border:"2px dashed #2e2e2e",borderRadius:10,padding:20,textAlign:"center",cursor:"pointer",background:"#1c1c1c"}}>
            <input id="groupFile" type="file" accept=".mp3,.wav,.m4a,audio/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){set("file",f);set("fileName",f.name);}}} />
            {form.fileName?<div style={{color:"#F27C20"}}>🎵 {form.fileName}</div>:<div style={{color:"#444",fontSize:13}}>📁 Click to select music file</div>}
          </div>
        </div>
        <button style={S.btn("#F27C20")} onClick={save} disabled={loading}>{loading?<Spinner color="#fff"/>:"Add Group Entry"}</button>
      </div>
    </Modal>
  );
}

// ── EDIT GROUP MODAL ──
function EditGroupModal({ group, dancers, groupMembers, onClose, onSave, notify }) {
  const [form, setForm] = useState({ group_name:group.group_name, genre:group.genre, song_title:group.song_title, age_group:group.age_group, file:null, fileName:"" });
  const [selectedMembers, setSelectedMembers] = useState(groupMembers.map(m=>({ id:m.dancer_id, first_name:m.dancer_name.split(" ")[0], last_name:m.dancer_name.split(" ").slice(1).join(" "), membership_code:m.membership_code, age_group:group.age_group })));
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const memberCount = selectedMembers.length;
  const gType = memberCount >= 2 ? groupType(memberCount) : "";
  const feePerPerson = memberCount >= 2 ? groupFee(memberCount) : 0;
  const totalFee = feePerPerson * memberCount;
  const toggleMember = (d) => setSelectedMembers(prev=>prev.find(m=>m.id===d.id)?prev.filter(m=>m.id!==d.id):[...prev,d]);

  const save = async () => {
    setLoading(true);
    try {
      const updates = { group_name:form.group_name, genre:form.genre, song_title:form.song_title, age_group:form.age_group, group_type:gType, member_count:memberCount, fee_per_person:feePerPerson, total_fee:totalFee };
      if (form.file) {
        const path = `${group.studio_code}/groups/${form.group_name.replace(/\s/g,"_")}_${Date.now()}_${form.file.name}`;
        await supabase.storage.from("mp3s").upload(path, form.file, {upsert:true});
        updates.file_name = form.file.name; updates.file_path = path;
      }
      const {error:gue2} = await supabase.from("group_entries").update(updates).eq("id",group.id); if(gue2) throw gue2;
      // update members: delete old, insert new
      for (const m of groupMembers) { await supabase.from("group_members").delete().eq("id",m.id); }
      for (const d of selectedMembers) {
        await supabase.from("group_members").insert({ group_entry_id:group.id, dancer_id:d.id, dancer_name:`${d.first_name} ${d.last_name}`, membership_code:d.membership_code });
      }
      onSave();
    } catch(e) { notify(e.message,"#c0392b"); }
    setLoading(false);
  };

  return (
    <Modal title="Edit Group Entry" onClose={onClose} color="#F27C20">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={S.label}>Group Name</label><input style={S.input} value={form.group_name} onChange={e=>set("group_name",e.target.value)} /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={S.label}>Genre</label><select style={S.select} value={form.genre} onChange={e=>set("genre",e.target.value)}>{GENRES.map(g=><option key={g}>{g}</option>)}</select></div>
          <div><label style={S.label}>Age Group</label><select style={S.select} value={form.age_group} onChange={e=>set("age_group",e.target.value)}>{AGE_GROUPS.map(ag=><option key={ag} value={ag}>{ag}</option>)}</select></div>
        </div>
        <div><label style={S.label}>Song Title</label><input style={S.input} value={form.song_title} onChange={e=>set("song_title",e.target.value)} /></div>
        <div>
          <label style={S.label}>Members</label>
          <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
            {dancers.map(d=>{
              const sel=!!selectedMembers.find(m=>m.id===d.id);
              return <div key={d.id} onClick={()=>toggleMember(d)} style={{padding:"9px 14px",borderRadius:8,border:`1px solid ${sel?"#F27C20":"#2e2e2e"}`,background:sel?"#F27C2018":"#1c1c1c",cursor:"pointer",display:"flex",justifyContent:"space-between"}}>
                <span>{d.first_name} {d.last_name}</span>{sel&&<span style={{color:"#F27C20"}}>✓</span>}
              </div>;
            })}
          </div>
        </div>
        {memberCount>=2&&<div style={{padding:"8px 12px",background:"#F27C2018",borderRadius:8,fontSize:13,color:"#F27C20"}}>{memberCount} dancers · {gType} · R{feePerPerson}pp · Total: R{totalFee}</div>}
        <div>
          <label style={S.label}>Replace Music (optional)</label>
          <div onClick={()=>document.getElementById("editGroupFile").click()} style={{border:"2px dashed #2e2e2e",borderRadius:10,padding:16,textAlign:"center",cursor:"pointer",background:"#1c1c1c"}}>
            <input id="editGroupFile" type="file" accept=".mp3,.wav,.m4a,audio/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){set("file",f);set("fileName",f.name);}}} />
            {form.fileName?<div style={{color:"#F27C20"}}>🎵 {form.fileName}</div>:<div style={{color:"#444",fontSize:12}}>Current: {group.file_name} · Click to replace</div>}
          </div>
        </div>
        <button style={S.btn("#F27C20")} onClick={save} disabled={loading}>{loading?<Spinner color="#fff"/>:"Save Changes"}</button>
      </div>
    </Modal>
  );
}

// ── GROUP MEMBERS VIEWER ──
function GroupMembersModal({ group, members, onClose }) {
  return (
    <Modal title={`${group.group_name} — Members`} onClose={onClose} color="#F27C20">
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <div style={{padding:"8px 12px",background:"#F27C2018",borderRadius:8,fontSize:13,color:"#F27C20",marginBottom:4}}>
          {group.group_type} · {group.genre} · {group.member_count} dancers
        </div>
        {members.map((m,i)=>(
          <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#1c1c1c",borderRadius:8,border:"1px solid #242424"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#c4713a22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#F27C20",fontWeight:"bold"}}>{i+1}</div>
            <div>
              <div style={{fontWeight:"bold"}}>{m.dancer_name}</div>
              <div style={{fontSize:11,color:"#555"}}>{m.membership_code}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── MODAL WRAPPER ──
function Modal({ title, onClose, color, children }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16,overflowY:"auto"}}>
      <div style={{...S.card,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,color}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
