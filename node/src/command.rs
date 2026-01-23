
use crate::{
    benchmarking::{inherent_benchmark_data, RemarkBuilder, TransferKeepAliveBuilder},
    chain_spec,
    cli::{Cli, Subcommand},
    service::{self, Service},
};
use frame_benchmarking_cli::{BenchmarkCmd, ExtrinsicFactory, SUBSTRATE_REFERENCE_HARDWARE};
use sc_cli::SubstrateCli;
use solochain_template_runtime::{Block, EXISTENTIAL_DEPOSIT};
use sp_keyring::Sr25519Keyring;

impl SubstrateCli for Cli {
    fn impl_name() -> String { "Substrate Node".into() }
    fn impl_version() -> String { env!("SUBSTRATE_CLI_IMPL_VERSION").into() }
    fn description() -> String { env!("CARGO_PKG_DESCRIPTION").into() }
    fn author() -> String { env!("CARGO_PKG_AUTHORS").into() }
    fn support_url() -> String { "support.anonymous.an".into() }
    fn copyright_start_year() -> i32 { 2017 }

    fn load_spec(&self, id: &str) -> Result<Box<dyn sc_service::ChainSpec>, String> {
        Ok(match id {
            "dev" => Box::new(chain_spec::development_chain_spec()?),
            "" | "local" => Box::new(chain_spec::local_chain_spec()?),
            path => Box::new(chain_spec::ChainSpec::from_json_file(std::path::PathBuf::from(path))?),
        })
    }
}

/// Parse and run command line arguments
pub fn run() -> sc_cli::Result<()> {
    let cli = Cli::from_args();

    match &cli.subcommand {
        Some(Subcommand::Key(cmd)) => cmd.run(&cli),

        Some(Subcommand::BuildSpec(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run(config.chain_spec, config.network))
        },

        Some(Subcommand::CheckBlock(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let partial: Service = service::new_partial(&config)?;
                Ok((cmd.run(partial.client, partial.import_queue), partial.task_manager))
            })
        },

        Some(Subcommand::ExportBlocks(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let partial: Service = service::new_partial(&config)?;
                Ok((cmd.run(partial.client, config.database), partial.task_manager))
            })
        },

        Some(Subcommand::ExportState(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let partial: Service = service::new_partial(&config)?;
                Ok((cmd.run(partial.client, config.chain_spec), partial.task_manager))
            })
        },

        Some(Subcommand::ImportBlocks(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let partial: Service = service::new_partial(&config)?;
                Ok((cmd.run(partial.client, partial.import_queue), partial.task_manager))
            })
        },

        Some(Subcommand::PurgeChain(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run(config.database))
        },

        Some(Subcommand::Revert(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let partial: Service = service::new_partial(&config)?;
                let aux_revert = Box::new(|client, _, blocks| {
                    sc_consensus_grandpa::revert(client, blocks)?;
                    Ok(())
                });
                Ok((cmd.run(partial.client, partial.backend, Some(aux_revert)), partial.task_manager))
            })
        },

        Some(Subcommand::Benchmark(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| {
                match cmd {
                    BenchmarkCmd::Pallet(cmd) => {
                        if !cfg!(feature = "runtime-benchmarks") {
                            return Err(
                                "Runtime benchmarking wasn't enabled when building the node. \
                                You can enable it with `--features runtime-benchmarks`.".into(),
                            );
                        }
                        cmd.run_with_spec::<sp_runtime::traits::HashingFor<Block>, ()>(Some(config.chain_spec))
                    },
                    BenchmarkCmd::Block(cmd) => {
                        let partial: Service = service::new_partial(&config)?;
                        cmd.run(partial.client)
                    },
                    #[cfg(not(feature = "runtime-benchmarks"))]
                    BenchmarkCmd::Storage(_) => Err(
                        "Storage benchmarking can be enabled with `--features runtime-benchmarks`.".into(),
                    ),
                    #[cfg(feature = "runtime-benchmarks")]
                    BenchmarkCmd::Storage(cmd) => {
                        let partial: Service = service::new_partial(&config)?;
                        let db = partial.backend.expose_db();
                        let storage = partial.backend.expose_storage();
                        cmd.run(config, partial.client, db, storage)
                    },
                    BenchmarkCmd::Overhead(cmd) => {
                        let partial: Service = service::new_partial(&config)?;
                        let ext_builder = RemarkBuilder::new(partial.client.clone());
                        cmd.run(
                            config.chain_spec.name().into(),
                            partial.client,
                            inherent_benchmark_data().map_err(|e| format!("{:?}", e))?,
                            Vec::new(),
                            &ext_builder,
                            false,
                        )
                    },
                    BenchmarkCmd::Extrinsic(cmd) => {
                        let partial: Service = service::new_partial(&config)?;
                        let ext_factory = ExtrinsicFactory(vec![
                            Box::new(RemarkBuilder::new(partial.client.clone())),
                            Box::new(TransferKeepAliveBuilder::new(
                                partial.client.clone(),
                                Sr25519Keyring::Alice.to_account_id(),
                                EXISTENTIAL_DEPOSIT,
                            )),
                        ]);
                        cmd.run(partial.client, inherent_benchmark_data().map_err(|e| format!("{:?}", e))?, Vec::new(), &ext_factory)
                    },
                    BenchmarkCmd::Machine(cmd) => cmd.run(&config, SUBSTRATE_REFERENCE_HARDWARE.clone()),
                }
            })
        },

        Some(Subcommand::ChainInfo(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run::<Block>(&config))
        },

        None => {
            let runner = cli.create_runner(&cli.run)?;
            runner.run_node_until_exit(|config| async move {
                match config.network.network_backend.unwrap_or_default() {
                    sc_network::config::NetworkBackendType::Libp2p => {
                        service::new_full::<
                            sc_network::NetworkWorker<
                                solochain_template_runtime::opaque::Block,
                                <solochain_template_runtime::opaque::Block as sp_runtime::traits::Block>::Hash,
                            >
                        >(config).map_err(sc_cli::Error::Service)
                    }
                    sc_network::config::NetworkBackendType::Litep2p => {
                        service::new_full::<sc_network::Litep2pNetworkBackend>(config)
                            .map_err(sc_cli::Error::Service)
                    }
                }
            })
        },
    }
}
