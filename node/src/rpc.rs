//! RPC extensions for the node.

use std::sync::Arc;
use jsonrpsee::RpcModule;
use sc_transaction_pool_api::TransactionPool;
use sp_blockchain::{Error as BlockChainError, HeaderBackend, HeaderMetadata};
use solochain_template_runtime::{AccountId, Balance, Nonce, opaque::Block as OpaqueBlock};

/// Full client dependencies.
pub struct FullDeps<C, P> {
	pub client: Arc<C>,
	pub pool: Arc<P>,
}

/// Instantiate all RPC extensions.
pub fn create_full<C, P>(
	deps: FullDeps<C, P>,
) -> Result<RpcModule<()>, Box<dyn std::error::Error + Send + Sync>>
where
	C: sp_api::ProvideRuntimeApi<OpaqueBlock>,
	C: HeaderBackend<OpaqueBlock> + HeaderMetadata<OpaqueBlock, Error = BlockChainError> + 'static,
	C: Send + Sync + 'static,
	C::Api: substrate_frame_rpc_system::AccountNonceApi<OpaqueBlock, AccountId, Nonce>,
	C::Api: pallet_transaction_payment_rpc::TransactionPaymentRuntimeApi<OpaqueBlock, Balance>,
	C::Api: sp_block_builder::BlockBuilder<OpaqueBlock>,
	P: TransactionPool + 'static,
{
	use pallet_transaction_payment_rpc::{TransactionPayment, TransactionPaymentApiServer};
	use substrate_frame_rpc_system::{System, SystemApiServer};

	let mut module = RpcModule::new(());
	let FullDeps { client, pool } = deps;

	module.merge(System::new(client.clone(), pool).into_rpc())?;
	module.merge(TransactionPayment::new(client).into_rpc())?;

	Ok(module)
}