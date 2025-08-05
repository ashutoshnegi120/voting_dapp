import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VotingDapp } from "../target/types/voting_dapp";
import { assert, expect } from "chai";

describe("voting_dapp", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VotingDapp as Program<VotingDapp>;

  it("Initializes the voting account!", async () => {
    // Must be 16-byte ID
    const id = new Uint8Array(16);
    const text = "poll-2025-01";
    id.set(anchor.utils.bytes.utf8.encode(text));

    // Derive PDA with same seeds as in Rust: [b"voting", id.as_ref()]
    const [votingPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("voting"), Buffer.from(id)],
      program.programId
    );
    const now = Math.floor(Date.now() / 1000);
    await program.methods
      .initializeVoting(
        Array.from(id),                    
        "Who is best dev?",          
        new anchor.BN(now),                
        new anchor.BN(now + 600)               
      )
      .accounts({
        payer: provider.wallet.publicKey,
        voting: votingPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const voteAccount = await program.account.vote.fetch(votingPda);
    console.log("Vote Account:", voteAccount);
    assert.ok(voteAccount.totalVotes.toNumber() === 0);
    console.log("Voting account initialized ✅");

    expect(voteAccount.description).to.equal("Who is best dev?");
    expect(voteAccount.totalVotes.toNumber()).to.equal(0);
    expect(voteAccount.start.toNumber()).to.be.lessThanOrEqual(voteAccount.end.toNumber());
  });

  it("Initializes candidates", async () => {
    const candidate1 = "me";
    const candidate2 = "you";
    const id = new Uint8Array(16);
    const text = "poll-2025-01";
    id.set(anchor.utils.bytes.utf8.encode(text));

    const [candidatePda1] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(id), Buffer.from(candidate1)],
      program.programId
    );

    await program.methods.initializeCandidate(
      candidate1,
      Array.from(id)
    ).accounts({
      payer: provider.wallet.publicKey,
      voting: candidatePda1,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    const candidateAccount1 = await program.account.candidateInfo.fetch(candidatePda1);
    console.log("Candidate 1 Account:", candidateAccount1);
    expect(candidateAccount1.candidateName).to.equal(candidate1);
    expect(candidateAccount1.voteCount.toNumber()).to.equal(0);
    console.log("Candidate 1 initialized ✅");
    const [candidatePda2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(id), Buffer.from(candidate2)],
      program.programId
    );
    await program.methods.initializeCandidate(
      candidate2,
      Array.from(id)
    ).accounts({
      payer: provider.wallet.publicKey,
      voting: candidatePda2,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    const candidateAccount2 = await program.account.candidateInfo.fetch(candidatePda2);
    console.log("Candidate 2 Account:", candidateAccount2);
    expect(candidateAccount2.candidateName).to.equal(candidate2);
    expect(candidateAccount2.voteCount.toNumber()).to.equal(0);
    console.log("Candidate 2 initialized ✅");


  });

 it("Prevents double voting in the same poll", async () => {
  const id = new Uint8Array(16);
  const text = "poll-2025-01";
  const candidate = "me";
  const candidate2 = "you";
  id.set(anchor.utils.bytes.utf8.encode(text));

  const [votingPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("voting"), Buffer.from(id)],
    program.programId
  );

  const [voteRecordPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("voting_inside"), Buffer.from(id), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  const [candidatePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(id), Buffer.from(candidate)],
    program.programId
  );

  const [candidatePda2] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(id), Buffer.from(candidate2)],
    program.programId
  );

  // First vote
  await program.methods.vote(candidate, Array.from(id)).accounts({
    voter: provider.wallet.publicKey,
    candidate: candidatePda, // ✅ same candidate PDA
    voting: votingPda,
    voting_account: voteRecordPda,
    systemProgram: anchor.web3.SystemProgram.programId,
  }).rpc();
  console.log("First vote cast ✅");
  const voteRecord1 = await program.account.voteRecord.fetch(voteRecordPda);
  expect(voteRecord1.hasVoted).to.be.true;
  const candidateAccount1 = await program.account.candidateInfo.fetch(candidatePda);
  expect(candidateAccount1.voteCount.toNumber()).to.equal(1);
  console.log("Candidate 1 vote count:", candidateAccount1.voteCount.toNumber());
  const votingAccount = await program.account.vote.fetch(votingPda);
  expect(votingAccount.totalVotes.toNumber()).to.equal(1);
  console.log("Total votes in voting account:", votingAccount.totalVotes.toNumber());

  // Attempt to vote again with the same voter and candidate
  let errorThrown = false;
  try {
    await program.methods.vote(candidate, Array.from(id)).accounts({
      voter: provider.wallet.publicKey,
      candidate: candidatePda2,
      voting: votingPda,
      voting_account: voteRecordPda,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();
  } catch (err) {
    console.log("Expected error:", err.error.errorMessage);
    errorThrown = true;
    expect(err.error.errorCode.code).to.equal("ConstraintSeeds"); // if you defined it
  }

  expect(errorThrown).to.be.true;
});



});
