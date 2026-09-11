import { toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { Counter } from '../wrappers/Counter';

export async function run(provider: NetworkProvider) {
    const counter = provider.open(
        Counter.createFromConfig(
            {
                id: Math.floor(Math.random() * 10000),
                counter: 0,
            },
            await compile('Counter'),
        ),
    );

    await counter.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(counter.address);

    console.log('Counter deployed at', counter.address.toString());
}
