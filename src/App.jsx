import { useState, useEffect, useRef } from "react";
import { db, S, Spinner, Toast, AudioBars, GENRES, PRICING } from "./App.jsx";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

const ADMIN_PASSWORD = "GrandeNational2025!";

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
      const [st, da, so, gr, gm] = await Promise.all([
        db.get("studios"),
        db.get("dancers"),
        db.get("solo_entries"),
        db.get("group_entries"),
        db.get("group_members"),
      ]);
      setStudios(st); setDancers(da); setSolos(so); setGroups(gr); setGroupMembers(gm);
    } catch(e) { notify("Load error: " + e.message, "#c0392b"); }
    setLoading(false);
  };

  useEffect(() => { if (authed) load(); }, [authed]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (playingUrl) { audioRef.current.src = playingUrl; audioRef.current.play().catch(() => {}); }
    else { audioRef.current.pause(); audioRef.current.src = ""; }
  }, [playingUrl]);

  const approveStudio = async (studio) => {
    await db.update("studios", studio.id, { status: "approved" });
    setStudios(prev => prev.map(s => s.id === studio.id ? { ...s, status: "approved" } : s));
    notify(`✓ ${studio.studio_name} approved!`);
  };

  const rejectStudio = async (studio) => {
    if (!confirm(`Reject ${studio.studio_name}?`)) return;
    await db.update("studios", studio.id, { status: "rejected" });
    setStudios(prev => prev.map(s => s.id === studio.id ? { ...s, status: "rejected" } : s));
    notify(`${studio.studio_name} rejected`, "#c0392b");
  };

  // ── EXPORTS ──────────────────────────────────────────────────────
  const exportMasterCSV = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: All dancers
    const dancerRows = dancers.map(d => ({
      "Membership Code": d.membership_code,
      "First Name": d.first_name,
      "Last Name": d.last_name,
      "DOB": d.date_of_birth,
      "Age": d.age,
      "Age Group": d.age_group,
      "Gender": d.gender,
      "Studio": d.studio_name,
      "Reg Fee": d.registration_fee,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dancerRows), "Dancers");

    // Sheet 2: All solos
    const soloRows = solos.map(s => ({
      "Dancer Name": s.dancer_name,
      "Membership Code": s.membership_code,
      "Studio": s.studio_name,
      "Genre": s.genre,
      "Song Title": s.song_title,
      "Age Group": s.age_group,
      "Fee": s.fee,
      "File Name": s.file_name,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(soloRows), "Solos");

    // Sheet 3: All groups
    const groupRows = groups.map(g => ({
      "Group Name": g.group_name,
      "Type": g.group_type,
      "Studio": g.studio_name,
      "Genre": g.genre,
      "Song Title": g.song_title,
      "Age Group": g.age_group,
      "Members": g.member_count,
      "Fee Per Person": g.fee_per_person,
      "Total Fee": g.total_fee,
      "File Name": g.file_name,
      "Member Names": groupMembers.filter(m => m.group_entry_id === g.id).map(m => m.dancer_name).join(", "),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(groupRows), "Groups");

    XLSX.writeFile(wb, "GrandeNational_Master.xlsx");
    notify("✓ Master export downloaded!");
  };

  const exportStudioInvoice = (studio) => {
    const wb = XLSX.utils.book_new();
    const stDancers = dancers.filter(d => d.studio_code === studio.studio_code);
    const stSolos = solos.filter(s => s.studio_code === studio.studio_code);
    const stGroups = groups.filter(g => g.studio_code === studio.studio_code);

    // Invoice summary sheet
    const regFees = stDancers.length * PRICING.registration;
    const soloFees = stSolos.length * PRICING.solo;
    const groupFees = stGroups.reduce((a, g) => a + g.total_fee, 0);
    const total = regFees + soloFees + groupFees;

    const summaryRows = [
      { "Item": "Registration Fees", "Qty": stDancers.length, "Rate": `R${PRICING.registration}`, "Total": `R${regFees}` },
      { "Item": "Solo Entries", "Qty": stSolos.length, "Rate": `R${PRICING.solo}`, "Total": `R${soloFees}` },
      { "Item": "Group/Duo Entries (total)", "Qty": stGroups.length, "Rate": "varies", "Total": `R${groupFees}` },
      { "Item": "ESTIMATED TOTAL", "Qty": "", "Rate": "", "Total": `R${total}` },
      { "Item": "⚠️ Please wait for final invoice before payment", "Qty": "", "Rate": "", "Total": "" },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Invoice Summary");

    // Dancers sheet
    const dancerRows = stDancers.map(d => {
      const dSolos = stSolos.filter(s => s.dancer_id === d.id);
      const dGroups = groupMembers.filter(m => m.dancer_id === d.id);
      const soloTotal = dSolos.length * PRICING.solo;
      const groupTotal = stGroups.filter(g => dGroups.some(m => m.group_entry_id === g.id)).reduce((a, g) => a + g.fee_per_person, 0);
      return {
        "Name": `${d.first_name} ${d.last_name}`,
        "Membership Code": d.membership_code,
        "DOB": d.date_of_birth,
        "Age": d.age,
        "Age Group": d.age_group,
        "Gender": d.gender,
        "Reg Fee": `R${d.registration_fee}`,
        "Solo Entries": dSolos.length,
        "Solo Fees": `R${soloTotal}`,
        "Group Entries": dGroups.length,
        "Group Fees (approx)": `R${groupTotal}`,
        "Dancer Total": `R${d.registration_fee + soloTotal + groupTotal}`,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dancerRows), "Dancers & Costs");

    // Solos sheet
    const soloRows = stSolos.map(s => ({
      "Dancer": s.dancer_name,
      "Genre": s.genre,
      "Song Title": s.song_title,
      "Age Group": s.age_group,
      "Fee": `R${s.fee}`,
      "File": s.file_name,
    }));
    if (soloRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(soloRows), "Solos");

    // Groups sheet
    const groupRows = stGroups.map(g => ({
      "Group Name": g.group_name,
      "Type": g.group_type,
      "Genre": g.genre,
      "Song Title": g.song_title,
      "Age Group": g.age_group,
      "Members": g.member_count,
      "Fee pp": `R${g.fee_per_person}`,
      "Total": `R${g.total_fee}`,
      "Member Names": groupMembers.filter(m => m.group_entry_id === g.id).map(m => m.dancer_name).join(", "),
      "File": g.file_name,
    }));
    if (groupRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(groupRows), "Groups");

    XLSX.writeFile(wb, `GrandeNational_${studio.studio_code}_Invoice.xlsx`);
    notify(`✓ Invoice exported for ${studio.studio_name}!`);
  };

  const exportRunningOrder = () => {
    const wb = XLSX.utils.book_new();
    GENRES.forEach(genre => {
      const genreSolos = solos.filter(s => s.genre === genre);
      const genreGroups = groups.filter(g => g.genre === genre);
      if (!genreSolos.length && !genreGroups.length) return;
      const rows = [];
      if (genreSolos.length) {
        rows.push({ "Type": "--- SOLOS ---", "Name": "", "Studio": "", "Song": "", "Age Group": "", "File": "" });
        genreSolos.forEach(s => rows.push({ "Type": "Solo", "Name": s.dancer_name, "Studio": s.studio_name, "Song": s.song_title, "Age Group": s.age_group, "File": s.file_name }));
      }
      if (genreGroups.length) {
        rows.push({ "Type": "--- GROUPS/DUOS ---", "Name": "", "Studio": "", "Song": "", "Age Group": "", "File": "" });
        genreGroups.forEach(g => rows.push({ "Type": g.group_type, "Name": g.group_name, "Studio": g.studio_name, "Song": g.song_title, "Age Group": g.age_group, "File": g.file_name }));
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), genre.slice(0, 31));
    });
    XLSX.writeFile(wb, "GrandeNational_RunningOrder.xlsx");
    notify("✓ Running order exported!");
  };

  // ── LOGIN SCREEN ──
  if (!authed) return (
    <div style={S.app}>
      <div style={{ maxWidth:400, margin:"0 auto", padding:"120px 24px" }}>
        <button style={S.back} onClick={onBack}>← Back</button>
        <div style={{ fontSize:10, letterSpacing:"0.4em", color:"#ff6b6b", textTransform:"uppercase", marginBottom:10 }}>Restricted Area</div>
        <h2 style={{ fontSize:28, fontWeight:"normal", margin:"0 0 28px" }}>Admin Login</h2>
        <div style={S.card}>
          <label style={S.label}>Admin Password</label>
          <input style={S.input} type="password" value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (pw === ADMIN_PASSWORD ? setAuthed(true) : notify("Incorrect password", "#c0392b"))}
            placeholder="••••••••" />
          <button style={{ ...S.btn("#ff6b6b"), marginTop:16, width:"100%" }}
            onClick={() => pw === ADMIN_PASSWORD ? setAuthed(true) : notify("Incorrect password", "#c0392b")}>
            Enter Dashboard →
          </button>
          <div style={{ fontSize:11, color:"#333", marginTop:16, textAlign:"center" }}>
            Default password: GrandeNational2025!<br/>Change this in AdminDashboard.jsx before launch
          </div>
        </div>
      </div>
    </div>
  );

  const filteredSolos = solos.filter(s =>
    (filterStudio === "all" || s.studio_code === filterStudio) &&
    (filterGenre === "all" || s.genre === filterGenre)
  );
  const filteredGroups = groups.filter(g =>
    (filterStudio === "all" || g.studio_code === filterStudio) &&
    (filterGenre === "all" || g.genre === filterGenre)
  );

  const totalReg = dancers.length * PRICING.registration;
  const totalSolos = solos.length * PRICING.solo;
  const totalGroups = groups.reduce((a, g) => a + g.total_fee, 0);
  const grandTotal = totalReg + totalSolos + totalGroups;

  return (
    <div style={S.app}>
      <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} />

      {/* Header */}
      <div style={{ background:"#0f0f0f", borderBottom:"1px solid #1e1e1e", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.3em", color:"#ff6b6b", textTransform:"uppercase" }}>Admin Dashboard</div>
          <div style={{ fontSize:18, marginTop:2 }}>Grande National HQ</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => { load(); notify("✓ Data refreshed"); }} style={S.ghost("#555")}>↻ Refresh</button>
          <button onClick={onBack} style={S.ghost("#666")}>← Back</button>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:28 }}>
          {[
            { label:"Studios", value:studios.filter(s=>s.status==="approved").length, sub:`${studios.filter(s=>s.status==="pending").length} pending`, color:"#a78bfa" },
            { label:"Dancers", value:dancers.length, sub:`R${totalReg} reg fees`, color:"#4ecdc4" },
            { label:"Solos", value:solos.length, sub:`R${totalSolos}`, color:"#e8c547" },
            { label:"Groups/Duos", value:groups.length, sub:`R${totalGroups}`, color:"#ff6b6b" },
            { label:"Est. Total Revenue", value:`R${grandTotal}`, sub:"estimates only", color:"#a8e6cf" },
          ].map((st, i, arr) => (
            <div key={st.label} style={{ ...S.card, padding:"16px 18px", textAlign:"center" }}>
              <div style={{ fontSize:26, color:st.color, fontStyle:"italic" }}>{st.value}</div>
              <div style={{ fontSize:10, color:"#444", textTransform:"uppercase", letterSpacing:"0.1em", marginTop:2 }}>{st.label}</div>
              <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{st.sub}</div>
            </div>
          ))}
        </div>

        {/* Export buttons */}
        <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
          <button onClick={exportMasterCSV} style={S.btn("#ff6b6b")}>⬇ Master Export (All)</button>
          <button onClick={exportRunningOrder} style={S.btn("#e8c547")}>⬇ Running Order by Genre</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:24, background:"#141414", padding:4, borderRadius:10, border:"1px solid #1e1e1e" }}>
          {[["studios","🏫 Studios"],["dancers","👥 Dancers"],["solos","🎭 Solos"],["groups","👯 Groups & Duos"],["invoices","💰 Invoices"]].map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex:1, padding:"10px 6px", borderRadius:8, border:"none", background:tab===key?"#ff6b6b":"transparent", color:tab===key?"#fff":"#555", cursor:"pointer", fontFamily:"Georgia,serif", fontSize:13, fontWeight:tab===key?"bold":"normal", transition:"all .2s" }}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#444" }}><Spinner /><div style={{marginTop:12}}>Loading...</div></div>
        ) : (
          <>
            {/* ── STUDIOS ── */}
            {tab === "studios" && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {studios.length === 0 && <div style={{ ...S.card, textAlign:"center", color:"#444", fontStyle:"italic", padding:40 }}>No studio registrations yet.</div>}
                {["pending","approved","rejected"].map(status => {
                  const list = studios.filter(s => s.status === status);
                  if (!list.length) return null;
                  return (
                    <div key={status}>
                      <div style={{ fontSize:11, letterSpacing:"0.15em", color:status==="approved"?"#4ecdc4":status==="pending"?"#e8c547":"#ff6b6b", textTransform:"uppercase", marginBottom:10 }}>
                        {status} ({list.length})
                      </div>
                      {list.map(s => (
                        <div key={s.id} style={{ ...S.card, marginBottom:10 }}>
                          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:"bold", fontSize:16 }}>{s.studio_name} <span style={{ fontSize:12, color:"#555" }}>· {s.studio_code}</span></div>
                              <div style={{ fontSize:12, color:"#666", marginTop:4, lineHeight:1.7 }}>
                                📍 {s.studio_address || "—"}<br/>
                                📧 {s.studio_email} · 📞 {s.studio_contact_nr || "—"}<br/>
                                👤 {s.studio_owner_name || "—"} · {s.studio_owner_email || "—"} · {s.studio_owner_contact_nr || "—"}
                              </div>
                              <div style={{ marginTop:8 }}>
                                <span style={S.tag(status==="approved"?"#4ecdc4":status==="pending"?"#e8c547":"#ff6b6b")}>
                                  {status}
                                </span>
                              </div>
                            </div>
                            {status === "pending" && (
                              <div style={{ display:"flex", gap:8 }}>
                                <button onClick={() => approveStudio(s)} style={S.btn("#4ecdc4")}>✓ Approve</button>
                                <button onClick={() => rejectStudio(s)} style={S.ghost("#ff6b6b")}>✕ Reject</button>
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

            {/* ── DANCERS ── */}
            {tab === "dancers" && (
              <div>
                <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
                  <select style={{ ...S.select, width:"auto", minWidth:180 }} value={filterStudio} onChange={e => setFilterStudio(e.target.value)}>
                    <option value="all">All Studios</option>
                    {studios.filter(s=>s.status==="approved").map(s => <option key={s.id} value={s.studio_code}>{s.studio_name}</option>)}
                  </select>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {dancers.filter(d => filterStudio==="all"||d.studio_code===filterStudio).map(d => {
                    const dSolos = solos.filter(s => s.dancer_id === d.id);
                    const dGroups = groupMembers.filter(m => m.dancer_id === d.id);
                    const soloFees = dSolos.length * PRICING.solo;
                    const groupFees = groups.filter(g => dGroups.some(m => m.group_entry_id === g.id)).reduce((a, g) => a + g.fee_per_person, 0);
                    return (
                      <div key={d.id} style={{ ...S.card, padding:"14px 18px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div>
                            <div style={{ fontWeight:"bold" }}>{d.first_name} {d.last_name} <span style={{ fontSize:12, color:"#555" }}>· {d.membership_code}</span></div>
                            <div style={{ fontSize:12, color:"#666", marginTop:3 }}>{d.studio_name} · {d.gender} · Age {d.age} · {d.age_group}</div>
                            <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                              <span style={S.tag("#4ecdc4")}>{dSolos.length} solos</span>
                              <span style={S.tag("#a78bfa")}>{dGroups.length} groups</span>
                              <span style={S.tag("#e8c547")}>Est. R{d.registration_fee + soloFees + groupFees}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SOLOS ── */}
            {tab === "solos" && (
              <div>
                <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                  <select style={{ ...S.select, width:"auto", minWidth:180 }} value={filterStudio} onChange={e => setFilterStudio(e.target.value)}>
                    <option value="all">All Studios</option>
                    {studios.filter(s=>s.status==="approved").map(s => <option key={s.id} value={s.studio_code}>{s.studio_name}</option>)}
                  </select>
                  <select style={{ ...S.select, width:"auto", minWidth:150 }} value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
                    <option value="all">All Genres</option>
                    {GENRES.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                {GENRES.map(genre => {
                  const items = filteredSolos.filter(s => s.genre === genre);
                  if (!items.length) return null;
                  return (
                    <div key={genre} style={{ marginBottom:24 }}>
                      <div style={{ fontSize:11, letterSpacing:"0.15em", color:"#e8c547", textTransform:"uppercase", marginBottom:10 }}>
                        {genre} — {items.length} solo{items.length!==1?"s":""}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {items.map(s => {
                          const url = db.fileUrl(s.file_path);
                          return (
                            <div key={s.id} style={{ ...S.card, padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                              <div>
                                <div style={{ fontWeight:"bold" }}>{s.dancer_name} <span style={{ fontSize:11, color:"#555" }}>· {s.membership_code}</span></div>
                                <div style={{ fontSize:12, color:"#888", marginTop:2 }}>"{s.song_title}" · {s.studio_name} · {s.age_group}</div>
                              </div>
                              {url && (
                                <button onClick={() => setPlayingUrl(p => p===url?null:url)} style={{ background:"#e8c54718", border:"none", borderRadius:6, padding:"6px 14px", color:"#e8c547", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center" }}>
                                  {playingUrl===url?"⏸":"▶"}<AudioBars playing={playingUrl===url}/>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {filteredSolos.length === 0 && <div style={{ ...S.card, textAlign:"center", color:"#444", padding:40, fontStyle:"italic" }}>No solo entries match your filters.</div>}
              </div>
            )}

            {/* ── GROUPS ── */}
            {tab === "groups" && (
              <div>
                <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                  <select style={{ ...S.select, width:"auto", minWidth:180 }} value={filterStudio} onChange={e => setFilterStudio(e.target.value)}>
                    <option value="all">All Studios</option>
                    {studios.filter(s=>s.status==="approved").map(s => <option key={s.id} value={s.studio_code}>{s.studio_name}</option>)}
                  </select>
                  <select style={{ ...S.select, width:"auto", minWidth:150 }} value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
                    <option value="all">All Genres</option>
                    {GENRES.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                {filteredGroups.length === 0 && <div style={{ ...S.card, textAlign:"center", color:"#444", padding:40, fontStyle:"italic" }}>No group entries match your filters.</div>}
                {GENRES.map(genre => {
                  const items = filteredGroups.filter(g => g.genre === genre);
                  if (!items.length) return null;
                  return (
                    <div key={genre} style={{ marginBottom:24 }}>
                      <div style={{ fontSize:11, letterSpacing:"0.15em", color:"#a78bfa", textTransform:"uppercase", marginBottom:10 }}>
                        {genre} — {items.length} group{items.length!==1?"s":""}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {items.map(g => {
                          const members = groupMembers.filter(m => m.group_entry_id === g.id);
                          const url = db.fileUrl(g.file_path);
                          return (
                            <div key={g.id} style={{ ...S.card, padding:"14px 18px" }}>
                              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                                    <span style={{ fontWeight:"bold", fontSize:15 }}>{g.group_name}</span>
                                    <span style={S.tag("#a78bfa")}>{g.group_type}</span>
                                    <span style={{ fontSize:12, color:"#555" }}>{g.studio_name}</span>
                                  </div>
                                  <div style={{ fontSize:12, color:"#888", marginTop:4 }}>"{g.song_title}" · {g.age_group} · R{g.total_fee} total</div>
                                  <div style={{ marginTop:8 }}>
                                    <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Members ({members.length}):</div>
                                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                                      {members.map(m => <span key={m.id} style={S.tag("#555")}>{m.dancer_name}</span>)}
                                    </div>
                                  </div>
                                </div>
                                {url && (
                                  <button onClick={() => setPlayingUrl(p => p===url?null:url)} style={{ background:"#a78bfa18", border:"none", borderRadius:6, padding:"6px 14px", color:"#a78bfa", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", flexShrink:0 }}>
                                    {playingUrl===url?"⏸":"▶"}<AudioBars playing={playingUrl===url}/>
                                  </button>
                                )}
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

            {/* ── INVOICES ── */}
            {tab === "invoices" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {studios.filter(s => s.status === "approved").map(studio => {
                  const stDancers = dancers.filter(d => d.studio_code === studio.studio_code);
                  const stSolos = solos.filter(s => s.studio_code === studio.studio_code);
                  const stGroups = groups.filter(g => g.studio_code === studio.studio_code);
                  const regFees = stDancers.length * PRICING.registration;
                  const soloFees = stSolos.length * PRICING.solo;
                  const groupFees = stGroups.reduce((a, g) => a + g.total_fee, 0);
                  const total = regFees + soloFees + groupFees;
                  return (
                    <div key={studio.id} style={S.card}>
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:"bold", fontSize:17 }}>{studio.studio_name}</div>
                          <div style={{ fontSize:12, color:"#555", marginTop:4 }}>{studio.studio_code} · {studio.studio_email}</div>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8, marginTop:14 }}>
                            {[
                              { label:"Reg fees", value:`R${regFees}`, sub:`${stDancers.length} dancers` },
                              { label:"Solo fees", value:`R${soloFees}`, sub:`${stSolos.length} entries` },
                              { label:"Group fees", value:`R${groupFees}`, sub:`${stGroups.length} entries` },
                              { label:"Est. Total", value:`R${total}`, sub:"estimate only", bold:true },
                            ].map(it => (
                              <div key={it.label} style={{ padding:"10px 12px", background:"#1c1c1c", borderRadius:8, border:"1px solid #242424" }}>
                                <div style={{ fontSize:it.bold?18:15, color:it.bold?"#ff6b6b":"#f0ece0", fontWeight:it.bold?"bold":"normal" }}>{it.value}</div>
                                <div style={{ fontSize:10, color:"#444", textTransform:"uppercase", letterSpacing:"0.08em" }}>{it.label}</div>
                                <div style={{ fontSize:11, color:"#555" }}>{it.sub}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => exportStudioInvoice(studio)} style={S.ghost("#e8c547")}>⬇ Export Invoice</button>
                      </div>
                    </div>
                  );
                })}
                {studios.filter(s=>s.status==="approved").length === 0 && (
                  <div style={{ ...S.card, textAlign:"center", color:"#444", padding:40, fontStyle:"italic" }}>No approved studios yet.</div>
                )}
                <div style={S.disclaimer}>⚠️ All amounts shown are estimates. Please issue final invoices separately before requesting payment from studios.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
