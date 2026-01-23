//! Setup code for benchmarks.

use std::sync::Arc;
use sc_client_api::UsageProvider;
use solochain_template_runtime as runtime;
use runtime::{AccountId, Balance, RuntimeCall};
use sp_core::{Pair, crypto::AccountId32};
use sp_runtime::{OpaqueExtrinsic, generic::Era};
use sp_runtime::codec::Encode;

use crate::service::FullClient;

/// Generates `Balances::TransferKeepAlive` extrinsics for the benchmarks.
pub struct TransferKeepAliveBuilder {
	client: Arc<FullClient>,
	dest: AccountId,
	value: Balance,
}

impl TransferKeepAliveBuilder {
	pub fn new(client: Arc<FullClient>, dest: AccountId, value: Balance) -> Self {
		Self { client, dest, value }
	}
}

impl frame_benchmarking_cli::ExtrinsicBuilder for TransferKeepAliveBuilder {
	fn pallet(&self) -> &str {
		"balances"
	}

	fn extrinsic(&self) -> &str {
		"transfer_keep_alive"
	}

	fn build(&self, nonce: u32) -> std::result::Result<OpaqueExtrinsic, &'static str> {
		with_signed_payload(
			self.client.clone(),
			RuntimeCall::Balances(runtime::pallet_balances::Call::transfer_keep_alive {
				dest: self.dest.clone().into(),
				value: self.value,
			}),
			nonce,
		)
	}
}

/// Generates `System::Remark` extrinsics for the benchmarks.
pub struct RemarkBuilder {
	client: Arc<FullClient>,
}

impl RemarkBuilder {
	pub fn new(client: Arc<FullClient>) -> Self {
		Self { client }
	}
}

impl frame_benchmarking_cli::ExtrinsicBuilder for RemarkBuilder {
	fn pallet(&self) -> &str {
		"system"
	}

	fn extrinsic(&self) -> &str {
		"remark"
	}

	fn build(&self, nonce: u32) -> std::result::Result<OpaqueExtrinsic, &'static str> {
		with_signed_payload(
			self.client.clone(),
			RuntimeCall::System(runtime::frame_system::Call::remark { remark: vec![] }),
			nonce,
		)
	}
}

/// Create a transaction using the given `call`.
pub fn with_signed_payload(
	client: Arc<FullClient>,
	call: RuntimeCall,
	nonce: u32,
) -> std::result::Result<OpaqueExtrinsic, &'static str> {
	let acc = sp_keyring::Sr25519Keyring::Bob.pair();
	let extrinsic: OpaqueExtrinsic = client
		.usage_info()
		.chain
		.best_number
		.checked_add(runtime::BlockHashCount::get())
		.and_then(|_block| {
			let period: u64 = runtime::BlockHashCount::get().into();
			let best_block: u64 = client.usage_info().chain.best_number.into();
			let extra: runtime::SignedExtra = (
				runtime::frame_system::CheckNonZeroSender::<runtime::Runtime>::new(),
				runtime::frame_system::CheckSpecVersion::<runtime::Runtime>::new(),
				runtime::frame_system::CheckTxVersion::<runtime::Runtime>::new(),
				runtime::frame_system::CheckGenesis::<runtime::Runtime>::new(),
				runtime::frame_system::CheckEra::<runtime::Runtime>::from(Era::mortal(
					period,
					best_block,
				)),
				runtime::frame_system::CheckNonce::<runtime::Runtime>::from(nonce),
				runtime::frame_system::CheckWeight::<runtime::Runtime>::new(),
				pallet_transaction_payment::ChargeTransactionPayment::<runtime::Runtime>::from(0),
				frame_metadata_hash_extension::CheckMetadataHash::<runtime::Runtime>::new(false),
				frame_system::WeightReclaim::<runtime::Runtime>::new(),
			);

			let payload = runtime::SignedPayload::new(call.clone(), extra.clone())
				.ok()?;
			
			let signature = payload.using_encoded(|p| acc.sign(p));
			
			Some(
				runtime::UncheckedExtrinsic::new_signed(
					call,
					AccountId32::from(acc.public()).into(),
					runtime::Signature::Sr25519(signature),
					extra,
				)
				.into(),
			)
		})
		.ok_or("failed to create extrinsic")?;

	Ok(extrinsic)
}

/// Generates inherent data for the `benchmark overhead` command.
pub fn inherent_benchmark_data() -> Result<sp_inherents::InherentData, sp_inherents::Error> {
	use sp_inherents::InherentDataProvider;
	let mut inherent_data = sp_inherents::InherentData::new();
	let d = std::time::Duration::from_millis(0);
	let timestamp = sp_timestamp::InherentDataProvider::new(d.into());

	futures::executor::block_on(timestamp.provide_inherent_data(&mut inherent_data))?;

	Ok(inherent_data)
}