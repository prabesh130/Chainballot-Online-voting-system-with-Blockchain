import React, { useEffect, useRef, useState } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { mnemonicGenerate, cryptoWaitReady } from "@polkadot/util-crypto";
import { getApiUrl } from "../utils/api";
import { u8aToHex } from "@polkadot/util";
import forge from "node-forge";
import { QRCodeCanvas } from "qrcode.react";
import {
  ConfirmDialog,
  type NoticeItem,
  type NoticeKind,
  NotificationStack,
} from "./ui/feedback";

// ==================== TYPES ====================
type RegisteredVoter = {
  id: number;
  roll: string;
  email: string;
  name: string;
  is_verified: boolean;
};

type BlockchainAccount = RegisteredVoter & {
  mnemonic: string;
  address: string;
  publicKey: string;
  funded: boolean;
};

type ElectionStatus = {
  status: "not_started" | "active" | "ended";
  is_active: boolean;
  started_at: string | null;
  ended_at: string | null;
  blockchain_phase: "NotStarted" | "Voting" | "Ended" | "TallyComplete" | null;
};

// CHANGED: removed blockchain_candidate_id - candidates are Django-only now
type AdminCandidate = {
  id: number;
  candidate_id: number | null; // explicit admin-assigned ID, shown during tallying
  name: string;
  post: string;
  photo_url: string;
  is_active: boolean;
};

type EncryptedVote = {
  vote_id: number;
  encrypted_vote: string;
  blind_signature: string;
  vote_hash:string;
};

type RevealProgress = {
  total: number;
  revealed: number;
  current: number;
};

const CANDIDATE_POSTS = [
  "President",
  "Vice President",
  "Secretary",
  "Vice Secretary",
] as const;

const DEFAULT_CANDIDATE_IMAGE = "src/assets/image/candidate.jpg";
const FEE_AMOUNT = "1000000000000"; // 1 token
const ALICE_SEED = "//Alice";
const NODE_URL = "ws://127.0.0.1:9944";
const getChainCandidateId = (candidate: AdminCandidate) =>
  candidate.candidate_id ?? candidate.id;

// ==================== ADMIN LOGIN COMPONENT ====================
const AdminLogin: React.FC<{ onLoginSuccess: () => void }> = ({
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(getApiUrl("/voter/admin/login/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onLoginSuccess();
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch (err: any) {
      setError("Failed to connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">
            Admin Login
          </h1>
          <p className="text-slate-600">Blockchain Voting System</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="admin@example.com"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>
            {error && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <p className="text-red-700 text-sm font-semibold">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-900 text-white py-3 rounded-lg hover:from-blue-700 hover:to-blue-900 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-semibold transition-all transform hover:scale-105 disabled:transform-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Authenticating...
                </>
              ) : (
                "Login to Dashboard"
              )}
            </button>
          </form>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Only staff/superuser accounts can access this dashboard
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== VOTE REVEAL COMPONENT ====================
const VoteRevealPanel: React.FC<{
  api: ApiPromise | null;
  candidates: AdminCandidate[];
  onRevealComplete: () => void;
}> = ({ api, candidates, onRevealComplete }) => {
  const [encryptedVotes, setEncryptedVotes] = useState<EncryptedVote[]>([]);
  const [revealProgress, setRevealProgress] = useState<RevealProgress>({
    total: 0,
    revealed: 0,
    current: 0,
  });
  const [revealing, setRevealing] = useState(false);
  const [selectedVote, setSelectedVote] = useState<EncryptedVote | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [decryptedData, setDecryptedData] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>("");
  const [showPrivateKeyInput, setShowPrivateKeyInput] = useState(false);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  const pushNotice = (
    kind: NoticeKind,
    title: string,
    message?: string,
    timeout = 5000,
  ) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((prev) => [...prev, { id, kind, title, message }]);
    setTimeout(
      () => setNotices((prev) => prev.filter((n) => n.id !== id)),
      timeout,
    );
  };

  const dismissNotice = (id: number) =>
    setNotices((prev) => prev.filter((n) => n.id !== id));

  const decryptVoteWithKey = (encryptedVote: string, key: string): string => {
    const encryptedHex = encryptedVote.trim().replace(/^0x/i, "");
    if (!encryptedHex) {
      throw new Error("Encrypted vote is empty");
    }

    const privateKeyPem = key.trim();
    if (!privateKeyPem) {
      throw new Error("Private key is required");
    }

    const rsaPrivateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const encryptedBytes = forge.util.hexToBytes(encryptedHex);
    const decryptedText = rsaPrivateKey.decrypt(encryptedBytes, "RSA-OAEP");
    const parsed = JSON.parse(decryptedText);

    return JSON.stringify(parsed);
  };

  const fetchEncryptedVotes = async () => {
    if (!api) return;
    try {
      let total = 0;
      if (api.query.voting.voteCounter) {
        total = ((await api.query.voting.voteCounter()) as any).toNumber();
      }
      console.log("Total votes on chain:", total);

      const votes: EncryptedVote[] = [];
      for (let i = 0; i < total; i++) {
        const voteOpt = await (api.query.voting.encryptedVotes as any)(i);
        const voteData = voteOpt?.isSome ? voteOpt.unwrap() : voteOpt;

        if (voteData && !voteData.isEmpty) {
          const encVote = voteData.encryptedVote ?? voteData.encrypted_vote;
          const blindSig = voteData.blindSignature ?? voteData.blind_signature;
          const voteHash=voteData.voteHash?? voteData.vote_hash;
          votes.push({
            vote_id: i,
            encrypted_vote: encVote?.toHex? encVote.toHex()
: u8aToHex(encVote?.toU8a?.() ?? new Uint8Array()),
            blind_signature: blindSig?.toHex
              ? blindSig.toHex()
  : u8aToHex(blindSig?.toU8a?.() ?? new Uint8Array()),
            vote_hash: voteHash?.toHex? voteHash.toHex():
  u8aToHex(voteHash?.toU8a?.() ?? new Uint8Array()),
          });
        }
      }

      console.log(`Fetched ${votes.length} votes`);
      setEncryptedVotes(votes);

      const revealedCount = api.query.voting.revealedCount
        ? ((await api.query.voting.revealedCount()) as any).toNumber()
        : 0;

      setRevealProgress({
        total: votes.length,
        revealed: revealedCount,
        current: 0,
      });
    } catch (error) {
      console.error("Error fetching encrypted votes:", error);
      pushNotice("error", "Failed to fetch encrypted votes");
    }
  };

  const handleDecryptVote = () => {
    if (!selectedVote || !privateKey) return;
    try {
      const decrypted = decryptVoteWithKey(
        selectedVote.encrypted_vote,
        privateKey,
      );
      setDecryptedData(decrypted);
      pushNotice("success", "Vote decrypted successfully");
    } catch (error: any) {
      pushNotice(
        "error",
        "Failed to decrypt vote",
        error?.message || "Check private key and payload format",
      );
    }
  };

  const handleRevealVote = async () => {
    if (!api || !selectedVote || !selectedCandidate) return;
    try {
      setRevealing(true);
      const keyring = new Keyring({ type: "sr25519" });
      await cryptoWaitReady();
      const alice = keyring.addFromUri(ALICE_SEED);
      const VoteHashBytes=Array.from(hexToU8a(selectedVote.vote_hash));
      // CHANGED: wrap reveal_vote in sudo since AdminOrigin requires it
      const innerCall = api.tx.voting.revealVote(
        selectedVote.vote_id,
        parseInt(selectedCandidate),
        VoteHashBytes,
      );
      const tx = api.tx.sudo.sudo(innerCall);

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(alice, (result: any) => {
          if (result.dispatchError) {
            let msg = "Dispatch error";
            if (result.dispatchError.isModule) {
              try {
                const d = api.registry.findMetaError(
                  result.dispatchError.asModule,
                );
                msg = `${d.section}.${d.name}: ${d.docs.join(" ")}`;
              } catch {
                msg = "Module error";
              }
            } else {
              msg = result.dispatchError.toString?.() ?? msg;
            }
            console.error("revealVote dispatchError:", msg);
            reject(new Error(msg));
            return;
          }
          if (result.status.isInBlock) {
            pushNotice("success", `Vote #${selectedVote.vote_id} revealed`);
            resolve();
          }
        });
      });

      await fetchEncryptedVotes();
      setSelectedVote(null);
      setSelectedCandidate("");
      setDecryptedData("");
      onRevealComplete();
    } catch (error: any) {
      pushNotice("error", "Failed to reveal vote", error.message);
    } finally {
      setRevealing(false);
    }
  };

  const handleFinalizeTally = async () => {
    if (!api) return;
    try {
      const keyring = new Keyring({ type: "sr25519" });
      await cryptoWaitReady();
      const alice = keyring.addFromUri(ALICE_SEED);

      // CHANGED: wrap finalize_tally in sudo
      const innerCall = api.tx.voting.finalizeTally();
      const tx = api.tx.sudo.sudo(innerCall);

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(alice, (result: any) => {
          if (result.dispatchError) {
            let msg = "Dispatch error";
            if (result.dispatchError.isModule) {
              try {
                const d = api.registry.findMetaError(
                  result.dispatchError.asModule,
                );
                msg = `${d.section}.${d.name}: ${d.docs.join(" ")}`;
              } catch {
                msg = "Module error";
              }
            } else {
              msg = result.dispatchError.toString?.() ?? msg;
            }
            console.error("finalizeTally dispatchError:", msg);
            reject(new Error(msg));
            return;
          }
          if (result.status.isInBlock) {
            pushNotice("success", "Tally finalized", "Results are now public");
            resolve();
          }
        });
      });

      onRevealComplete();
    } catch (error: any) {
      pushNotice("error", "Failed to finalize tally", error.message);
    }
  };

  useEffect(() => {
    if (api) fetchEncryptedVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <NotificationStack notices={notices} onDismiss={dismissNotice} />
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Vote Decryption and Reveal
      </h2>

      {revealProgress.total > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Reveal Progress</span>
            <span>
              {revealProgress.revealed} / {revealProgress.total} votes
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all"
              style={{
                width: `${(revealProgress.revealed / revealProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={() => setShowPrivateKeyInput(!showPrivateKeyInput)}
          className="text-blue-600 hover:text-blue-700 font-medium mb-3"
        >
          {showPrivateKeyInput ? "Hide" : "Show"} RSA Private Key Input
        </button>
        {showPrivateKeyInput && (
          <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RSA Private Key (PEM format)
            </label>
            <textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              placeholder="-----BEGIN RSA PRIVATE KEY----- ..."
            />
            <p className="text-xs text-gray-500 mt-2">
              Private key is processed locally and never sent to server
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">
            Encrypted Votes ({encryptedVotes.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {encryptedVotes.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                No votes found on chain
              </p>
            )}
            {encryptedVotes.map((vote) => (
              <div
                key={vote.vote_id}
                onClick={() => setSelectedVote(vote)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedVote?.vote_id === vote.vote_id
                    ? "bg-blue-50 border-blue-500"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">Vote #{vote.vote_id}</span>
                  <span className="text-xs text-gray-500">
                    {vote.encrypted_vote.slice(0, 20)}...
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedVote && (
          <div className="border-l pl-6">
            <h3 className="font-semibold text-gray-700 mb-3">
              Decrypt Vote #{selectedVote.vote_id}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Encrypted Data
                </label>
                <code className="block bg-gray-100 p-3 rounded-lg text-xs break-all">
                  {selectedVote.encrypted_vote}
                </code>
              </div>
              <button
                onClick={handleDecryptVote}
                disabled={!privateKey}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                Decrypt Vote
              </button>
              {decryptedData && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Decrypted Data
                    </label>
                    <pre className="bg-green-50 p-3 rounded-lg text-sm border border-green-300 overflow-auto max-h-32">
                      {JSON.stringify(JSON.parse(decryptedData), null, 2)}
                    </pre>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Candidate to Credit
                    </label>
                    <select
                      value={selectedCandidate}
                      onChange={(e) => setSelectedCandidate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Choose candidate...</option>
                      {candidates.map((c) => (
                        <option
                          key={c.id}
                          value={String(getChainCandidateId(c))}
                        >
                          [ID: {getChainCandidateId(c)}] {c.name} ({c.post})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleRevealVote}
                    disabled={!selectedCandidate || revealing}
                    className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {revealing ? "Revealing..." : "Reveal Vote on Blockchain"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {revealProgress.revealed === revealProgress.total &&
        revealProgress.total > 0 && (
          <div className="mt-6 pt-4 border-t">
            <button
              onClick={handleFinalizeTally}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-semibold"
            >
              Finalize Tally and Publish Results
            </button>
          </div>
        )}
    </div>
  );
};

// ==================== RESULTS DISPLAY COMPONENT ====================
const ResultsDisplay: React.FC<{
  api: ApiPromise | null;
  candidates: AdminCandidate[];
}> = ({ api, candidates }) => {
  const [tally, setTally] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [totalVotes, setTotalVotes] = useState(0);

  const fetchTally = async () => {
    if (!api) return;
    setLoading(true);
    try {
      const tallyData: Record<number, number> = {};
      let total = 0;
      for (const candidate of candidates) {
        const chainCandidateId = getChainCandidateId(candidate);
        const count = await (api.query.voting.tally as any)(chainCandidateId);
        const votes = count.toNumber();
        tallyData[chainCandidateId] = votes;
        total += votes;
      }
      setTally(tallyData);
      setTotalVotes(total);
    } catch (error) {
      console.error("Error fetching tally:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!api || candidates.length === 0) return;
    fetchTally();

    let unsubscribe: (() => void) | null = null;
    const subscribe = async () => {
      try {
        const unsub = await (api.query.voting.voteCounter as any)(
          (counter: any) => {
            console.log("Vote counter changed:", counter.toString());
            fetchTally();
          },
        );
        unsubscribe = unsub as unknown as () => void;
      } catch (err) {
        console.error("Failed to subscribe to vote counter:", err);
      }
    };
    subscribe();
    return () => {
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, candidates]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading results...</p>
      </div>
    );
  }

  const sortedCandidates = [...candidates].sort(
    (a, b) =>
      (tally[getChainCandidateId(b)] || 0) -
      (tally[getChainCandidateId(a)] || 0),
  );
  const winner = sortedCandidates[0];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Election Results</h2>
      {totalVotes > 0 && (
        <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Votes Cast</p>
            <p className="text-3xl font-bold text-green-700">{totalVotes}</p>
          </div>
          {winner && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <p className="text-sm text-gray-600">Current Leader</p>
              <p className="text-xl font-bold text-green-800">
                {winner.name} ({winner.post}) -{" "}
                {tally[getChainCandidateId(winner)] || 0} votes
              </p>
            </div>
          )}
        </div>
      )}
      <div className="space-y-4">
        {CANDIDATE_POSTS.map((post) => {
          const postCandidates = candidates.filter((c) => c.post === post);
          if (postCandidates.length === 0) return null;
          return (
            <div key={post} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-3">{post}</h3>
              <div className="space-y-3">
                {postCandidates.map((candidate) => {
                  const votes = tally[getChainCandidateId(candidate)] || 0;
                  const percentage =
                    totalVotes > 0
                      ? ((votes / totalVotes) * 100).toFixed(1)
                      : "0";
                  return (
                    <div key={candidate.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{candidate.name}</span>
                        <span className="text-gray-600">
                          {votes} votes ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==================== MAIN ADMIN DASHBOARD ====================
const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [accounts, setAccounts] = useState<BlockchainAccount[]>([]);
  const [selected, setSelected] = useState<BlockchainAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState(false);
  const [electionStatus, setElectionStatus] = useState<ElectionStatus | null>(
    null,
  );
  const [electionActionLoading, setElectionActionLoading] = useState(false);
  const [candidates, setCandidates] = useState<AdminCandidate[]>([]);
  const [candidateSubmitting, setCandidateSubmitting] = useState(false);
  const [candidateForm, setCandidateForm] = useState<{
    name: string;
    post: (typeof CANDIDATE_POSTS)[number];
    photo_url: string;
  }>({
    name: "",
    post: CANDIDATE_POSTS[0],
    photo_url: "",
  });
  const [fundingProgress, setFundingProgress] = useState({
    current: 0,
    total: 0,
  });
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
  });
  const confirmResolverRef = useRef<((accepted: boolean) => void) | null>(null);
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "accounts" | "funding" | "reveal" | "results"
  >("accounts");
  const apiRef = useRef<ApiPromise | null>(null);
  const phaseUnsubRef = useRef<(() => void) | null>(null);

  const pushNotice = (
    kind: NoticeKind,
    title: string,
    message?: string,
    timeout = 5000,
  ) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((prev) => [...prev, { id, kind, title, message }]);
    setTimeout(
      () => setNotices((prev) => prev.filter((n) => n.id !== id)),
      timeout,
    );
  };

  const dismissNotice = (id: number) =>
    setNotices((prev) => prev.filter((n) => n.id !== id));

  const requestConfirmation = (
    title: string,
    message: string,
    confirmLabel = "Confirm",
  ) =>
    new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({ open: true, title, message, confirmLabel });
    });

  const resolveConfirmation = (accepted: boolean) => {
    setConfirmState((prev) => ({ ...prev, open: false }));
    if (confirmResolverRef.current) {
      confirmResolverRef.current(accepted);
      confirmResolverRef.current = null;
    }
  };

  useEffect(() => {
    initializeSystem();
    return () => {
      if (phaseUnsubRef.current) {
        phaseUnsubRef.current();
        phaseUnsubRef.current = null;
      }
      if (apiRef.current) {
        apiRef.current.disconnect();
        apiRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeSystem = async () => {
    await cryptoWaitReady();
    await initApi();
    await Promise.all([
      fetchAndGenerateAccounts(),
      fetchElectionStatus(),
      fetchCandidates(),
    ]);
  };

  const initApi = async () => {
    try {
      const provider = new WsProvider(NODE_URL);
      const apiInstance = await ApiPromise.create({ provider });
      await apiInstance.isReady;
      console.log("Blockchain connected");

      if (!apiInstance.query.voting) {
        pushNotice(
          "warning",
          "Voting pallet not found",
          "Make sure your pallet is named 'voting' in the runtime",
        );
        apiRef.current = apiInstance;
        setApi(apiInstance);
        setConnected(true);
        return;
      }

      try {
        const initialPhase =
          (await apiInstance.query.voting.currentPhase()) as any;
        setElectionStatus((prev) =>
          prev
            ? { ...prev, blockchain_phase: initialPhase.toString() as any }
            : null,
        );
      } catch {
        /* phase query failed, not fatal */
      }

      try {
        const unsub = await (apiInstance.query.voting.currentPhase as any)(
          (phase: any) => {
            const phaseStr = phase.toString();
            setElectionStatus((prev) =>
              prev ? { ...prev, blockchain_phase: phaseStr as any } : null,
            );
            fetchElectionStatus();
          },
        );
        phaseUnsubRef.current = unsub as unknown as () => void;
      } catch (err) {
        console.error("Failed to subscribe to phase changes:", err);
      }

      apiRef.current = apiInstance;
      setApi(apiInstance);
      setConnected(true);
    } catch (err: any) {
      pushNotice(
        "error",
        "Blockchain connection failed",
        `${err.message}. Make sure your node is running on ${NODE_URL}.`,
      );
    }
  };

  const fetchElectionStatus = async () => {
    try {
      const response = await fetch(getApiUrl("/voting/election/status/"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load election status");
      const data: ElectionStatus = await response.json();
      const currentApi = apiRef.current;
      if (currentApi?.query.voting?.currentPhase) {
        try {
          const phase = (await currentApi.query.voting.currentPhase()) as any;
          data.blockchain_phase = phase.toString() as any;
        } catch {
          /* not fatal */
        }
      }
      setElectionStatus(data);
    } catch (error) {
      console.error("Failed to fetch election status:", error);
    }
  };

  const fetchCandidates = async () => {
    try {
      const response = await fetch(getApiUrl("/voting/admin/candidates/"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load candidates");
      const data = await response.json();
      setCandidates(data.candidates || []);
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    }
  };

  const fetchAndGenerateAccounts = async (): Promise<BlockchainAccount[]> => {
    setLoading(true);
    try {
      const response = await fetch(
        getApiUrl("/voter/admin/verified-voters/"),
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Failed to fetch voters. Session may have expired.");
      const data = await response.json();
      const registeredVoters: RegisteredVoter[] = data.voters || [];

      if (registeredVoters.length === 0) {
        setAccounts([]);
        localStorage.removeItem("blockchain_accounts");
        setLoading(false);
        return [];
      }

      const keyring = new Keyring({ type: "sr25519" });
      const cachedByRoll = new Map<string, BlockchainAccount>();
      const cachedRaw = localStorage.getItem("blockchain_accounts");
      if (cachedRaw) {
        try {
          (JSON.parse(cachedRaw) as BlockchainAccount[]).forEach((acc) => {
            if (acc.roll && acc.mnemonic) cachedByRoll.set(acc.roll, acc);
          });
        } catch {
          /* ignore parse error */
        }
      }

      const generatedAccounts: BlockchainAccount[] = registeredVoters.map(
        (voter, index) => {
          const cached = cachedByRoll.get(voter.roll);
          const mnemonic = cached?.mnemonic || mnemonicGenerate(12);
          const account = keyring.addFromUri(mnemonic);
          console.log(`  ${index + 1}. ${voter.name} -> ${account.address}`);
          return {
            ...voter,
            mnemonic,
            address: account.address,
            publicKey: u8aToHex(account.publicKey),
            funded: cached?.funded || false,
          };
        },
      );

      setAccounts(generatedAccounts);
      localStorage.setItem(
        "blockchain_accounts",
        JSON.stringify(generatedAccounts),
      );
      setLoading(false);
      return generatedAccounts;
    } catch (error: any) {
      pushNotice("error", "Failed to load voter accounts", error.message);
      setLoading(false);
      return [];
    }
  };

  const fundAllAccounts = async () => {
    if (!api) {
      pushNotice("error", "Blockchain is not connected");
      return;
    }
    const unfundedAccounts = accounts.filter((a) => !a.funded);
    if (unfundedAccounts.length === 0) {
      pushNotice("info", "All accounts are already funded");
      return;
    }

    const shouldFund = await requestConfirmation(
      "Fund Accounts",
      `Fund ${unfundedAccounts.length} accounts?\n\nTotal cost: ${BigInt(FEE_AMOUNT) * BigInt(unfundedAccounts.length)} tokens`,
      "Start Funding",
    );
    if (!shouldFund) return;

    setFunding(true);
    setFundingProgress({ current: 0, total: unfundedAccounts.length });
    const keyring = new Keyring({ type: "sr25519" });
    const alice = keyring.addFromUri(ALICE_SEED);
    let successCount = 0;

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      if (account.funded) continue;

      const progressIndex = accounts
        .slice(0, i + 1)
        .filter((a) => !a.funded).length;
      setFundingProgress({
        current: progressIndex,
        total: unfundedAccounts.length,
      });

      try {
        await new Promise<void>((resolve, reject) => {
          api.tx.balances
            .transferKeepAlive(account.address, FEE_AMOUNT)
            .signAndSend(alice, (result: any) => {
              if (result.dispatchError) {
                reject(result.dispatchError);
                return;
              }
              if (result.status.isInBlock) {
                setAccounts((prev) =>
                  prev.map((acc, idx) =>
                    idx === i ? { ...acc, funded: true } : acc,
                  ),
                );
                successCount++;
                resolve();
              }
            });
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to fund ${account.name}:`, error);
      }
    }

    setAccounts((prev) => {
      localStorage.setItem("blockchain_accounts", JSON.stringify(prev));
      return prev;
    });
    pushNotice(
      "success",
      "Funding completed",
      `Successfully funded ${successCount}/${unfundedAccounts.length} accounts.`,
      7000,
    );
    setFunding(false);
    setFundingProgress({ current: 0, total: 0 });
  };

  // CHANGED: registerCandidate now only saves to Django - no on-chain call
  const registerCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateForm.name.trim()) {
      pushNotice("warning", "Candidate name is required");
      return;
    }
    setCandidateSubmitting(true);
    try {
      const response = await fetch(getApiUrl("/voting/admin/candidates/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: candidateForm.name.trim(),
          post: candidateForm.post,
          photo_url: candidateForm.photo_url.trim() || DEFAULT_CANDIDATE_IMAGE,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to register candidate");
      setCandidateForm((prev) => ({ ...prev, name: "", photo_url: "" }));
      await fetchCandidates();
      pushNotice("success", "Candidate registered successfully");
    } catch (error: any) {
      pushNotice("error", "Unable to register candidate", error.message);
    } finally {
      setCandidateSubmitting(false);
    }
  };

  const decodeDispatchError = (api: ApiPromise, err: any): string => {
    if (err?.isModule) {
      try {
        const decoded = api.registry.findMetaError(err.asModule);
        return `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
      } catch {
        return `Module error (index ${err.asModule?.index}, error ${err.asModule?.error})`;
      }
    }
    for (const v of [
      "BadOrigin",
      "CannotLookup",
      "Other",
      "Token",
      "Arithmetic",
      "Transactional",
      "Exhausted",
      "Corruption",
      "Unavailable",
      "RootNotAllowed",
    ]) {
      if (err?.[`is${v}`]) {
        const d = err[`as${v}`];
        return d?.toString ? `${v}: ${d.toString()}` : v;
      }
    }
    return err?.toString?.() ?? "Unknown dispatch error";
  };

  const startElectionOnChain = async () => {
    const currentApi = apiRef.current;
    if (!currentApi) throw new Error("Blockchain not connected");
    const keyring = new Keyring({ type: "sr25519" });
    const alice = keyring.addFromUri(ALICE_SEED);
    const tx = currentApi.tx.sudo.sudo(currentApi.tx.voting.startElection());
    return new Promise<void>((resolve, reject) => {
      tx.signAndSend(alice, (result: any) => {
        if (result.dispatchError) {
          reject(
            new Error(decodeDispatchError(currentApi, result.dispatchError)),
          );
          return;
        }
        if (result.status.isInBlock) {
          console.log(`Election started in block ${result.status.asInBlock}`);
          resolve();
        }
      });
    });
  };

  const startElection = async () => {
    if (electionStatus?.status === "active") {
      pushNotice("info", "Election is already active");
      return;
    }
    const missingPosts = CANDIDATE_POSTS.filter(
      (post) => !candidates.some((c) => c.post === post),
    );
    if (missingPosts.length > 0) {
      pushNotice(
        "warning",
        "Cannot start election",
        `Add at least one candidate for: ${missingPosts.join(", ")}`,
      );
      return;
    }
    const shouldStart = await requestConfirmation(
      "Start Election",
      "This will start the election on blockchain and email credentials to all voters.\n\nProceed?",
      "Start Election",
    );
    if (!shouldStart) return;
    setElectionActionLoading(true);
    try {
      await startElectionOnChain();
      const response = await fetch(
        getApiUrl("/voting/admin/election/start/"),
        { method: "POST", credentials: "include" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to start election in Django");

      let accountsToSend = accounts;
      if (accountsToSend.length === 0)
        accountsToSend = await fetchAndGenerateAccounts();
      const results = await Promise.allSettled(
        accountsToSend.map((a) => sendCredentialsForAccount(a, true)),
      );
      const sentCount = results.filter(
        (r) => r.status === "fulfilled" && r.value,
      ).length;
      await fetchElectionStatus();
      pushNotice(
        "success",
        "Election started successfully",
        `Emails sent: ${sentCount}/${accountsToSend.length}`,
        7000,
      );
    } catch (error: any) {
      pushNotice("error", "Unable to start election", error.message);
    } finally {
      setElectionActionLoading(false);
    }
  };

  const endElectionOnChain = async () => {
    const currentApi = apiRef.current;
    if (!currentApi) throw new Error("Blockchain not connected");
    const keyring = new Keyring({ type: "sr25519" });
    const alice = keyring.addFromUri(ALICE_SEED);
    const tx = currentApi.tx.sudo.sudo(currentApi.tx.voting.endElection());
    return new Promise<void>((resolve, reject) => {
      tx.signAndSend(alice, (result: any) => {
        if (result.dispatchError) {
          reject(
            new Error(decodeDispatchError(currentApi, result.dispatchError)),
          );
          return;
        }
        if (result.status.isInBlock) {
          console.log(`Election ended in block ${result.status.asInBlock}`);
          resolve();
        }
      });
    });
  };

  const endElection = async () => {
    if (electionStatus?.status !== "active") {
      pushNotice("info", "Election is not active");
      return;
    }
    const shouldEnd = await requestConfirmation(
      "End Election",
      "This will end voting immediately.\n\nProceed?",
      "End Election",
    );
    if (!shouldEnd) return;
    setElectionActionLoading(true);
    try {
      await endElectionOnChain();
      const response = await fetch(
        getApiUrl("/voting/admin/election/end/"),
        { method: "POST", credentials: "include" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to end election in Django");
      await fetchElectionStatus();
      pushNotice("success", "Election ended", "Voting is now closed.");
    } catch (error: any) {
      pushNotice("error", "Unable to end election", error.message);
    } finally {
      setElectionActionLoading(false);
    }
  };

  const removeCandidate = async (
    candidateId: number,
    candidateName: string,
  ) => {
    if (electionStatus?.status === "active") {
      pushNotice("warning", "Cannot remove candidates during active election");
      return;
    }
    const shouldRemove = await requestConfirmation(
      "Remove Candidate",
      `Remove ${candidateName} from candidate list?`,
      "Remove",
    );
    if (!shouldRemove) return;
    try {
      const response = await fetch(
        getApiUrl(`/voting/admin/candidates/${candidateId}/delete/`),
        { method: "POST", credentials: "include" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to remove candidate");
      await fetchCandidates();
      pushNotice("success", "Candidate removed");
    } catch (error: any) {
      pushNotice("error", "Unable to remove candidate", error.message);
    }
  };

  const sendCredentialsForAccount = async (
    account: BlockchainAccount,
    silent: boolean,
  ) => {
    try {
      const response = await fetch(
        getApiUrl("/voter/admin/send-credentials/"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: account.email,
            name: account.name,
            roll: account.roll,
            mnemonic: account.mnemonic,
            address: account.address,
            funded: account.funded,
          }),
        },
      );
      if (response.ok) {
        if (!silent) pushNotice("success", "Credentials sent", account.email);
        return true;
      }
      if (!silent)
        pushNotice("error", "Failed to send credentials", account.email);
      return false;
    } catch (error) {
      if (!silent)
        pushNotice("error", "Error sending credentials", String(error));
      return false;
    }
  };

  const downloadJSON = () => {
    if (accounts.length === 0) {
      pushNotice("warning", "No accounts available for download");
      return;
    }
    const blob = new Blob([JSON.stringify(accounts, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blockchain_accounts_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushNotice(
      "success",
      "JSON downloaded",
      "Keep this file secure. It contains voter mnemonics.",
    );
  };

  const downloadCSV = () => {
    if (accounts.length === 0) {
      pushNotice("warning", "No accounts available for download");
      return;
    }
    const csv = [
      ["Name", "Roll", "Email", "Address", "Mnemonic", "Funded"].join(","),
      ...accounts.map((acc) =>
        [
          acc.name,
          acc.roll,
          acc.email,
          acc.address,
          acc.mnemonic,
          acc.funded ? "Yes" : "No",
        ]
          .map((c) => `"${c}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blockchain_accounts_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    pushNotice("success", "CSV downloaded");
  };

  const copyText = async (text: string, label = "Text") => {
    try {
      await navigator.clipboard.writeText(text);
      pushNotice("success", `${label} copied`);
    } catch {
      pushNotice("error", `Failed to copy ${label.toLowerCase()}`);
    }
  };

  const refreshAccounts = async () => {
    // Re-fetch election status fresh from server
    let isActive = false;
    try {
      const response = await fetch(getApiUrl("/voting/election/status/"), {
        credentials: "include",
      });
      if (response.ok) {
        const freshStatus: ElectionStatus = await response.json();
        setElectionStatus(freshStatus);
        isActive = freshStatus.status === "active";
      }
    } catch {
      /* not fatal */
    }

    if (isActive) {
      pushNotice(
        "warning",
        "Cannot regenerate accounts while election is active",
      );
      return;
    }

    // Clear localStorage and regenerate - this resets funded flags too
    localStorage.removeItem("blockchain_accounts");
    await fetchAndGenerateAccounts();
    pushNotice(
      "success",
      "Accounts refreshed",
      "You can now fund them on the new chain.",
    );
  };

  // Resets funded=false for all accounts without regenerating mnemonics
  // Use this after purging the chain so you can re-fund on the fresh chain
  const resetFundedStatus = () => {
    const updated = accounts.map((a) => ({ ...a, funded: false }));
    setAccounts(updated);
    localStorage.setItem("blockchain_accounts", JSON.stringify(updated));
    pushNotice(
      "success",
      "Funding status reset",
      "You can now fund all accounts again.",
    );
  };

  const handleLogout = async () => {
    const shouldLogout = await requestConfirmation(
      "Logout",
      "Are you sure you want to logout?",
      "Logout",
    );
    if (!shouldLogout) return;
    try {
      await fetch(getApiUrl("/voter/admin/logout/"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    onLogout();
  };

  const groupedCandidates = CANDIDATE_POSTS.reduce<
    Record<string, AdminCandidate[]>
  >((acc, post) => {
    acc[post] = candidates.filter((c) => c.post === post);
    return acc;
  }, {});
  const missingCandidatePosts = CANDIDATE_POSTS.filter(
    (post) => !groupedCandidates[post]?.length,
  );

  if (loading && !accounts.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-slate-700">
            Loading Dashboard...
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Connecting to blockchain and fetching voters
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  px-4 py-6 md:px-8 md:py-10">
      <NotificationStack notices={notices} onDismiss={dismissNotice} />
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={() => resolveConfirmation(true)}
        onCancel={() => resolveConfirmation(false)}
      />
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-r from-sky-700 via-blue-700 to-indigo-700 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">
                Blockchain Voting Admin
              </h1>
              <p className="text-blue-100 text-sm md:text-base">
                Complete election management dashboard
              </p>
              <p className="text-blue-100/90 text-xs mt-2">
                {connected
                  ? `Chain: ${(api as any)?.runtimeVersion?.specName?.toString() || "Substrate"} | Phase: ${electionStatus?.blockchain_phase || "Unknown"}`
                  : "Blockchain node is disconnected"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  connected
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-rose-100 text-rose-900"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
                {connected ? "Blockchain Connected" : "Blockchain Disconnected"}
              </div>
              <div className="flex items-center gap-2">
                {!connected && (
                  <button
                    onClick={initApi}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg transition-colors text-sm font-semibold"
                  >
                    Reconnect
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Election Status Bar */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Election Status</p>
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                <span
                  className={`text-xs px-3 py-1 rounded-full font-semibold ${
                    electionStatus?.status === "active"
                      ? "bg-green-600 text-white"
                      : electionStatus?.status === "ended"
                        ? "bg-red-600 text-white"
                        : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {electionStatus?.status === "active"
                    ? "ACTIVE"
                    : electionStatus?.status === "ended"
                      ? "ENDED"
                      : "NOT STARTED"}
                </span>
                {electionStatus?.blockchain_phase && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                    Blockchain: {electionStatus.blockchain_phase}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {electionStatus?.started_at
                    ? `Started: ${new Date(electionStatus.started_at).toLocaleString()}`
                    : "Election has not started yet"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={startElection}
                disabled={
                  electionActionLoading ||
                  electionStatus?.status === "active" ||
                  !connected ||
                  missingCandidatePosts.length > 0
                }
                className="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {electionActionLoading && electionStatus?.status !== "active"
                  ? "Starting..."
                  : "Start Election"}
              </button>
              <button
                onClick={endElection}
                disabled={
                  electionActionLoading ||
                  electionStatus?.status !== "active" ||
                  !connected
                }
                className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {electionActionLoading && electionStatus?.status === "active"
                  ? "Ending..."
                  : "End Election"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Starting election will immediately email 12-word mnemonic
            credentials to all registered and verified voters.
          </p>
          {missingCandidatePosts.length > 0 && (
            <p className="text-xs text-red-600 mt-2">
              Add at least one candidate for: {missingCandidatePosts.join(", ")}
              .
            </p>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl p-2 flex gap-2 border border-slate-200">
          {(["accounts", "funding", "reveal", "results"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                disabled={
                  tab === "reveal" && electionStatus?.status !== "ended"
                }
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : tab === "reveal" && electionStatus?.status !== "ended"
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab === "accounts"
                  ? "Register Candidates"
                  : tab === "funding"
                    ? "Account Funding"
                    : tab === "reveal"
                      ? "Reveal Votes"
                      : "Results"}
              </button>
            ),
          )}
        </div>

        {/* Tab Content */}
        {activeTab === "accounts" && (
          <>
            {/* Candidate Registration - Django only, no on-chain call */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Candidate Registration
              </h2>
              <form
                onSubmit={registerCandidate}
                className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5"
              >
                <input
                  type="text"
                  value={candidateForm.name}
                  onChange={(e) =>
                    setCandidateForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Candidate name"
                  className="px-4 py-3 border border-gray-300 rounded-lg"
                  disabled={
                    candidateSubmitting || electionStatus?.status === "active"
                  }
                />
                <select
                  value={candidateForm.post}
                  onChange={(e) =>
                    setCandidateForm((prev) => ({
                      ...prev,
                      post: e.target.value as (typeof CANDIDATE_POSTS)[number],
                    }))
                  }
                  className="px-4 py-3 border border-gray-300 rounded-lg"
                  disabled={
                    candidateSubmitting || electionStatus?.status === "active"
                  }
                >
                  {CANDIDATE_POSTS.map((post) => (
                    <option key={post} value={post}>
                      {post}
                    </option>
                  ))}
                </select>
                <input
                  value={candidateForm.photo_url}
                  onChange={(e) =>
                    setCandidateForm((prev) => ({
                      ...prev,
                      photo_url: e.target.value,
                    }))
                  }
                  placeholder="Photo URL (optional)"
                  className="px-4 py-3 border border-gray-300 rounded-lg"
                  disabled={
                    candidateSubmitting || electionStatus?.status === "active"
                  }
                />
                <button
                  type="submit"
                  disabled={
                    candidateSubmitting ||
                    electionStatus?.status === "active" ||
                    !candidateForm.name.trim()
                  }
                  className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {candidateSubmitting ? "Saving..." : "Add Candidate"}
                </button>
              </form>
              {electionStatus?.status === "active" && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
                  Election is active. Candidate changes are locked until the
                  election ends.
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CANDIDATE_POSTS.map((post) => (
                  <div
                    key={post}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <h3 className="font-semibold text-gray-700 mb-3">{post}</h3>
                    {groupedCandidates[post]?.length ? (
                      <div className="space-y-2">
                        {groupedCandidates[post].map((candidate) => (
                          <div
                            key={candidate.id}
                            className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  candidate.photo_url || DEFAULT_CANDIDATE_IMAGE
                                }
                                alt={candidate.name}
                                className="w-10 h-10 rounded-full object-cover border border-gray-300"
                              />
                              <span className="font-medium text-gray-700">
                                {candidate.name}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                removeCandidate(candidate.id, candidate.name)
                              }
                              disabled={electionStatus?.status === "active"}
                              className="text-red-600 hover:text-red-700 text-sm font-semibold disabled:text-gray-400"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No candidates registered.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {accounts.length === 0 && (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <h3 className="text-2xl font-bold text-gray-700 mb-2">
                  No Registered Voters
                </h3>
                <p className="text-gray-500 mb-4">
                  When students register and verify their emails, their
                  blockchain accounts will appear here automatically.
                </p>
                <button
                  onClick={refreshAccounts}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Check Again
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "funding" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Accounts",
                  value: accounts.length,
                  color: "blue",
                },
                {
                  label: "Funded",
                  value: accounts.filter((a) => a.funded).length,
                  color: "green",
                },
                {
                  label: "Pending Funding",
                  value: accounts.filter((a) => !a.funded).length,
                  color: "orange",
                },
                {
                  label: "Completion",
                  value: `${accounts.length > 0 ? Math.round((accounts.filter((a) => a.funded).length / accounts.length) * 100) : 0}%`,
                  color: "blue",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className={`bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-${color}-500`}
                >
                  <div className={`text-3xl font-bold text-${color}-600`}>
                    {value}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Funding and Export Controls
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={fundAllAccounts}
                  disabled={
                    funding ||
                    !connected ||
                    accounts.length === 0 ||
                    accounts.every((a) => a.funded)
                  }
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                >
                  {funding ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Funding {fundingProgress.current}/{fundingProgress.total}
                      ...
                    </>
                  ) : (
                    <>
                      Fund All Accounts (
                      {accounts.filter((a) => !a.funded).length})
                    </>
                  )}
                </button>
                <button
                  onClick={downloadJSON}
                  disabled={accounts.length === 0}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
                >
                  Download JSON
                </button>
                <button
                  onClick={downloadCSV}
                  disabled={accounts.length === 0}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 font-medium transition-colors"
                >
                  Download CSV
                </button>
                <button
                  onClick={refreshAccounts}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={resetFundedStatus}
                  disabled={
                    accounts.length === 0 || accounts.every((a) => !a.funded)
                  }
                  className="bg-amber-500 text-white px-6 py-3 rounded-lg hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                  title="Use this after purging the chain to re-fund accounts"
                >
                  Reset Funding
                </button>
              </div>
            </div>

            {accounts.length > 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5">
                <p className="font-bold text-red-700 mb-2">
                  Critical Security Warnings
                </p>
                <ul className="text-sm text-red-600 space-y-1 ml-5 list-disc">
                  <li>
                    <strong>Start election only after final review</strong> -
                    mnemonics are emailed automatically on start
                  </li>
                  <li>
                    <strong>Store files securely</strong> - They contain all
                    recovery phrases
                  </li>
                  <li>
                    <strong>Never share mnemonics publicly</strong> - Anyone
                    with them can vote
                  </li>
                  <li>
                    <strong>Accounts in localStorage</strong> - Backup available
                    until browser cache is cleared
                  </li>
                </ul>
              </div>
            )}

            {accounts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((acc, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelected(acc)}
                    className={`bg-white rounded-xl p-5 cursor-pointer hover:shadow-xl transition-all border-2 ${acc.funded ? "border-green-400 hover:border-green-500" : "border-orange-400 hover:border-orange-500"} transform hover:scale-105`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">
                          {acc.name}
                        </h3>
                        <p className="text-sm text-gray-500">{acc.roll}</p>
                      </div>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-semibold ${acc.funded ? "bg-green-500 text-white" : "bg-orange-500 text-white"}`}
                      >
                        {acc.funded ? "Funded" : "Pending"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{acc.email}</p>
                    <div className="bg-gray-100 rounded-lg p-2">
                      <code className="text-xs text-gray-600 block truncate">
                        {acc.address}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "reveal" && api && (
          <VoteRevealPanel
            api={api}
            candidates={candidates}
            onRevealComplete={() => {
              fetchElectionStatus();
              setActiveTab("results");
            }}
          />
        )}
        {activeTab === "results" && api && (
          <ResultsDisplay api={api} candidates={candidates} />
        )}
      </div>

      {/* Account Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl relative">
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl font-bold"
              >
                x
              </button>
              <h2 className="text-2xl font-bold">Voter Credentials</h2>
              <p className="text-blue-100 text-sm mt-1">{selected.name}</p>
            </div>
            <div className="p-6">
              <div
                className={`p-4 rounded-lg mb-6 ${selected.funded ? "bg-green-100 border-2 border-green-400 text-green-800" : "bg-orange-100 border-2 border-orange-400 text-orange-800"}`}
              >
                <p className="font-semibold">
                  {selected.funded
                    ? "Account funded and ready to vote"
                    : "Account needs funding before voting"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Student Name</p>
                  <p className="font-semibold text-gray-800">{selected.name}</p>
                </div>
                <div className="rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Roll Number</p>
                  <p className="font-semibold text-gray-800">{selected.roll}</p>
                </div>
                <div className="rounded-lg p-4 col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="font-semibold text-gray-800">
                    {selected.email}
                  </p>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Blockchain Address
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-100 p-3 rounded-lg text-sm break-all border border-gray-300">
                    {selected.address}
                  </code>
                  <button
                    onClick={() => copyText(selected.address, "Address")}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5 mb-6">
                <p className="font-bold text-red-700 mb-2">
                  Secret Recovery Phrase (12 Words)
                </p>
                <p className="text-sm text-red-600 mb-4">
                  <strong>Warning:</strong> Anyone with these words controls
                  this voting account.
                </p>
                <div className="bg-white rounded-lg p-4 mb-4 border-2 border-red-200">
                  <code className="text-sm text-gray-800 block break-all leading-relaxed">
                    {selected.mnemonic}
                  </code>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyText(selected.mnemonic, "Mnemonic")}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium"
                  >
                    Copy Phrase
                  </button>
                  <button
                    onClick={() => sendCredentialsForAccount(selected, false)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Email to Student
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-center rounded-lg p-6">
                <p className="font-semibold text-gray-700 mb-4">
                  QR Code for Mobile Import
                </p>
                <div className="bg-white p-4 rounded-lg border-2 border-gray-300 shadow-sm">
                  <QRCodeCanvas value={selected.mnemonic} size={200} />
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Scan with phone camera to import mnemonic
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(getApiUrl("/voter/admin/check-auth/"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated || false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? (
    <AdminDashboard onLogout={() => setIsAuthenticated(false)} />
  ) : (
    <AdminLogin onLoginSuccess={() => setIsAuthenticated(true)} />
  );
};

export default Admin;
