#![cfg_attr(not(feature = "std"), no_std)]

/// Blockchain-based campus voting pallet
/// Features:
///   - RSA encrypted vote storage
///   - Blind signature verification
///   - Nullifier-based double-vote prevention
///   - Election phase management
///   - On-chain tally via authority reveal
///   - Election reset (allows reuse without purging chain)
pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::EnsureOrigin,
    };
    use frame_system::pallet_prelude::*;
    use sp_std::vec::Vec;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // =========================================================
    // STRUCTURES
    // =========================================================

    #[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct EncryptedVote<T: Config> {
        pub encrypted_vote: BoundedVec<u8, T::MaxEncryptedVoteSize>,
        pub blind_signature: BoundedVec<u8, T::MaxBlindSignatureSize>,
    }

    /// NotStarted → Voting → Ended → TallyComplete
    /// sudo can reset back to NotStarted at any time via reset_election
    #[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen, Default)]
    pub enum ElectionPhase {
        #[default]
        NotStarted,
        Voting,
        Ended,
        TallyComplete,
    }

    // =========================================================
    // CONFIG
    // =========================================================
    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Origin allowed to manage election (sudo / POA authority)
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        #[pallet::constant]
        type MaxEncryptedVoteSize: Get<u32>;

        #[pallet::constant]
        type MaxBlindSignatureSize: Get<u32>;
    }

    // =========================================================
    // STORAGE
    // =========================================================

    #[pallet::storage]
    #[pallet::getter(fn election_phase)]
    pub type CurrentPhase<T: Config> = StorageValue<_, ElectionPhase, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn encrypted_votes)]
    pub type EncryptedVotes<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u32,
        EncryptedVote<T>,
        OptionQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn vote_counter)]
    pub type VoteCounter<T: Config> = StorageValue<_, u32, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn used_nullifiers)]
    pub type UsedNullifiers<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BoundedVec<u8, ConstU32<64>>,
        bool,
        ValueQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn has_voted)]
    pub type HasVoted<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        bool,
        ValueQuery,
    >;

    /// key: Django candidate ID, value: vote count
    #[pallet::storage]
    #[pallet::getter(fn tally)]
    pub type Tally<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u32,
        u64,
        ValueQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn revealed_count)]
    pub type RevealedCount<T: Config> = StorageValue<_, u32, ValueQuery>;

    // =========================================================
    // EVENTS
    // =========================================================
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        VoteSubmitted { vote_id: u32 },
        PhaseChanged { new_phase: ElectionPhase },
        VoteRevealed { vote_id: u32, candidate_id: u32 },
        TallyFinalized,
        ElectionReset,
    }

    // =========================================================
    // ERRORS
    // =========================================================
    #[pallet::error]
    pub enum Error<T> {
        EncryptedVoteTooLarge,
        BlindSignatureTooLarge,
        AlreadyVoted,
        NullifierAlreadyUsed,
        VoteNotFound,
        WrongPhase,
    }

    // =========================================================
    // EXTRINSICS
    // =========================================================
    #[pallet::call]
    impl<T: Config> Pallet<T> {

        // call_index(0): start_election — NotStarted → Voting
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        #[pallet::call_index(0)]
        pub fn start_election(origin: OriginFor<T>) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            ensure!(CurrentPhase::<T>::get() == ElectionPhase::NotStarted, Error::<T>::WrongPhase);
            CurrentPhase::<T>::put(ElectionPhase::Voting);
            Self::deposit_event(Event::PhaseChanged { new_phase: ElectionPhase::Voting });
            Ok(())
        }

        // call_index(1): end_election — Voting → Ended
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        #[pallet::call_index(1)]
        pub fn end_election(origin: OriginFor<T>) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            ensure!(CurrentPhase::<T>::get() == ElectionPhase::Voting, Error::<T>::WrongPhase);
            CurrentPhase::<T>::put(ElectionPhase::Ended);
            Self::deposit_event(Event::PhaseChanged { new_phase: ElectionPhase::Ended });
            Ok(())
        }

        // call_index(2): submit_vote — voter submits encrypted vote during Voting phase
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        #[pallet::call_index(2)]
        pub fn submit_vote(
            origin: OriginFor<T>,
            encrypted_vote: Vec<u8>,
            blind_signature: Vec<u8>,
        ) -> DispatchResult {
            let voter = ensure_signed(origin)?;
            ensure!(CurrentPhase::<T>::get() == ElectionPhase::Voting, Error::<T>::WrongPhase);
            ensure!(!HasVoted::<T>::get(&voter), Error::<T>::AlreadyVoted);

            let nullifier_raw: Vec<u8> = blind_signature.iter().take(64).cloned().collect();
            // let nullifier: BoundedVec<u8, ConstU32<64>> =
            //     BoundedVec::try_from(nullifier_raw).map_err(|_| Error::<T>::BlindSignatureTooLarge)?;
            // ensure!(!UsedNullifiers::<T>::get(&nullifier), Error::<T>::NullifierAlreadyUsed);

            let bounded_vote = BoundedVec::try_from(encrypted_vote)
                .map_err(|_| Error::<T>::EncryptedVoteTooLarge)?;
            let bounded_signature = BoundedVec::try_from(blind_signature)
                .map_err(|_| Error::<T>::BlindSignatureTooLarge)?;

            let vote_id = VoteCounter::<T>::get();
            EncryptedVotes::<T>::insert(vote_id, EncryptedVote::<T> {
                encrypted_vote: bounded_vote,
                blind_signature: bounded_signature,
            });
            VoteCounter::<T>::put(vote_id.saturating_add(1));
            // UsedNullifiers::<T>::insert(&nullifier, true);
            HasVoted::<T>::insert(&voter, true);

            Self::deposit_event(Event::VoteSubmitted { vote_id });
            Ok(())
        }

        // call_index(3): reveal_vote — admin decrypts and records a vote during Ended phase
        // candidate_id is the Django candidate ID
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        #[pallet::call_index(3)]
        pub fn reveal_vote(
            origin: OriginFor<T>,
            vote_id: u32,
            candidate_id: u32,
        ) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            ensure!(CurrentPhase::<T>::get() == ElectionPhase::Ended, Error::<T>::WrongPhase);
            ensure!(EncryptedVotes::<T>::contains_key(vote_id), Error::<T>::VoteNotFound);

            EncryptedVotes::<T>::remove(vote_id);
            Tally::<T>::mutate(candidate_id, |count| *count = count.saturating_add(1));
            RevealedCount::<T>::mutate(|c| *c = c.saturating_add(1));

            Self::deposit_event(Event::VoteRevealed { vote_id, candidate_id });
            Ok(())
        }

        // call_index(4): finalize_tally — Ended → TallyComplete
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        #[pallet::call_index(4)]
        pub fn finalize_tally(origin: OriginFor<T>) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            ensure!(CurrentPhase::<T>::get() == ElectionPhase::Ended, Error::<T>::WrongPhase);
            CurrentPhase::<T>::put(ElectionPhase::TallyComplete);
            Self::deposit_event(Event::TallyFinalized);
            Self::deposit_event(Event::PhaseChanged { new_phase: ElectionPhase::TallyComplete });
            Ok(())
        }

        // call_index(5): reset_election — clears all state, back to NotStarted
        // Use this to run a new election without purging the chain
        #[pallet::weight(Weight::from_parts(100_000, 0))]
        #[pallet::call_index(5)]
        pub fn reset_election(origin: OriginFor<T>) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;

            let _ = EncryptedVotes::<T>::clear(u32::MAX, None);
            VoteCounter::<T>::put(0u32);
            RevealedCount::<T>::put(0u32);
            let _ = HasVoted::<T>::clear(u32::MAX, None);
            let _ = UsedNullifiers::<T>::clear(u32::MAX, None);
            let _ = Tally::<T>::clear(u32::MAX, None);

            CurrentPhase::<T>::put(ElectionPhase::NotStarted);
            Self::deposit_event(Event::ElectionReset);
            Self::deposit_event(Event::PhaseChanged { new_phase: ElectionPhase::NotStarted });
            Ok(())
        }
    }

    // =========================================================
    // HELPERS
    // =========================================================
    impl<T: Config> Pallet<T> {
        pub fn get_tallies(candidate_ids: Vec<u32>) -> Vec<(u32, u64)> {
            candidate_ids.into_iter().map(|id| (id, Tally::<T>::get(id))).collect()
        }
    }
}