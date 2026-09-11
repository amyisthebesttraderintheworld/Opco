import { Address, Sender } from '@ton/core';
import { OpenCooperationRound, RoundConfigSnapshot, RoundStatsSnapshot, CommitRequest, RevealRequest, ResolveRequest, ClaimRequest } from './OpenCooperationRound';

export type OpenCooperationRoundClientState = {
    config: RoundConfigSnapshot;
    stats: RoundStatsSnapshot;
};

type OpenedRoundContract = {
    address: Address;
    sendDeploy(via: Sender, value: bigint): Promise<unknown>;
    sendCommit(via: Sender, opts: CommitRequest): Promise<unknown>;
    sendReveal(via: Sender, opts: RevealRequest): Promise<unknown>;
    sendResolve(via: Sender, opts: ResolveRequest): Promise<unknown>;
    sendClaim(via: Sender, opts: ClaimRequest): Promise<unknown>;
    getRoundConfig(): Promise<RoundConfigSnapshot>;
    getRoundStats(): Promise<RoundStatsSnapshot>;
};

export class OpenCooperationRoundClient {
    readonly address: Address;

    constructor(private readonly contract: OpenedRoundContract | OpenCooperationRound) {
        this.address = contract.address;
    }

    static fromContract(contract: OpenCooperationRound): OpenCooperationRoundClient {
        return new OpenCooperationRoundClient(contract);
    }

    static fromOpenedContract(contract: OpenedRoundContract): OpenCooperationRoundClient {
        return new OpenCooperationRoundClient(contract);
    }

    static fromAddress(address: Address): OpenCooperationRoundClient {
        return new OpenCooperationRoundClient(OpenCooperationRound.createFromAddress(address));
    }

    async deploy(via: Sender, value: bigint): Promise<void> {
        const method = (this.contract as any).sendDeploy;
        if (method.length >= 3) {
            throw new Error('Raw contract instance requires a provider. Use fromOpenedContract(provider.open(...)).');
        }
        await method.call(this.contract, via, value);
    }

    async commit(via: Sender, opts: CommitRequest): Promise<void> {
        const method = (this.contract as any).sendCommit;
        if (method.length >= 3) {
            throw new Error('Raw contract instance requires a provider. Use fromOpenedContract(provider.open(...)).');
        }
        await method.call(this.contract, via, opts);
    }

    async reveal(via: Sender, opts: RevealRequest): Promise<void> {
        const method = (this.contract as any).sendReveal;
        if (method.length >= 3) {
            throw new Error('Raw contract instance requires a provider. Use fromOpenedContract(provider.open(...)).');
        }
        await method.call(this.contract, via, opts);
    }

    async resolve(via: Sender, opts: ResolveRequest): Promise<void> {
        const method = (this.contract as any).sendResolve;
        if (method.length >= 3) {
            throw new Error('Raw contract instance requires a provider. Use fromOpenedContract(provider.open(...)).');
        }
        await method.call(this.contract, via, opts);
    }

    async claim(via: Sender, opts: ClaimRequest): Promise<void> {
        const method = (this.contract as any).sendClaim;
        if (method.length >= 3) {
            throw new Error('Raw contract instance requires a provider. Use fromOpenedContract(provider.open(...)).');
        }
        await method.call(this.contract, via, opts);
    }

    async getState(): Promise<OpenCooperationRoundClientState> {
        const [config, stats] = await Promise.all([
            (this.contract as any).getRoundConfig.call(this.contract),
            (this.contract as any).getRoundStats.call(this.contract),
        ]);

        return { config, stats };
    }
}
