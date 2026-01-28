import { useState } from "react";
import { useNavigate } from "react-router-dom";

type Candidate = {
  id: number;
  name: string;
  photo: string;
};

const VotingPortal = () => {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false); // checkbox state
  const [agreed, setAgreed] = useState(false); // overlay visibility
  const [step, setStep] = useState(0);
  const [votes, setVotes] = useState<Record<string, number | null>>({});

  const positions = [
    "President",
    "Vice President",
    "Secretary",
    "Vice Secretary",
  ];
  const candidatesByPosition: Record<string, Candidate[]> = {
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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setChecked(e.target.checked);
  const handleGoBack = () => (window.location.href = "/");
  const handleContinue = () => checked && setAgreed(true);

  const handleVoteSubmit = () => {
    // Only store candidate IDs
    const voteIds: Record<string, number> = {};
    positions.forEach((pos) => (voteIds[pos] = votes[pos]!));

    // Navigate to VoteProcessing component
    navigate("/process-vote", { state: { votes: voteIds } });
  };

  return (
    <div className="min-h-screen relative">
      {/* Voting interface */}
      <div
        className={`transition-opacity duration-500 ${agreed ? "opacity-100" : "opacity-30 blur-sm pointer-events-none"}`}
      >
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <h1 className="text-4xl font-bold mb-2">
            Vote for {positions[step]}
          </h1>
          <p className="text-gray-600 mb-10">Select exactly one candidate</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl w-full">
            {candidatesByPosition[positions[step]].map((candidate) => (
              <div
                key={candidate.id}
                onClick={() =>
                  setVotes({ ...votes, [positions[step]]: candidate.id })
                }
                className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center transition-all ${
                  votes[positions[step]] === candidate.id
                    ? "border-green-600 ring-2 ring-green-500"
                    : "hover:border-gray-400"
                }`}
              >
                <img
                  src={candidate.photo}
                  alt={candidate.name}
                  className="w-32 h-32 object-cover rounded-full mb-4"
                />
                <h3 className="text-lg font-semibold">{candidate.name}</h3>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between w-full max-w-3xl mt-10">
            <button
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 rounded-lg bg-gray-400 text-white disabled:opacity-50"
            >
              Back
            </button>
            {step < positions.length - 1 ? (
              <button
                disabled={!votes[positions[step]]}
                onClick={() => setStep(step + 1)}
                className="px-6 py-3 rounded-lg bg-green-600 text-white disabled:bg-green-300"
              >
                Next
              </button>
            ) : (
              <button
                disabled={positions.some((pos) => !votes[pos])}
                onClick={handleVoteSubmit}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white disabled:bg-blue-300"
              >
                Submit Vote
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overlay */}
      {!agreed && (
        <div className="absolute inset-0 flex items-center justify-center z-50 px-6">
          <div className="rounded-xl shadow-xl bg-white max-w-3xl w-full p-6 space-y-6 flex flex-col">
            <h2 className="text-3xl font-bold text-center">
              Election Code of Conduct
            </h2>
            <p className="text-gray-700 text-center">
              Please read the rules carefully. You must agree before continuing.
            </p>

            <div className="text-left max-h-72 overflow-y-auto border p-4 rounded-md bg-gray-50 text-gray-700 space-y-4">
              <ul className="list-disc list-inside space-y-2">
                {/* Your code of conduct items */}
                <li>
                  <strong>Eligibility:</strong> Only registered, verified, and
                  eligible voters are allowed to participate.
                </li>
                <li>
                  <strong>Single Vote:</strong> Each voter is entitled to cast
                  only one vote.
                </li>
                <li>
                  <strong>Privacy:</strong> Maintain confidentiality of your
                  vote.
                </li>
                <li>
                  <strong>Integrity:</strong> Do not hack or manipulate the
                  voting system.
                </li>
                <li>
                  <strong>Declaration:</strong> By proceeding, you acknowledge
                  you agree with these rules.
                </li>
              </ul>

              {/* Checkbox */}
              <div className="mt-4 pt-4 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="agree"
                  checked={checked}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 text-green-600"
                />
                <label htmlFor="agree" className="text-gray-700 font-medium">
                  I have read and agree to the Election Code of Conduct
                </label>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-between mt-4">
              <button
                onClick={handleGoBack}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-3 rounded-lg shadow-md transition-all"
              >
                Go Back
              </button>
              <button
                onClick={handleContinue}
                disabled={!checked}
                className={`px-6 py-3 rounded-lg shadow-md text-white transition-all ${checked ? "bg-green-600 hover:bg-green-700 cursor-pointer" : "bg-green-300 cursor-not-allowed"}`}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VotingPortal;
