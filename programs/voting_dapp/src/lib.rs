
use anchor_lang::prelude::*;

declare_id!("ASRHPNB2tzoimDMoJJTiZFChQjnqAEEx1bN98b9xoJaW");

#[program]
pub mod voting_dapp {
    use super::*;

    pub fn initialize_voting(
        ctx : Context<InitializeVoting>,
        id : [u8; 16],
        description: String,
        start: u64,
        end: u64
    )-> Result<()>{
        let voting_account = &mut ctx.accounts.voting;
        voting_account.id = id;
        voting_account.description = description;
        voting_account.start = start;
        voting_account.end = end;
        voting_account.total_votes = 0;
        Ok(())
    }


    pub fn initialize_candidate(
        ctx : Context<Candidate>,
        candidate_name: String,
        _voting_id: [u8; 16]
    )-> Result<()>{
        let candidate_account = &mut ctx.accounts.candidate;
        candidate_account.candidate_name = candidate_name;
        candidate_account.vote_count = 0;
        Ok(())
    }

   pub fn vote(
    ctx: Context<VoteContext>,
    candidate_name: String,
    voting_id: [u8; 16]
) -> Result<()> {
    let candidate = &mut ctx.accounts.candidate;
    let voting = &mut ctx.accounts.voting;
    let vote_record = &mut ctx.accounts.voting_account;
    if vote_record.has_voted == true{
        return Err(VotingError::VotingAlreadyDid.into());
    }
    if voting.start > Clock::get()?.unix_timestamp as u64 || voting.end < Clock::get()?.unix_timestamp as u64 {
        return Err(VotingError::VotingTimeOut.into());
    }

    if candidate.candidate_name != candidate_name {
        return Err(VotingError::CandidateNotFound.into());
    }

    if voting.id != voting_id {
        return Err(VotingError::VotingNotFound.into());
    }

    candidate.vote_count += 1;
    voting.total_votes += 1;
    vote_record.has_voted = true;

    Ok(())
}


}

#[derive(Accounts)]
#[instruction(id: [u8; 16])]
pub struct InitializeVoting<'info> {
    #[account(mut)]
    pub payer : Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Vote::INIT_SPACE, // Adjust space as needed for your data
        seeds = [b"voting", id.as_ref()],
        bump
    )]
    pub voting : Account<'info , Vote>,

    pub system_program: Program<'info, System>,
}


#[account]
#[derive(InitSpace)]
pub struct Vote{
    pub id : [u8; 16],
    #[max_len(280)]
    pub description: String,
    pub start : u64,
    pub end : u64,
    pub total_votes : u64
}


#[derive(Accounts)]
#[instruction(candidate_name: String, voting_id: [u8; 16])]
pub struct Candidate <'info> {
    #[account(mut)]
    pub payer : Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + CandidateInfo::INIT_SPACE, 
        seeds = [voting_id.as_ref(), candidate_name.as_bytes().as_ref()],
        bump
    )]
    pub candidate: Account<'info, CandidateInfo>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct CandidateInfo {
    #[max_len(50)]
    pub candidate_name: String,
    pub vote_count: u64, 
}



#[derive(Accounts)]
#[instruction(candidate_name :String,voting_id: [u8; 16])]
pub struct VoteContext<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [voting_id.as_ref(), candidate_name.as_bytes().as_ref()],
        bump
    )]
    pub candidate: Account<'info, CandidateInfo>,

    #[account(
        mut,
        seeds = [b"voting", voting_id.as_ref()],
        bump
    )]
    pub voting: Account<'info, Vote>,  // This is the Vote account data
    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"voting_inside", voting_id.as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub voting_account : Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub has_voted: bool
}


#[error_code]
pub enum VotingError {
    #[msg("Candidate not found")]
    CandidateNotFound,
    #[msg("Voting not found")]
    VotingNotFound,
    #[msg("Voting time out")]
    VotingTimeOut,
    #[msg("You have already voted")]
    VotingAlreadyDid,
}


