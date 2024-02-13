import { test, expect } from 'vitest'
import { setupNetworks, withExpect, setupContext, testingPairs } from '@acala-network/chopsticks-testing'
import { ChopsticksProvider, setStorage, setup } from '@acala-network/chopsticks-core'
import { IdbDatabase } from '@acala-network/chopsticks-db/browser'
import { ApiPromise, WsProvider } from "@polkadot/api";
import { formatNumber, hexToU8a, isHex, stringToU8, u8aToHex } from '@polkadot/util';
import { readFileSync } from 'fs';


const wasmRuntimePath ='./paseo_runtime.compact.compressed.wasm'; 



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

function getDispatchError(dispatchError) {
  let message = dispatchError.type;

  if (dispatchError.isModule) {
      try {
          const mod = dispatchError.asModule;
          const { name, docs } = dispatchError.registry.findMetaError(mod);
          return { name, docs }

      } catch {
          // swallow
      }
  } else if (dispatchError.isToken) {
      message = `${dispatchError.type}.${dispatchError.asToken.type}`;
  }
  console.log('message', message)
  return message;
}

export const parseSudoEvent = (data) => {
  const [dispatchInfo] = data;

  if (dispatchInfo.isErr) {
      const { name, docs } = getDispatchError(dispatchInfo.value)
      return { errorType: `${name}`, reason: docs };
  }

  return { ok: 'ok'}

}

const BYTE_STR_0 = '0'.charCodeAt(0);
const BYTE_STR_X = 'x'.charCodeAt(0);
const STR_NL = '\n';
const NOOP = () => undefined;

function convertResult (result) {
  const data = new Uint8Array(result);

  // this converts the input (if detected as hex), via the hex conversion route
  if (data[0] === BYTE_STR_0 && data[1] === BYTE_STR_X) {
    let hex = u8aToString(data);

    while (hex.endsWith(STR_NL)) {
      hex = hex.substring(0, hex.length - 1);
    }

    if (isHex(hex)) {
      return hexToU8a(hex);
    }
  }

  return data;
}

test('test', async () => {
   const { alice } = testingPairs()
   const code =  readFileSync(wasmRuntimePath);
   const c = u8aToHex(code)
   const endpoint = 'wss://paseo.rpc.amforc.com'
   const network = await setupContext({timeout: 600000,  db: "./db.sqlite", port: 0, endpoint  })

   let version = await network.api.rpc.state.getRuntimeVersion()
   console.log("Current Spec Version:", version.toJSON().specVersion)

   await network.dev.setStorage({
    Sudo: {
      key: alice.address
    },
    System: {
      account: [[[alice.address], { providers: 1, data: { free: 100 * 1e12 } }]],
    },
   })

 const unsub = await network.api.tx.sudo.sudo(
    network.api.tx.system.setCode(c))
    .signAndSend(
      alice,
      ({ events = [], status, txHash }) => {
        console.log(`Current status is ${status.type}`);

        if (status.isFinalized) {
          console.log(`Transaction included at blockHash ${status.asFinalized}`);
          console.log(`Transaction hash ${txHash.toHex()}`);

          // Loop through Vec<EventRecord> to display all events
          events.forEach(({ phase, event: { data, method, section }  }) => {
            console.log(`\t' ${phase}: ${section}.${method}:: ${data}`);
            if (method === "Sudid"){
            console.log( parseSudoEvent(data))
            }
          });
          unsub();
  }
});
  
await network.dev.newBlock()
 
   await checkSystemEvents(network, 'sudo')
   .redact({ address: true, number: true })
   .toMatchSnapshot()
}, 300000)