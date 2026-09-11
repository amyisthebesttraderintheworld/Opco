export type StakeType = 'free' | 'jeton' | 'grm' | 'usdt';
export type ExternalSettlementMode = 'onchain-free' | 'jetton-wallet' | 'grm-wallet' | 'usdt-wallet';

export interface StakePolicy {
    type: StakeType;
    requiresExternalAdapter: boolean;
    settlementMode: ExternalSettlementMode;
    adapter: 'none' | 'jetton' | 'grm' | 'usdt';
}

export interface ExternalStakeAdapterConfig {
    kind: StakeType;
    settlementMode: ExternalSettlementMode;
    requiresWalletAddress: boolean;
    walletAddress?: string;
    masterAddress?: string;
    amount: bigint;
}

export const stakeTypeCode: Record<StakeType, number> = { free: 0, jeton: 1, grm: 2, usdt: 3 };
export const STAKE_TYPES: StakeType[] = ['free', 'jeton', 'grm', 'usdt'];

export function normalizeStakeType(value: string | StakeType): StakeType {
    const candidate = String(value).trim().toLowerCase();
    if (candidate === 'free' || candidate === 'jeton' || candidate === 'grm' || candidate === 'usdt') {
        return candidate as StakeType;
    }
    throw new Error(`Unsupported stake type: ${value}. Supported values: free, jeton, grm, usdt.`);
}

export function getStakePolicy(stakeType: StakeType): StakePolicy {
    switch (stakeType) {
        case 'free':
            return {
                type: 'free',
                requiresExternalAdapter: false,
                settlementMode: 'onchain-free',
                adapter: 'none',
            };
        case 'jeton':
            return {
                type: 'jeton',
                requiresExternalAdapter: true,
                settlementMode: 'jetton-wallet',
                adapter: 'jetton',
            };
        case 'grm':
            return {
                type: 'grm',
                requiresExternalAdapter: true,
                settlementMode: 'grm-wallet',
                adapter: 'grm',
            };
        case 'usdt':
            return {
                type: 'usdt',
                requiresExternalAdapter: true,
                settlementMode: 'usdt-wallet',
                adapter: 'usdt',
            };
    }
}

export function resolveExternalStakeAdapter(
    stakeType: StakeType,
    opts: {
        walletAddress?: string;
        masterAddress?: string;
        amount?: bigint;
    } = {},
): ExternalStakeAdapterConfig {
    const policy = getStakePolicy(stakeType);

    if (!policy.requiresExternalAdapter) {
        return {
            kind: stakeType,
            settlementMode: policy.settlementMode,
            requiresWalletAddress: false,
            amount: opts.amount ?? 0n,
        };
    }

    if (!opts.walletAddress) {
        throw new Error(`${stakeType} stake requires a walletAddress for the external adapter.`);
    }

    return {
        kind: stakeType,
        settlementMode: policy.settlementMode,
        requiresWalletAddress: true,
        walletAddress: opts.walletAddress,
        masterAddress: opts.masterAddress,
        amount: opts.amount ?? 0n,
    };
}

export function createJettonAdapterConfig(opts: {
    walletAddress: string;
    masterAddress?: string;
    amount?: bigint;
}): ExternalStakeAdapterConfig {
    return resolveExternalStakeAdapter('jeton', opts);
}

export function createGrmAdapterConfig(opts: {
    walletAddress: string;
    masterAddress?: string;
    amount?: bigint;
}): ExternalStakeAdapterConfig {
    return resolveExternalStakeAdapter('grm', opts);
}

export function createUsdtAdapterConfig(opts: {
    walletAddress: string;
    masterAddress?: string;
    amount?: bigint;
}): ExternalStakeAdapterConfig {
    return resolveExternalStakeAdapter('usdt', opts);
}

export function createStakeAdapterRegistry() {
    return {
        free: () => ({ kind: 'free', settlementMode: 'onchain-free', requiresWalletAddress: false, amount: 0n }),
        jeton: createJettonAdapterConfig,
        grm: createGrmAdapterConfig,
        usdt: createUsdtAdapterConfig,
    } as const;
}

export function stakeConfigFromEnv(env: NodeJS.ProcessEnv = process.env) {
    const stakeType = normalizeStakeType(env.ROUND_STAKE_TYPE ?? 'free');
    return {
        stakeType,
        policy: getStakePolicy(stakeType),
        amount: BigInt(env.ROUND_STAKE_AMOUNT ?? '0'),
        duration: Number(env.ROUND_DURATION ?? String(60 * 60)),
        revealDuration: Number(env.ROUND_REVEAL_DURATION ?? String(60 * 10)),
        roundId: BigInt(env.ROUND_ID ?? '1'),
        startsAt: BigInt(env.ROUND_STARTS_AT ?? String(Math.floor(Date.now() / 1000))),
    };
}
