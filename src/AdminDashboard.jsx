import { useState, useEffect, useRef } from "react";
import { supabase, S, Spinner, AudioBars, GENRES, PRICING, C } from "./App.jsx";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const ADMIN_PASSWORD = "ROOS"; // Change this to your password

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
  const [zipProgress, setZipProgress] = useState(null);
  const [submissionsLocked, setSubmissionsLocked] = useState(false);
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

  useEffect(() => { if (authed) { load(); loadLockStatus(); } }, [authed]);

  const loadLockStatus = async () => {
    try {
      const { data } = await supabase.from("app_settings").select("value").eq("key","submissions_locked").single();
      setSubmissionsLocked(data?.value === "true");
    } catch(e) { setSubmissionsLocked(false); }
  };

  const toggleLock = async () => {
    const newVal = !submissionsLocked;
    try {
      await supabase.from("app_settings").upsert({ key:"submissions_locked", value: String(newVal) }, { onConflict:"key" });
      setSubmissionsLocked(newVal);
      notify(newVal ? "🔒 Submissions are now CLOSED — studios cannot add new entries." : "🔓 Submissions are now OPEN — studios can add entries.", newVal ? "#c0392b" : "#1a6b3a");
    } catch(e) { notify("Error: " + e.message, "#c0392b"); }
  };
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

  // ── Build master Excel workbook ──────────────────────────────────
  const buildMasterExcel = () => {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: FULL DANCER DETAIL — one row per dancer with ALL solos and groups expanded ──
    const dancerRows = [];
    dancers.forEach(d => {
      const dSolos = solos.filter(s => s.dancer_id === d.id);
      const dGroupIds = groupMembers.filter(m => m.dancer_id === d.id).map(m => m.group_entry_id);
      const dGroups = groups.filter(g => dGroupIds.includes(g.id));
      const soloFee = dSolos.length * PRICING.solo;
      const groupFee = dGroups.reduce((a,g) => a + g.fee_per_person, 0);
      const total = d.registration_fee + soloFee + groupFee;

      // Build solo columns — one per genre
      const soloDetail = {};
      GENRES.forEach(genre => {
        const s = dSolos.find(s => s.genre === genre);
        soloDetail[`Solo: ${genre}`] = s ? s.song_title : "";
      });

      // Build group detail
      const groupDetail = dGroups.map(g =>
        `${g.group_name} (${g.group_type}, ${g.genre}, "${g.song_title}")`
      ).join(" | ");

      dancerRows.push({
        "First Name": d.first_name,
        "Last Name": d.last_name,
        "Studio": d.studio_name,
        "Date of Birth": d.date_of_birth,
        "Age": d.age,
        "Age Group": d.age_group,
        "Gender": d.gender,
        "Membership Code": d.membership_code,
        "No. of Solos": dSolos.length,
        ...soloDetail,
        "No. of Group Entries": dGroups.length,
        "Group Entries Detail": groupDetail,
        "Reg Fee": `R${d.registration_fee}`,
        "Solo Fees": `R${soloFee}`,
        "Group Fees": `R${groupFee}`,
        "DANCER TOTAL": `R${total}`,
      });
    });
    const ws1 = XLSX.utils.json_to_sheet(dancerRows);
    ws1["!cols"] = [
      {wch:14},{wch:14},{wch:22},{wch:14},{wch:5},{wch:16},{wch:8},{wch:20},
      {wch:10},
      ...GENRES.map(()=>({wch:28})),
      {wch:16},{wch:60},
      {wch:10},{wch:10},{wch:10},{wch:14}
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "All Dancers (Full Detail)");

    // ── Sheet 2: ALL SOLOS ──
    const soloRows = [];
    // Group by genre for easy reading
    GENRES.forEach(genre => {
      const genreSolos = solos.filter(s => s.genre === genre);
      if (!genreSolos.length) return;
      soloRows.push({"Genre": `=== ${genre.toUpperCase()} ===`, "Dancer Name":"", "Studio":"", "Song Title":"", "Age Group":"", "Membership Code":"", "Fee":"", "Music File":""});
      genreSolos.forEach((s,i) => soloRows.push({
        "Genre": genre,
        "Dancer Name": s.dancer_name,
        "Studio": s.studio_name,
        "Song Title": s.song_title,
        "Age Group": s.age_group,
        "Membership Code": s.membership_code,
        "Fee": `R${s.fee}`,
        "Music File": s.file_name,
      }));
      soloRows.push({"Genre":"","Dancer Name":"","Studio":"","Song Title":"","Age Group":"","Membership Code":"","Fee":"","Music File":""});
    });
    const ws2 = XLSX.utils.json_to_sheet(soloRows);
    ws2["!cols"] = [{wch:16},{wch:24},{wch:22},{wch:30},{wch:22},{wch:20},{wch:8},{wch:36}];
    XLSX.utils.book_append_sheet(wb, ws2, "All Solos by Genre");

    // ── Sheet 3: ALL GROUPS & DUOS ──
    const groupRows = [];
    GENRES.forEach(genre => {
      const genreGroups = groups.filter(g => g.genre === genre);
      if (!genreGroups.length) return;
      groupRows.push({"Genre":`=== ${genre.toUpperCase()} ===`,"Group Name":"","Type":"","Studio":"","Song Title":"","Age Group":"","No. Dancers":"","Fee pp":"","Total Fee":"","All Members":"","Music File":""});
      genreGroups.forEach(g => {
        const members = groupMembers.filter(m => m.group_entry_id === g.id).map(m => m.dancer_name).join(", ");
        groupRows.push({
          "Genre": genre,
          "Group Name": g.group_name,
          "Type": g.group_type,
          "Studio": g.studio_name,
          "Song Title": g.song_title,
          "Age Group": g.age_group,
          "No. Dancers": g.member_count,
          "Fee pp": `R${g.fee_per_person}`,
          "Total Fee": `R${g.total_fee}`,
          "All Members": members,
          "Music File": g.file_name,
        });
      });
      groupRows.push({"Genre":"","Group Name":"","Type":"","Studio":"","Song Title":"","Age Group":"","No. Dancers":"","Fee pp":"","Total Fee":"","All Members":"","Music File":""});
    });
    const ws3 = XLSX.utils.json_to_sheet(groupRows);
    ws3["!cols"] = [{wch:16},{wch:24},{wch:12},{wch:22},{wch:30},{wch:22},{wch:10},{wch:8},{wch:10},{wch:60},{wch:36}];
    XLSX.utils.book_append_sheet(wb, ws3, "All Groups & Duos by Genre");

    // ── Sheet 4: RUNNING ORDER ──
    const runRows = [];
    let entryNum = 1;
    GENRES.forEach(genre => {
      const gs = solos.filter(s => s.genre === genre);
      const gg = groups.filter(g => g.genre === genre);
      if (!gs.length && !gg.length) return;
      runRows.push({"#":"", "Genre":`=== ${genre.toUpperCase()} ===`, "Type":"", "Performer":"", "Studio":"", "Song Title":"", "Age Group":"", "Music File":""});
      gs.forEach(s => { runRows.push({"#":entryNum++,"Genre":genre,"Type":"Solo","Performer":s.dancer_name,"Studio":s.studio_name,"Song Title":s.song_title,"Age Group":s.age_group,"Music File":s.file_name}); });
      gg.forEach(g => { runRows.push({"#":entryNum++,"Genre":genre,"Type":g.group_type,"Performer":g.group_name,"Studio":g.studio_name,"Song Title":g.song_title,"Age Group":g.age_group,"Music File":g.file_name}); });
      runRows.push({"#":"","Genre":"","Type":"","Performer":"","Studio":"","Song Title":"","Age Group":"","Music File":""});
    });
    const ws4 = XLSX.utils.json_to_sheet(runRows);
    ws4["!cols"] = [{wch:4},{wch:14},{wch:12},{wch:26},{wch:22},{wch:30},{wch:22},{wch:36}];
    XLSX.utils.book_append_sheet(wb, ws4, "Running Order");

    // ── Sheet 5: FINANCIAL SUMMARY ──
    const totalReg = dancers.length * PRICING.registration;
    const totalSol = solos.length * PRICING.solo;
    const totalGrp = groups.reduce((a,g) => a+g.total_fee, 0);
    const finRows = [
      {"Studio":"GRAND TOTAL","Dancers":dancers.length,"Reg Fees":`R${totalReg}`,"Solo Entries":solos.length,"Solo Fees":`R${totalSol}`,"Group Entries":groups.length,"Group Fees":`R${totalGrp}`,"ESTIMATED TOTAL":`R${totalReg+totalSol+totalGrp}`},
      {"Studio":"","Dancers":"","Reg Fees":"","Solo Entries":"","Solo Fees":"","Group Entries":"","Group Fees":"","ESTIMATED TOTAL":""},
    ];
    studios.filter(s => s.status==="approved").forEach(studio => {
      const sd=dancers.filter(d=>d.studio_code===studio.studio_code);
      const ss=solos.filter(s=>s.studio_code===studio.studio_code);
      const sg=groups.filter(g=>g.studio_code===studio.studio_code);
      const reg=sd.length*PRICING.registration, sol=ss.length*PRICING.solo, grp=sg.reduce((a,g)=>a+g.total_fee,0);
      finRows.push({"Studio":studio.studio_name,"Dancers":sd.length,"Reg Fees":`R${reg}`,"Solo Entries":ss.length,"Solo Fees":`R${sol}`,"Group Entries":sg.length,"Group Fees":`R${grp}`,"ESTIMATED TOTAL":`R${reg+sol+grp}`});
    });
    finRows.push({"Studio":"","Dancers":"","Reg Fees":"","Solo Entries":"","Solo Fees":"","Group Entries":"","Group Fees":"","ESTIMATED TOTAL":""});
    finRows.push({"Studio":"NOTE: All amounts are estimates. Please issue final invoices before requesting payment.","Dancers":"","Reg Fees":"","Solo Entries":"","Solo Fees":"","Group Entries":"","Group Fees":"","ESTIMATED TOTAL":""});
    const ws5 = XLSX.utils.json_to_sheet(finRows);
    ws5["!cols"] = [{wch:28},{wch:8},{wch:12},{wch:12},{wch:12},{wch:14},{wch:12},{wch:16}];
    XLSX.utils.book_append_sheet(wb, ws5, "Financial Summary");

    return wb;
  };

  const exportAllSolos = () => {
    if (!solos.length) { notify("No solo entries yet","#c0392b"); return; }
    const wb = XLSX.utils.book_new();
    GENRES.forEach(genre => {
      const items = solos.filter(s => s.genre === genre);
      if (!items.length) return;
      const rows = items.map(s => ({
        "Dancer Name": s.dancer_name,
        "Membership Code": s.membership_code,
        "Studio": s.studio_name,
        "Song Title": s.song_title,
        "Age Group": s.age_group,
        "Fee": `R${s.fee}`,
        "Music File": s.file_name,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{wch:24},{wch:20},{wch:22},{wch:30},{wch:22},{wch:8},{wch:36}];
      XLSX.utils.book_append_sheet(wb, ws, genre.slice(0,31));
    });
    XLSX.writeFile(wb, "GrandeNational_AllSolos.xlsx");
    notify("✓ All solos exported — one sheet per genre!");
  };

  const exportAllGroups = () => {
    if (!groups.length) { notify("No group entries yet","#c0392b"); return; }
    const wb = XLSX.utils.book_new();
    GENRES.forEach(genre => {
      const items = groups.filter(g => g.genre === genre);
      if (!items.length) return;
      const rows = items.map(g => ({
        "Group Name": g.group_name,
        "Type": g.group_type,
        "Studio": g.studio_name,
        "Song Title": g.song_title,
        "Age Group": g.age_group,
        "No. Dancers": g.member_count,
        "Fee Per Person": `R${g.fee_per_person}`,
        "Total Fee": `R${g.total_fee}`,
        "All Members": groupMembers.filter(m=>m.group_entry_id===g.id).map(m=>m.dancer_name).join(", "),
        "Music File": g.file_name,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{wch:24},{wch:12},{wch:22},{wch:30},{wch:22},{wch:10},{wch:12},{wch:10},{wch:60},{wch:36}];
      XLSX.utils.book_append_sheet(wb, ws, genre.slice(0,31));
    });
    XLSX.writeFile(wb, "GrandeNational_AllGroups.xlsx");
    notify("✓ All groups exported — one sheet per genre!");
  };

  const exportMaster = () => {
    const wb = buildMasterExcel();
    XLSX.writeFile(wb, "GrandeNational_Master.xlsx");
    notify("✓ Master spreadsheet downloaded!");
  };

  const exportRunningOrder = () => {
    const wb = XLSX.utils.book_new();
    GENRES.forEach(genre => {
      const gs = solos.filter(s=>s.genre===genre);
      const gg = groups.filter(g=>g.genre===genre);
      if (!gs.length&&!gg.length) return;
      const rows = [];
      if (gs.length) { rows.push({"#":"","Type":"--- SOLOS ---","Performer":"","Studio":"","Song Title":"","Age Group":"","File":""}); gs.forEach((s,i)=>rows.push({"#":i+1,"Type":"Solo","Performer":s.dancer_name,"Studio":s.studio_name,"Song Title":s.song_title,"Age Group":s.age_group,"File":s.file_name})); }
      if (gg.length) { rows.push({"#":"","Type":"--- GROUPS/DUOS ---","Performer":"","Studio":"","Song Title":"","Age Group":"","File":""}); gg.forEach((g,i)=>rows.push({"#":i+1,"Type":g.group_type,"Performer":g.group_name,"Studio":g.studio_name,"Song Title":g.song_title,"Age Group":g.age_group,"File":g.file_name})); }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), genre.slice(0,31));
    });
    XLSX.writeFile(wb, "GrandeNational_RunningOrder.xlsx");
    notify("✓ Running order downloaded!");
  };

  const exportStudioInvoice = (studio) => {
    const wb = XLSX.utils.book_new();
    const sd = dancers.filter(d=>d.studio_code===studio.studio_code);
    const ss = solos.filter(s=>s.studio_code===studio.studio_code);
    const sg = groups.filter(g=>g.studio_code===studio.studio_code);
    const regFees=sd.length*PRICING.registration, soloFees=ss.length*PRICING.solo, groupFees=sg.reduce((a,g)=>a+g.total_fee,0);

    // Invoice sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      {"Item":"Studio","Detail":studio.studio_name},
      {"Item":"Studio Code","Detail":studio.studio_code},
      {"Item":"Contact Email","Detail":studio.studio_email},
      {"Item":"","Detail":""},
      {"Item":"Registration Fees","Detail":`${sd.length} dancers x R${PRICING.registration} = R${regFees}`},
      {"Item":"Solo Entry Fees","Detail":`${ss.length} entries x R${PRICING.solo} = R${soloFees}`},
      {"Item":"Group/Duo Fees","Detail":`${sg.length} entries = R${groupFees}`},
      {"Item":"","Detail":""},
      {"Item":"ESTIMATED TOTAL","Detail":`R${regFees+soloFees+groupFees}`},
      {"Item":"","Detail":""},
      {"Item":"NOTE","Detail":"Please wait for your final invoice before making payment. All fees are estimates."},
    ]), "Invoice");

    // Dancers sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sd.map(d=>{
      const ds=ss.filter(s=>s.dancer_id===d.id);
      const dg=groupMembers.filter(m=>m.dancer_id===d.id);
      const sf=ds.length*PRICING.solo;
      const gf=sg.filter(g=>dg.some(m=>m.group_entry_id===g.id)).reduce((a,g)=>a+g.fee_per_person,0);
      return {
        "Full Name":`${d.first_name} ${d.last_name}`,
        "Membership Code":d.membership_code,
        "Date of Birth":d.date_of_birth,
        "Age":d.age,
        "Age Group":d.age_group,
        "Gender":d.gender,
        "Solo Entries":ds.length,
        "Solo Genres":ds.map(s=>s.genre).join(", "),
        "Group Entries":dg.length,
        "Reg Fee":`R${d.registration_fee}`,
        "Solo Fees":`R${sf}`,
        "Group Fees (approx)":`R${gf}`,
        "Total":`R${d.registration_fee+sf+gf}`,
      };
    })), "Dancers");

    if (ss.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ss.map(s=>({
      "Dancer":s.dancer_name, "Membership Code":s.membership_code,
      "Genre":s.genre, "Song Title":s.song_title,
      "Age Group":s.age_group, "Fee":`R${s.fee}`, "Music File":s.file_name
    }))), "Solo Entries");

    if (sg.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sg.map(g=>({
      "Group Name":g.group_name, "Type":g.group_type,
      "Genre":g.genre, "Song Title":g.song_title,
      "Age Group":g.age_group, "Dancers":g.member_count,
      "Fee Per Person":`R${g.fee_per_person}`, "Total":`R${g.total_fee}`,
      "Members":groupMembers.filter(m=>m.group_entry_id===g.id).map(m=>m.dancer_name).join(", "),
      "Music File":g.file_name
    }))), "Groups & Duos");

    XLSX.writeFile(wb, `GrandeNational_${studio.studio_code}_Invoice.xlsx`);
    notify(`✓ Invoice exported for ${studio.studio_name}!`);
  };

  // ── ZIP DOWNLOAD - All music + spreadsheet ────────────────────────────────
  const downloadAllAsZip = async () => {
    const allEntries = [...solos, ...groups];
    if (!allEntries.length) { notify("No music files uploaded yet","#c0392b"); return; }

    setZipProgress("Preparing download...");
    const zip = new JSZip();
    const root = zip.folder("GrandeNational_Competition");

    // Add master Excel
    setZipProgress("Building spreadsheet...");
    const wb = buildMasterExcel();
    const excelBuffer = XLSX.write(wb, { bookType:"xlsx", type:"array" });
    root.file("GrandeNational_Master.xlsx", excelBuffer);

    // Add solo music files organised by genre
    const solosFolder = root.folder("Solos");
    let done = 0;
    for (const s of solos) {
      if (!s.file_path) continue;
      try {
        setZipProgress(`Downloading solos... ${done+1}/${solos.length}`);
        const url = fileUrl(s.file_path);
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const safeName = `${s.dancer_name.replace(/[^a-zA-Z0-9]/g,"_")}_${s.song_title.replace(/[^a-zA-Z0-9]/g,"_")}${s.file_name.slice(s.file_name.lastIndexOf("."))}`;
        solosFolder.folder(s.genre).file(safeName, blob);
        done++;
      } catch(e) { console.error("File error:", s.file_name, e); }
    }

    // Add group/duo music files organised by genre
    const groupsFolder = root.folder("Groups_and_Duos");
    done = 0;
    for (const g of groups) {
      if (!g.file_path) continue;
      try {
        setZipProgress(`Downloading groups... ${done+1}/${groups.length}`);
        const url = fileUrl(g.file_path);
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const safeName = `${g.group_name.replace(/[^a-zA-Z0-9]/g,"_")}_${g.song_title.replace(/[^a-zA-Z0-9]/g,"_")}${g.file_name.slice(g.file_name.lastIndexOf("."))}`;
        groupsFolder.folder(g.genre).file(safeName, blob);
        done++;
      } catch(e) { console.error("File error:", g.file_name, e); }
    }

    setZipProgress("Creating ZIP file...");
    const zipBlob = await zip.generateAsync({ type:"blob", compression:"DEFLATE", compressionOptions:{ level:3 } });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url; a.download = "GrandeNational_Competition_Export.zip";
    a.click();
    URL.revokeObjectURL(url);
    setZipProgress(null);
    notify(`✓ ZIP downloaded! ${solos.length} solos + ${groups.length} groups + master spreadsheet`);
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

        {/* Submission lock banner */}
        <div style={{ marginBottom:16, padding:"14px 20px", background: submissionsLocked ? "#2a0808" : "#082a12", border: `1px solid ${submissionsLocked ? "#c0392b" : "#1a6b3a"}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:"bold", color: submissionsLocked ? "#ff6b6b" : "#4ecdc4", fontFamily:"'Montserrat',sans-serif" }}>
              {submissionsLocked ? "🔒 Submissions CLOSED" : "🔓 Submissions OPEN"}
            </div>
            <div style={{ fontSize:12, color:"#cccccc", marginTop:4, fontFamily:"'Montserrat',sans-serif" }}>
              {submissionsLocked ? "Studios cannot add new entries or upload music." : "Studios can register, add dancers and upload music."}
            </div>
          </div>
          <button onClick={toggleLock} style={{ ...S.btn(submissionsLocked ? "#1a6b3a" : "#c0392b"), padding:"10px 24px", fontSize:13 }}>
            {submissionsLocked ? "🔓 Open Submissions" : "🔒 Close Submissions"}
          </button>
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
          <button onClick={downloadAllAsZip} disabled={!!zipProgress} style={{ ...S.btn("#F27C20"), fontSize:14, padding:"14px 28px" }}>
            {zipProgress ? <><Spinner color="#fff" /> {zipProgress}</> : "⬇ Download Everything (ZIP + Music + Spreadsheet)"}
          </button>
        </div>
        <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
          <button onClick={exportMaster} style={S.ghost("#F27C20")}>⬇ Full Spreadsheet</button>
          <button onClick={exportRunningOrder} style={S.ghost("#F27C20")}>⬇ Running Order</button>
          <button onClick={exportAllSolos} style={S.ghost("#F27C20")}>⬇ All Solos</button>
          <button onClick={exportAllGroups} style={S.ghost("#F27C20")}>⬇ All Groups & Duos</button>
        </div>
        {zipProgress && (
          <div style={{ marginBottom:16, padding:"12px 16px", background:"#F27C2015", border:"1px solid #F27C2044", borderRadius:6, fontSize:13, color:"#F27C20", fontFamily:"'Montserrat',sans-serif" }}>
            ⏳ {zipProgress} — Please wait, this may take a minute for large files...
          </div>
        )}

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
