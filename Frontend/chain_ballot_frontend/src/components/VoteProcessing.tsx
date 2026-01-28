import { useLocation } from "react-router-dom";
import forge from "node-forge";
import { useEffect, useState } from "react";
import { Shield, CheckCircle, Lock, Send } from "lucide-react";

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0HSF4hLodHkn/eilWZd7
ZSh2kHWJpDMjo5ZEYEGRWVysd86Qr3P/Bf9N00Eq3AxHhoRJHLR/ZNECS3XidLHc
iv/CsWRXYcSAT6Q9KchXVU3DSblJQu40WH14rqte7i2te6dWDA6cKIZwEScu3zy3
G6+ZNQYWB83qIxRf2uTWj0EmAl5xDr5+mFDgdC5Gwlv1YLlKu7o6fKVRx/Mu1jP1
7ztk88bhH/FbDO6zTHX/BCUqE/fKzAo+UQeni5yJRhZD1ZnA4JZndbAUJNpAWUbB
n9DGTlRHMiBIfhlb0Z2DlzpO8a60h5FttthEYbQSI8e88ymMecz25hhwz60j300b
hwIDAQAB
-----END PUBLIC KEY-----`;

type Payload = {
  encryptedVote: string;
  blindedVote: string;
  r: string;
  voteHash: string;
};

export default function VoteProcessing() {
  const location = useLocation();
  const votes: Record<string, number> = location.state.votes;

  const [payload, setPayload] = useState<Payload | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  /* 1️⃣ Blind vote on mount */
  useEffect(() => {
    const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM);

    // Hash vote
    const voteStr = JSON.stringify(votes);

    // Hash vote (THIS is what gets signed)
    const md = forge.md.sha256.create();
    md.update(voteStr, "utf8");
    const voteHashHex = md.digest().toHex();
    const voteHash = new forge.jsbn.BigInteger(voteHashHex, 16);

    const n = publicKey.n;
    const e = publicKey.e;

    // Encrypt vote (for blockchain submission)
    const encryptedVote = forge.util.encode64(
      publicKey.encrypt(voteStr, "RSA-OAEP"),
    );

    // Generate blinding factor r
    let r: forge.jsbn.BigInteger;
    do {
      r = new forge.jsbn.BigInteger(forge.random.getBytesSync(32), 256);
    } while (!r.gcd(n).equals(forge.jsbn.BigInteger.ONE));

    const blinded = voteHash.multiply(r.modPow(e, n)).mod(n);

    setPayload({
      encryptedVote, // for blockchain only
      blindedVote: blinded.toString(16),
      r: r.toString(16),
      voteHash: voteHashHex,
    });
  }, [votes]);

  /* 2️⃣ Send blinded vote for signing */
  const sendForSigning = async () => {
    if (!payload) return;
    setLoading(true);

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
    setLoading(false);

    if (!res.ok) {
      alert(data.error || "Signing failed");
      return;
    }

    // 3️⃣ Unblind signature
    const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM);
    const n = publicKey.n;

    const signedBlinded = new forge.jsbn.BigInteger(data.signedBlinded, 16);

    const rInv = new forge.jsbn.BigInteger(payload.r, 16).modInverse(n);
    const unblinded = signedBlinded.multiply(rInv).mod(n);

    setSignature(unblinded.toString(16));
    setVerified(true);
  };

  /* 4️⃣ Submit vote to blockchain */
  const submitToBlockchain = async () => {
    if (!payload || !signature) return;

    const blockchainPlayload = {
      encryptedVote: payload.encryptedVote,
      voteHash: payload.voteHash,
      signature,
    };

    console.log("🚀 Submitting to blockchain:", blockchainPlayload);

    // Example blockchain submission
    // await fetch("/blockchain/submit", { ... })

    alert("🗳️ Vote successfully submitted to blockchain!");
  };

  return (
    <div className="min-h-screen  py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Vote Verification
          </h1>
          <p className="text-gray-600">
            Secure cryptographic verification process
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    payload ? "bg-green-500 shadow-md" : "bg-gray-300"
                  } transition-all duration-300`}
                >
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs mt-2 text-gray-600 font-medium">
                  Encrypted
                </p>
              </div>
              <div
                className={`h-1 flex-1 mx-2 ${
                  verified ? "bg-green-500" : "bg-gray-200"
                } transition-all duration-500`}
              ></div>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    verified ? "bg-green-500 shadow-md" : "bg-gray-300"
                  } transition-all duration-300`}
                >
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs mt-2 text-gray-600 font-medium">
                  Verified
                </p>
              </div>
              <div
                className={`h-1 flex-1 mx-2 bg-gray-200 transition-all duration-500`}
              ></div>
              <div className="flex flex-col items-center flex-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-300 transition-all duration-300">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs mt-2 text-gray-600 font-medium">
                  Submitted
                </p>
              </div>
            </div>

            {/* Status Messages */}
            {!verified && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 animate-fadeIn">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Ready for Verification
                </h3>
                <p className="text-blue-700 text-sm">
                  Your vote has been encrypted using blind signature
                  cryptography. Click below to verify your eligibility.
                </p>
              </div>
            )}

            {verified && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 animate-fadeIn">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">
                    Verification Successful
                  </h3>
                </div>
                <p className="text-green-700 text-sm">
                  Your vote has been cryptographically verified. You can now
                  submit it to the blockchain.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {!verified && (
                <button
                  onClick={sendForSigning}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    "Verify Vote"
                  )}
                </button>
              )}

              {verified && (
                <button
                  onClick={submitToBlockchain}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                >
                  Submit Vote to Blockchain
                </button>
              )}
            </div>
          </div>

          {/* Debug Section */}
          <div className="border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="w-full px-8 py-4 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-150 flex items-center justify-between"
            >
              <span>Technical Details</span>
              <span
                className={`transform transition-transform duration-200 ${
                  showDebug ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {showDebug && (
              <div className="px-8 pb-6 animate-fadeIn">
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  {payload && (
                    <pre className="text-xs text-green-400">
                      {JSON.stringify(
                        {
                          ...payload,
                          signature: signature || "N/A",
                        },
                        null,
                        2,
                      )}
                    </pre>
                  )}
                  {!payload && (
                    <p className="text-xs text-red-400">No payload data.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>🔒 End-to-end encrypted • Anonymous • Tamper-proof</p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
