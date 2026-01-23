#![cfg_attr(not(feature = "std"), no_std)]

#[cfg(feature = "std")]
include!(concat!(env!("OUT_DIR"), "/wasm_binary.rs"));

extern crate alloc;
use alloc::vec::Vec;

use frame_support::{
    derive_impl,
    parameter_types,
    traits::{ConstBool, ConstU128, ConstU16, ConstU32, ConstU64, ConstU8},
    weights::{
        constants::WEIGHT_REF_TIME_PER_SECOND, Weight, WeightToFeeCoefficients,
        WeightToFeePolynomial,
    },
};
use frame_system::limits::{BlockLength, BlockWeights};
use pallet_collective::{EnsureProportionAtLeast, Instance1};
use pallet_transaction_payment::{FungibleAdapter, Multiplier};


use sp_runtime::{
    generic, impl_opaque_keys,
    traits::{AccountIdLookup, BlakeTwo256, IdentifyAccount, Verify},
    MultiAddress, MultiSignature, Perbill,
};

#[cfg(feature = "std")]
use sp_version::NativeVersion;
use sp_version::RuntimeVersion;

pub mod apis;
pub mod genesis_config_presets;

/* -------------------------------------------------------------
   Time & constants
------------------------------------------------------------- */

pub const MILLI_SECS_PER_BLOCK: u64 = 6000;
pub const SLOT_DURATION: u64 = MILLI_SECS_PER_BLOCK;

pub type BlockNumber = u32;
pub type Balance = u128;
pub type Nonce = u32;
pub type Hash = sp_core::H256;

pub const UNIT: Balance = 1_000_000_000_000;
pub const MILLI_UNIT: Balance = 1_000_000_000;
pub const EXISTENTIAL_DEPOSIT: Balance = MILLI_UNIT;

/* -------------------------------------------------------------
   Account & crypto
------------------------------------------------------------- */

pub type Signature = MultiSignature;
pub type AccountId = <<Signature as Verify>::Signer as IdentifyAccount>::AccountId;
pub type Address = MultiAddress<AccountId, ()>;

/* -------------------------------------------------------------
   Council / voting
------------------------------------------------------------- */

pub type CouncilCollective = Instance1;
pub type CouncilMajorityOrigin =
    EnsureProportionAtLeast<AccountId, CouncilCollective, 3, 4>;

/* -------------------------------------------------------------
   Runtime extrinsics & block
------------------------------------------------------------- */

pub type TxExtension = (
    frame_system::CheckNonZeroSender<Runtime>,
    frame_system::CheckSpecVersion<Runtime>,
    frame_system::CheckTxVersion<Runtime>,
    frame_system::CheckGenesis<Runtime>,
    frame_system::CheckEra<Runtime>,
    frame_system::CheckNonce<Runtime>,
    frame_system::CheckWeight<Runtime>,
    pallet_transaction_payment::ChargeTransactionPayment<Runtime>,
    frame_metadata_hash_extension::CheckMetadataHash<Runtime>,
    frame_system::WeightReclaim<Runtime>,
);

// Re-exports for benchmarking node
pub use pallet_balances;
pub use frame_system;
pub type SignedExtra = TxExtension;
pub type SignedPayload = sp_runtime::generic::SignedPayload<RuntimeCall, SignedExtra>;

pub type UncheckedExtrinsic =
    generic::UncheckedExtrinsic<Address, RuntimeCall, Signature, TxExtension>;

pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
pub type Block = generic::Block<Header, UncheckedExtrinsic>;

/* -------------------------------------------------------------
   Opaque types (NODE ONLY)
------------------------------------------------------------- */

pub mod opaque {
    use super::*;
    use sp_runtime::{
        generic,
        traits::{BlakeTwo256, Hash as HashT},
        OpaqueExtrinsic,
    };
    
    pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
    pub type Block = generic::Block<Header, OpaqueExtrinsic>;
    pub type BlockId = generic::BlockId<Block>;
    pub type Hash = <BlakeTwo256 as HashT>::Output;
}

/* -------------------------------------------------------------
   Runtime macro
------------------------------------------------------------- */

#[frame_support::runtime]
mod runtime {
    #[runtime::runtime]
    #[runtime::derive(
        RuntimeCall,
        RuntimeEvent,
        RuntimeError,
        RuntimeOrigin,
        RuntimeFreezeReason,
        RuntimeHoldReason,
        RuntimeSlashReason,
        RuntimeLockId,
        RuntimeTask,
        RuntimeViewFunction
    )]
    pub struct Runtime;

    #[runtime::pallet_index(0)]
    pub type System = frame_system;
    #[runtime::pallet_index(1)]
    pub type Timestamp = pallet_timestamp;
    #[runtime::pallet_index(2)]
    pub type Aura = pallet_aura;
    #[runtime::pallet_index(3)]
    pub type Grandpa = pallet_grandpa;
    #[runtime::pallet_index(4)]
    pub type Balances = pallet_balances;
    #[runtime::pallet_index(5)]
    pub type TransactionPayment = pallet_transaction_payment;
    #[runtime::pallet_index(6)]
    pub type Sudo = pallet_sudo;
    #[runtime::pallet_index(7)]
    pub type Template = pallet_template;
    #[runtime::pallet_index(8)]
    pub type Voting = pallet_voting;
    #[runtime::pallet_index(9)]
    pub type Council = pallet_collective<Instance1>;
}

// Remove `pub use runtime::*;` — the runtime macro exposes types automatically

/* -------------------------------------------------------------
   Session keys
------------------------------------------------------------- */

impl_opaque_keys! {
    pub struct SessionKeys {
        pub aura: Aura,
        pub grandpa: Grandpa,
    }
}

/* -------------------------------------------------------------
   Runtime version
------------------------------------------------------------- */

#[sp_version::runtime_version]
pub const VERSION: RuntimeVersion = RuntimeVersion {
    spec_name: alloc::borrow::Cow::Borrowed("solochain-template-runtime"),
    impl_name: alloc::borrow::Cow::Borrowed("solochain-template-runtime"),
    authoring_version: 1,
    spec_version: 100,
    impl_version: 1,
    apis: apis::RUNTIME_API_VERSIONS,
    transaction_version: 1,
    system_version: 1,
};

#[cfg(feature = "std")]
pub fn native_version() -> NativeVersion {
    NativeVersion {
        runtime_version: VERSION,
        can_author_with: Default::default(),
    }
}

/* -------------------------------------------------------------
   Block weights and limits
------------------------------------------------------------- */

const NORMAL_DISPATCH_RATIO: Perbill = Perbill::from_percent(75);
const MAXIMUM_BLOCK_WEIGHT: Weight = Weight::from_parts(
    WEIGHT_REF_TIME_PER_SECOND.saturating_mul(2),
    5 * 1024 * 1024,
);

parameter_types! {
    pub const Version: RuntimeVersion = VERSION;
    pub const BlockHashCount: BlockNumber = 2400;
    pub RuntimeBlockLength: BlockLength =
        BlockLength::max_with_normal_ratio(5 * 1024 * 1024, NORMAL_DISPATCH_RATIO);
    pub RuntimeBlockWeights: BlockWeights = BlockWeights::builder()
        .base_block(Weight::from_parts(10_000_000, 0))
        .for_class(frame_support::dispatch::DispatchClass::all(), |weights| {
            weights.base_extrinsic = Weight::from_parts(125_000_000, 0);
        })
        .for_class(frame_support::dispatch::DispatchClass::Normal, |weights| {
            weights.max_total = Some(NORMAL_DISPATCH_RATIO * MAXIMUM_BLOCK_WEIGHT);
        })
        .for_class(frame_support::dispatch::DispatchClass::Operational, |weights| {
            weights.max_total = Some(MAXIMUM_BLOCK_WEIGHT);
            weights.reserved = Some(
                MAXIMUM_BLOCK_WEIGHT - NORMAL_DISPATCH_RATIO * MAXIMUM_BLOCK_WEIGHT
            );
        })
        .avg_block_initialization(Perbill::from_percent(10))
        .build_or_panic();
}

/* -------------------------------------------------------------
   Executive
------------------------------------------------------------- */

type Migrations = ();

pub type Executive = frame_executive::Executive<
    Runtime,
    Block,
    frame_system::ChainContext<Runtime>,
    Runtime,
    AllPalletsWithSystem,
    Migrations,
>;

/* -------------------------------------------------------------
   Pallet configs
------------------------------------------------------------- */

#[derive_impl(frame_system::config_preludes::SolochainDefaultConfig)]
impl frame_system::Config for Runtime {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = RuntimeBlockWeights;
    type BlockLength = RuntimeBlockLength;
    type AccountId = AccountId;
    type RuntimeCall = RuntimeCall;
    type Lookup = AccountIdLookup<AccountId, ()>;
    type Nonce = Nonce;
    type Hash = Hash;
    type Hashing = BlakeTwo256;
    type Block = Block;
    type RuntimeEvent = RuntimeEvent;
    type RuntimeOrigin = RuntimeOrigin;
    type BlockHashCount = BlockHashCount;
    type DbWeight = ();
    type Version = Version;
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<Balance>;
    type SS58Prefix = ConstU16<42>;
    type MaxConsumers = ConstU32<16>;
}

/* -------------------------------------------------------------
   Timestamp / Aura / Grandpa
------------------------------------------------------------- */

impl pallet_timestamp::Config for Runtime {
    type Moment = u64;
    type OnTimestampSet = Aura;
    type MinimumPeriod = ConstU64<{ SLOT_DURATION / 2 }>;
    type WeightInfo = ();
}

impl pallet_aura::Config for Runtime {
    type AuthorityId = sp_consensus_aura::sr25519::AuthorityId;
    type DisabledValidators = ();
    type AllowMultipleBlocksPerSlot = ConstBool<false>;
    type MaxAuthorities = ConstU32<32>;
    type SlotDuration = ConstU64<SLOT_DURATION>;
}

impl pallet_grandpa::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxAuthorities = ConstU32<32>;
    type MaxNominators = ConstU32<0>;
    type MaxSetIdSessionEntries = ConstU64<0>;
    type KeyOwnerProof = sp_core::Void;
    type EquivocationReportSystem = ();
    type WeightInfo = ();
}

/* -------------------------------------------------------------
   Balances
------------------------------------------------------------- */

impl pallet_balances::Config for Runtime {
    type Balance = Balance;
    type RuntimeEvent = RuntimeEvent;
    type ExistentialDeposit = ConstU128<EXISTENTIAL_DEPOSIT>;
    type AccountStore = System;
    type WeightInfo = ();
    type RuntimeHoldReason = RuntimeHoldReason;
    type RuntimeFreezeReason = RuntimeFreezeReason;
    type DustRemoval = ();
    type ReserveIdentifier = [u8; 8];
    type FreezeIdentifier = RuntimeFreezeReason;
    type MaxLocks = ConstU32<50>;
    type MaxReserves = ();
    type MaxFreezes = ConstU32<50>;
    type DoneSlashHandler = ();
}

/* -------------------------------------------------------------
   Transaction Payment
------------------------------------------------------------- */

parameter_types! {
    pub FeeMultiplier: Multiplier = Multiplier::from_u32(1);
}

impl pallet_transaction_payment::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type OnChargeTransaction = FungibleAdapter<Balances, ()>;
    type OperationalFeeMultiplier = ConstU8<5>;
    type WeightToFee = IdentityFee<Balance>;
    type LengthToFee = IdentityFee<Balance>;
    type FeeMultiplierUpdate = ();
    type WeightInfo = ();
}

/* -------------------------------------------------------------
   Weight to Fee
------------------------------------------------------------- */

pub struct IdentityFee<T>(core::marker::PhantomData<T>);

impl<T> WeightToFeePolynomial for IdentityFee<T>
where
    T: frame_support::sp_runtime::traits::AtLeast32BitUnsigned + Copy + From<u64>,
{
    type Balance = T;

    fn polynomial() -> WeightToFeeCoefficients<Self::Balance> {
        use frame_support::weights::WeightToFeeCoefficient;
        use smallvec::smallvec;

        let one = T::from(1u64);

        smallvec![WeightToFeeCoefficient {
            degree: 1,
            negative: false,
            coeff_frac: Perbill::zero(),
            coeff_integer: one,
        }]
    }
}

/* -------------------------------------------------------------
   Other pallets
------------------------------------------------------------- */

impl pallet_sudo::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type WeightInfo = ();
}

impl pallet_template::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = ();
}

impl pallet_voting::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type AuthorityOrigin = frame_system::EnsureRoot<AccountId>;
}

parameter_types! {
    pub MaxProposalWeight: Weight =
        Perbill::from_percent(50) * RuntimeBlockWeights::get().max_block;
}

impl pallet_collective::Config<CouncilCollective> for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeOrigin = RuntimeOrigin;
    type Proposal = RuntimeCall;
    type MotionDuration = ConstU32<5>;
    type MaxProposals = ConstU32<100>;
    type MaxMembers = ConstU32<10>;
    type DefaultVote = pallet_collective::PrimeDefaultVote;
    type WeightInfo = ();
    type SetMembersOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxProposalWeight = MaxProposalWeight;
    type DisapproveOrigin = frame_system::EnsureRoot<AccountId>;
    type KillOrigin = frame_system::EnsureRoot<AccountId>;
    type Consideration = ();
}

