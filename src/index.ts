import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import idl from "./idl/staking.json";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Staking } from "./idl/staking";
import assert from "assert"
import { splTokenProgram } from "@coral-xyz/spl-token"
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { program } from "commander";

const ONE_YEAR = new BN(3600 * 24 * 365);
const VESTING_PROGRAM_ID = new PublicKey("pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ")
const PYTH_TOKEN_ADDRESS = new PublicKey("HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3")

program
  .name("vesting_cli")
  .description("CLI for verifying vesting accounts")
  .version("1.0.0");

program.command("verify").description("Verify a vesting account given its position account address")
.requiredOption("-p, --position <pubkey>", "Position account address")
.requiredOption("-o --owner <pubkey>", "Expected owner")
.requiredOption("-b --balance <number>", "Expected balance")
.option("-u --url <string>", "RPC URL to use", "https://api.mainnet-beta.solana.com")
.action(async (options : any) => {
    const positionAccountAddress = new PublicKey(options.position);
    const owner = new PublicKey(options.owner);
    const balance = new BN(options.balance).mul(new BN(10).pow(new BN(6)));

    const provider = new AnchorProvider(new Connection(options.url), new NodeWallet(new Keypair()), AnchorProvider.defaultOptions());
    const tokenProgram = splTokenProgram({programId: TOKEN_PROGRAM_ID, provider })
    const stakingProgram = new Program<Staking>(idl as Staking, VESTING_PROGRAM_ID, provider);
    const positionAccountInfo = await stakingProgram.provider.connection.getAccountInfo(positionAccountAddress);
    assert(positionAccountInfo, "Position account info not found")
    assert(positionAccountInfo.owner.equals(VESTING_PROGRAM_ID), "Position account is not owned by the vesting program")

    const positionAccountData = await stakingProgram.account.positionData.fetch(positionAccountAddress);
    
    assert(positionAccountData, "Position account data not found")
    assert(positionAccountData.owner.equals(owner), "Position account owner field is not the expected one")

    const metadataAccountAddress = PublicKey.findProgramAddressSync([Buffer.from("stake_metadata"), positionAccountAddress.toBuffer()], VESTING_PROGRAM_ID)[0];
    const metadataAccountData = await stakingProgram.account.stakeAccountMetadataV2.fetch(metadataAccountAddress);

    assert(metadataAccountData, "Metadata account data not found");
    assert(metadataAccountData.owner.equals(owner), "Metadata account owner field is not the expected one")
    assert(metadataAccountData.lock.periodicVestingAfterListing, "Metadata account is not periodic vesting after listing")
    assert(metadataAccountData.lock.periodicVestingAfterListing.initialBalance.eq(balance), "Vesting schedule has the wrong initial balance")
    assert(metadataAccountData.lock.periodicVestingAfterListing.numPeriods.eq(new BN(4)), "Vesting schedule has the wrong number of periods")
    assert(metadataAccountData.lock.periodicVestingAfterListing.periodDuration.eq(ONE_YEAR), "Vesting schedule has the wrong period duration")


    const custodyAccountAddress = PublicKey.findProgramAddressSync([Buffer.from("custody"), positionAccountAddress.toBuffer()], VESTING_PROGRAM_ID)[0];
    const custodyAccountData = await tokenProgram.account.account.fetch(custodyAccountAddress);

    assert(custodyAccountData, "Custody account data not found");
    assert(custodyAccountData.mint.equals(PYTH_TOKEN_ADDRESS), "Custody account mint is not the expected one")
    assert(custodyAccountData.amount.eq(0), "This account has already received the tokens")

    console.log(`Succesfully verified vesting account : ${positionAccountAddress.toBase58()}`)
    console.log(`With owner ${owner.toBase58()} and balance ${options.balance} PYTH`)
    console.log(`Tokens must be sent to: ${custodyAccountAddress.toBase58()}`) 
});


program.parse();