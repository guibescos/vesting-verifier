## Getting started

### Install packages
```
npm install
```

### Verify a vesting account (only relevant for locked tokens)
```
npm run cli verify -p ${POSITION_ACCOUNT} -o ${EXPECTED_OWNER_PUBKEY} -b ${EXPECTED_BALANCE}
```

If successful the output will be something like this : 

```
Succesfully verified vesting account : J2i217izZR97ZfxF9uKdFFx2VaUmRiV1Dv3rQ3njaZFe
With owner BTwXQZS3EzfxBkv2A54estmn9YbmcpmRWeFP4f3avLi4 and balance 1 PYTH
Tokens must be sent to: 5rc39nNUqWAKHZvLVkUg5zovJtMyeA7fiCcqKHpkgSnh
```