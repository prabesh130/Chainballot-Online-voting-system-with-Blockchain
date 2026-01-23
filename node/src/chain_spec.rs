#![allow(unused_imports)]
use sc_service::ChainType;
use solochain_template_runtime::WASM_BINARY;
use solochain_template_runtime as solochain_runtime;
use sp_core::{Pair as PairT, sr25519};
use sp_runtime::traits::Verify;
use sc_telemetry::serde_json;
use sc_telemetry::serde_json::json;
use sp_core::crypto::Ss58Codec;
/// Specialized `ChainSpec`. This is a specialization of the general Substrate ChainSpec type.
pub type ChainSpec = sc_service::GenericChainSpec;
use sp_runtime::traits::IdentifyAccount;
type AccountPublic = <solochain_runtime::Signature as Verify>::Signer;

fn get_account_id_from_seed(
	seed: &str,
) -> solochain_runtime::AccountId {
	use sp_runtime::traits::IdentifyAccount;

	let pair = sp_core::sr25519::Pair::from_string(
		&format!("//{}", seed),
		None,
	)
	.expect("static values are valid");

	AccountPublic::from(pair.public()).into_account()
}

fn get_authority_keys_from_seed(seed: &str) -> (String, String) {
    let pair = sr25519::Pair::from_string(
        &format!("//{}", seed),
        None,
    )
    .expect("static values are valid");

    let public = pair.public().to_ss58check();

    // Aura and GRANDPA both use sr25519 in the node template
    (public.clone(), public)
}


pub fn development_chain_spec() -> Result<ChainSpec, String> {
	Ok(ChainSpec::builder(
		WASM_BINARY.ok_or_else(|| "Development wasm not available".to_string())?,
		None,
	)
	.with_name("Development")
	.with_id("dev")
	.with_chain_type(ChainType::Development)
	.with_genesis_config_patch(testnet_genesis())
	.build())
}

pub fn local_chain_spec() -> Result<ChainSpec, String> {
	Ok(ChainSpec::builder(
		WASM_BINARY.ok_or_else(|| "Development wasm not available".to_string())?,
		None,
	)
	.with_name("Local Testnet")
	.with_id("local_testnet")
	.with_chain_type(ChainType::Local)
	.with_genesis_config_patch(testnet_genesis())
	.build())
}

fn testnet_genesis() -> serde_json::Value {
    let authorities = vec![
        get_authority_keys_from_seed("Alice"),
        get_authority_keys_from_seed("Bob"),
        get_authority_keys_from_seed("Charlie"),
        get_authority_keys_from_seed("Dave"),
    ];

    json!({
        "balances": {
            "balances": vec![
                (get_account_id_from_seed("Alice"), 1u128 << 60),
                (get_account_id_from_seed("Bob"), 1u128 << 60),
                (get_account_id_from_seed("Charlie"), 1u128 << 60),
                (get_account_id_from_seed("Dave"), 1u128 << 60),
            ],
        },

        "aura": {
            "authorities": authorities
                .iter()
                .map(|(aura_key, _)| aura_key)
                .collect::<Vec<_>>()
        },

        "grandpa": {
            "authorities": authorities
                .iter()
                .map(|(_, grandpa_key)| json!([grandpa_key, 1]))
                .collect::<Vec<_>>()
        },

        "council": {
            "members": vec![
                get_account_id_from_seed("Alice"),
                get_account_id_from_seed("Bob"),
                get_account_id_from_seed("Charlie"),
                get_account_id_from_seed("Dave"),
            ],
        },
    })
}
