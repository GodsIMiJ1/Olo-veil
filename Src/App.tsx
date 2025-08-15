import React, { useEffect, useMemo, useRef, useState } from "react";

/**

OLO VEIL PROTOTYPE – MOBILE FIRST

Single-file React app that:

1. Creates an OVP package (JSON container) from a base image + spectral overlay using AES-GCM



2. Reveals the spectral layer when a correct Veil Key is provided



3. Offers a simple AR-style camera backdrop for live reveal preview



File format (.ovp.json for MVP)

{

ovpVersion: "0.1-json",

meta: { glyph, phrase, roles, saltB64, ivB64, checksumSha256Hex },

basePngB64: "data:image/png;base64,...",

spectralCipherB64: "base64 ciphertext"

}

Notes

This MVP avoids external dependencies to stay single-file


WebCrypto is used for AES-GCM and SHA-256


Replace JSON container with .zip in a later sprint */



const enc = new TextEncoder(); const dec = new TextDecoder();

function b64ToBytes(b64: string): Uint8Array { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; } function bytesToB64(bytes: Uint8Array): string { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }

async function sha256Hex(data: Uint8Array): Promise<string> { const h = await crypto.subtle.digest("SHA-256", data); const b = new Uint8Array(h); return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); }

function randBytes(n: number) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }

async function deriveKeyFromPass(pass: string, salt: Uint8Array) { // Use PBKDF2 for portability in MVP. Replace with Argon2/scrypt later. const keyMaterial = await crypto.subtle.importKey( "raw", enc.encode(pass), { name: "PBKDF2" }, false, ["deriveKey"] ); const key = await crypto.subtle.deriveKey( { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"] ); return key; }

async function encryptAesGcm(key: CryptoKey, iv: Uint8Array, data: Uint8Array) { const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data); return new Uint8Array(ct); } async function decryptAesGcm(key: CryptoKey, iv: Uint8Array, data: Uint8Array) { const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data); return new Uint8Array(pt); }

async function fileToDataUrl(file: File): Promise<string> { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); }); }

function download(filename: string, text: string) { const b = new Blob([text], { type: "application/json" }); const url = URL.createObjectURL(b); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }

function useMobileVH() { useEffect(() => { const set = () => { const vh = window.innerHeight * 0.01; document.documentElement.style.setProperty("--vh", ${vh}px); }; set(); window.addEventListener("resize", set); return () => window.removeEventListener("resize", set); }, []); }

function Section({ title, children }: { title: string; children: React.ReactNode }) { return ( <section className="px-4 py-5"> <h2 className="text-base font-semibold tracking-wide mb-3 text-[#f59e0b]">{title}</h2> {children} </section> ); }

export default function App() { useMobileVH(); const [tab, setTab] = useState<"reveal" | "create" | "ar" | "keys">("reveal");

return ( <div className="min-h-[calc(var(--vh,1vh)*100)] bg-[#0b0b0e] text-zinc-200 flex flex-col"> <header className="p-4 border-b border-zinc-800"> <h1 className="text-lg font-bold">Olo Veil</h1> <p className="text-xs opacity-70">NAH'NUMA'HA Prototype</p> </header>

<main className="flex-1 overflow-auto">
    {tab === "reveal" && <RevealView />}
    {tab === "create" && <CreateView />}
    {tab === "ar" && <ARView />}
    {tab === "keys" && <KeysView />}
  </main>

  <nav className="h-14 border-t border-zinc-800 grid grid-cols-4 text-xs">
    {(
      [
        ["Reveal", "reveal"],
        ["Create", "create"],
        ["AR", "ar"],
        ["Keys", "keys"],
      ] as const
    ).map(([label, id]) => (
      <button
        key={id}
        onClick={() => setTab(id)}
        className={`flex items-center justify-center ${
          tab === id ? "bg-zinc-900 text-white" : "text-zinc-400"
        }`}
      >
        {label}
      </button>
    ))}
  </nav>
</div>

); }

function RevealView() { const [ovp, setOvp] = useState<any>(null); const [uReveal, setUReveal] = useState(0); const [error, setError] = useState<string | null>(null);

const baseRef = useRef<HTMLImageElement>(null); const specRef = useRef<HTMLImageElement>(null);

async function handleOpen(file: File) { const text = await file.text(); const obj = JSON.parse(text); setOvp(obj); }

async function unlock() { if (!ovp) return; const pass = prompt("Enter Veil Key") || ""; try { const salt = b64ToBytes(ovp.meta.saltB64); const iv = b64ToBytes(ovp.meta.ivB64); const key = await deriveKeyFromPass(pass, salt); const ct = b64ToBytes(ovp.spectralCipherB64); const pt = await decryptAesGcm(key, iv, ct); // pt is a PNG bytes const b64 = bytesToB64(pt); if (specRef.current) specRef.current.src = data:image/png;base64,${b64}; setError(null); } catch (e) { setError("Invalid key or corrupted file"); } }

useEffect(() => { if (ovp && baseRef.current) baseRef.current.src = ovp.basePngB64; }, [ovp]);

return ( <div> <Section title="Open OVP file"> <input className="block w-full text-sm" type="file" accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleOpen(f); }} /> <button onClick={unlock} className="mt-3 px-4 py-2 bg-[#f59e0b] text-black rounded">Unlock</button> {error && <p className="text-red-400 text-xs mt-2">{error}</p>} </Section>

<Section title="Reveal">
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={uReveal}
      onChange={(e) => setUReveal(parseFloat(e.target.value))}
      className="w-full"
    />
    <div className="relative mt-4 w-full max-w-sm mx-auto aspect-[3/4] rounded-xl overflow-hidden shadow">
      <img ref={baseRef} className="absolute inset-0 w-full h-full object-cover" />
      <img
        ref={specRef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity"
        style={{ opacity: uReveal, mixBlendMode: "screen" }}
      />
    </div>
    {ovp && (
      <p className="text-xs opacity-70 mt-3">
        Glyph {ovp.meta.glyph} • Roles {ovp.meta.roles?.join(", ")}
      </p>
    )}
  </Section>
</div>

); }

function KeysView() { const [pass, setPass] = useState(""); const [salt, setSalt] = useState<string>(bytesToB64(randBytes(16)));

return ( <div> <Section title="Create Veil Key"> <label className="block text-xs mb-1">Passphrase</label> <input value={pass} onChange={(e) => setPass(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" placeholder="Create a strong key" /> <label className="block text-xs mt-3 mb-1">Salt (base64)</label> <input value={salt} onChange={(e) => setSalt(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" /> <p className="text-xs opacity-70 mt-2"> Save both passphrase and salt. Your scrolls cannot be recovered without them. </p> </Section> </div> ); }

function CreateView() { const [baseDataUrl, setBaseDataUrl] = useState<string | null>(null); const [specDataUrl, setSpecDataUrl] = useState<string | null>(null); const [phrase, setPhrase] = useState("Through the Veil, We Walk Unseen"); const [roles, setRoles] = useState<string[]>(["Council"]); const [saltB64, setSaltB64] = useState(bytesToB64(randBytes(16))); const [pass, setPass] = useState("");

async function build() { if (!baseDataUrl || !specDataUrl) return alert("Provide base and spectral images"); if (!pass) return alert("Enter a Veil Key");

const baseBytes = b64ToBytes(baseDataUrl.split(",")[1]);
const spectralBytes = b64ToBytes(specDataUrl.split(",")[1]);

const salt = b64ToBytes(saltB64);
const iv = randBytes(12);
const key = await deriveKeyFromPass(pass, salt);

const ct = await encryptAesGcm(key, iv, spectralBytes);
const checksum = await sha256Hex(ct);

const ovp = {
  ovpVersion: "0.1-json",
  meta: {
    glyph: "NAH'NUMA'HA",
    phrase,
    roles,
    saltB64,
    ivB64: bytesToB64(iv),
    checksumSha256Hex: checksum,
  },
  basePngB64: baseDataUrl,
  spectralCipherB64: bytesToB64(ct),
};

download(`nahnumaha.ovp.json`, JSON.stringify(ovp));

}

return ( <div> <Section title="Base parchment"> <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setBaseDataUrl(await fileToDataUrl(f)); }} /> {baseDataUrl && ( <img src={baseDataUrl} className="mt-3 w-full max-w-sm rounded" /> )} </Section>

<Section title="Spectral overlay (hidden layer)">
    <input
      type="file"
      accept="image/*"
      onChange={async (e) => {
        const f = e.target.files?.[0];
        if (f) setSpecDataUrl(await fileToDataUrl(f));
      }}
    />
    {specDataUrl && (
      <img src={specDataUrl} className="mt-3 w-full max-w-sm rounded opacity-80" />
    )}
  </Section>

  <Section title="Metadata">
    <label className="block text-xs mb-1">Phrase</label>
    <input
      value={phrase}
      onChange={(e) => setPhrase(e.target.value)}
      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 mb-3"
    />
    <label className="block text-xs mb-1">Roles (comma separated)</label>
    <input
      defaultValue={roles.join(", ")}
      onChange={(e) => setRoles(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 mb-3"
    />
    <label className="block text-xs mb-1">Veil Key</label>
    <input
      type="password"
      value={pass}
      onChange={(e) => setPass(e.target.value)}
      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 mb-3"
    />
    <label className="block text-xs mb-1">Salt (base64)</label>
    <input
      value={saltB64}
      onChange={(e) => setSaltB64(e.target.value)}
      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 mb-3"
    />
    <button onClick={build} className="px-4 py-2 bg-[#f59e0b] text-black rounded">Create .ovp.json</button>
    <p className="text-xs opacity-70 mt-2">Keep the Veil Key and salt secure.</p>
  </Section>
</div>

); }

function ARView() { const videoRef = useRef<HTMLVideoElement>(null); const [ready, setReady] = useState(false);

useEffect(() => { let stream: MediaStream; async function init() { try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setReady(true); } } catch (e) { console.error(e); } } init(); return () => stream && stream.getTracks().forEach((t) => t.stop()); }, []);

return ( <div className="p-4 space-y-3"> <h2 className="text-base font-semibold tracking-wide text-[#f59e0b]">Live Reveal Preview</h2> <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-zinc-800"> <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted /> <div className="absolute inset-0 flex items-center justify-center"> <div className="px-3 py-1 text-xs bg-black/50 rounded">Point at a printed scroll</div> </div> </div> <p className="text-xs opacity-70">Planar tracking and real reveal overlay will land in Sprint 2.</p> </div> ); }

// Basic styles for Tailwind-like look without dependency const style = document.createElement("style"); style.innerHTML = *{box-sizing:border-box} .bg-\[\#0b0b0e\]{background:#0b0b0e} .text-zinc-200{color:#e4e4e7} .text-white{color:#fff} .text-black{color:#000} .text-\[\#f59e0b\]{color:#f59e0b} .opacity-70{opacity:.7} .text-xs{font-size:.75rem} .text-base{font-size:1rem} .text-lg{font-size:1.125rem} .font-bold{font-weight:700} .font-semibold{font-weight:600} .tracking-wide{letter-spacing:.02em} .p-4{padding:1rem} .px-3{padding-left:.75rem;padding-right:.75rem} .px-4{padding-left:1rem;padding-right:1rem} .py-1{padding-top:.25rem;padding-bottom:.25rem} .py-2{padding-top:.5rem;padding-bottom:.5rem} .py-5{padding-top:1.25rem;padding-bottom:1.25rem} .mb-1{margin-bottom:.25rem} .mb-2{margin-bottom:.5rem} .mb-3{margin-bottom:.75rem} .mt-2{margin-top:.5rem} .mt-3{margin-top:.75rem} .mt-4{margin-top:1rem} .space-y-3>*+*{margin-top:.75rem} .space-y-4>*+*{margin-top:1rem} .border{border-width:1px} .border-b{border-bottom-width:1px} .border-t{border-top-width:1px} .border-zinc-800{border-color:#27272a} .border-zinc-700{border-color:#3f3f46} .rounded{border-radius:.5rem} .rounded-xl{border-radius:1rem} .shadow{box-shadow:0 10px 25px rgba(0,0,0,.25)} .bg-zinc-900{background:#18181b} .bg-zinc-800{background:#27272a} .bg-\[\#f59e0b\]{background:#f59e0b} .text-zinc-400{color:#a1a1aa} .flex{display:flex} .flex-col{flex-direction:column} .items-center{align-items:center} .justify-center{justify-content:center} .grid{display:grid} .grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))} .min-h-\[calc\(var\(--vh,1vh\)\*100\)\]{min-height:calc(var(--vh,1vh)*100)} .h-14{height:3.5rem} .w-full{width:100%} .max-w-sm{max-width:24rem} .mx-auto{margin-left:auto;margin-right:auto} .aspect-\[3\/4\]{position:relative} .aspect-\[3\/4\]::before{content:"";display:block;padding-top:133.3333%} .absolute{position:absolute} .relative{position:relative} .inset-0{top:0;left:0;right:0;bottom:0} .overflow-hidden{overflow:hidden} .object-cover{object-fit:cover} .rounded-xl{border-radius:1rem} .transition-opacity{transition:opacity .2s}; document.head.appendChild(style);

