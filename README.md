## Getting started

### Install packages
```
npm install
```

### Verify a vesting account (only relevant for locked tokens)

To verify a vesting account for someone has been setup properly you need 2 things : 
- The expected owner (the public key you expect to be the beneficiary of the account).
- The expected balance (the balance you expect the owner to be entitled to).

Run the following command from the root directory: 
```
npm run cli verify -- -o ${EXPECTED_OWNER_PUBKEY} -b ${EXPECTED_BALANCE}
```

If successful the output will be something like this: 

```
npm run cli verify -- -o ADBD8FKZXbHLTbJqJYNYPkiKqZp9AXg9EFU43oxZKeD2 -b 600,000,000

Succesfully verified vesting account
for owner ADBD8FKZXbHLTbJqJYNYPkiKqZp9AXg9EFU43oxZKeD2 and balance 600,000,000 PYTH
The custody token account is 61YcP8msC5F3ZTLy99VWM2oom6y47UzNmSQQdXMmdCG1
✅ This account has already received the tokens, not further action required
```

You can then transfer the tokens to the address printed in bright green.