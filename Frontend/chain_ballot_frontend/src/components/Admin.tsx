import React, { useState } from "react";
import { Keyring } from "@polkadot/keyring";
import { mnemonicGenerate } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { QRCodeCanvas } from "qrcode.react";

/* =============================
   TYPES
============================= */

type GeneratedAccount = {
  id: number;
  studentId: string;
  email: string;
  mnemonic: string;
  address: string;
  publicKey: string;
};

/* =============================
   ADMIN PANEL
============================= */

const AdminAccountGenerator: React.FC = () => {
  const [count, setCount] = useState<number>(1);
  const [accounts, setAccounts] = useState<GeneratedAccount[]>([]);
  const [selected, setSelected] = useState<GeneratedAccount | null>(null);
  const [loading, setLoading] = useState(false);

  const generateAccounts = () => {
    setLoading(true);

    const keyring = new Keyring({ type: "sr25519" });
    const generated: GeneratedAccount[] = [];

    for (let i = 0; i < count; i++) {
      const mnemonic = mnemonicGenerate(12);
      const acc = keyring.addFromUri(mnemonic);

      generated.push({
        id: i + 1,
        studentId: `STU${String(i + 1).padStart(4, "0")}`,
        email: `student${i + 1}@campus.edu`,
        mnemonic,
        address: acc.address,
        publicKey: u8aToHex(acc.publicKey),
      });
    }

    setAccounts(generated);
    setLoading(false);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(accounts, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_accounts.json";
    a.click();
  };

  return (
    <div className="min-h-screen p-10 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-xl p-8">
        <h1 className="text-3xl font-bold mb-2">Admin – Account Generator</h1>
        <p className="text-gray-600 mb-6">
          Generate blockchain voting accounts and recovery phrases for students
        </p>

        <div className="flex items-center gap-4 mb-6">
          <input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="border rounded-lg px-4 py-2 w-32"
          />
          <button
            onClick={generateAccounts}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            {loading ? "Generating..." : "Generate Accounts"}
          </button>

          {accounts.length > 0 && (
            <button
              onClick={downloadJSON}
              className="bg-green-600 text-white px-6 py-2 rounded-lg"
            >
              Download JSON
            </button>
          )}
        </div>

        {/* ACCOUNTS LIST */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              onClick={() => setSelected(acc)}
              className="border rounded-xl p-4 cursor-pointer hover:shadow-md"
            >
              <h3 className="font-semibold">{acc.studentId}</h3>
              <p className="text-sm text-gray-500">{acc.email}</p>
              <code className="text-xs break-all block mt-2">
                {acc.address}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 relative">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 text-gray-500"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4">Student Credentials</h2>

            <p>
              <strong>ID:</strong> {selected.studentId}
            </p>
            <p>
              <strong>Email:</strong> {selected.email}
            </p>

            <div className="mt-4">
              <p className="font-semibold">Blockchain Address</p>
              <code className="text-sm break-all">{selected.address}</code>
            </div>

            <div className="mt-4">
              <p className="font-semibold text-red-600">Recovery Phrase</p>
              <code className="text-sm break-all">{selected.mnemonic}</code>
            </div>

            <div className="mt-6 flex justify-center">
              <QRCodeCanvas value={selected.mnemonic} size={180} />
            </div>

            <p className="text-xs text-center text-gray-500 mt-4">
              ⚠️ Anyone with this phrase can vote as this student
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAccountGenerator;
