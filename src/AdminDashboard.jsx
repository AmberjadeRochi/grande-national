import { useState, useEffect, useRef } from "react";
import { supabase, S, Spinner, AudioBars, GENRES, PRICING, C } from "./App.jsx";
import * as XLSX from "xlsx";

const ADMIN_PASSWORD = "GrandeNational2025!"; // Change this to your password

export default function AdminDashboard({ onBack, notify }) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [tab, setTab] = useState("studios");
  const [studios, setStudios] = useState([]);
  const [dancers, setDancers] = useState([]);
  const [solos, setSolos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingUrl, setPlayingUrl] = useState(null);
  const [filterStudio, setFilterStudio] = useState("all");
  const [filterGenre, setFilterGenre] = useState("all");
  const audioRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s1, s2, s3, s4, s5] = await Promise.all([
        supabase.from("studios").select("*").order("created_at", { ascending:false }),
        supabase.from("dancers").select("*").order("last_name"),
        supabase.from("solo_entries").select("*").order("created_at"),
        supabase.from("group_entries").select("*").order("created_at"),
        supabase.from("group_members").select("*"),
      ]);
      if (s1.error) throw s1.error;
      if (s2.error) throw s2.error;
      setStudios(s1.data||[]);
      setDancers(s2.data||[]);
      setSolos(s3.data||[]);
      setGroups(s4.data||[]);
      setGroupMembers(s5.data||[]);
    } catch(e) { notify("Load error: "+e.message,"#c0392b"); }
    setLoading(false);
  };

  useEffect(() => { if (authed) load(); }, [authed]);
  useEffect(() => {
    if (!audioRef.current) return;
    if (playingUrl) { audioRef.current.src=playingUrl; audioRef.current.play().catch(()=>{}); }
    else { audioRef.current.pause(); audioRef.current.src=""; }
  }, [playingUrl]);

  const fileUrl = (path) => path ? `https://xyezjpubmveizkzqbxue.supabase.co/storage/v1/object/public/mp3s/${path}` : null;

  const approveStudio = async (studio) => {
    const { error } = await supabase.from("studios").update({ status:"approved" }).eq("id", studio.id);
    if (error) { notify("Error: "+error.message,"#c0392b"); return; }
    setStudios(prev=>prev.map(s=>s.id===studio.id?{...s,status:"approved"}:s));
    notify(`✓ ${studio.studio_name} approved!`);
  };

  const rejectStudio = async (studio) => {
    if (!confirm(`Reject ${studio.studio_name}?`)) return;
    const { error } = await supabase.from("studios").update({ status:"rejected" }).eq("id", studio.id);
    if (error) { notify("Error: "+error.message,"#c0392b"); return; }
    setStudios(prev=>prev.map(s=>s.id===studio.id?{...s,status:"rejected"}:s));
    notify(`${studio.studio_name} rejected`,"#c0392b");
  };

  const exportMaster = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dancers.map(d=>({
      "Membership Code":d.membership_code,"First Name":d.first_name,"Last Name":d.last_name,
      "DOB":d.date_of_birth,"Age":d.age,"Age Group":d.age_group,"Gender":d.gender,"Studio":d.studio_name,"Reg Fee":`R${d.registration_fee}`
    }))), "Dancers");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(solos.map(s=>({
      "Dancer":s.dancer_name,"Studio":s.studio_name,"Genre":s.genre,"Song Title":s.song_title,"Age Group":s.age_group,"Fee":`R${s.fee}`,"File":s.file_name
    }))), "Solos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(groups.map(g=>({
      "Group Name":g.group_name,"Type":g.group_type,"Studio":g.studio_name,"Genre":g.genre,"Song":g.song_title,
      "Age Group":g.age_group,"Members":g.member_count,"Total Fee":`R${g.total_fee}`,
      "Member Names":groupMembers.filter(m=>m.group_entry_id===g.id).map(m=>m.dancer_name).join(", "),"File":g.file_name
    }))), "Groups");
    XLSX.writeFile(wb, "GrandeNational_Master.xlsx");
    notify("✓ Master export downloaded!");
  };

  const exportRunningOrder = () => {
    const wb = XLSX.utils.book_new();
    GENRES.forEach(genre => {
      const gs = solos.filter(s=>s.genre===genre);
      const gg = groups.filter(g=>g.genre===genre);
      if (!gs.length&&!gg.length) return;
      const rows = [];
      if (gs.length) { rows.push({"Type":"--- SOLOS ---","Name":"","Studio":"","Song":"","Age Group":""}); gs.forEach(s=>rows.push({"Type":"Solo","Name":s.dancer_name,"Studio":s.studio_name,"Song":s.song_title,"Age Group":s.age_group})); }
      if (gg.length) { rows.push({"Type":"--- GROUPS/DUOS ---","Name":"","Studio":"","Song":"","Age Group":""}); gg.forEach(g=>rows.push({"Type":g.group_type,"Name":g.group_name,"Studio":g.studio_name,"Song":g.song_title,"Age Group":g.age_group})); }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), genre.slice(0,31));
    });
    XLSX.writeFile(wb, "GrandeNational_RunningOrder.xlsx");
    notify("✓ Running order exported!");
  };

  const exportStudioInvoice = (studio) => {
    const wb = XLSX.utils.book_new();
    const sd = dancers.filter(d=>d.studio_code===studio.studio_code);
    const ss = solos.filter(s=>s.studio_code===studio.studio_code);
    const sg = groups.filter(g=>g.studio_code===studio.studio_code);
    const regFees=sd.length*PRICING.registration, soloFees=ss.length*PRICING.solo, groupFees=sg.reduce((a,g)=>a+g.total_fee,0);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      {"Item":"Registration Fees","Qty":sd.length,"Rate":`R${PRICING.registration}`,"Total":`R${regFees}`},
      {"Item":"Solo Entries","Qty":ss.length,"Rate":`R${PRICING.solo}`,"Total":`R${soloFees}`},
      {"Item":"Group/Duo Entries","Qty":sg.length,"Rate":"varies","Total":`R${groupFees}`},
      {"Item":"ESTIMATED TOTAL","Qty":"","Rate":"","Total":`R${regFees+soloFees+groupFees}`},
      {"Item":"⚠️ Wait for final invoice before payment","Qty":"","Rate":"","Total":""},
    ]), "Invoice");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sd.map(d=>{
      const ds=ss.filter(s=>s.dancer_id===d.id), dg=groupMembers.filter(m=>m.dancer_id===d.id);
      const sf=ds.length*PRICING.solo, gf=sg.filter(g=>dg.some(m=>m.group_entry_id===g.id)).reduce((a,g)=>a+g.fee_per_person,0);
      return {"Name":`${d.first_name} ${d.last_name}`,"Code":d.membership_code,"DOB":d.date_of_birth,"Age":d.age,"Age Group":d.age_group,"Gender":d.gender,"Reg Fee":`R${d.registration_fee}`,"Solo Entries":ds.length,"Solo Fees":`R${sf}`,"Group Entries":dg.length,"Group Fees":`R${gf}`,"Total":`R${d.registration_fee+sf+gf}`};
    })), "Dancers & Costs");
    if (ss.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ss.map(s=>({ "Dancer":s.dancer_name,"Genre":s.genre,"Song":s.song_title,"Age Group":s.age_group,"Fee":`R${s.fee}`,"File":s.file_name }))), "Solos");
    if (sg.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sg.map(g=>({ "Group":g.group_name,"Type":g.group_type,"Genre":g.genre,"Song":g.song_title,"Age Group":g.age_group,"Members":g.member_count,"Total":`R${g.total_fee}`,"Member Names":groupMembers.filter(m=>m.group_entry_id===g.id).map(m=>m.dancer_name).join(", "),"File":g.file_name }))), "Groups");
    XLSX.writeFile(wb, `GrandeNational_${studio.studio_code}_Invoice.xlsx`);
    notify(`✓ Invoice exported for ${studio.studio_name}!`);
  };

  const totalReg=dancers.length*PRICING.registration, totalSolo=solos.length*PRICING.solo, totalGroup=groups.reduce((a,g)=>a+g.total_fee,0);

  if (!authed) return (
    <div style={S.app}>
      <div style={{ maxWidth:400, margin:"0 auto", padding:"120px 24px" }}>
        <button style={S.back} onClick={onBack}>← Back</button>
        <div style={{ fontSize:10, letterSpacing:"0.4em", color:"#F27C20", textTransform:"uppercase", marginBottom:10 }}>Restricted</div>
        <h2 style={{ fontSize:28, fontWeight:"normal", margin:"0 0 28px" }}>Admin Login</h2>
        <div style={S.card}>
          <label style={S.label}>Admin Password</label>
          <input style={S.input} type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(pw===ADMIN_PASSWORD?setAuthed(true):notify("Incorrect password","#c0392b"))} placeholder="••••••••" />
          <button style={{...S.btn("#F27C20"),marginTop:16,width:"100%"}} onClick={()=>pw===ADMIN_PASSWORD?setAuthed(true):notify("Incorrect password","#c0392b")}>Enter Dashboard →</button>
        </div>
      </div>
    </div>
  );

  const filteredSolos = solos.filter(s=>(filterStudio==="all"||s.studio_code===filterStudio)&&(filterGenre==="all"||s.genre===filterGenre));
  const filteredGroups = groups.filter(g=>(filterStudio==="all"||g.studio_code===filterStudio)&&(filterGenre==="all"||g.genre===filterGenre));

  return (
    <div style={S.app}>
      <audio ref={audioRef} onEnded={()=>setPlayingUrl(null)} />
      <div style={{ background:"#0f0f0f", borderBottom:"1px solid #1e1e1e", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.3em", color:"#F27C20", textTransform:"uppercase" }}>Admin Dashboard</div>
          <div style={{ fontSize:18, marginTop:2 }}>Grande National HQ</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>{load();notify("✓ Refreshed");}} style={S.ghost("#555")}>↻ Refresh</button>
          <button onClick={onBack} style={S.ghost("#666")}>← Back</button>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:28 }}>
          {[
            {label:"Studios",value:studios.filter(s=>s.status==="approved").length,sub:`${studios.filter(s=>s.status==="pending").length} pending`,color:"#F27C20"},
            {label:"Dancers",value:dancers.length,sub:`R${totalReg} reg fees`,color:"#F27C20"},
            {label:"Solos",value:solos.length,sub:`R${totalSolo}`,color:"#F27C20"},
            {label:"Groups/Duos",value:groups.length,sub:`R${totalGroup}`,color:"#F27C20"},
            {label:"Est. Revenue",value:`R${totalReg+totalSolo+totalGroup}`,sub:"estimates only",color:"#a8e6cf"},
          ].map(st=>(
            <div key={st.label} style={{...S.card,padding:"16px 18px",textAlign:"center"}}>
              <div style={{fontSize:26,color:st.color,fontStyle:"italic"}}>{st.value}</div>
              <div style={{fontSize:10,color:"#ffffff",textTransform:"uppercase",letterSpacing:"0.1em",marginTop:2}}>{st.label}</div>
              <div style={{fontSize:11,color:"#ffffff",marginTop:2}}>{st.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
          <button onClick={exportMaster} style={S.btn("#F27C20")}>⬇ Master Export</button>
          <button onClick={exportRunningOrder} style={S.btn("#F27C20")}>⬇ Running Order by Genre</button>
        </div>

        <div style={{ display:"flex", gap:4, marginBottom:24, background:"#141414", padding:4, borderRadius:10, border:"1px solid #1e1e1e" }}>
          {[["studios","🏫 Studios"],["dancers","👥 Dancers"],["solos","🎭 Solos"],["groups","👯 Groups & Duos"],["invoices","💰 Invoices"]].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{ flex:1, padding:"10px 6px", borderRadius:8, border:"none", background:tab===key?"#F27C20":"transparent", color:tab===key?"#fff":"#555", cursor:"pointer", fontFamily:"Georgia,serif", fontSize:13, fontWeight:tab===key?"bold":"normal", transition:"all .2s" }}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:60,color:"#ffffff"}}><Spinner/><div style={{marginTop:12}}>Loading...</div></div>
        ) : (
          <>
            {tab==="studios" && (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {studios.length===0 && <div style={{...S.card,textAlign:"center",color:"#ffffff",fontStyle:"italic",padding:40}}>No studio registrations yet.</div>}
                {["pending","approved","rejected"].map(status=>{
                  const list=studios.filter(s=>s.status===status);
                  if (!list.length) return null;
                  return (
                    <div key={status}>
                      <div style={{fontSize:11,letterSpacing:"0.15em",color:status==="approved"?"#F27C20":status==="pending"?"#F27C20":"#F27C20",textTransform:"uppercase",marginBottom:10,marginTop:8}}>
                        {status} ({list.length})
                      </div>
                      {list.map(s=>(
                        <div key={s.id} style={{...S.card,marginBottom:10}}>
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:"bold",fontSize:16}}>{s.studio_name} <span style={{fontSize:12,color:"#ffffff"}}>· {s.studio_code}</span></div>
                              <div style={{fontSize:12,color:"#ffffff",marginTop:4,lineHeight:1.8}}>
                                📧 {s.studio_email} · 📞 {s.studio_contact_nr||"—"}<br/>
                                📍 {s.studio_address||"—"}<br/>
                                👤 {s.studio_owner_name||"—"} · {s.studio_owner_contact_nr||"—"}
                              </div>
                              <div style={{marginTop:8}}><span style={S.tag(status==="approved"?"#F27C20":status==="pending"?"#F27C20":"#F27C20")}>{status}</span></div>
                            </div>
                            {status==="pending" && (
                              <div style={{display:"flex",gap:8,flexShrink:0}}>
                                <button onClick={()=>approveStudio(s)} style={S.btn("#F27C20")}>✓ Approve</button>
                                <button onClick={()=>rejectStudio(s)} style={S.ghost("#F27C20")}>✕ Reject</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {tab==="dancers" && (
              <div>
                <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                  <select style={{...S.select,width:"auto",minWidth:180}} value={filterStudio} onChange={e=>setFilterStudio(e.target.value)}>
                    <option value="all">All Studios</option>
                    {studios.filter(s=>s.status==="approved").map(s=><option key={s.id} value={s.studio_code}>{s.studio_name}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {dancers.filter(d=>filterStudio==="all"||d.studio_code===filterStudio).map(d=>{
                    const ds=solos.filter(s=>s.dancer_id===d.id), dg=groupMembers.filter(m=>m.dancer_id===d.id);
                    const sf=ds.length*PRICING.solo, gf=groups.filter(g=>dg.some(m=>m.group_entry_id===g.id)).reduce((a,g)=>a+g.fee_per_person,0);
                    return (
                      <div key={d.id} style={{...S.card,padding:"14px 18px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div>
                            <div style={{fontWeight:"bold"}}>{d.first_name} {d.last_name} <span style={{fontSize:12,color:"#ffffff"}}>· {d.membership_code}</span></div>
                            <div style={{fontSize:12,color:"#ffffff",marginTop:3}}>{d.studio_name} · {d.gender} · Age {d.age} · {d.age_group}</div>
                            <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                              <span style={S.tag("#F27C20")}>{ds.length} solos</span>
                              <span style={S.tag("#F27C20")}>{dg.length} groups</span>
                              <span style={S.tag("#F27C20")}>Est. R{d.registration_fee+sf+gf}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab==="solos" && (
              <div>
                <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                  <select style={{...S.select,width:"auto",minWidth:180}} value={filterStudio} onChange={e=>setFilterStudio(e.target.value)}>
                    <option value="all">All Studios</option>
                    {studios.filter(s=>s.status==="approved").map(s=><option key={s.id} value={s.studio_code}>{s.studio_name}</option>)}
                  </select>
                  <select style={{...S.select,width:"auto",minWidth:150}} value={filterGenre} onChange={e=>setFilterGenre(e.target.value)}>
                    <option value="all">All Genres</option>
                    {GENRES.map(g=><option key={g}>{g}</option>)}
                  </select>
                </div>
                {filteredSolos.length===0 && <div style={{...S.card,textAlign:"center",color:"#ffffff",padding:40,fontStyle:"italic"}}>No solo entries found.</div>}
                {GENRES.map(genre=>{
                  const items=filteredSolos.filter(s=>s.genre===genre);
                  if (!items.length) return null;
                  return (
                    <div key={genre} style={{marginBottom:24}}>
                      <div style={{fontSize:11,letterSpacing:"0.15em",color:"#F27C20",textTransform:"uppercase",marginBottom:10}}>{genre} ({items.length})</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {items.map(s=>{
                          const url=fileUrl(s.file_path);
                          return (
                            <div key={s.id} style={{...S.card,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                              <div>
                                <div style={{fontWeight:"bold"}}>{s.dancer_name} <span style={{fontSize:11,color:"#ffffff"}}>· {s.membership_code}</span></div>
                                <div style={{fontSize:12,color:"#cccccc",marginTop:2}}>"{s.song_title}" · {s.studio_name} · {s.age_group}</div>
                              </div>
                              {url && <button onClick={()=>setPlayingUrl(p=>p===url?null:url)} style={{background:"#F27C2018",border:"none",borderRadius:6,padding:"6px 14px",color:"#F27C20",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center"}}>
                                {playingUrl===url?"⏸":"▶"}<AudioBars playing={playingUrl===url}/>
                              </button>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab==="groups" && (
              <div>
                <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                  <select style={{...S.select,width:"auto",minWidth:180}} value={filterStudio} onChange={e=>setFilterStudio(e.target.value)}>
                    <option value="all">All Studios</option>
                    {studios.filter(s=>s.status==="approved").map(s=><option key={s.id} value={s.studio_code}>{s.studio_name}</option>)}
                  </select>
                  <select style={{...S.select,width:"auto",minWidth:150}} value={filterGenre} onChange={e=>setFilterGenre(e.target.value)}>
                    <option value="all">All Genres</option>
                    {GENRES.map(g=><option key={g}>{g}</option>)}
                  </select>
                </div>
                {filteredGroups.length===0 && <div style={{...S.card,textAlign:"center",color:"#ffffff",padding:40,fontStyle:"italic"}}>No group entries found.</div>}
                {GENRES.map(genre=>{
                  const items=filteredGroups.filter(g=>g.genre===genre);
                  if (!items.length) return null;
                  return (
                    <div key={genre} style={{marginBottom:24}}>
                      <div style={{fontSize:11,letterSpacing:"0.15em",color:"#F27C20",textTransform:"uppercase",marginBottom:10}}>{genre} ({items.length})</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {items.map(g=>{
                          const members=groupMembers.filter(m=>m.group_entry_id===g.id);
                          const url=fileUrl(g.file_path);
                          return (
                            <div key={g.id} style={S.card}>
                              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                                    <span style={{fontWeight:"bold",fontSize:15}}>{g.group_name}</span>
                                    <span style={S.tag("#F27C20")}>{g.group_type}</span>
                                    <span style={{fontSize:12,color:"#ffffff"}}>{g.studio_name}</span>
                                  </div>
                                  <div style={{fontSize:12,color:"#cccccc",marginTop:4}}>"{g.song_title}" · {g.age_group} · R{g.total_fee}</div>
                                  <div style={{marginTop:8}}>
                                    <div style={{fontSize:11,color:"#ffffff",marginBottom:4}}>Members:</div>
                                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{members.map(m=><span key={m.id} style={S.tag("#555")}>{m.dancer_name}</span>)}</div>
                                  </div>
                                </div>
                                {url && <button onClick={()=>setPlayingUrl(p=>p===url?null:url)} style={{background:"#F27C2018",border:"none",borderRadius:6,padding:"6px 14px",color:"#F27C20",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",flexShrink:0}}>
                                  {playingUrl===url?"⏸":"▶"}<AudioBars playing={playingUrl===url}/>
                                </button>}
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

            {tab==="invoices" && (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {studios.filter(s=>s.status==="approved").length===0 && <div style={{...S.card,textAlign:"center",color:"#ffffff",padding:40,fontStyle:"italic"}}>No approved studios yet.</div>}
                {studios.filter(s=>s.status==="approved").map(studio=>{
                  const sd=dancers.filter(d=>d.studio_code===studio.studio_code);
                  const ss=solos.filter(s=>s.studio_code===studio.studio_code);
                  const sg=groups.filter(g=>g.studio_code===studio.studio_code);
                  const reg=sd.length*PRICING.registration, sol=ss.length*PRICING.solo, grp=sg.reduce((a,g)=>a+g.total_fee,0);
                  return (
                    <div key={studio.id} style={S.card}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:"bold",fontSize:17}}>{studio.studio_name}</div>
                          <div style={{fontSize:12,color:"#ffffff",marginTop:4}}>{studio.studio_code} · {studio.studio_email}</div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginTop:14}}>
                            {[
                              {label:"Reg fees",value:`R${reg}`,sub:`${sd.length} dancers`},
                              {label:"Solo fees",value:`R${sol}`,sub:`${ss.length} entries`},
                              {label:"Group fees",value:`R${grp}`,sub:`${sg.length} entries`},
                              {label:"Est. Total",value:`R${reg+sol+grp}`,sub:"estimate only",bold:true},
                            ].map(it=>(
                              <div key={it.label} style={{padding:"10px 12px",background:"#1c1c1c",borderRadius:8,border:"1px solid #242424"}}>
                                <div style={{fontSize:it.bold?18:15,color:it.bold?"#F27C20":"#f0ece0",fontWeight:it.bold?"bold":"normal"}}>{it.value}</div>
                                <div style={{fontSize:10,color:"#ffffff",textTransform:"uppercase",letterSpacing:"0.08em"}}>{it.label}</div>
                                <div style={{fontSize:11,color:"#ffffff"}}>{it.sub}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={()=>exportStudioInvoice(studio)} style={S.ghost("#F27C20")}>⬇ Export</button>
                      </div>
                    </div>
                  );
                })}
                <div style={S.disclaimer}>⚠️ All amounts are estimates. Issue final invoices separately before requesting payment.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
