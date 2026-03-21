import React, { useEffect, useRef, useState } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";

const NODE_URL = "ws://introductory-lie-forget-mounts.trycloudflare.com/";

// ==================== TYPES ====================
type BlockEntry = {
  number: number;
  hash: string;
  parentHash: string;
  stateRoot: string;
  extrinsicsRoot: string;
  extrinsics: ExtrinsicEntry[];
  timestamp: string;
  isNew?: boolean;
};

type ExtrinsicEntry = {
  index: number;
  method: string;
  section: string;
  args: string;
  isSigned: boolean;
  signer?: string;
};

type ChainStats = {
  specName: string;
  specVersion: number;
  blockTime: number | null;
  latestBlock: number;
  peers: number;
};

// ==================== HELPERS ====================
const shortHash = (hash: string, start = 10, end = 6) =>
  `${hash.slice(0, start)}…${hash.slice(-end)}`;

const timeAgo = (timestamp: string): string => {
  const diff = Math.floor(
    (Date.now() - new Date(`1970-01-01 ${timestamp}`).getTime()) / 1000,
  );
  if (isNaN(diff) || diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
};

// ==================== BLOCK DETAIL MODAL ====================
const BlockDetailModal: React.FC<{
  block: BlockEntry;
  onClose: () => void;
}> = ({ block, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-red-600 text-white px-6 py-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
              </div>
              <div>
                <p className="text-blue-200 text-xs font-medium">Block</p>
                <h2 className="text-xl font-bold">#{block.number.toLocaleString()}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Hashes */}
          <div className="space-y-3">
            {[
              { label: "Block Hash", value: block.hash },
              { label: "Parent Hash", value: block.parentHash },
              { label: "State Root", value: block.stateRoot },
              { label: "Extrinsics Root", value: block.extrinsicsRoot },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <code className="text-xs text-gray-700 break-all font-mono">{value}</code>
                </div>
              </div>
            ))}
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{block.extrinsics.length}</p>
              <p className="text-xs text-blue-500 font-medium mt-0.5">Extrinsics</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-red-700 font-mono">{block.timestamp}</p>
              <p className="text-xs text-red-500 font-medium mt-0.5">Received at</p>
            </div>
          </div>

          {/* Extrinsics */}
          {block.extrinsics.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 bg-gray-100 rounded-md flex items-center justify-center text-xs font-bold text-gray-500">
                  {block.extrinsics.length}
                </span>
                Extrinsics
              </h3>
              <div className="space-y-2">
                {block.extrinsics.map((ext) => (
                  <div
                    key={ext.index}
                    className="border border-gray-100 rounded-xl p-3 bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded font-mono">
                          #{ext.index}
                        </span>
                        <span className="text-sm font-semibold text-gray-800">
                          <span className="text-blue-600">{ext.section}</span>
                          <span className="text-gray-400">.</span>
                          <span>{ext.method}</span>
                        </span>
                      </div>
                      {ext.isSigned && (
                        <span className="flex-shrink-0 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                          Signed
                        </span>
                      )}
                    </div>
                    {ext.signer && (
                      <p className="text-xs text-gray-500 font-mono truncate mb-1">
                        <span className="text-gray-400">Signer: </span>{ext.signer}
                      </p>
                    )}
                    {ext.args && ext.args !== "[]" && (
                      <div className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 mt-1">
                        <p className="text-[11px] text-gray-400 font-semibold mb-0.5">Args</p>
                        <code className="text-[11px] text-gray-600 break-all font-mono">{ext.args}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== STAT CARD ====================
const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, sub, icon, color }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5`}>
    <div className="flex items-start justify-between mb-3">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
    </div>
    <p className="text-2xl font-bold text-gray-800 leading-none">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

// ==================== MAIN BLOCK EXPLORER ====================
const BlockExplorer: React.FC = () => {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [blocks, setBlocks] = useState<BlockEntry[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<BlockEntry | null>(null);
  const [chainStats, setChainStats] = useState<ChainStats>({
    specName: "—",
    specVersion: 0,
    blockTime: null,
    latestBlock: 0,
    peers: 0,
  });
  const [blockTimestamps, setBlockTimestamps] = useState<number[]>([]);
  const apiRef = useRef<ApiPromise | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const MAX_BLOCKS = 50;

  const connect = async () => {
    if (apiRef.current) {
      try { await apiRef.current.disconnect(); } catch { /* ignore */ }
      apiRef.current = null;
    }
    setConnecting(true);
    setConnected(false);
    setBlocks([]);
    try {
      const provider = new WsProvider(NODE_URL);
      const instance = await ApiPromise.create({ provider });
      await instance.isReady;

      const runtimeVersion = instance.runtimeVersion;
      setChainStats((prev) => ({
        ...prev,
        specName: runtimeVersion.specName.toString(),
        specVersion: runtimeVersion.specVersion.toNumber(),
      }));

      apiRef.current = instance;
      setApi(instance);
      setConnected(true);
      startSubscription(instance);
    } catch (err) {
      console.error("BlockExplorer: connection failed", err);
    } finally {
      setConnecting(false);
    }
  };

  const startSubscription = (instance: ApiPromise) => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    instance.rpc.chain
      .subscribeNewHeads(async (header: any) => {
        const blockNumber = header.number.toNumber();
        const blockHash = header.hash.toHex();
        const parentHash = header.parentHash.toHex();
        const stateRoot = header.stateRoot.toHex();
        const extrinsicsRoot = header.extrinsicsRoot.toHex();
        const now = Date.now();

        // Update avg block time
        setBlockTimestamps((prev) => {
          const updated = [...prev, now].slice(-6);
          if (updated.length >= 2) {
            const diffs = updated
              .slice(1)
              .map((t, i) => t - updated[i]);
            const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
            setChainStats((s) => ({
              ...s,
              latestBlock: blockNumber,
              blockTime: Math.round(avg / 100) / 10,
            }));
          } else {
            setChainStats((s) => ({ ...s, latestBlock: blockNumber }));
          }
          return updated;
        });

        // Fetch full block for extrinsics
        let extrinsics: ExtrinsicEntry[] = [];
        try {
          const signedBlock = await instance.rpc.chain.getBlock(blockHash);
          extrinsics = signedBlock.block.extrinsics.map((ext: any, idx: number) => {
            const { method: { method, section }, isSigned, signer, args } = ext;
            return {
              index: idx,
              method: method.toString(),
              section: section.toString(),
              args: JSON.stringify(args.toHuman()),
              isSigned,
              signer: isSigned ? signer.toString() : undefined,
            };
          });
        } catch { /* not fatal */ }

        const entry: BlockEntry = {
          number: blockNumber,
          hash: blockHash,
          parentHash,
          stateRoot,
          extrinsicsRoot,
          extrinsics,
          timestamp: new Date().toLocaleTimeString(),
          isNew: true,
        };

        setBlocks((prev) => {
          const next = [entry, ...prev].slice(0, MAX_BLOCKS);
          setTimeout(() => {
            setBlocks((b) =>
              b.map((bl) =>
                bl.number === blockNumber ? { ...bl, isNew: false } : bl,
              ),
            );
          }, 1800);
          return next;
        });
      })
      .then((unsub) => {
        unsubRef.current = unsub as unknown as () => void;
      })
      .catch((err) => console.error("subscribeNewHeads failed", err));
  };

  useEffect(() => {
    connect();
    return () => {
      if (unsubRef.current) unsubRef.current();
      if (apiRef.current) apiRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avgTxPerBlock =
    blocks.length > 0
      ? (
          blocks.reduce((s, b) => s + b.extrinsics.length, 0) / blocks.length
        ).toFixed(1)
      : "—";

  return (
    <div className="w-full">
      <div className="w-full mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-800 via-blue-700 to-red-700 p-8 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                  </svg>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Block Explorer</h1>
              </div>
              <p className="text-blue-200 text-sm">
                Live view of the ChainBallot blockchain
              </p>
              {connected && (
                <p className="text-blue-300 text-xs mt-1 font-mono">
                  {chainStats.specName} v{chainStats.specVersion} · {NODE_URL}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Connection status */}
              {connecting ? (
                <span className="flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold">
                  <div className="animate-spin h-3 w-3 rounded-full border-2 border-white border-t-transparent" />
                  Connecting…
                </span>
              ) : connected ? (
                <span className="flex items-center gap-2 bg-blue-500/20 border border-blue-400/40 px-3 py-1.5 rounded-full text-xs font-semibold text-blue-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                  </span>
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-2 bg-red-500/20 border border-red-400/40 px-3 py-1.5 rounded-full text-xs font-semibold text-red-100">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  Disconnected
                </span>
              )}
              {!connected && !connecting && (
                <button
                  onClick={connect}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Reconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Latest Block"
            value={chainStats.latestBlock > 0 ? `#${chainStats.latestBlock.toLocaleString()}` : "—"}
            icon={
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
            }
            color="bg-blue-50"
          />
          <StatCard
            label="Avg Block Time"
            value={chainStats.blockTime ? `${chainStats.blockTime}s` : "—"}
            sub="rolling 5-block avg"
            icon={
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="bg-red-50"
          />
          <StatCard
            label="Avg Tx / Block"
            value={avgTxPerBlock}
            sub={`last ${blocks.length} blocks`}
            icon={
              <svg className="w-4 h-4 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            color="bg-gray-100"
          />
          <StatCard
            label="Blocks Seen"
            value={blocks.length}
            sub={`max ${MAX_BLOCKS} stored`}
            icon={
              <svg className="w-4 h-4 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
            color="bg-blue-100"
          />
        </div>

        {/* ── Block Feed ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-800">Recent Blocks</h2>
              {connected && blocks.length > 0 && (
                <span className="text-xs text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                  {blocks.length}
                </span>
              )}
            </div>
            {connected && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                Live
              </span>
            )}
          </div>

          {/* Column labels */}
          {blocks.length > 0 && (
            <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-gray-50 border-b border-slate-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              <div className="col-span-2">Block</div>
              <div className="col-span-4">Hash</div>
              <div className="col-span-3 hidden md:block">Parent</div>
              <div className="col-span-1 text-center">Txs</div>
              <div className="col-span-2 text-right">Time</div>
            </div>
          )}

          {/* Rows */}
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              {connecting ? (
                <>
                  <div className="animate-spin w-10 h-10 rounded-full border-3 border-blue-200 border-t-blue-600 mb-3" />
                  <p className="text-sm font-medium">Connecting to node…</p>
                </>
              ) : (
                <>
                  <div className="animate-pulse w-12 h-12 rounded-2xl bg-gray-100 mb-4 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium">Waiting for blocks…</p>
                  <p className="text-xs mt-1">New blocks appear in real time</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
              {blocks.map((block) => (
                <div
                  key={block.number}
                  onClick={() => setSelectedBlock(block)}
                  className={`grid grid-cols-12 gap-2 px-6 py-3.5 cursor-pointer transition-all duration-500 items-center ${
                    block.isNew
                      ? "bg-blue-50 hover:bg-blue-100"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {/* Block number */}
                  <div className="col-span-2 flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                        block.isNew
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {block.isNew ? (
                        <span className="text-[9px]">NEW</span>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                        </svg>
                      )}
                    </div>
                    <span className="font-bold text-blue-700 text-sm">
                      {block.number.toLocaleString()}
                    </span>
                  </div>

                  {/* Hash */}
                  <div className="col-span-4">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {shortHash(block.hash)}
                    </span>
                  </div>

                  {/* Parent hash */}
                  <div className="col-span-3 hidden md:block">
                    <span className="text-xs font-mono text-gray-400">
                      {shortHash(block.parentHash)}
                    </span>
                  </div>

                  {/* Tx count */}
                  <div className="col-span-1 flex justify-center">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        block.extrinsics.length > 1
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {block.extrinsics.length}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="col-span-2 text-right">
                    <span className="text-xs text-gray-400 font-mono">
                      {block.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Block detail modal */}
      {selectedBlock && (
        <BlockDetailModal
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
        />
      )}
    </div>
  );
};

export default BlockExplorer;