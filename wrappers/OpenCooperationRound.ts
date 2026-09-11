import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractABI,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
} from '@ton/core';

export type StakeType = 'free' | 'jeton' | 'grm' | 'usdt';
export type RoundPhase = 'queued' | 'committing' | 'revealing' | 'resolved' | 'claimed';

export type OpenCooperationRoundConfig = {
    roundId: bigint;
    duration: number;
    revealDuration: number;
    stakeType: StakeType;
    stakeAmount: bigint;
    startsAt: bigint;
};

export type RoundConfigSnapshot = {
    roundId: bigint;
    duration: number;
    revealDuration: number;
    stakeType: number;
    stakeAmount: bigint;
    startsAt: bigint;
    phase: number;
};

export type RoundStatsSnapshot = {
    participants: number;
    cooperators: number;
    defectors: number;
    phase: number;
    settlement: number;
};

export type CommitRequest = {
    commitment: bigint;
    value: bigint;
    queryId?: bigint;
};

export type RevealRequest = {
    action: boolean;
    salt: bigint;
    value: bigint;
    queryId?: bigint;
};

export type ResolveRequest = {
    value: bigint;
    queryId?: bigint;
};

export type ClaimRequest = {
    value: bigint;
    queryId?: bigint;
};

export interface OpenCooperationRoundProtocol {
    sendDeploy(provider: ContractProvider, via: Sender, value: bigint): Promise<void>;
    sendCommit(provider: ContractProvider, via: Sender, opts: CommitRequest): Promise<void>;
    sendReveal(provider: ContractProvider, via: Sender, opts: RevealRequest): Promise<void>;
    sendResolve(provider: ContractProvider, via: Sender, opts: ResolveRequest): Promise<void>;
    sendClaim(provider: ContractProvider, via: Sender, opts: ClaimRequest): Promise<void>;
    getRoundConfig(provider: ContractProvider): Promise<RoundConfigSnapshot>;
    getRoundStats(provider: ContractProvider): Promise<RoundStatsSnapshot>;
}

export const stakeTypeCode: Record<StakeType, number> = { free: 0, jeton: 1, grm: 2, usdt: 3 };

export function normalizeStakeType(value: string | StakeType): StakeType {
    const candidate = String(value).trim().toLowerCase();
    if (candidate in stakeTypeCode) {
        return candidate as StakeType;
    }
    throw new Error(`Unsupported stake type: ${value}. Supported values: free, jeton, grm, usdt.`);
}

export function getStakePolicy(stakeType: StakeType) {
    return {
        type: stakeType,
        requiresExternalAdapter: stakeType !== 'free',
        settlementMode: stakeType === 'free' ? 'onchain-free' : 'adapter-backed',
    };
}

export const RoundOpcodes = {
    commit: 0x6f70656e,
    reveal: 0x7265766c,
    resolve: 0x7265736f,
    claim: 0x636c616d,
};

export function commitmentHash(action: boolean, salt: bigint): bigint {
    const hash = beginCell().storeBit(action).storeUint(salt, 256).endCell().hash();
    return BigInt(`0x${hash.toString('hex')}`);
}

export function openCooperationRoundConfigToCell(config: OpenCooperationRoundConfig): Cell {
    return beginCell()
        .storeUint(config.roundId, 64)
        .storeUint(config.duration, 32)
        .storeUint(config.revealDuration, 32)
        .storeUint(stakeTypeCode[config.stakeType], 8)
        .storeCoins(config.stakeAmount)
        .storeUint(config.startsAt, 64)
        .storeUint(0, 8)
        .storeInt(0, 8)
        .storeDict(null)
        .storeDict(null)
        .storeDict(null)
        .storeUint(0, 32)
        .storeUint(0, 32)
        .storeUint(0, 32)
        .endCell();
}

export class OpenCooperationRound implements Contract, OpenCooperationRoundProtocol {
    abi: ContractABI = { name: 'OpenCooperationRound' };

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address): OpenCooperationRound {
        return new OpenCooperationRound(address);
    }

    static createFromConfig(config: OpenCooperationRoundConfig, code: Cell, workchain = 0) {
        const init = { code, data: openCooperationRoundConfigToCell(config) };
        return new OpenCooperationRound(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint): Promise<void> {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCommit(provider: ContractProvider, via: Sender, opts: CommitRequest): Promise<void> {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(RoundOpcodes.commit, 32).storeUint(opts.queryId ?? 0n, 64)
                .storeUint(opts.commitment, 256).endCell(),
        });
    }

    async sendReveal(provider: ContractProvider, via: Sender, opts: RevealRequest): Promise<void> {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(RoundOpcodes.reveal, 32).storeUint(opts.queryId ?? 0n, 64)
                .storeBit(opts.action).storeUint(opts.salt, 256).endCell(),
        });
    }

    async sendResolve(provider: ContractProvider, via: Sender, opts: ResolveRequest): Promise<void> {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(RoundOpcodes.resolve, 32).storeUint(opts.queryId ?? 0n, 64).endCell(),
        });
    }

    async sendClaim(provider: ContractProvider, via: Sender, opts: ClaimRequest): Promise<void> {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(RoundOpcodes.claim, 32).storeUint(opts.queryId ?? 0n, 64).endCell(),
        });
    }

    async getRoundConfig(provider: ContractProvider): Promise<RoundConfigSnapshot> {
        const result = await provider.get('roundConfig', []);
        return {
            roundId: result.stack.readBigNumber(),
            duration: result.stack.readNumber(),
            revealDuration: result.stack.readNumber(),
            stakeType: result.stack.readNumber(),
            stakeAmount: result.stack.readBigNumber(),
            startsAt: result.stack.readBigNumber(),
            phase: result.stack.readNumber(),
        };
    }

    async getRoundStats(provider: ContractProvider): Promise<RoundStatsSnapshot> {
        const result = await provider.get('roundStats', []);
        return {
            participants: result.stack.readNumber(),
            cooperators: result.stack.readNumber(),
            defectors: result.stack.readNumber(),
            phase: result.stack.readNumber(),
            settlement: result.stack.readNumber(),
        };
    }
}