import React, { useEffect, useState } from "react";
import { ApiPromise } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { hexToU8a, stringToU8a } from "@polkadot/util";
import forge from "node-forge";

type Candidate = {
  id: number;
  name: string;
  photo: string;
};

type VotesByPosition = Record<string, number>;

type BlindPayload = {
  encryptedVote: string;
  blindedVote: string;
  r: string;
  voteHash: string;
};

const POSITIONS = ["President", "Vice President", "Secretary", "Vice Secretary"] as const;

const CANDIDATES: Record<string, Candidate[]> = {
  President: [
    { id: 1, name: "Candidate A", photo: "src/assets/image/candidate.jpg" },
    { id: 2, name: "Candidate B", photo: "src/assets/image/candidate2.jpg" },
  ],
  "Vice President": [
    { id: 3, name: "Candidate C", photo: "src/assets/image/candidate.jpg" },
    { id: 4, name: "Candidate D", photo: "src/assets/image/candidate2.jpg" },
  ],
  Secretary: [
    { id: 5, name: "Candidate E", photo: "src/assets/image/candidate.jpg" },
    { id: 6, name: "Candidate F", photo: "src/assets/image/candidate2.jpg" },
  ],
  "Vice Secretary": [
    { id: 7, name: "Candidate G", photo: "src/assets/image/candidate.jpg" },
    { id: 8, name: "Candidate H", photo: "src/assets/image/candidate2.jpg" },
  ],
};

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

  const importAccount = () => {
    try {
      const keyring = new Keyring({ type: "sr25519" });
      const acc = keyring.addFromUri(mnemonic.trim());
      onImported(acc);
    } catch {
      setError("Invalid recovery phrase");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold">Import Voting Account</h2>
        <p className="text-gray-600">Enter the 12-word phrase sent by the admin</p>
        <textarea
          className="w-full border rounded-lg p-3"
          rows={3}
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
        />
        {error && <p className="text-red-600">{error}</p>}
        <button
          onClick={importAccount}
          className="w-full bg-blue-600 text-white py-3 rounded-lg"
        >
          Continue to Voting
        </button>
      </div>
    </div>
  );
};

const VotingPortal: React.FC<{ onSubmit: (votes: VotesByPosition) => void }> = ({ onSubmit }) => {
  const [step, setStep] = useState(0);
  const [votes, setVotes] = useState<Record<string, number | null>>({});

  const currentPos = POSITIONS[step];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold mb-2">Vote for {currentPos}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl w-full">
        {CANDIDATES[currentPos].map((c) => (
          <div
            key={c.id}
            onClick={() => setVotes({ ...votes, [currentPos]: c.id })}
            className={`cursor-pointer border rounded-xl p-4 text-center ${
              votes[currentPos] === c.id ? "border-green-600 ring-2" : ""
            }`}
          >
            <img src={c.photo} className="w-32 h-32 rounded-full mx-auto mb-3" />
            <h3>{c.name}</h3>
          </div>
        ))}
      </div>

      <div className="flex justify-between max-w-3xl w-full mt-8">
        <button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < POSITIONS.length - 1 ? (
          <button disabled={!votes[currentPos]} onClick={() => setStep(step + 1)}>Next</button>
        ) : (
          <button
            disabled={POSITIONS.some((p) => !votes[p])}
            onClick={() => onSubmit(votes as VotesByPosition)}
          >
            Submit Vote
          </button>
        )}
      </div>
    </div>
  );
};

const VoteProcessing: React.FC<{ api: ApiPromise; account: any; votes: VotesByPosition }> = ({
  api,
  account,
  votes,
}) => {
  const [payload, setPayload] = useState<BlindPayload | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM);
    const voteStr = JSON.stringify(votes);

    const md = forge.md.sha256.create();
    md.update(voteStr, "utf8");
    const voteHashHex = md.digest().toHex();
    const voteHash = new forge.jsbn.BigInteger(voteHashHex, 16);

    const encryptedVote = forge.util.encode64(publicKey.encrypt(voteStr, "RSA-OAEP"));

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
    const res = await fetch("http://127.0.0.1:8000/voting/api/sign-blind-vote/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ blindedVote: payload.blindedVote }),
    });
    const data = await res.json();

    const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM);
    const n = publicKey.n;

    const signedBlinded = new forge.jsbn.BigInteger(data.signedBlinded, 16);
    const rInv = new forge.jsbn.BigInteger(payload.r, 16).modInverse(n);
    const unblinded = signedBlinded.multiply(rInv).mod(n);

    setSignature(unblinded.toString(16));
    setVerified(true);
  };

  const submitBlockchain = async () => {
    if (!payload || !signature) return;

    // Convert to bytes
    const encryptedBytes = Array.from(stringToU8a(payload.encryptedVote));
    const signatureBytes = Array.from(hexToU8a(signature));

    await api.tx.voting
      .submitVote(encryptedBytes, signatureBytes)
      .signAndSend(account);

    alert("Vote submitted on-chain");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-6 space-y-4">
        <h2 className="text-2xl font-bold">Vote Verification</h2>
        {!verified ? (
          <button onClick={verifyVote} className="w-full bg-blue-600 text-white py-3 rounded-lg">
            Verify Vote
          </button>
        ) : (
          <button
            onClick={submitBlockchain}
            className="w-full bg-green-600 text-white py-3 rounded-lg"
          >
            Submit to Blockchain
          </button>
        )}
      </div>
    </div>
  );
};

const MergedVotingFlow: React.FC<{ api: ApiPromise }> = ({ api }) => {
  const [account, setAccount] = useState<any>(null);
  const [votes, setVotes] = useState<VotesByPosition | null>(null);

  if (!account) return <MnemonicGate onImported={setAccount} />;
  if (!votes) return <VotingPortal onSubmit={setVotes} />;
  return <VoteProcessing api={api} account={account} votes={votes} />;
};

export default MergedVotingFlow;
