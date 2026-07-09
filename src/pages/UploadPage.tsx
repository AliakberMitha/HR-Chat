import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useDatasetStore } from "../store/useDatasetStore";
import { parseFile, cacheLocally } from "../lib/loadPipeline";
import { uploadRemoteDataset, fetchRemotePointer, type RemotePointer } from "../lib/remoteDataset";
import { isGeminiConfigured } from "../lib/gemini";
import { adminLogin, isAdminAuthed, adminLogout } from "../lib/adminAuth";

const ACCEPTED_EXT = [".xlsx", ".xls"];

export default function UploadPage() {
  const navigate = useNavigate();
  const { stage, progressLabel, meta, error, setStage, setMeta, setError, reset } = useDatasetStore();
  const [dragActive, setDragActive] = useState(false);
  const [authed, setAuthed] = useState(isAdminAuthed());
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [current, setCurrent] = useState<RemotePointer | null>(null);
  const [checkingCurrent, setCheckingCurrent] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    fetchRemotePointer()
      .then((p) => !cancelled && setCurrent(p))
      .catch(() => !cancelled && setCurrent(null))
      .finally(() => !cancelled && setCheckingCurrent(false));
    return () => {
      cancelled = true;
    };
  }, [authed]);

  const handleLogin = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await adminLogin(password);
      setAuthed(true);
      setPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setAuthBusy(false);
    }
  }, [password]);

  const handleFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (!ACCEPTED_EXT.some((ext) => lower.endsWith(ext))) {
        setError("Please upload a .xlsx or .xls file.");
        return;
      }
      setError(null);
      try {
        const { meta: parsedMeta, rows } = await parseFile(file, {
          onStage: (s, label) => setStage(s, label),
          onError: (m) => setError(m),
        });

        setStage("uploading", "Publishing to shared storage...");
        await uploadRemoteDataset(parsedMeta, rows, (pct) => {
          setStage("uploading", `Publishing to shared storage... ${Math.round(pct)}%`);
        });
        await cacheLocally(parsedMeta, rows);

        setStage("ready", "Done");
        setMeta(parsedMeta);
        setCurrent({ url: "", meta: parsedMeta });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    },
    [setError, setMeta, setStage],
  );

  const handleStartOver = useCallback(() => {
    reset();
  }, [reset]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const busy = stage === "reading" || stage === "parsing" || stage === "indexing" || stage === "uploading";
  const geminiReady = isGeminiConfigured();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-white mb-4">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white dark:text-zinc-900" fill="none">
              <path d="M4 19.5V4.5A1.5 1.5 0 0 1 5.5 3H16l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M16 3v3.5A1.5 1.5 0 0 0 17.5 8H20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 13h8M8 16.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">HR Talent Chat — Admin</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Upload HR Excel data here to publish it for everyone using the chat.
          </p>
        </div>

        {!geminiReady && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <strong className="font-medium">Gemini API key not set.</strong> Add{" "}
            <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">VITE_GEMINI_API_KEY</code> to a{" "}
            <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">.env</code> file (see{" "}
            <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">.env.example</code>) and restart /
            redeploy before chatting.
          </div>
        )}

        {!authed ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6"
          >
            <h2 className="font-medium text-center mb-1">Admin sign-in required</h2>
            <p className="text-xs text-zinc-400 text-center mb-4">
              Only admins can upload or replace the HR dataset. Everyone else should use the chat link directly.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Admin password"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              autoFocus
            />
            {authError && <p className="text-xs text-red-500 mt-2">{authError}</p>}
            <button
              onClick={handleLogin}
              disabled={authBusy || !password}
              className="mt-3 w-full rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
            >
              {authBusy ? "Signing in..." : "Sign in"}
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="mt-2 w-full text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 py-1"
            >
              Not an admin? Go to the chat →
            </button>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 text-xs text-zinc-400">
              <span>
                {checkingCurrent
                  ? "Checking published dataset..."
                  : current
                    ? `Currently published: ${current.meta.fileName} · ${current.meta.rowCount.toLocaleString()} records`
                    : "Nothing published yet."}
              </span>
              <button onClick={adminLogout} className="hover:text-zinc-600 dark:hover:text-zinc-300">
                Sign out
              </button>
            </div>

            <AnimatePresence mode="wait">
              {stage === "ready" && meta ? (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 text-center"
                >
                  <div className="text-emerald-500 mb-2">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                      <path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h2 className="font-medium">{meta.fileName}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {meta.rowCount.toLocaleString()} records · {meta.columns.length} fields — published for everyone
                  </p>
                  <button
                    onClick={() => navigate("/chat")}
                    className="mt-5 w-full rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-3 font-medium hover:opacity-90 transition"
                  >
                    Go to chat →
                  </button>
                  <button
                    onClick={handleStartOver}
                    className="mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 py-2.5 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
                  >
                    Publish a different file
                  </button>
                </motion.div>
              ) : busy ? (
                <motion.div
                  key="busy"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center"
                >
                  <div className="w-8 h-8 mx-auto mb-4 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white animate-spin" />
                  <p className="text-sm font-medium">{progressLabel || "Working..."}</p>
                  <p className="text-xs text-zinc-400 mt-1">This can take a little while for large files.</p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
                      dragActive
                        ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900"
                        : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                    }`}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                        e.target.value = "";
                      }}
                    />
                    <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto mb-3 text-zinc-400" fill="none">
                      <path d="M12 4v11m0-11 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 16.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p className="font-medium text-sm">Drop your Excel file here, or click to browse</p>
                    <p className="text-xs text-zinc-400 mt-1">.xlsx or .xls — this will replace the dataset everyone chats with</p>
                  </div>

                  {error && (
                    <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                      {error}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
