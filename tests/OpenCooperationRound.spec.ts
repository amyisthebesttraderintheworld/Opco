import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';
import {
    commitmentHash,
    OpenCooperationRound,
} from '../wrappers/OpenCooperationRound';
import { OpenCooperationRoundClient } from '../wrappers/OpenCooperationRoundClient';

describe('OpenCooperationRound', () => {
    let code: Cell;
    let blockchain: Blockchain;
    let round: SandboxContract<OpenCooperationRound>;
    let alice: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;

    beforeAll(async () => {
        code = await compile('OpenCooperationRound');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1_000;
        alice = await blockchain.treasury('alice');
        bob = await blockchain.treasury('bob');
        round = blockchain.openContract(
            OpenCooperationRound.createFromConfig({
                roundId: 1n,
                duration: 10,
                revealDuration: 10,
                stakeType: 'free',
                stakeAmount: 0n,
                startsAt: 1_000n,
            }, code),
        );

        const deployResult = await round.sendDeploy(alice.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: alice.address,
            to: round.address,
            deploy: true,
            success: true,
        });
    });

    it('keeps actions hidden until the reveal window and resolves aggregates', async () => {
        const cooperationSalt = 11n;
        const defectionSalt = 22n;

        await round.sendCommit(alice.getSender(), {
            commitment: commitmentHash(true, cooperationSalt),
            value: toNano('0.02'),
        });
        await round.sendCommit(bob.getSender(), {
            commitment: commitmentHash(false, defectionSalt),
            value: toNano('0.02'),
        });

        expect(await round.getRoundStats()).toMatchObject({
            participants: 2,
            cooperators: 0,
            defectors: 0,
            phase: 0,
        });

        blockchain.now = 1_011;
        await round.sendReveal(alice.getSender(), {
            action: true,
            salt: cooperationSalt,
            value: toNano('0.02'),
        });
        await round.sendReveal(bob.getSender(), {
            action: false,
            salt: defectionSalt,
            value: toNano('0.02'),
        });

        expect(await round.getRoundStats()).toMatchObject({
            participants: 2,
            cooperators: 1,
            defectors: 1,
            phase: 1,
        });

        blockchain.now = 1_021;
        const resolveResult = await round.sendResolve(alice.getSender(), { value: toNano('0.02') });
        expect(resolveResult.transactions).toHaveTransaction({
            from: alice.address,
            to: round.address,
            success: true,
        });
        expect((await round.getRoundStats()).phase).toBe(2);
    });

    it('sets a deterministic settlement outcome and prevents duplicate claims', async () => {
        const cooperationSalt = 11n;
        const defectionSalt = 22n;

        await round.sendCommit(alice.getSender(), {
            commitment: commitmentHash(true, cooperationSalt),
            value: toNano('0.02'),
        });
        await round.sendCommit(bob.getSender(), {
            commitment: commitmentHash(false, defectionSalt),
            value: toNano('0.02'),
        });

        blockchain.now = 1_011;
        await round.sendReveal(alice.getSender(), {
            action: true,
            salt: cooperationSalt,
            value: toNano('0.02'),
        });
        await round.sendReveal(bob.getSender(), {
            action: false,
            salt: defectionSalt,
            value: toNano('0.02'),
        });

        blockchain.now = 1_021;
        await round.sendResolve(alice.getSender(), { value: toNano('0.02') });

        expect((await round.getRoundStats()).settlement).toBe(0);

        const firstClaim = await round.sendClaim(alice.getSender(), { value: toNano('0.02') });
        expect(firstClaim.transactions).toHaveTransaction({
            from: alice.address,
            to: round.address,
            success: true,
        });

        const secondClaim = await round.sendClaim(alice.getSender(), { value: toNano('0.02') });
        expect(secondClaim.transactions).toHaveTransaction({
            from: alice.address,
            to: round.address,
            success: false,
        });
    });

    it('exposes a client facade for the protocol lifecycle', async () => {
        const client = OpenCooperationRoundClient.fromOpenedContract(round);

        expect(client.address.toString()).toBe(round.address.toString());
        expect(typeof client.deploy).toBe('function');
        expect(typeof client.commit).toBe('function');
        expect(typeof client.reveal).toBe('function');
        expect(typeof client.resolve).toBe('function');
        expect(typeof client.claim).toBe('function');
        expect(typeof client.getState).toBe('function');
    });
});