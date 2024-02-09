import { test, expect } from 'vitest'
import { setupNetworks, withExpect, setupContext, testingPairs } from '@acala-network/chopsticks-testing'
import { ChopsticksProvider, setStorage, setup } from '@acala-network/chopsticks-core'
import { IdbDatabase } from '@acala-network/chopsticks-db/browser'
import { ApiPromise, WsProvider } from "@polkadot/api";

const { check, checkEvents, checkHrmp, checkSystemEvents, checkUmp } = withExpect((x) => ({
  toMatchSnapshot(msg) {
    expect(x).toMatchSnapshot(msg)
  },
  toMatch(value, _msg) {
    expect(x).toMatch(value)
  },
  toMatchObject(value, _msg) {
    expect(x).toMatchObject(value)
  },
}))


test('test', async () => {
   const { alice } = testingPairs()
   const endpoint = 'wss://paseo.rpc.amforc.com'
   const network = await setupContext({timeout: 600000, blockNumber:100,  db: "./db.sqlite", port: 0, endpoint  })

   let version = await network.api.rpc.state.getRuntimeVersion()
   console.log(version.toJSON().specVersion)
   let sudo_key =  await network.api.query.sudo.key();
   await network.dev.setStorage({
    Sudo: {
      key: alice.address
    },
    System: {
      account: [[[alice.address], { providers: 1, data: { free: 1000 * 1e12 } }]],
    },
   })
   await network.api.tx.sudo.sudo(network.api.tx.balances.forceSetBalance(alice.address, 1000000000000)).signAndSend(alice, (result) => console.log(result.txHash.toHuman()));
   await network.dev.newBlock()
 
   await checkSystemEvents(network, 'sudo')
   .redact({ address: true, number: true })
   .toMatchSnapshot()
}, 300000)