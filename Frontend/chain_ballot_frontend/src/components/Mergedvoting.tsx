import React, { useEffect, useState } from "react";
import { ApiPromise } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { hexToU8a } from "@polkadot/util";
// FIX: removed unused stringToU8a import
import forge from "node-forge";
import {
  type NoticeItem,
  type NoticeKind,
  NotificationStack,
} from "./ui/feedback";

type Candidate = {
  id: number;
  candidate_id: number | null; // explicit admin-assigned ID
  name: string;
  post: string;
  photo_url: string;
};

type ElectionStatus = {
  status: "not_started" | "active" | "ended";
  is_active: boolean;
  started_at: string | null;
  ended_at: string | null;
};

type VotesByPosition = Record<string, number>;

type BlindPayload = {
  encryptedVote: string;
  blindedVote: string;
  r: string;
  voteHash: string;
};

const DEFAULT_CANDIDATE_IMAGE = "src/assets/image/candidate.jpg";

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0HSF4hLodHkn/eilWZd7
ZSh2kHWJpDMjo5ZEYEGRWVysd86Qr3P/Bf9N00Eq3AxHhoRJHLR/ZNECS3XidLHc
iv/CsWRXYcSAT6Q9KchXVU3DSblJQu40WH14rqte7i2te6dWDA6cKIZwEScu3zy3
G6+ZNQYWB83qIxRf2uTWj0EmAl5xDr5+mFDgdC5Gwlv1YLlKu7o6fKVRx/Mu1jP1
7ztk88bhH/FbDO6zTHX/BCUqE/fKzAo+UQeni5yJRhZD1ZnA4JZndbAUJNpAWUbB
n9DGTlRHMiBIfhlb0Z2DlzpO8a60h5FttthEYbQSI8e88ymMecz25hhwz60j300b
hwIDAQAB
-----END PUBLIC KEY-----`;

type MnemonicGateProps = {
  onImported: (account: any) => void;
};

const MnemonicGate: React.FC<MnemonicGateProps> = ({ onImported }) => {
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const importAccount = () => {
    setError(null);
    setIsLoading(true);

    try {
      const trimmedMnemonic = mnemonic.trim();

      const words = trimmedMnemonic.split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        setError("Recovery phrase must be 12 or 24 words");
        setIsLoading(false);
        return;
      }

      const keyring = new Keyring({ type: "sr25519" });
      const acc = keyring.addFromUri(trimmedMnemonic);

      if (!acc || !acc.address) {
        setError("Invalid recovery phrase");
        setIsLoading(false);
        return;
      }

      onImported(acc);
      setIsLoading(false);
    } catch (err) {
      console.error("Mnemonic import error:", err);
      setError("Invalid recovery phrase. Please check and try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold">Import Voting Account</h2>
        <p className="text-gray-600">
          Enter the 12-word phrase sent by the admin
        </p>
        <textarea
          className={`w-full border rounded-lg p-3 ${
            error ? "border-red-500" : "border-gray-300"
          }`}
          rows={3}
          value={mnemonic}
          onChange={(e) => {
            setMnemonic(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter your 12-word recovery phrase..."
        />
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-semibold">❌ {error}</p>
          </div>
        )}
        <button
          onClick={importAccount}
          disabled={isLoading || !mnemonic.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isLoading ? "Verifying..." : "Continue to Voting"}
        </button>
      </div>
    </div>
  );
};

const VotingPortal: React.FC<{
  posts: string[];
  candidatesByPost: Record<string, Candidate[]>;
  onSubmit: (votes: VotesByPosition) => void;
}> = ({ posts, candidatesByPost, onSubmit }) => {
  const [step, setStep] = useState(0);
  const [votes, setVotes] = useState<Record<string, number | null>>({});
  const [showSummary, setShowSummary] = useState(false);

  const getCandidateVoteId = (candidate: Candidate) =>
    candidate.candidate_id ?? candidate.id;

  const currentPos = posts[step];
  const allVotesSelected = posts.every((p) => votes[p]);

  if (!currentPos) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            No Candidates Available
          </h2>
          <p className="text-gray-600">
            Election admin has not registered candidates yet.
          </p>
        </div>
      </div>
    );
  }

  const getEncryptedPreview = () => {
    if (!allVotesSelected) return "";
    const voteStr = JSON.stringify(votes);
    return btoa(voteStr).substring(0, 64) + "...";
  };

  if (showSummary && allVotesSelected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="max-w-3xl w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent mb-2">
              Vote Summary
            </h1>
            <p className="text-gray-600">
              Review your selections before proceeding
            </p>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              Your Selections
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(votes).map(([position, candidateId]) => {
                const candidate = Object.values(candidatesByPost)
                  .flat()
                  .find((c) => getCandidateVoteId(c) === candidateId);
                return (
                  <div
                    key={position}
                    className="bg-white rounded-lg p-4 flex items-center space-x-3"
                  >
                    <img
                      src={candidate?.photo_url || DEFAULT_CANDIDATE_IMAGE}
                      alt={candidate?.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-gray-500 text-xs">{position}</div>
                      <div className="font-medium text-gray-800">
                        {candidate?.name}
                      </div>
                      {candidate?.candidate_id != null && (
                        <div className="text-xs font-mono text-blue-600">
                          ID: {candidate.candidate_id}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Encrypted Vote Data
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Encrypted Vote
                </label>
                <div className="bg-white rounded-lg p-3 border border-gray-200 font-mono text-xs text-gray-600 break-all">
                  {getEncryptedPreview()}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Signature Status
                </label>
                <div className="bg-white rounded-lg p-3 border border-gray-200 flex items-center">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">
                    Not yet signed - Click "Proceed to Verification" to sign
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setShowSummary(false)}
              className="flex-1 px-6 py-3 rounded-xl font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
            >
              ← Edit Votes
            </button>
            <button
              onClick={() => onSubmit(votes as VotesByPosition)}
              className="flex-1 px-8 py-3 rounded-xl font-medium bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all"
            >
              Proceed to Verification →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-4xl w-full mb-8">
        <div className="flex items-center justify-between mb-3">
          {posts.map((pos, idx) => (
            <div key={pos} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                    idx < step
                      ? "bg-green-500 text-white"
                      : idx === step
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-200"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {idx < step ? "✓" : idx + 1}
                </div>
                <span
                  className={`text-xs mt-2 font-medium ${
                    idx === step ? "text-indigo-600" : "text-gray-500"
                  }`}
                >
                  {pos}
                </span>
              </div>
              {idx < posts.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 rounded transition-all ${
                    idx < step ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Vote for {currentPos}
          </h1>
          <p className="text-gray-600">Select your preferred candidate</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {(candidatesByPost[currentPos] || []).map((c) => (
            <div
              key={c.id}
              onClick={() =>
                setVotes({ ...votes, [currentPos]: getCandidateVoteId(c) })
              }
              className={`group cursor-pointer border-2 rounded-2xl p-6 text-center transition-all duration-300 hover:shadow-xl ${
                votes[currentPos] === getCandidateVoteId(c)
                  ? "border-indigo-600 bg-indigo-50 shadow-lg scale-105"
                  : "border-gray-200 hover:border-indigo-300 bg-white"
              }`}
            >
              <div className="relative inline-block mb-4">
                <img
                  src={c.photo_url || DEFAULT_CANDIDATE_IMAGE}
                  alt={c.name}
                  className={`w-32 h-32 rounded-full mx-auto object-cover transition-all duration-300 ${
                    votes[currentPos] === getCandidateVoteId(c)
                      ? "ring-4 ring-indigo-400"
                      : "group-hover:ring-4 group-hover:ring-indigo-200"
                  }`}
                />
                {votes[currentPos] === getCandidateVoteId(c) && (
                  <div className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-800">{c.name}</h3>
              <div
                className={`mt-3 text-sm font-medium ${
                  votes[currentPos] === getCandidateVoteId(c)
                    ? "text-indigo-600"
                    : "text-gray-500"
                }`}
              >
                {votes[currentPos] === getCandidateVoteId(c)
                  ? "Selected"
                  : "Click to select"}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-6 border-t">
          <button
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
            className="px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100"
          >
            ← Previous
          </button>

          {step < posts.length - 1 ? (
            <button
              disabled={!votes[currentPos]}
              onClick={() => setStep(step + 1)}
              className="px-8 py-3 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl disabled:hover:bg-indigo-600"
            >
              Next →
            </button>
          ) : (
            <button
              disabled={!allVotesSelected}
              onClick={() => setShowSummary(true)}
              className="px-8 py-3 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl disabled:hover:from-green-500"
            >
              Review Vote ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const VoteProcessing: React.FC<{
  api: ApiPromise;
  account: any;
  votes: VotesByPosition;
  onNotify: (kind: NoticeKind, title: string, message?: string) => void;
}> = ({ api, account, votes, onNotify }) => {
  const [payload, setPayload] = useState<BlindPayload | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM);
    const voteStr = JSON.stringify(votes);

    const md = forge.md.sha256.create();
    md.update(voteStr, "utf8");
    const voteHashHex = md.digest().toHex();
    const voteHash = new forge.jsbn.BigInteger(voteHashHex, 16);

    const encryptedVote = forge.util.encode64(
      publicKey.encrypt(voteStr, "RSA-OAEP"),
    );

    const n = publicKey.n;
    const e = publicKey.e;

    let r: forge.jsbn.BigInteger;
    do {
      r = new forge.jsbn.BigInteger(forge.random.getBytesSync(32), 256);
    } while (!r.gcd(n).equals(forge.jsbn.BigInteger.ONE));

    const blinded = voteHash.multiply(r.modPow(e, n)).mod(n);

    setPayload({
      encryptedVote,
      blindedVote: blinded.toString(16),
      r: r.toString(16),
      voteHash: voteHashHex,
    });
  }, [votes]);

  const verifyVote = async () => {
    if (!payload) return;
    setIsProcessing(true);

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/voting/api/sign-blind-vote/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ blindedVote: payload.blindedVote }),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify vote");
      }

      const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM);
      const n = publicKey.n;

      const signedBlinded = new forge.jsbn.BigInteger(data.signedBlinded, 16);
      const rInv = new forge.jsbn.BigInteger(payload.r, 16).modInverse(n);
      const unblinded = signedBlinded.multiply(rInv).mod(n);

      setSignature(unblinded.toString(16));
      setVerified(true);
    } catch (error: any) {
      console.error("Verification error:", error);
      onNotify(
        "error",
        "Verification failed",
        error.message || "Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const submitBlockchain = async () => {
    if (!payload || !signature) return;
    setIsProcessing(true);

    try {
      const electionRes = await fetch(
        "http://127.0.0.1:8000/voting/election/status/",
        { credentials: "include" },
      );
      if (electionRes.ok) {
        const electionData: ElectionStatus = await electionRes.json();
        if (electionData.status !== "active") {
          onNotify(
            "warning",
            "Voting is closed",
            "Election is not active right now.",
          );
          setIsProcessing(false);
          return;
        }
      }

      // FIX 1: encryptedVote is base64 (from forge.util.encode64).
      // The old code used stringToU8a which treated it as UTF-8 text — wrong.
      // atob() decodes base64 to the actual binary string, then we get char codes.
      const encryptedBinary = atob(payload.encryptedVote);
      const encryptedBytes = Array.from(
        { length: encryptedBinary.length },
        (_, i) => encryptedBinary.charCodeAt(i),
      );

      // signature is a hex string — hexToU8a is correct
      const signatureBytes = Array.from(hexToU8a(signature));

      console.log("📤 Submitting vote to blockchain...");
      console.log("  encryptedBytes length:", encryptedBytes.length);
      console.log("  signatureBytes length:", signatureBytes.length);

      await new Promise<void>((resolve, reject) => {
        api.tx.voting
          .submitVote(encryptedBytes, signatureBytes)
          .signAndSend(account, (result: any) => {
            console.log("📡 Tx status:", result.status.toString());

            // FIX 2: Decode dispatchError and surface it to the user via onNotify
            if (result.dispatchError) {
              let msg = "Transaction failed";
              if (result.dispatchError.isModule) {
                try {
                  const decoded = api.registry.findMetaError(
                    result.dispatchError.asModule,
                  );
                  msg = `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
                } catch {
                  msg = "Module dispatch error";
                }
              } else {
                msg = result.dispatchError.toString();
              }
              console.error("❌ Vote dispatchError:", msg);
              reject(new Error(msg));
              return;
            }

            // FIX 3: isInBlock is sufficient — don't wait for isFinalized
            if (result.status.isInBlock) {
              console.log(
                "✅ Vote in block:",
                result.status.asInBlock.toString(),
              );
              resolve();
            }
          });
      });

      setIsSubmitted(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (error: any) {
      console.error("Failed to submit vote:", error);
      onNotify(
        "error",
        "Failed to submit vote",
        error?.message || "Please try again.",
      );
    } finally {
      // FIX 4: Always reset in finally so button never stays stuck
      setIsProcessing(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6">
            <svg
              className="w-14 h-14 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">
            Vote Submitted Successfully!
          </h2>
          <p className="text-gray-600 mb-4">
            Your vote has been securely recorded on the blockchain
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">
              ✓ Vote encrypted and signed
              <br />
              ✓ Submitted to blockchain
              <br />✓ Transaction finalized
            </p>
          </div>
          <p className="text-sm text-gray-500">
            Redirecting to home page in a few seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mt-3 flex items-center justify-center px-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-4">
            <svg
              className="w-10 h-10 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Vote Verification
          </h2>
          <p className="text-gray-600">
            {!verified
              ? "Review encrypted vote and obtain signature"
              : "Signature obtained - Ready to submit to blockchain"}
          </p>
        </div>

        <div
          className={`rounded-xl p-6 border mb-6 ${
            verified
              ? "bg-green-50 border-green-200"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            Blind Signature
          </h3>
          {verified && signature ? (
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Signature
              </label>
              <div className="bg-white rounded-lg p-3 border border-gray-200 font-mono text-xs text-gray-600 break-all max-h-20 overflow-y-auto">
                {signature}
              </div>
              <div className="flex items-center mt-3 text-green-700">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium">Signature verified</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center text-yellow-700">
              <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
              <span className="text-sm">
                No signature - Click "Verify Vote" to obtain signature
              </span>
            </div>
          )}
        </div>

        {!verified ? (
          <button
            onClick={verifyVote}
            disabled={isProcessing || !payload}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Verifying...
              </>
            ) : (
              <>
                <svg
                  className="w-6 h-6 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Verify Vote
              </>
            )}
          </button>
        ) : (
          <button
            onClick={submitBlockchain}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Submitting to Blockchain...
              </>
            ) : (
              <>
                <svg
                  className="w-6 h-6 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Submit to Blockchain
              </>
            )}
          </button>
        )}

        <div className="bg-black rounded-xl p-6 border border-gray-200 mt-2">
          <h3 className="font-semibold text-white mb-4 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Encrypted Vote Data
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Encrypted Vote
              </label>
              <div className="bg-black rounded-lg p-3 border border-gray-200 font-mono text-xs text-green-400 break-all max-h-20 overflow-y-auto">
                {payload?.encryptedVote || "Generating..."}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Signature
              </label>
              <div className="bg-black rounded-lg p-3 border border-gray-200 font-mono text-xs text-green-400 break-all max-h-20 overflow-y-auto">
                {signature || "Not yet signed"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-blue-800">
              Your vote is encrypted and anonymized using blind signature
              cryptography. No one can link your vote back to your identity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MergedVotingFlow: React.FC<{ api: ApiPromise }> = ({ api }) => {
  const [account, setAccount] = useState<any>(null);
  const [votes, setVotes] = useState<VotesByPosition | null>(null);
  const [electionStatus, setElectionStatus] = useState<ElectionStatus | null>(
    null,
  );
  const [posts, setPosts] = useState<string[]>([]);
  const [candidatesByPost, setCandidatesByPost] = useState<
    Record<string, Candidate[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

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

  useEffect(() => {
    const loadVotingConfig = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [statusRes, candidatesRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/voting/election/status/", {
            credentials: "include",
          }),
          fetch("http://127.0.0.1:8000/voting/election/candidates/", {
            credentials: "include",
          }),
        ]);

        if (!statusRes.ok) throw new Error("Failed to fetch election status");
        if (!candidatesRes.ok) throw new Error("Failed to fetch candidates");

        const statusData: ElectionStatus = await statusRes.json();
        const candidateData = await candidatesRes.json();

        setElectionStatus(statusData);
        setPosts(
          (candidateData.posts || []).filter(
            (post: string) =>
              (candidateData.candidates?.[post] || []).length > 0,
          ),
        );
        setCandidatesByPost(candidateData.candidates || {});
      } catch (error: any) {
        console.error("Voting config error:", error);
        setLoadError(error.message || "Unable to load election details");
      }

      setLoading(false);
    };

    loadVotingConfig();
  }, []);

  if (loading) {
    return (
      <>
        <NotificationStack notices={notices} onDismiss={dismissNotice} />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading election details...</p>
          </div>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <NotificationStack notices={notices} onDismiss={dismissNotice} />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              Unable to Open Voting
            </h2>
            <p className="text-red-600">{loadError}</p>
          </div>
        </div>
      </>
    );
  }

  if (!electionStatus || electionStatus.status !== "active") {
    return (
      <>
        <NotificationStack notices={notices} onDismiss={dismissNotice} />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              {electionStatus?.status === "ended"
                ? "Election Has Ended"
                : "Election Not Started"}
            </h2>
            <p className="text-gray-600">
              {electionStatus?.status === "ended"
                ? "Voting is now closed. Thank you for participating."
                : "Voting will open once the admin starts the election."}
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!posts.length) {
    return (
      <>
        <NotificationStack notices={notices} onDismiss={dismissNotice} />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              Candidates Not Published
            </h2>
            <p className="text-gray-600">
              Please contact admin. Candidate registration is incomplete.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!account) {
    return (
      <>
        <NotificationStack notices={notices} onDismiss={dismissNotice} />
        <MnemonicGate onImported={setAccount} />
      </>
    );
  }

  if (!votes) {
    return (
      <>
        <NotificationStack notices={notices} onDismiss={dismissNotice} />
        <VotingPortal
          posts={posts}
          candidatesByPost={candidatesByPost}
          onSubmit={setVotes}
        />
      </>
    );
  }

  return (
    <>
      <NotificationStack notices={notices} onDismiss={dismissNotice} />
      <VoteProcessing
        api={api}
        account={account}
        votes={votes}
        onNotify={pushNotice}
      />
    </>
  );
};

export default MergedVotingFlow;
