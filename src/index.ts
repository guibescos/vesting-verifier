import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import idl from "./idl/staking.json";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Staking } from "./idl/staking";
import assert from "assert"
import { splTokenProgram } from "@coral-xyz/spl-token"
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { program } from "commander";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const ONE_YEAR = new BN(3600 * 24 * 365);
const VESTING_PROGRAM_ID = new PublicKey("pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ")
const PYTH_TOKEN_ADDRESS = new PublicKey("HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3")

program
  .name("vesting_cli")
  .description("CLI for verifying vesting accounts")
  .version("1.0.0");

program.command("verify").description("Verify a vesting account given its position account address")
.requiredOption("-o --owner <pubkey>", "Expected owner")
.requiredOption("-b --balance <number>", "Expected balance")
.option("-u --url <string>", "RPC URL to use", "https://mainnet.helius-rpc.com/?api-key=10f312e5-47b7-41b3-8bd1-8aa2f6a6b948")
.action(async (options : any) => {
    const owner = new PublicKey(options.owner);
    const balance = new BN(removeCommas(options.balance)).mul(new BN(10).pow(new BN(6)));
    
    const provider = new AnchorProvider(new Connection(options.url), new NodeWallet(new Keypair()), AnchorProvider.defaultOptions());
    const positionAccountAddress = await getMainPositionsAccount(provider.connection,owner)
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
    assert(metadataAccountData.lock.periodicVestingAfterListing.numPeriods.eq(new BN(4)), "Vesting schedule has the wrong number of periods")
    assert(metadataAccountData.lock.periodicVestingAfterListing.periodDuration.eq(ONE_YEAR), "Vesting schedule has the wrong period duration")


    const custodyAccountAddress = PublicKey.findProgramAddressSync([Buffer.from("custody"), positionAccountAddress.toBuffer()], VESTING_PROGRAM_ID)[0];
    const custodyAccountData = await tokenProgram.account.account.fetch(custodyAccountAddress);

    assert(custodyAccountData, "Custody account data not found");
    assert(custodyAccountData.mint.equals(PYTH_TOKEN_ADDRESS), "Custody account mint is not the expected one")

    const targetBalance = metadataAccountData.lock.periodicVestingAfterListing.initialBalance;    

    if(!targetBalance.eq(balance)){
      console.log(`❌ Specified balance does not match with smart contract balance: contract ${addCommas(targetBalance.div(new BN(10).pow(new BN(6))).toString())} vs specified ${addCommas(options.balance.toString())}`);
      return;
    }

    console.log(`Succesfully verified vesting account`)
    console.log(`for owner ${owner.toBase58()} and balance ${addCommas(options.balance)} PYTH`)
    console.log(`The custody token account is ${custodyAccountAddress.toBase58()}`)
    if (custodyAccountData.amount.eq(new BN(0))){
      console.log(`✅ Please send ${addCommas(options.balance)} PYTH Tokens to \x1b[32m${custodyAccountAddress.toBase58()}`); 
    } else if (custodyAccountData.amount.eq(targetBalance)) {
      console.log(`✅ This account has already received the tokens, not further action required`); 
    } else if (custodyAccountData.amount.gt(targetBalance)){
      console.log(`❌ This account has received ${custodyAccountData.amount.sub(targetBalance).div(new BN(10).pow(new BN(6))).toString()} tokens more than expected`); 
    } else if (custodyAccountData.amount.lt(targetBalance)){
      console.log(`✅ This account hasn't received the totality of their tokens. Please send ${addCommas(targetBalance.sub(custodyAccountData.amount).div(new BN(10).pow(new BN(6))).toString())} PYTH Tokens to \x1b[32m${custodyAccountAddress.toBase58()}`); 
    }
});


async function getMainPositionsAccount(connection : Connection, owner : PublicKey){
  const response = await connection.getProgramAccounts(
    VESTING_PROGRAM_ID,
    {
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset : 0,
            bytes : bs58.encode(Buffer.from("55c3f14f7cc04f0b", "hex"))
          },
        },
        {
          memcmp: {
            offset: 8,
            bytes: owner.toBase58(),
          },
        },
      ],
    }
  );
  assert(response.length === 1, "Positions account not found");
  return response[0].pubkey;
}

const addCommas = (x: string) => {
  return x.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const removeCommas = (x: string) => {
  return x.replace(/,/g, "");
}

program.parse();