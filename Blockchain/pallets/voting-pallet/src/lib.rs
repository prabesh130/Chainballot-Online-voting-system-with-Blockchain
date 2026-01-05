#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use sp_std::vec::Vec;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>>
            + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // Store candidate information
    #[pallet::storage]
    #[pallet::getter(fn candidates)]
    pub type Candidates<T: Config> = StorageMap<_, Blake2_128Concat, u32, Candidate, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn candidate_count)]
    pub type CandidateCount<T: Config> = StorageValue<_, u32, ValueQuery>;

    // Track who voted for whom
    #[pallet::storage]
    #[pallet::getter(fn votes)]
    pub type Votes<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u32, OptionQuery>;

    // Track vote counts per candidate
    #[pallet::storage]
    #[pallet::getter(fn vote_count)]
    pub type VoteCount<T: Config> = StorageMap<_, Blake2_128Concat, u32, u32, ValueQuery>;

    // Election status
    #[pallet::storage]
    #[pallet::getter(fn election_active)]
    pub type ElectionActive<T: Config> = StorageValue<_, bool, ValueQuery>;

    #[derive(Clone, Encode, Decode, Eq, PartialEq, Debug, TypeInfo, MaxEncodedLen)]
    pub struct Candidate {
        pub name: BoundedVec<u8, ConstU32<50>>,
        pub info: BoundedVec<u8, ConstU32<200>>,
        pub vote_count: u32,
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        CandidateRegistered { 
            candidate_id: u32, 
            name: Vec<u8> 
        },
        VoteCast { 
            voter: T::AccountId, 
            candidate_id: u32 
        },
        ElectionStarted,
        ElectionEnded,
        Winner { 
            candidate_id: u32, 
            votes: u32 
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        AlreadyVoted,
        CandidateNotFound,
        ElectionNotActive,
        ElectionAlreadyActive,
        NameTooLong,
        InfoTooLong,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Register a new candidate (admin only in production)
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn register_candidate(
            origin: OriginFor<T>,
            name: Vec<u8>,
            info: Vec<u8>,
        ) -> DispatchResult {
            let _who = ensure_signed(origin)?;

            let candidate_id = CandidateCount::<T>::get();

            let candidate = Candidate {
                name: name.clone().try_into().map_err(|_| Error::<T>::NameTooLong)?,
                info: info.try_into().map_err(|_| Error::<T>::InfoTooLong)?,
                vote_count: 0,
            };

            Candidates::<T>::insert(candidate_id, candidate);
            CandidateCount::<T>::put(candidate_id + 1);

            Self::deposit_event(Event::CandidateRegistered {
                candidate_id,
                name,
            });

            Ok(())
        }

        /// Cast a vote for a candidate
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn cast_vote(
            origin: OriginFor<T>,
            candidate_id: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Check if election is active
            ensure!(
                ElectionActive::<T>::get(),
                Error::<T>::ElectionNotActive
            );

            // Check if voter already voted
            ensure!(
                !Votes::<T>::contains_key(&who),
                Error::<T>::AlreadyVoted
            );

            // Check if candidate exists
            ensure!(
                Candidates::<T>::contains_key(candidate_id),
                Error::<T>::CandidateNotFound
            );

            // Record the vote
            Votes::<T>::insert(&who, candidate_id);

            // Increment vote count
            VoteCount::<T>::mutate(candidate_id, |count| {
                *count += 1;
            });

            // Update candidate vote count
            Candidates::<T>::mutate(candidate_id, |maybe_candidate| {
                if let Some(candidate) = maybe_candidate {
                    candidate.vote_count += 1;
                }
            });

            Self::deposit_event(Event::VoteCast {
                voter: who,
                candidate_id,
            });

            Ok(())
        }

        /// Start election (admin only)
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn start_election(origin: OriginFor<T>) -> DispatchResult {
            let _who = ensure_signed(origin)?;

            ensure!(
                !ElectionActive::<T>::get(),
                Error::<T>::ElectionAlreadyActive
            );

            ElectionActive::<T>::put(true);
            Self::deposit_event(Event::ElectionStarted);

            Ok(())
        }

        /// End election and announce winner (admin only)
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn end_election(origin: OriginFor<T>) -> DispatchResult {
            let _who = ensure_signed(origin)?;

            ensure!(
                ElectionActive::<T>::get(),
                Error::<T>::ElectionNotActive
            );

            ElectionActive::<T>::put(false);

            // Find winner (candidate with most votes)
            let mut max_votes = 0u32;
            let mut winner_id = 0u32;

            let candidate_count = CandidateCount::<T>::get();
            for id in 0..candidate_count {
                let votes = VoteCount::<T>::get(id);
                if votes > max_votes {
                    max_votes = votes;
                    winner_id = id;
                }
            }

            Self::deposit_event(Event::ElectionEnded);
            Self::deposit_event(Event::Winner {
                candidate_id: winner_id,
                votes: max_votes,
            });

            Ok(())
        }
    }
}