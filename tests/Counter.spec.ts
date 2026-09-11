import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import { Counter } from '../wrappers/Counter';
import '@ton/test-utils';

describe('Counter', () => {
    let code: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let counter: SandboxContract<Counter>;

    beforeAll(async () => {
        code = await compile('Counter');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        counter = blockchain.openContract(
            Counter.createFromConfig({ id: 0, counter: 0 }, code),
        );
        deployer = await blockchain.treasury('deployer');

        const deployResult = await counter.sendDeploy(deployer.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: counter.address,
            deploy: true,
            success: true,
        });
    });

    it('deploys with the configured state', async () => {
        expect(await counter.getId()).toBe(0);
        expect(await counter.getCounter()).toBe(0);
    });

    it('increases and resets the counter', async () => {
        const sender = await blockchain.treasury('sender');

        const increaseResult = await counter.sendIncrease(sender.getSender(), {
            increaseBy: 5,
            value: toNano('0.05'),
        });
        expect(increaseResult.transactions).toHaveTransaction({
            from: sender.address,
            to: counter.address,
            success: true,
        });
        expect(await counter.getCounter()).toBe(5);

        await counter.sendReset(sender.getSender(), { value: toNano('0.05') });
        expect(await counter.getCounter()).toBe(0);
    });
});
