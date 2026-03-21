import { useEffect, useState } from "react";
import { ApiPromise } from "@polkadot/api";
import { getApiUrl } from "../utils/api";
import Blockexplorer from "./Blockexplorer";

type Candidate = {
  id: number;
  candidate_id: number | null;
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

const getChainCandidateId = (candidate: Candidate) =>
  candidate.candidate_id ?? candidate.id;

export default function Results({ api }: { api: ApiPromise | null }) {
  const [loading, setLoading] = useState(true);
  const [electionStatus, setElectionStatus] = useState<ElectionStatus | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  const [tally, setTally] = useState<Record<number, number>>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);

  const fetchElectionData = async () => {
    try {
      const [statusRes, candidatesRes] = await Promise.all([
        fetch(getApiUrl("/voting/election/status/")),
        // The public endpoint for candidates
        fetch(getApiUrl("/voting/election/candidates/"))
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setElectionStatus(statusData);
      }
      
      if (candidatesRes.ok) {
        const candidateData = await candidatesRes.json();
        if (candidateData.candidates) {
          const allCands: Candidate[] = [];
          Object.values(candidateData.candidates).forEach((cands: any) => {
            allCands.push(...cands);
          });
          setCandidates(allCands);
        }
      }
    } catch (err) {
      console.error("Error fetching election data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTally = async () => {
    if (!api) return;
    try {
      let total = 0;
      if (api.query.voting.voteCounter) {
        total = ((await api.query.voting.voteCounter()) as any).toNumber();
      }
      setTotalVotes(total);

      let revealed = 0;
      if (api.query.voting.revealedCount) {
        revealed = ((await api.query.voting.revealedCount()) as any).toNumber();
      }
      setRevealedCount(revealed);

      const tallyData: Record<number, number> = {};
      for (const candidate of candidates) {
        const chainId = getChainCandidateId(candidate);
        const count = await (api.query.voting.tally as any)(chainId);
        tallyData[chainId] = count.toNumber();
      }
      setTally(tallyData);
    } catch (err) {
      console.error("Error fetching chain data:", err);
    }
  };

  useEffect(() => {
    fetchElectionData();
  }, []);

  useEffect(() => {
    if (!api || candidates.length === 0) return;
    fetchTally();

    // Poll the tally and revealed count every 3 seconds to get live updates
    const interval = setInterval(() => {
      fetchTally();
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, candidates]);

  if (loading || !api) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  if (electionStatus?.status !== "ended") {
    return (
      <div className="min-h-screen px-4 py-10 md:px-6">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-blue-200 bg-white p-8 text-center shadow-xl">
          <h2 className="mb-3 text-3xl font-bold text-blue-900">
            Election Results
          </h2>
          <p className="text-slate-600 text-lg">
            Results will be available once the election ends and votes are decrypted.
          </p>
        </div>
      </div>
    );
  }

  const predefinedOrder = ["President", "Vice President", "Secretary", "Vice Secretary"];
  const posts = Array.from(new Set(candidates.map(c => c.post))).sort((a, b) => {
    let indexA = predefinedOrder.indexOf(a);
    let indexB = predefinedOrder.indexOf(b);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });

  const isElectionFinished = electionStatus?.status === "ended" && totalVotes > 0 && revealedCount === totalVotes;

  const getWinnersByPost = () => {
    if (!isElectionFinished) return [];
    
    return posts.map(post => {
      const postCandidates = candidates.filter((c) => c.post === post);
      if (postCandidates.length === 0) return null;

      const sorted = [...postCandidates].sort(
        (a, b) => (tally[getChainCandidateId(b)] || 0) - (tally[getChainCandidateId(a)] || 0)
      );

      const topVotes = tally[getChainCandidateId(sorted[0])] || 0;
      if (topVotes === 0) return null;

      const leadingCandidates = sorted.filter(
        (c) => (tally[getChainCandidateId(c)] || 0) === topVotes
      );

      return { post, winners: leadingCandidates, votes: topVotes };
    }).filter(Boolean);
  };

  const winnersList = getWinnersByPost();

  return (
    <div className="min-h-screen px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-7xl">
        {!isElectionFinished && (
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-blue-900 mb-4">Live Election Results</h1>
            <p className="text-lg text-slate-600">
              Watch the live results as ballots are decrypted by the election committee.
            </p>
          </div>
        )}

        {isElectionFinished && winnersList.length > 0 && (
          <div className="mb-16">
            <h2 className="text-4xl font-extrabold text-center text-black mb-8 tracking-tight">Elected Candidates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {winnersList.map(item => (
                <div key={item!.post} className="bg-gradient-to-b red rounded-2xl shadow-xl border border-red-200 overflow-hidden transform transition-all hover:-translate-y-1 hover:shadow-2xl">
                  <div className="bg-red-800 px-4 py-3 text-center">
                    <h3 className="text-white font-bold tracking-wider uppercase text-sm drop-shadow-sm">{item!.post}</h3>
                  </div>
                  <div className="p-6 text-center space-y-4">
                    {item!.winners.length === 1 ? (
                      <>
                        <div className="relative inline-block">
                          <img 
                            src={item!.winners[0].photo_url || "src/assets/image/candidate.jpg"} 
                            className="w-28 h-28 rounded-full border-4 border-red-100 object-cover mx-auto"
                            alt={item!.winners[0].name}
                          />
                        </div>
                        <div>
                          <p className="text-2xl font-extrabold text-slate-800">{item!.winners[0].name}</p>
                          <p className="text-md font-bold text-red-600 mt-1">{item!.votes} Counted Votes</p>
                        </div>
                      </>
                    ) : (
                      <>
                         <div className="flex justify-center -space-x-4 mb-4">
                           {item!.winners.map((w, i) => (
                              <img 
                                key={w.id}
                                src={w.photo_url || "src/assets/image/candidate.jpg"} 
                                className="w-16 h-16 rounded-full border-4 border-red-100 object-cover relative"
                                style={{zIndex: 10 - i}}
                                alt={w.name}
                              />
                           ))}
                         </div>
                         <div>
                          <p className="text-xl font-extrabold text-orange-600 uppercase tracking-widest">IT'S A TIE</p>
                          <p className="text-sm font-bold text-slate-700 mt-2">
                            {item!.winners.map(w => w.name).join(", ")}
                          </p>
                          <p className="text-sm font-bold text-red-600 mt-1">{item!.votes} Counted Votes</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6 text-center">
             <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Votes Casted</div>
             <div className="text-5xl font-extrabold text-blue-700">{totalVotes}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-green-100 p-6 text-center">
             <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Counted Votes</div>
             <div className="text-5xl font-extrabold text-green-600">{revealedCount}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-orange-100 p-6 text-center">
             <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Remaining Votes</div>
             <div className="text-5xl font-extrabold text-orange-500">{Math.max(0, totalVotes - revealedCount)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {posts.map(post => {
            const postCandidates = candidates.filter(c => c.post === post);
            // sort by votes descending
            postCandidates.sort((a, b) => (tally[getChainCandidateId(b)] || 0) - (tally[getChainCandidateId(a)] || 0));
            
            return (
              <div key={post} className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="bg-blue-900 px-6 py-4">
                  <h3 className="text-2xl font-bold text-white">{post}</h3>
                </div>
                <div className="p-6 space-y-6 flex-1">
                  {postCandidates.map((candidate) => {
                    const votes = tally[getChainCandidateId(candidate)] || 0;
                    const percentage = revealedCount > 0 ? ((votes / revealedCount) * 100).toFixed(1) : "0";
                    
                    const topVotes = tally[getChainCandidateId(postCandidates[0])] || 0;
                    const isTie = postCandidates.filter((c) => (tally[getChainCandidateId(c)] || 0) === topVotes).length > 1;
                    const isTopScore = votes === topVotes && votes > 0;

                    const isWinner = isTopScore && !isTie && revealedCount === totalVotes && totalVotes > 0;
                    const isLeading = isTopScore && !isTie && revealedCount > 0 && revealedCount < totalVotes;
                    const showTie = isTopScore && isTie && revealedCount > 0;

                    return (
                      <div key={candidate.id} className="relative">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-4">
                            <img 
                              src={candidate.photo_url || "src/assets/image/candidate.jpg"} 
                              className="w-12 h-12 rounded-full border border-slate-200 object-cover"
                              alt={candidate.name}
                            />
                            <div>
                              <div className="font-bold text-lg text-slate-800 flex flex-wrap items-center">
                                {candidate.name} 
                                {isWinner && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full ml-3 font-bold tracking-wide border border-red-300 mb-1 lg:mb-0">WINNER</span>}
                                {isLeading && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-3 font-bold tracking-wide border border-blue-300 mb-1 lg:mb-0">LEADING</span>}
                                {showTie && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full ml-3 font-bold tracking-wide border border-orange-300 mb-1 lg:mb-0">TIED</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-2xl text-blue-700">{votes}</div>
                            <div className="text-sm text-slate-500 font-medium">{percentage}%</div>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                           <div 
                             className="bg-blue-600 h-4 rounded-full transition-all duration-1000"
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

        <div className="mt-16 pt-16 border-t border-slate-200">
           <div className="text-center mb-10">
             <h2 className="text-3xl font-bold text-blue-900 mb-4">Blockchain Explorer</h2>
             <p className="text-lg text-slate-600">
               Verify the integrity of the election with raw blockchain data.
             </p>
           </div>
           <Blockexplorer />
        </div>
      </div>
    </div>
  );
}
