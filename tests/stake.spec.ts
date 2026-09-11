import { describe, expect, it } from '@jest/globals';
import {
    createGrmAdapterConfig,
    createJettonAdapterConfig,
    createStakeAdapterRegistry,
    createUsdtAdapterConfig,
    getStakePolicy,
    normalizeStakeType,
    resolveExternalStakeAdapter,
    STAKE_TYPES,
} from '../wrappers/stake';

describe('stake adapter policy', () => {
    it('normalizes the supported stake types', () => {
        expect(normalizeStakeType('jeton')).toBe('jeton');
        expect(normalizeStakeType('USDT')).toBe('usdt');
        expect(STAKE_TYPES).toEqual(['free', 'jeton', 'grm', 'usdt']);
    });

    it('marks non-TON stakes as external-adapter-backed', () => {
        expect(getStakePolicy('free')).toMatchObject({
            requiresExternalAdapter: false,
            settlementMode: 'onchain-free',
            adapter: 'none',
        });

        expect(getStakePolicy('jeton')).toMatchObject({
            requiresExternalAdapter: true,
            settlementMode: 'jetton-wallet',
            adapter: 'jetton',
        });
    });

    it('requires explicit wallet metadata for external stake adapters', () => {
        expect(() => resolveExternalStakeAdapter('jeton')).toThrow('requires a walletAddress');

        expect(resolveExternalStakeAdapter('jeton', {
            walletAddress: 'EQTestWallet',
            amount: 42n,
        })).toMatchObject({
            kind: 'jeton',
            settlementMode: 'jetton-wallet',
            requiresWalletAddress: true,
            walletAddress: 'EQTestWallet',
            amount: 42n,
        });
    });

    it('builds the first concrete Jetton adapter config', () => {
        expect(createJettonAdapterConfig({
            walletAddress: 'EQJettonWallet',
            masterAddress: 'EQJettonMaster',
            amount: 100n,
        })).toMatchObject({
            kind: 'jeton',
            settlementMode: 'jetton-wallet',
            requiresWalletAddress: true,
            walletAddress: 'EQJettonWallet',
            masterAddress: 'EQJettonMaster',
            amount: 100n,
        });
    });

    it('supports the full external stake adapter registry for GRM and USDT', () => {
        const registry = createStakeAdapterRegistry();

        expect(registry.grm({
            walletAddress: 'EQGrmWallet',
            masterAddress: 'EQGrmMaster',
            amount: 200n,
        })).toMatchObject({
            kind: 'grm',
            settlementMode: 'grm-wallet',
            requiresWalletAddress: true,
            walletAddress: 'EQGrmWallet',
            masterAddress: 'EQGrmMaster',
            amount: 200n,
        });

        expect(createUsdtAdapterConfig({
            walletAddress: 'EQUsdtWallet',
            masterAddress: 'EQUsdtMaster',
            amount: 300n,
        })).toMatchObject({
            kind: 'usdt',
            settlementMode: 'usdt-wallet',
            requiresWalletAddress: true,
            walletAddress: 'EQUsdtWallet',
            masterAddress: 'EQUsdtMaster',
            amount: 300n,
        });
    });
});
