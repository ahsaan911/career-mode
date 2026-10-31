"use client";

import { useEffect, useState, useRef } from "react";
import {
  createPlayer, applyDecay, applyDrill, applyMatch, mentorTips, mentorChat, recalcOvr,
  categoriesOf, checkAchievements, loadPlayer, savePlayer, DRILLS,
  type Player, type Match, type Session,
} from "@/lib/stats";
import { analyzeVideo } from "@/lib/pose";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar } from "recharts";

const POSITIONS = ["ST", "LW", "RW", "CAM", "CM", "CDM", "CB", "LB", "RB", "GK"];
const FEET = ["Right", "Left", "Both"];
const EXPERIENCE = ["Beginner", "Intermediate", "Advanced"];
const GOALS = ["Improve pace", "Improve finishing", "Improve passing", "Improve dribbling", "Improve defending", "Improve fitness", "Play more matches"];

const NAV = [
  { id: "dash", label: "Dashboard", icon: "D" },
  { id: "player", label: "My Player", icon: "P" },
  { id: "training", label: "Training", icon: "T" },
  { id: "match", label: "Matches", icon: "M" },
  { id: "mentor", label: "AI Mentor", icon: "A" },
  { id: "history", label: "History", icon: "H" },
  { id: "settings", label: "Settings", icon: "S" },
];

function StatBar({ label, value }: { label: string; value: number }) {
  const color = value >= 85 ? "from-emerald-400 to-emerald-600" : value >= 70 ? "from-lime-400 to-lime-600" : value >= 55 ? "from-yellow-400 to-yellow-600" : value >= 40 ? "from-orange-400 to-orange-600" : "from-red-400 to-red-600";
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-[#F4F6FA]">{label}</span>
      <div className="flex-1 h-2.5 bg-[#0D1420] rounded-full overflow-hidden border border-[#263244]">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right font-mono font-bold text-white text-sm">{Math.round(value)}</span>
    </div>
  );
}

function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-[#808080] hover:text-white transition-colors mb-6 group">
      <span className="text-lg group-hover:-translate-x-1 transition-transform">{"<"}</span>
      <span className="text-sm font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

export default function Home() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [screen, setScreen] = useState("dash");
  const [onboarding, setOnboarding] = useState(true);
  // onboarding state
  const [oName, setOName] = useState("");
  const [oPos, setOPos] = useState("ST");
  const [oFoot, setOFoot] = useState("Right");
  const [oExp, setOExp] = useState("Intermediate");
  const [oGoals, setOGoals] = useState<string[]>([]);

  // training state
  const [selectedDrill, setSelectedDrill] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [manualReps, setManualReps] = useState(5);
  const [evidenceMode, setEvidenceMode] = useState<"camera" | "manual">("manual");

  // match state
  const [mOpponent, setMOpponent] = useState("");
  const [mCompetition, setMCompetition] = useState("League");
  const [mPosition, setMPosition] = useState("");
  const [mMinutes, setMMinutes] = useState(90);
  const [mResult, setMResult] = useState("W");
  const [mGoals, setMGoals] = useState(0);
  const [mAssists, setMAssists] = useState(0);
  const [mShots, setMShots] = useState(0);
  const [mChances, setMChances] = useState(0);
  const [mPassC, setMPassC] = useState(0);
  const [mPassA, setMPassA] = useState(0);
  const [mInt, setMInt] = useState(0);
  const [mTackles, setMTackles] = useState(0);
  const [mDistance, setMDistance] = useState(8);
  const [mSprints, setMSprints] = useState(15);
  const [mRating, setMRating] = useState(7);

  // mentor chat
  const [chatInput, setChatInput] = useState("");
  const [showMoreNav, setShowMoreNav] = useState(false);
  const [chatLog, setChatLog] = useState<{ who: string; text: string }[]>([
    { who: "mentor", text: "Hey! I'm your pro football mentor. Ask me anything about training, stats, or matches." },
  ]);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = loadPlayer();
    if (p) {
      setPlayer(p);
      setOnboarding(false);
      if (p.position) setMPosition(p.position);
    }
  }, []);

  useEffect(() => {
    if (player) savePlayer(player);
  }, [player]);

  const startCareer = () => {
    if (!oName.trim()) return;
    const p = createPlayer(oName.trim(), oPos, oFoot, oExp, oGoals);
    setPlayer(p);
    setOnboarding(false);
    setScreen("dash");
    setMPosition(oPos);
  };

  const reset = () => {
    localStorage.removeItem("irlfc_player");
    setPlayer(null);
    setOnboarding(true);
  };

  const restDay = () => {
    if (!player) return;
    const p = { ...player, energy: Math.min(100, player.energy + 40), sharpness: Math.min(100, player.sharpness + 5) };
    p.lastActive = Date.now();
    recalcOvr(p);
    setPlayer(p);
  };

  const handleVideo = (f: File) => {
    setVideoFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setLastResult(null);
  };

  const runAnalysis = async () => {
    if (!player || !selectedDrill || !videoFile) return;
    setAnalyzing(true);
    setProgress(0);
    try {
      const res = await analyzeVideo(videoFile, selectedDrill, (pct) => setProgress(pct));
      const submissionId = "cam_" + Date.now();
      const before = player.ovr;
      const p2 = JSON.parse(JSON.stringify(player)) as Player;
      const result = applyDrill(p2, selectedDrill, res.reps, "camera", submissionId);
      if (result) {
        setPlayer(p2);
        setLastResult(`Analyzed ${res.frames} frames over ${res.duration.toFixed(1)}s. Detected ${res.reps} reps. ${res.note} OVR ${before} ? ${p2.ovr}. +${result.xp} XP.`);
      } else {
        setLastResult("Duplicate submission ignored.");
      }
    } catch (e: any) {
      setLastResult("Analysis failed: " + (e?.message || e) + ". Try a shorter/clearer video, or use manual entry.");
    } finally {
      setAnalyzing(false);
    }
  };

  const runManual = () => {
    if (!player || !selectedDrill) return;
    const submissionId = "man_" + Date.now();
    const before = player.ovr;
    const p2 = JSON.parse(JSON.stringify(player)) as Player;
    const result = applyDrill(p2, selectedDrill, manualReps, "manual", submissionId);
    if (result) {
      setPlayer(p2);
      setLastResult(`Logged ${manualReps} reps manually. OVR ${before} ? ${p2.ovr}. +${result.xp} XP.`);
    } else {
      setLastResult("Duplicate submission ignored.");
    }
  };

  const logMatch = () => {
    if (!player) return;
    const m: Match = {
      id: "match_" + Date.now(),
      date: Date.now(),
      opponent: mOpponent || "Opponent",
      competition: mCompetition,
      position: mPosition || player.position,
      minutes: mMinutes,
      result: mResult,
      goals: mGoals, assists: mAssists, shots: mShots, chancesCreated: mChances,
      passesCompleted: mPassC, passesAttempted: mPassA, interceptions: mInt, tackles: mTackles,
      distance: mDistance, sprints: mSprints, rating: mRating,
    };
    const p2 = JSON.parse(JSON.stringify(player)) as Player;
    const { xp } = applyMatch(p2, m);
    setPlayer(p2);
    setScreen("dash");
    alert("Match logged! +" + xp + " XP");
  };

  const sendChat = () => {
    if (!chatInput.trim() || !player) return;
    const msg = chatInput.trim();
    setChatLog((l) => [...l, { who: "you", text: msg }]);
    const reply = mentorChat(player, msg);
    setTimeout(() => setChatLog((l) => [...l, { who: "mentor", text: reply }]), 300);
    setChatInput("");
  };

  // ---- Onboarding ----
  if (onboarding || !player) {
    return (
      <main className="min-h-screen bg-[#080D16] text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/40 via-transparent to-transparent" />
        <div className="relative w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="text-6xl mb-2">?</div>
            <h1 className="text-4xl font-black tracking-tight">IRL FC</h1>
            <p className="text-[#929FB2] mt-2">Real-life football. Real progression.</p>
          </div>
          <div className="bg-[#131D2B] -xl rounded-lg p-8 shadow-lg border border-[#263244] space-y-6">
            <div>
              <label className="block mb-2"><span className="text-xs uppercase tracking-widest text-[#929FB2] font-semibold">Player Name</span>
                <input value={oName} onChange={(e) => setOName(e.target.value)} className="w-full mt-2 px-4 py-3 rounded-lg bg-[#0D1420] border border-[#263244] focus:border-[#FF1E3C] focus:ring-2 focus:ring-[#FF1E3C]/30 outline-none transition text-lg" placeholder="Your name" />
              </label>
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-[#929FB2] font-semibold">Position</span>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {POSITIONS.map((p) => (
                  <button key={p} onClick={() => setOPos(p)} className={`py-2 rounded-lg text-sm font-bold transition ${oPos === p ? "bg-[#FF1E3C] text-[#080D16] shadow-lg shadow-[#FF1E3C]/20" : "bg-[#0D1420] text-[#929FB2] hover:bg-gray-700"}`}>{p}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-[#929FB2] font-semibold">Preferred Foot</span>
                <div className="flex gap-2 mt-2">
                  {FEET.map((f) => (
                    <button key={f} onClick={() => setOFoot(f)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${oFoot === f ? "bg-[#FF1E3C] text-[#080D16]" : "bg-[#0D1420] text-[#929FB2] hover:bg-gray-700"}`}>{f}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-widest text-[#929FB2] font-semibold">Experience</span>
                <div className="flex gap-2 mt-2">
                  {EXPERIENCE.map((e) => (
                    <button key={e} onClick={() => setOExp(e)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${oExp === e ? "bg-[#FF1E3C] text-[#080D16]" : "bg-[#0D1420] text-[#929FB2] hover:bg-gray-700"}`}>{e}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-[#929FB2] font-semibold">Development Goals (pick any)</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {GOALS.map((g) => (
                  <button key={g} onClick={() => setOGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${oGoals.includes(g) ? "bg-[#FF1E3C] text-[#080D16]" : "bg-[#0D1420] text-[#929FB2] hover:bg-gray-700"}`}>{g}</button>
                ))}
              </div>
            </div>
            <button onClick={startCareer} disabled={!oName.trim()} className="w-full py-4 rounded-lg bg-gradient-to-r from-[#FF1E3C] to-[#E01834] text-[#080D16] hover:from-[#E01834] hover:to-[#FF1E3C] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-lg shadow-lg shadow-[#FF1E3C]/20 transition transform hover:scale-[1.02] active:scale-[0.98]">
              Start Career
            </button>
            <p className="text-xs text-[#929FB2] text-center">Starting OVR ~50. Values are game estimates, not scientific measurements.</p>
          </div>
        </div>
      </main>
    );
  }

  const c = categoriesOf(player);
  const tips = mentorTips(player);
  const energyColor = player.energy >= 60 ? "from-blue-500 to-cyan-400" : player.energy >= 30 ? "from-yellow-500 to-orange-400" : "from-red-500 to-red-700";
  const sharpColor = player.sharpness >= 60 ? "from-purple-500 to-pink-400" : player.sharpness >= 30 ? "from-yellow-500 to-orange-400" : "from-red-500 to-red-700";

  const renderScreen = () => {
    switch (screen) {
      case "dash":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <div className="relative rounded-lg overflow-hidden bg-[#111111] border border-yellow-500/30 shadow-lg p-6">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl" />
                <div className="relative flex items-center gap-4 mb-5">
                  <div className="text-7xl font-black text-[#FF1E3C]">{player.ovr}</div>
                  <div>
                    <div className="text-xl font-bold">{player.name}</div>
                    <div className="text-sm text-[#929FB2]">{player.position} � Lvl {player.level}</div>
                    <div className="text-xs text-[#808080] uppercase tracking-widest mt-1">Overall</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-[#929FB2] mb-1"><span>Energy</span><span>{Math.round(player.energy)}/100</span></div>
                    <div className="h-3 bg-[#0D1420] rounded-full overflow-hidden border border-[#263244]"><div className={`h-full rounded-full bg-gradient-to-r ${energyColor} transition-all duration-700`} style={{ width: `${player.energy}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-[#929FB2] mb-1"><span>Sharpness</span><span>{Math.round(player.sharpness)}/100</span></div>
                    <div className="h-3 bg-[#0D1420] rounded-full overflow-hidden border border-[#263244]"><div className={`h-full rounded-full bg-gradient-to-r ${sharpColor} transition-all duration-700`} style={{ width: `${player.sharpness}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-[#929FB2] mb-1"><span>XP</span><span>{player.xp}/{player.xpToNext}</span></div>
                    <div className="h-3 bg-[#0D1420] rounded-full overflow-hidden border border-[#263244]"><div className="h-full rounded-full bg-[#FF1E3C] transition-all duration-700" style={{ width: `${(player.xp / player.xpToNext) * 100}%` }} /></div>
                  </div>
                  <div className="flex justify-between text-xs text-[#929FB2]"><span>Form</span><span className="font-bold text-white">{Math.round(player.form)}</span></div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <button onClick={() => setScreen("training")} className="py-2 rounded-lg bg-[#FF1E3C]/20 hover:bg-[#FF1E3C]/40 text-[#FF1E3C] text-xs font-bold border border-[#FF1E3C]/30 transition">Train</button>
                  <button onClick={() => setScreen("match")} className="py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-bold border border-blue-600/30 transition">Match</button>
                  <button onClick={() => setScreen("mentor")} className="py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 text-xs font-bold border border-purple-600/30 transition">Mentor</button>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1 bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
              <h2 className="font-bold mb-4 text-[#FF1E3C] flex items-center gap-2"><span>?</span> Attributes</h2>
              <div className="space-y-3">
                <StatBar label="Pace" value={c.pace} />
                <StatBar label="Shooting" value={c.shooting} />
                <StatBar label="Passing" value={c.passing} />
                <StatBar label="Dribbling" value={c.dribbling} />
                <StatBar label="Defending" value={c.defending} />
                <StatBar label="Physical" value={c.physical} />
              </div>
              <button onClick={() => setScreen("player")} className="mt-4 w-full py-2 text-sm text-[#FF1E3C] hover:text-[#FF1E3C] transition">View all attributes</button>
            </div>
            <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-6 mt-4">
              <div className="text-xs font-bold text-[#808080] uppercase tracking-widest mb-3">OVR Progression</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[{session:1,ovr:player.ovr}]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="session" stroke="#808080" fontSize={11} />
                    <YAxis stroke="#808080" fontSize={11} domain={[40,99]} />
                    <Tooltip contentStyle={{background:"#111111",border:"1px solid #2A2A2A",borderRadius:"8px",color:"#FFFFFF"}} />
                    <Line type="monotone" dataKey="ovr" stroke="#FF1E3C" strokeWidth={2} dot={{fill:"#FF1E3C",r:3}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-[#808080] mt-2 text-center">Current: {player.ovr} / Best: {player.bestOvr}</p>
            </div>
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
                <h2 className="font-bold mb-3 text-[#FF1E3C] flex items-center gap-2"><span>??</span> Mentor Tips</h2>
                <ul className="space-y-2">
                  {tips.map((t, i) => <li key={i} className="text-sm text-[#F4F6FA] bg-[#131D2B] rounded-lg px-3 py-2 border border-[#263244]">{t}</li>)}
                </ul>
              </div>
              <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
                <h2 className="font-bold mb-3 text-[#FF1E3C] flex items-center gap-2"><span>??</span> Recent Activity</h2>
                {player.history.length === 0 && <p className="text-sm text-[#929FB2]">No activity yet. Start training!</p>}
                <ul className="space-y-1.5">
                  {player.history.slice(0, 6).map((h, i) => (
                    <li key={i} className="text-sm text-[#F4F6FA] flex justify-between bg-[#131D2B] rounded-lg px-3 py-1.5">
                      <span className="truncate">{h.kind}</span>
                      <span className="text-[#929FB2] text-xs ml-2 shrink-0">{h.delta}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );

      case "player":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-[#FF1E3C]">My Player</h2>
            <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-lg mb-3">Info</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[#929FB2]">Name</span><span className="font-bold">{player.name}</span></div>
                    <div className="flex justify-between"><span className="text-[#929FB2]">Position</span><span className="font-bold">{player.position}</span></div>
                    <div className="flex justify-between"><span className="text-[#929FB2]">Foot</span><span className="font-bold">{player.foot}</span></div>
                    <div className="flex justify-between"><span className="text-[#929FB2]">Experience</span><span className="font-bold">{player.experience}</span></div>
                    <div className="flex justify-between"><span className="text-[#929FB2]">Level</span><span className="font-bold">{player.level}</span></div>
                    <div className="flex justify-between"><span className="text-[#929FB2]">Best OVR</span><span className="font-bold">{player.bestOvr}</span></div>
                    <div className="flex justify-between"><span className="text-[#929FB2]">Streak</span><span className="font-bold">{player.streak} days</span></div>
                  </div>
                  {player.goals.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs uppercase tracking-widest text-[#929FB2] mb-2">Goals</div>
                      <div className="flex flex-wrap gap-2">
                        {player.goals.map((g) => <span key={g} className="px-2 py-1 rounded-full bg-[#FF1E3C]/20 text-[#FF1E3C] text-xs border border-[#FF1E3C]/30">{g}</span>)}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-3">Categories</h3>
                  <div className="space-y-3">
                    <StatBar label="Pace" value={c.pace} />
                    <StatBar label="Shooting" value={c.shooting} />
                    <StatBar label="Passing" value={c.passing} />
                    <StatBar label="Dribbling" value={c.dribbling} />
                    <StatBar label="Defending" value={c.defending} />
                    <StatBar label="Physical" value={c.physical} />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
              <h3 className="font-bold text-lg mb-4">All Attributes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                {Object.entries(player.attrs).filter(([, v]) => typeof v === "number").map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-1 border-b border-[#263244]">
                    <span className="text-[#929FB2] capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                    <span className="font-mono font-bold text-white">{Math.round(v as number)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "training":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#FF1E3C]">Training Ground</h2>
              <p className="text-[#929FB2] text-sm mt-1">Choose a drill, record your result, earn XP and attribute gains.</p>
            </div>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setEvidenceMode("manual")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${evidenceMode === "manual" ? "bg-[#FF1E3C] text-[#080D16]" : "bg-[#0D1420] text-[#929FB2]"}`}>Manual Entry</button>
              <button onClick={() => setEvidenceMode("camera")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${evidenceMode === "camera" ? "bg-[#FF1E3C] text-[#080D16]" : "bg-[#0D1420] text-[#929FB2]"}`}>Camera Analysis</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {DRILLS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedDrill(d.id); setVideoFile(null); setVideoUrl(null); setLastResult(null); }}
                  className={`p-4 rounded-lg border text-left transition-all ${selectedDrill === d.id ? "border-[#FF1E3C] bg-[#FF1E3C]/10 shadow-lg shadow-[#FF1E3C]/10 scale-[1.02]" : "border-[#263244] bg-[#131D2B] hover:bg-[#131D2B] hover:border-[#263244]"}`}
                >
                  <div className="text-3xl mb-1">{d.emoji}</div>
                  <div className="font-bold text-sm">{d.name}</div>
                  <div className="text-xs text-[#929FB2] mt-1">{d.category}</div>
                </button>
              ))}
            </div>
            {selectedDrill && (
              <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244] space-y-4">
                {(() => {
                  const d = DRILLS.find((x) => x.id === selectedDrill)!;
                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="text-4xl">{d.emoji}</div>
                        <div>
                          <h3 className="font-bold text-lg">{d.name}</h3>
                          <p className="text-sm text-[#929FB2]">{d.desc}</p>
                          <div className="text-xs text-[#929FB2] mt-1">Energy cost {d.cost} � +{d.xp} XP base � Primary: {Object.keys(d.weights).join(", ")}</div>
                        </div>
                      </div>
                      {evidenceMode === "manual" && (
                        <div className="space-y-3">
                          <label className="block">
                            <span className="text-sm text-[#F4F6FA]">Reps completed: {manualReps}</span>
                            <input type="range" min={1} max={40} value={manualReps} onChange={(e) => setManualReps(Number(e.target.value))} className="w-full accent-[#FF1E3C]" />
                          </label>
                          <button onClick={runManual} disabled={player.energy < 5} className="w-full py-3 rounded-lg bg-gradient-to-r from-[#FF1E3C] to-[#E01834] text-[#080D16] hover:from-[#E01834] hover:to-[#FF1E3C] disabled:opacity-40 font-bold shadow-lg shadow-[#FF1E3C]/20 transition">Log Session</button>
                        </div>
                      )}
                      {evidenceMode === "camera" && (
                        <>
                          <label className="block">
                            <div className="border-2 border-dashed border-[#263244] hover:border-[#FF1E3C] rounded-lg p-6 text-center cursor-pointer transition">
                              <div className="text-3xl mb-2">??</div>
                              <div className="text-sm text-[#F4F6FA]">Click to select a video file</div>
                              <div className="text-xs text-[#929FB2] mt-1">MP4, MOV, WebM supported</div>
                            </div>
                            <input ref={fileRef} type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && handleVideo(e.target.files[0])} className="hidden" />
                          </label>
                          {videoUrl && <video src={videoUrl} controls className="w-full max-h-72 rounded-lg bg-black border border-[#263244]" />}
                          <button onClick={runAnalysis} disabled={!videoFile || analyzing || player.energy < 5} className="w-full py-3 rounded-lg bg-gradient-to-r from-[#FF1E3C] to-[#E01834] text-[#080D16] hover:from-[#E01834] hover:to-[#FF1E3C] disabled:opacity-40 font-bold shadow-lg shadow-[#FF1E3C]/20 transition">
                            {analyzing ? `Analyzing... ${Math.round(progress)}%` : "Analyze & Apply Gains"}
                          </button>
                          {analyzing && <div className="h-2 bg-[#0D1420] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#FF1E3C] transition-all duration-300" style={{ width: `${progress}%` }} /></div>}
                        </>
                      )}
                      {lastResult && <p className="text-sm text-[#F4F6FA] bg-[#131D2B] p-4 rounded-lg border border-[#263244]">{lastResult}</p>}
                      <p className="text-xs text-[#929FB2]">Energy: {Math.round(player.energy)}/100. Low energy reduces gains.</p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );

      case "match":
        return (
          <div className="max-w-2xl">
            <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
              <h2 className="text-2xl font-bold text-[#FF1E3C] mb-1">Match Centre</h2>
              <p className="text-[#929FB2] text-sm mb-6">Record a match to boost sharpness, form and XP.</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <label className="block"><span className="text-xs text-[#929FB2]">Opponent</span><input value={mOpponent} onChange={(e) => setMOpponent(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0D1420] border border-[#263244] focus:border-[#FF1E3C] outline-none" placeholder="Team name" /></label>
                <label className="block"><span className="text-xs text-[#929FB2]">Competition</span><input value={mCompetition} onChange={(e) => setMCompetition(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0D1420] border border-[#263244] focus:border-[#FF1E3C] outline-none" /></label>
                <label className="block"><span className="text-xs text-[#929FB2]">Position</span><input value={mPosition} onChange={(e) => setMPosition(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0D1420] border border-[#263244] focus:border-[#FF1E3C] outline-none" /></label>
                <label className="block"><span className="text-xs text-[#929FB2]">Minutes</span><input type="number" value={mMinutes} onChange={(e) => setMMinutes(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0D1420] border border-[#263244] focus:border-[#FF1E3C] outline-none" /></label>
                <label className="block"><span className="text-xs text-[#929FB2]">Result</span>
                  <select value={mResult} onChange={(e) => setMResult(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0D1420] border border-[#263244] focus:border-[#FF1E3C] outline-none">
                    <option>W</option><option>D</option><option>L</option>
                  </select>
                </label>
                <label className="block"><span className="text-xs text-[#929FB2]">Rating (1-10)</span><input type="number" min={1} max={10} value={mRating} onChange={(e) => setMRating(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0D1420] border border-[#263244] focus:border-[#FF1E3C] outline-none" /></label>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  { label: "Goals", val: mGoals, set: setMGoals },
                  { label: "Assists", val: mAssists, set: setMAssists },
                  { label: "Shots", val: mShots, set: setMShots },
                  { label: "Chances created", val: mChances, set: setMChances },
                  { label: "Passes completed", val: mPassC, set: setMPassC },
                  { label: "Passes attempted", val: mPassA, set: setMPassA },
                  { label: "Interceptions", val: mInt, set: setMInt },
                  { label: "Tackles", val: mTackles, set: setMTackles },
                  { label: "Distance (km)", val: mDistance, set: setMDistance },
                  { label: "Sprints", val: mSprints, set: setMSprints },
                ].map((f) => (
                  <label key={f.label} className="block">
                    <span className="text-xs text-[#929FB2]">{f.label}</span>
                    <input type="number" min={0} value={f.val} onChange={(e) => f.set(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0D1420] border border-[#263244] focus:border-[#FF1E3C] outline-none" />
                  </label>
                ))}
              </div>
              <button onClick={logMatch} className="w-full py-3 rounded-lg bg-gradient-to-r from-[#FF1E3C] to-[#E01834] text-[#080D16] hover:from-[#E01834] hover:to-[#FF1E3C] font-bold shadow-lg shadow-[#FF1E3C]/20 transition">Log Match</button>
            </div>
            {player.matches.length > 0 && (
              <div className="mt-6 bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
                <h3 className="font-bold text-lg mb-4">Match History</h3>
                <div className="space-y-2">
                  {player.matches.slice(0, 10).map((m) => (
                    <div key={m.id} className="bg-[#131D2B] rounded-lg p-3 border border-[#263244] text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">vs {m.opponent}</span>
                        <span className="text-[#929FB2]">{new Date(m.date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-[#F4F6FA] mt-1">{m.result} � {m.goals}G {m.assists}A � Rating {m.rating} � {m.minutes}min</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "mentor":
        return (
          <div className="bg-[#131D2B]  rounded-lg border border-[#263244] flex flex-col h-[70vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#263244] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xl">??</div>
              <div>
                <div className="font-bold">AI Mentor</div>
                <div className="text-xs text-[#929FB2]">Your pro football coach (rule-based demo mode)</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {chatLog.map((c, i) => (
                <div key={i} className={`flex ${c.who === "you" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-lg text-sm ${c.who === "you" ? "bg-gradient-to-r from-[#FF1E3C] to-[#E01834] text-[#080D16] text-white rounded-br-md" : "bg-[#0D1420] text-gray-100 rounded-bl-md border border-[#263244]"}`}>
                    {c.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[#263244] flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Ask about sprint, jump, energy, sharpness, match, camera, weak..." className="flex-1 px-4 py-3 rounded-lg bg-[#0D1420] border border-[#263244] focus:border-[#FF1E3C] focus:ring-2 focus:ring-[#FF1E3C]/30 outline-none transition" />
              <button onClick={sendChat} className="px-5 py-3 rounded-lg bg-gradient-to-r from-[#FF1E3C] to-[#E01834] text-[#080D16] hover:from-[#E01834] hover:to-[#FF1E3C] font-semibold transition transform hover:scale-105 active:scale-95">?</button>
            </div>
          </div>
        );

      case "history":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-[#FF1E3C]">Career History</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
                <h3 className="font-bold text-lg mb-3">OVR & Level</h3>
                <div className="text-5xl font-black text-yellow-400">{player.ovr}</div>
                <div className="text-sm text-[#929FB2] mt-1">Best: {player.bestOvr} � Level {player.level} � {player.xp} XP</div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-[#929FB2]">Sessions</span><span className="font-bold">{player.drillsDone}</span></div>
                  <div className="flex justify-between"><span className="text-[#929FB2]">Matches</span><span className="font-bold">{player.matchesPlayed}</span></div>
                  <div className="flex justify-between"><span className="text-[#929FB2]">Streak</span><span className="font-bold">{player.streak} days</span></div>
                  <div className="flex justify-between"><span className="text-[#929FB2]">Form</span><span className="font-bold">{Math.round(player.form)}</span></div>
                </div>
              </div>
              <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
                <h3 className="font-bold text-lg mb-3">Achievements ({player.achievements.length})</h3>
                {player.achievements.length === 0 && <p className="text-sm text-[#929FB2]">No achievements yet. Keep training!</p>}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {player.achievements.map((a) => (
                    <div key={a.id} className="bg-[#131D2B] rounded-lg p-3 border border-[#263244]">
                      <div className="font-bold text-sm text-yellow-400">{a.name}</div>
                      <div className="text-xs text-[#929FB2]">{a.desc}</div>
                      <div className="text-xs text-gray-600 mt-1">{new Date(a.date).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244]">
              <h3 className="font-bold text-lg mb-3">Training Sessions ({player.sessions.length})</h3>
              {player.sessions.length === 0 && <p className="text-sm text-[#929FB2]">No sessions yet.</p>}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {player.sessions.map((s: Session) => (
                  <div key={s.id} className="bg-[#131D2B] rounded-lg p-3 border border-[#263244] text-sm">
                    <div className="flex justify-between">
                      <span className="font-bold">{s.drill}</span>
                      <span className="text-[#929FB2] text-xs">{new Date(s.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[#F4F6FA] mt-1">{s.reps} reps � {s.evidence} � +{s.xp} XP</div>
                    {s.changes.length > 0 && <div className="text-xs text-[#FF1E3C] mt-1">{s.changes.map((ch) => ch.attr + " " + ch.before + "?" + ch.after).join(", ")}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="max-w-lg space-y-4">
            <h2 className="text-2xl font-bold text-[#FF1E3C]">Settings</h2>
            <div className="bg-[#131D2B]  rounded-lg p-6 border border-[#263244] space-y-4">
              <div className="text-sm text-[#F4F6FA]">
                <p className="mb-2"><span className="font-bold">Persistence:</span> localStorage (single device). For multi-device, configure Supabase.</p>
                <p className="mb-2"><span className="font-bold">AI Mentor:</span> Rule-based demo mode (no API key). Set OPENAI_API_KEY on server for live AI.</p>
                <p className="mb-2"><span className="font-bold">Camera:</span> MediaPipe pose runs in-browser. No footage uploaded.</p>
              </div>
              <button onClick={() => { if (confirm("Delete all player data?")) reset(); }} className="w-full py-3 rounded-lg bg-red-900/50 hover:bg-red-800/60 text-red-300 font-bold border border-red-900/50 transition">Delete Player Data</button>
              <button onClick={() => { localStorage.removeItem("irlfc_player"); location.reload(); }} className="w-full py-3 rounded-lg bg-[#0D1420] hover:bg-gray-700 text-[#F4F6FA] font-bold border border-[#263244] transition">Clear & Reload</button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-[#080D16] text-white flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-60 bg-[#131D2B] border-r border-[#263244] p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-6 px-2">
          <div className="text-2xl">?</div>
          <div className="font-black text-lg tracking-tight">IRL FC</div>
        </div>
        <div className="bg-[#131D2B] rounded-lg p-3 mb-4 border border-[#263244]">
          <div className="text-sm font-bold truncate">{player.name}</div>
          <div className="text-xs text-[#929FB2]">{player.position} � {player.ovr} OVR</div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setScreen(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${screen === n.id ? "bg-gradient-to-r from-[#FF1E3C] to-[#E01834] text-[#080D16] text-white shadow-lg shadow-[#FF1E3C]/20" : "text-[#929FB2] hover:bg-[#131D2B] hover:text-white"}`}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <button onClick={restDay} className="mt-2 w-full py-2 rounded-lg bg-[#0D1420] hover:bg-gray-700 text-sm font-semibold transition">Rest Day</button>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-[#0D1420]/95  border-b border-[#263244] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xl">?</div>
          <div className="font-black">IRL FC</div>
        </div>
        <div className="text-xs text-[#929FB2]">{player.name} � {player.ovr}</div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="md:hidden h-14" />
        <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24 md:pb-6">
          {renderScreen()}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0A0A0A]/95  border-t border-[#2A2A2A] flex justify-around py-2 px-1">
        {NAV.slice(0, 4).map((n) => (
          <button key={n.id} onClick={() => setScreen(n.id)} className={`flex flex-col items-center px-2 py-1.5 rounded text-[10px] font-bold transition-colors min-w-[52px] uppercase ${screen === n.id ? "text-[#FF1E3C]" : "text-[#808080]"}`}>
            <span className="text-lg mb-0.5">{n.icon}</span>
            <span className="truncate max-w-[52px]">{n.label}</span>
          </button>
        ))}
        <button onClick={() => setShowMoreNav(!showMoreNav)} className={`flex flex-col items-center px-2 py-1.5 rounded text-[10px] font-bold transition-colors min-w-[52px] uppercase ${showMoreNav ? "text-[#FF1E3C]" : "text-[#808080]"}`}>
          <span className="text-lg mb-0.5">+</span>
          <span>More</span>
        </button>
      </nav>
      {showMoreNav && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setShowMoreNav(false)}>
          <div className="absolute bottom-16 right-2 bg-[#111111] border border-[#2A2A2A] rounded-lg shadow-lg p-2 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
            {NAV.slice(4).map((n) => (
              <button key={n.id} onClick={() => { setScreen(n.id); setShowMoreNav(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${screen === n.id ? "bg-[#FF1E3C]/10 text-[#FF1E3C]" : "text-[#808080] hover:text-white hover:bg-[#1A1A1A]"}`}>
                <span>{n.icon}</span>{n.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
