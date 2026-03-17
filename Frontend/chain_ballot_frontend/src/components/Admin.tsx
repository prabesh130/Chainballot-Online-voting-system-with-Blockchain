// Admin.tsx - Admin login + Auto-generate blockchain accounts

import React, { useState, useEffect } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { mnemonicGenerate } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { QRCodeCanvas } from "qrcode.react";

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
    <div className="min-h-screen flex items-center justify-center  p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Login</h1>
          <p className="text-gray-600">Blockchain Account Manager</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
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
  const [fundingProgress, setFundingProgress] = useState({
    current: 0,
    total: 0,
  });

  const [api, setApi] = useState<ApiPromise | null>(null);
  const [connected, setConnected] = useState(false);

  const feeAmount = "1000000000000"; // 1 token

  useEffect(() => {
    initializeSystem();
  }, []);

  const initializeSystem = async () => {
    await initApi();
    await fetchAndGenerateAccounts();
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
      alert(
        `Blockchain connection failed: ${err.message}\n\nMake sure your node is running on ws://127.0.0.1:9944`,
      );
    }
  };

  const fetchAndGenerateAccounts = async () => {
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
        setLoading(false);
        return;
      }

      console.log("🔑 Generating blockchain accounts...");
      const keyring = new Keyring({ type: "sr25519" });
      const generatedAccounts: BlockchainAccount[] = [];

      registeredVoters.forEach((voter, index) => {
        const mnemonic = mnemonicGenerate(12);
        const account = keyring.addFromUri(mnemonic);

        generatedAccounts.push({
          ...voter,
          mnemonic,
          address: account.address,
          publicKey: u8aToHex(account.publicKey),
          funded: false,
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
    } catch (error: any) {
      console.error("❌ Error:", error);
      alert(`Error: ${error.message}`);
    }

    setLoading(false);
  };

  const fundAllAccounts = async () => {
    if (!api) {
      alert("❌ Blockchain not connected!");
      return;
    }

    if (accounts.length === 0) {
      alert("❌ No accounts to fund!");
      return;
    }

    const unfundedCount = accounts.filter((a) => !a.funded).length;

    if (unfundedCount === 0) {
      alert("✅ All accounts are already funded!");
      return;
    }

    const confirmMsg = `Fund ${unfundedCount} accounts?\n\nThis will transfer ${feeAmount} tokens to each account from Alice.\n\nTotal cost: ${BigInt(feeAmount) * BigInt(unfundedCount)} tokens`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setFunding(true);
    setFundingProgress({ current: 0, total: unfundedCount });

    try {
      const keyring = new Keyring({ type: "sr25519" });
      const alice = keyring.addFromUri("//Alice");

      console.log("💰 Funding from Alice:", alice.address);

      const { data: aliceBalance } = await api.query.system.account(
        alice.address,
      );
      console.log("Alice balance:", aliceBalance.free.toString());

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
      alert(
        `✅ Funding Complete!\n\nSuccessfully funded: ${successCount}/${unfundedCount} accounts`,
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
      alert(`Error during funding: ${error.message}`);
    }

    setFunding(false);
    setFundingProgress({ current: 0, total: 0 });
  };

  const downloadJSON = () => {
    if (accounts.length === 0) {
      alert("❌ No accounts to download!");
      return;
    }

    const dataStr = JSON.stringify(accounts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blockchain_accounts_${new Date().toISOString().split("T")[0]}.json`;
    link.click();

    alert(
      "✅ Downloaded!\n\n⚠️ Keep this file SECURE - it contains all mnemonics!",
    );
  };

  const downloadCSV = () => {
    if (accounts.length === 0) {
      alert("❌ No accounts to download!");
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

    alert("✅ CSV Downloaded!");
  };

  const copyText = (text: string, label: string = "Text") => {
    navigator.clipboard.writeText(text);
    alert(`✅ ${label} copied to clipboard!`);
  };

  const sendCredentialsEmail = async (account: BlockchainAccount) => {
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
        alert(`✅ Credentials sent to ${account.email}`);
      } else {
        alert(`❌ Failed to send email to ${account.email}`);
      }
    } catch (error) {
      console.error("Email error:", error);
      alert(`❌ Error sending email: ${error}`);
    }
  };

  const refreshAccounts = () => {
    if (
      confirm(
        "Refresh will regenerate all accounts and you will lose current mnemonics.\n\nAre you sure?",
      )
    ) {
      fetchAndGenerateAccounts();
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to logout?")) {
      try {
        await fetch("http://127.0.0.1:8000/voter/admin/logout/", {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.error("Logout error:", err);
      }
      onLogout();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center  ">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">
            Loading Dashboard...
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Fetching voters and generating accounts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10  ">
      <div className="max-w-7xl mx-auto">
        {/* Header with Logout */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-900 rounded-xl shadow-lg p-8 mb-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                🔑 Blockchain Account Manager
              </h1>
              <p className="text-blue-100">
                Auto-generated blockchain accounts for registered voters
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div
          className={`p-4 rounded-lg mb-6 ${
            connected
              ? "bg-green-100 border-2 border-green-400"
              : "bg-red-100 border-2 border-red-400"
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

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-blue-500">
            <div className="text-3xl font-bold text-blue-600">
              {accounts.length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Accounts</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-green-500">
            <div className="text-3xl font-bold text-green-600">
              {accounts.filter((a) => a.funded).length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Funded</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-orange-500">
            <div className="text-3xl font-bold text-orange-600">
              {accounts.filter((a) => !a.funded).length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Pending Funding</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-blue-500">
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
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
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
              disabled={loading}
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
                    <strong>Download the JSON/CSV immediately</strong> -
                    Accounts regenerate on refresh
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
                    <strong>Send credentials individually</strong> - Use the
                    modal to email each student
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
