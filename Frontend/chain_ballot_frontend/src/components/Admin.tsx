// Admin.tsx - Admin login + Auto-generate blockchain accounts

import React, { useEffect, useRef, useState } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { mnemonicGenerate } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { QRCodeCanvas } from "qrcode.react";
import {
  ConfirmDialog,
  type NoticeItem,
  type NoticeKind,
  NotificationStack,
} from "./ui/feedback";

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
};

type AdminCandidate = {
  id: number;
  name: string;
  post: string;
  photo_url: string;
  is_active: boolean;
};

const CANDIDATE_POSTS = [
  "President",
  "Vice President",
  "Secretary",
  "Vice Secretary",
] as const;

const DEFAULT_CANDIDATE_IMAGE = "src/assets/image/candidate.jpg";

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
      // Call Django admin login endpoint
      const response = await fetch("http://127.0.0.1:8000/voter/admin/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("✅ Admin login successful");
        onLoginSuccess();
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Failed to connect to server. Is the backend running?");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%)] p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">
            Admin Login
          </h1>
          <p className="text-slate-600">Blockchain Account Manager</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
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

            {/* Password Field */}
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

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <p className="text-red-700 text-sm font-semibold">❌ {error}</p>
              </div>
            )}

            {/* Submit Button */}
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
                <> Login to Dashboard</>
              )}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              ⚠️ Only staff/superuser accounts can access this dashboard
            </p>
          </div>
        </div>
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
    post: string;
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

  const feeAmount = "1000000000000"; // 1 token

  const pushNotice = (
    kind: NoticeKind,
    title: string,
    message?: string,
    timeout = 5000,
  ) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((prev) => [...prev, { id, kind, title, message }]);

    window.setTimeout(() => {
      setNotices((prev) => prev.filter((notice) => notice.id !== id));
    }, timeout);
  };

  const dismissNotice = (id: number) => {
    setNotices((prev) => prev.filter((notice) => notice.id !== id));
  };

  const requestConfirmation = (
    title: string,
    message: string,
    confirmLabel = "Confirm",
  ) => {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({
        open: true,
        title,
        message,
        confirmLabel,
      });
    });
  };

  const resolveConfirmation = (accepted: boolean) => {
    setConfirmState((prev) => ({ ...prev, open: false }));
    if (confirmResolverRef.current) {
      confirmResolverRef.current(accepted);
      confirmResolverRef.current = null;
    }
  };

  useEffect(() => {
    initializeSystem();
  }, []);

  const initializeSystem = async () => {
    await Promise.all([
      initApi(),
      fetchAndGenerateAccounts(),
      fetchElectionStatus(),
      fetchCandidates(),
    ]);
  };

  const initApi = async () => {
    try {
      console.log("🔗 Connecting to Substrate...");
      const provider = new WsProvider("ws://127.0.0.1:9944");
      const apiInstance = await ApiPromise.create({ provider });
      await apiInstance.isReady;

      console.log("✅ Blockchain connected");
      console.log("Chain:", await apiInstance.rpc.system.chain());

      setApi(apiInstance);
      setConnected(true);
    } catch (err: any) {
      console.error("❌ Failed to connect to blockchain:", err);
      pushNotice(
        "error",
        "Blockchain connection failed",
        `${err.message}. Make sure your node is running on ws://127.0.0.1:9944.`,
      );
    }
  };

  const fetchElectionStatus = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/voting/election/status/",
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load election status");
      }

      const data: ElectionStatus = await response.json();
      setElectionStatus(data);
    } catch (error) {
      console.error("Failed to fetch election status:", error);
    }
  };

  const fetchCandidates = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/voting/admin/candidates/",
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load candidates");
      }

      const data = await response.json();
      setCandidates(data.candidates || []);
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
    }
  };

  const fetchAndGenerateAccounts = async (): Promise<BlockchainAccount[]> => {
    setLoading(true);

    try {
      console.log("📡 Fetching registered voters...");

      const response = await fetch(
        "http://127.0.0.1:8000/voter/admin/verified-voters/",
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch voters. Session may have expired.");
      }

      const data = await response.json();
      const registeredVoters: RegisteredVoter[] = data.voters || [];

      console.log(`✅ Found ${registeredVoters.length} registered voters`);

      if (registeredVoters.length === 0) {
        console.log("ℹ️ No registered voters yet");
        setAccounts([]);
        localStorage.removeItem("blockchain_accounts");
        setLoading(false);
        return [];
      }

      console.log("🔑 Loading cached accounts and generating missing ones...");
      const keyring = new Keyring({ type: "sr25519" });
      const generatedAccounts: BlockchainAccount[] = [];
      const cachedByRoll = new Map<string, BlockchainAccount>();

      const cachedRaw = localStorage.getItem("blockchain_accounts");
      if (cachedRaw) {
        try {
          const cachedAccounts: BlockchainAccount[] = JSON.parse(cachedRaw);
          cachedAccounts.forEach((acc) => {
            if (acc.roll && acc.mnemonic) {
              cachedByRoll.set(acc.roll, acc);
            }
          });
        } catch (error) {
          console.warn(
            "Could not parse cached accounts. Regenerating all.",
            error,
          );
        }
      }

      registeredVoters.forEach((voter, index) => {
        const cached = cachedByRoll.get(voter.roll);
        const mnemonic = cached?.mnemonic || mnemonicGenerate(12);
        const account = keyring.addFromUri(mnemonic);

        generatedAccounts.push({
          ...voter,
          mnemonic,
          address: account.address,
          publicKey: u8aToHex(account.publicKey),
          funded: cached?.funded || false,
        });

        console.log(`  ${index + 1}. ${voter.name} → ${account.address}`);
      });

      setAccounts(generatedAccounts);
      console.log(
        `✅ Generated ${generatedAccounts.length} blockchain accounts`,
      );

      localStorage.setItem(
        "blockchain_accounts",
        JSON.stringify(generatedAccounts),
      );
      console.log("💾 Accounts backed up to localStorage");
      setLoading(false);
      return generatedAccounts;
    } catch (error: any) {
      console.error("❌ Error:", error);
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

    if (accounts.length === 0) {
      pushNotice("warning", "No accounts available for funding");
      return;
    }

    const unfundedCount = accounts.filter((a) => !a.funded).length;

    if (unfundedCount === 0) {
      pushNotice("info", "All accounts are already funded");
      return;
    }

    const confirmMsg = `Fund ${unfundedCount} accounts?\n\nThis will transfer ${feeAmount} tokens to each account from Alice.\n\nTotal cost: ${BigInt(feeAmount) * BigInt(unfundedCount)} tokens`;

    const shouldFund = await requestConfirmation(
      "Fund Accounts",
      confirmMsg,
      "Start Funding",
    );
    if (!shouldFund) {
      return;
    }

    setFunding(true);
    setFundingProgress({ current: 0, total: unfundedCount });

    try {
      const keyring = new Keyring({ type: "sr25519" });
      const alice = keyring.addFromUri("//Alice");

      console.log("💰 Funding from Alice:", alice.address);

      const aliceAccountInfo = await api.query.system.account(alice.address);
      const aliceBalance =
        (aliceAccountInfo as any).data?.free?.toString?.() || "0";
      console.log("Alice balance:", aliceBalance);

      let successCount = 0;
      let currentProgress = 0;

      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];

        if (account.funded) {
          console.log(`⏭️ Skipping ${account.name} (already funded)`);
          continue;
        }

        currentProgress++;
        setFundingProgress({ current: currentProgress, total: unfundedCount });

        console.log(
          `💸 Funding ${currentProgress}/${unfundedCount}: ${account.name} (${account.roll})`,
        );

        try {
          await new Promise<void>((resolve, reject) => {
            api.tx.balances
              .transferKeepAlive(account.address, feeAmount)
              .signAndSend(alice, (result) => {
                if (result.dispatchError) {
                  if (result.dispatchError.isModule) {
                    const decoded = api.registry.findMetaError(
                      result.dispatchError.asModule,
                    );
                    console.error(
                      `❌ Error: ${decoded.section}.${decoded.name}`,
                    );
                  }
                  reject(result.dispatchError);
                  return;
                }

                if (result.status.isInBlock) {
                  console.log(
                    `✅ ${account.name} funded in block ${result.status.asInBlock}`,
                  );

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
          console.error(`❌ Failed to fund ${account.name}:`, error);
        }
      }

      console.log(
        `\n🎉 Funding complete: ${successCount}/${unfundedCount} successful`,
      );
      pushNotice(
        "success",
        "Funding completed",
        `Successfully funded ${successCount}/${unfundedCount} accounts.`,
        7000,
      );

      const updatedAccounts = accounts.map((acc, idx) =>
        accounts[idx].funded ? acc : { ...acc, funded: true },
      );
      localStorage.setItem(
        "blockchain_accounts",
        JSON.stringify(updatedAccounts),
      );
    } catch (error: any) {
      console.error("❌ Funding error:", error);
      pushNotice("error", "Funding failed", error.message);
    }

    setFunding(false);
    setFundingProgress({ current: 0, total: 0 });
  };

  const downloadJSON = () => {
    if (accounts.length === 0) {
      pushNotice("warning", "No accounts available for download");
      return;
    }

    const dataStr = JSON.stringify(accounts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blockchain_accounts_${new Date().toISOString().split("T")[0]}.json`;
    link.click();

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

    const headers = ["Name", "Roll", "Email", "Address", "Mnemonic", "Funded"];
    const rows = accounts.map((acc) => [
      acc.name,
      acc.roll,
      acc.email,
      acc.address,
      acc.mnemonic,
      acc.funded ? "Yes" : "No",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blockchain_accounts_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    pushNotice("success", "CSV downloaded");
  };

  const copyText = async (text: string, label: string = "Text") => {
    try {
      await navigator.clipboard.writeText(text);
      pushNotice("success", `${label} copied`);
    } catch (error) {
      console.error("Clipboard copy failed:", error);
      pushNotice("error", `Failed to copy ${label.toLowerCase()}`);
    }
  };

  const sendCredentialsForAccount = async (
    account: BlockchainAccount,
    silent: boolean,
  ) => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/voter/admin/send-credentials/",
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
        if (!silent) {
          pushNotice("success", "Credentials sent", account.email);
        }
        return true;
      } else {
        if (!silent) {
          pushNotice("error", "Failed to send credentials", account.email);
        }
        return false;
      }
    } catch (error) {
      console.error("Email error:", error);
      if (!silent) {
        pushNotice("error", "Error sending credentials", String(error));
      }
      return false;
    }
  };

  const sendCredentialsEmail = async (account: BlockchainAccount) => {
    await sendCredentialsForAccount(account, false);
  };

  const startElection = async () => {
    if (electionStatus?.status === "active") {
      pushNotice("info", "Election is already active");
      return;
    }

    const shouldStart = await requestConfirmation(
      "Start Election",
      "This will reset vote signing state and immediately email all voter mnemonics.",
      "Start Election",
    );
    if (!shouldStart) {
      return;
    }

    setElectionActionLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/voting/admin/election/start/",
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start election");
      }

      let accountsToSend = accounts;
      if (accountsToSend.length === 0) {
        accountsToSend = await fetchAndGenerateAccounts();
      }

      const results = await Promise.allSettled(
        accountsToSend.map((account) =>
          sendCredentialsForAccount(account, true),
        ),
      );

      const sentCount = results.filter(
        (result) => result.status === "fulfilled" && result.value,
      ).length;
      const failedCount = accountsToSend.length - sentCount;

      await fetchElectionStatus();

      pushNotice(
        "success",
        "Election started successfully",
        `Credentials email summary - Sent: ${sentCount}, Failed: ${failedCount}`,
        7000,
      );
    } catch (error: any) {
      console.error("Start election error:", error);
      pushNotice("error", "Unable to start election", error.message);
    }

    setElectionActionLoading(false);
  };

  const endElection = async () => {
    if (electionStatus?.status !== "active") {
      pushNotice("info", "Election is not active");
      return;
    }

    const shouldEnd = await requestConfirmation(
      "End Election",
      "Voting will be blocked immediately.",
      "End Election",
    );
    if (!shouldEnd) {
      return;
    }

    setElectionActionLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/voting/admin/election/end/",
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to end election");
      }

      await fetchElectionStatus();
      pushNotice("success", "Election ended", "Voting is now closed.");
    } catch (error: any) {
      console.error("End election error:", error);
      pushNotice("error", "Unable to end election", error.message);
    }

    setElectionActionLoading(false);
  };

  const registerCandidate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!candidateForm.name.trim()) {
      pushNotice("warning", "Candidate name is required");
      return;
    }

    setCandidateSubmitting(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/voting/admin/candidates/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: candidateForm.name.trim(),
            post: candidateForm.post,
            photo_url: candidateForm.photo_url.trim(),
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to register candidate");
      }

      setCandidateForm((prev) => ({ ...prev, name: "", photo_url: "" }));
      await fetchCandidates();
      pushNotice("success", "Candidate registered successfully");
    } catch (error: any) {
      console.error("Candidate registration error:", error);
      pushNotice("error", "Unable to register candidate", error.message);
    }

    setCandidateSubmitting(false);
  };

  const removeCandidate = async (
    candidateId: number,
    candidateName: string,
  ) => {
    const shouldRemove = await requestConfirmation(
      "Remove Candidate",
      `Remove ${candidateName} from candidate list?`,
      "Remove",
    );
    if (!shouldRemove) {
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/voting/admin/candidates/${candidateId}/delete/`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove candidate");
      }

      await fetchCandidates();
    } catch (error: any) {
      console.error("Candidate delete error:", error);
      pushNotice("error", "Unable to remove candidate", error.message);
    }
  };

  const refreshAccounts = async () => {
    if (electionStatus?.status === "active") {
      pushNotice(
        "warning",
        "Cannot regenerate accounts while election is active",
      );
      return;
    }

    const shouldRefresh = await requestConfirmation(
      "Regenerate Accounts",
      "This will regenerate all accounts and you will lose current mnemonics.",
      "Regenerate",
    );
    if (shouldRefresh) {
      fetchAndGenerateAccounts();
    }
  };

  const handleLogout = async () => {
    const shouldLogout = await requestConfirmation(
      "Logout",
      "Are you sure you want to logout?",
      "Logout",
    );
    if (!shouldLogout) {
      return;
    }

    try {
      await fetch("http://127.0.0.1:8000/voter/admin/logout/", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    }

    onLogout();
  };

  const groupedCandidates = CANDIDATE_POSTS.reduce<
    Record<string, AdminCandidate[]>
  >((acc, post) => {
    acc[post] = candidates.filter((candidate) => candidate.post === post);
    return acc;
  }, {});
  const missingCandidatePosts = CANDIDATE_POSTS.filter(
    (post) => !groupedCandidates[post]?.length,
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-slate-700">
            Loading Dashboard...
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Fetching voters and generating accounts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#e0f2fe,_#f8fafc_35%,_#f8fafc)] px-4 py-6 md:px-8 md:py-10">
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
        {/* Header with Logout */}
        <div className="rounded-2xl bg-gradient-to-r from-sky-700 via-blue-700 to-indigo-700 p-8 text-white shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">
                🔑 Blockchain Account Manager
              </h1>
              <p className="text-blue-100 text-sm md:text-base">
                Auto-generated blockchain accounts for registered voters
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div
          className={`rounded-xl p-4 border shadow-sm ${
            connected
              ? "bg-emerald-50 border-emerald-300"
              : "bg-rose-50 border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"} animate-pulse`}
              />
              <span className="font-semibold">
                {connected
                  ? "✅ Blockchain Connected"
                  : "❌ Blockchain Disconnected"}
              </span>
            </div>
            {!connected && (
              <button
                onClick={initApi}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>

        {/* Election Controls */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Election Status</p>
              <div className="mt-1 flex items-center gap-3">
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
                  accounts.length === 0 ||
                  missingCandidatePosts.length > 0
                }
                className="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {electionActionLoading && electionStatus?.status !== "active"
                  ? "Starting..."
                  : "▶️ Start Election"}
              </button>

              <button
                onClick={endElection}
                disabled={
                  electionActionLoading || electionStatus?.status !== "active"
                }
                className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {electionActionLoading && electionStatus?.status === "active"
                  ? "Ending..."
                  : "⏹ End Election"}
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

        {/* Candidate Registration */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            🧑‍💼 Candidate Registration By Post
          </h2>

          <form
            onSubmit={registerCandidate}
            className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5"
          >
            <input
              type="text"
              value={candidateForm.name}
              onChange={(e) =>
                setCandidateForm((prev) => ({ ...prev, name: e.target.value }))
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
                setCandidateForm((prev) => ({ ...prev, post: e.target.value }))
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
              type="url"
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
              <div key={post} className="border border-gray-200 rounded-lg p-4">
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
                            src={candidate.photo_url || DEFAULT_CANDIDATE_IMAGE}
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

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
            <div className="text-3xl font-bold text-blue-600">
              {accounts.length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Accounts</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-green-500">
            <div className="text-3xl font-bold text-green-600">
              {accounts.filter((a) => a.funded).length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Funded</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-orange-500">
            <div className="text-3xl font-bold text-orange-600">
              {accounts.filter((a) => !a.funded).length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Pending Funding</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
            <div className="text-3xl font-bold text-blue-600">
              {accounts.filter((a) => a.funded).length > 0
                ? Math.round(
                    (accounts.filter((a) => a.funded).length /
                      accounts.length) *
                      100,
                  )
                : 0}
              %
            </div>
            <div className="text-sm text-gray-600 mt-1">Completion</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
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
                  Funding {fundingProgress.current}/{fundingProgress.total}...
                </>
              ) : (
                <>
                  💰 Fund All Accounts (
                  {accounts.filter((a) => !a.funded).length})
                </>
              )}
            </button>

            <button
              onClick={downloadJSON}
              disabled={accounts.length === 0}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
            >
              📥 Download JSON
            </button>

            <button
              onClick={downloadCSV}
              disabled={accounts.length === 0}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 font-medium transition-colors"
            >
              📊 Download CSV
            </button>

            <button
              onClick={refreshAccounts}
              disabled={loading || electionStatus?.status === "active"}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Security Warning */}
        {accounts.length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-red-700 mb-2">
                  CRITICAL SECURITY WARNINGS
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
                    <strong>Manual send is optional</strong> - Use the modal to
                    resend a single student's credentials
                  </li>
                  <li>
                    <strong>Accounts in localStorage</strong> - Backup available
                    until browser cache is cleared
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {accounts.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">
              No Registered Voters
            </h3>
            <p className="text-gray-500 mb-4">
              When students register and verify their emails, their blockchain
              accounts will appear here automatically.
            </p>
            <button
              onClick={refreshAccounts}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
            >
              🔄 Check Again
            </button>
          </div>
        )}

        {/* Accounts Grid */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc, idx) => (
              <div
                key={idx}
                onClick={() => setSelected(acc)}
                className={`bg-white rounded-xl p-5 cursor-pointer hover:shadow-xl transition-all border-2 ${
                  acc.funded
                    ? "border-green-400 hover:border-green-500"
                    : "border-orange-400 hover:border-orange-500"
                } transform hover:scale-105`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">
                      {acc.name}
                    </h3>
                    <p className="text-sm text-gray-500">{acc.roll}</p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-semibold ${
                      acc.funded
                        ? "bg-green-500 text-white"
                        : "bg-orange-500 text-white"
                    }`}
                  >
                    {acc.funded ? "✅ Funded" : "⏳ Pending"}
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
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-600 text-white p-6 rounded-t-2xl relative">
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl font-bold"
              >
                ×
              </button>
              <h2 className="text-2xl font-bold">📧 Voter Credentials</h2>
              <p className="text-blue-100 text-sm mt-1">{selected.name}</p>
            </div>

            <div className="p-6">
              <div
                className={`p-4 rounded-lg mb-6 ${
                  selected.funded
                    ? "bg-green-100 border-2 border-green-400 text-green-800"
                    : "bg-orange-100 border-2 border-orange-400 text-orange-800"
                }`}
              >
                <p className="font-semibold flex items-center gap-2">
                  {selected.funded ? (
                    <>✅ Account funded and ready to vote!</>
                  ) : (
                    <>⚠️ Account needs funding before voting</>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="  rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Student Name</p>
                  <p className="font-semibold text-gray-800">{selected.name}</p>
                </div>
                <div className="  rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Roll Number</p>
                  <p className="font-semibold text-gray-800">{selected.roll}</p>
                </div>
                <div className="  rounded-lg p-4 col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="font-semibold text-gray-800">
                    {selected.email}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  🔗 Blockchain Address
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-100 p-3 rounded-lg text-sm break-all border border-gray-300">
                    {selected.address}
                  </code>
                  <button
                    onClick={() => copyText(selected.address, "Address")}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    title="Copy Address"
                  >
                    📋
                  </button>
                </div>
              </div>

              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5 mb-6">
                <p className="font-bold text-red-700 mb-2 flex items-center gap-2">
                  🔐 Secret Recovery Phrase (12 Words)
                </p>
                <p className="text-sm text-red-600 mb-4">
                  ⚠️ <strong>WARNING:</strong> Anyone with these words controls
                  this voting account!
                </p>
                <div className="bg-white rounded-lg p-4 mb-4 border-2 border-red-200">
                  <code className="text-sm text-gray-800 block break-all leading-relaxed">
                    {selected.mnemonic}
                  </code>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyText(selected.mnemonic, "Mnemonic")}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    📋 Copy Phrase
                  </button>
                  <button
                    onClick={() => sendCredentialsEmail(selected)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    📧 Email to Student
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center   rounded-lg p-6">
                <p className="font-semibold text-gray-700 mb-4">
                  📱 QR Code for Mobile Import
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

// ==================== MAIN COMPONENT WITH AUTH STATE ====================
const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/voter/admin/check-auth/",
        {
          credentials: "include",
        },
      );

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated || false);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setIsAuthenticated(false);
    }
    setChecking(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
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
