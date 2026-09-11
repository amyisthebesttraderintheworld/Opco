import { toNano } from '@ton/core';
import { AssetsSDK, createApi } from '@ton-community/assets-sdk';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    if (process.env.MINT_TESTNET_JETTONS !== 'true') {
        throw new Error('Set MINT_TESTNET_JETTONS=true to deploy OPCO and mock USDT on testnet.');
    }

    const sender = provider.sender();
    if (!sender.address) {
        throw new Error('The configured Blueprint sender has no address.');
    }

    const endpoint = process.env.TONRPC_ENDPOINT ?? 'https://testnet.toncenter.com/api/v2/jsonRPC';
    const api = await createApi('testnet');
    const sdk = AssetsSDK.create({
        api,
        sender,
    });

    const opco = await sdk.deployJetton({
        name: 'Open Cooperation',
        description: 'Game token for the Open Cooperation Experiment testnet.',
        symbol: 'OPCO',
        decimals: 9,
        amountStyle: 'n',
        renderType: 'game',
    }, {
        onchainContent: true,
        premintAmount: 1_000_000_000_000_000n,
        value: toNano('0.5'),
    });
    await provider.waitForDeploy(opco.address);

    const mockUsdt = await sdk.deployJetton({
        name: 'Open Cooperation Mock USDT',
        description: 'Testnet-only mock stablecoin for Open Cooperation adapter testing.',
        symbol: 'mUSDT',
        decimals: 6,
        amountStyle: 'n',
        renderType: 'currency',
    }, {
        onchainContent: true,
        premintAmount: 1_000_000_000_000n,
        value: toNano('0.5'),
    });
    await provider.waitForDeploy(mockUsdt.address);

    const opcoWallet = await (opco as any).getWalletAddress(provider, sender.address);
    const mockUsdtWallet = await (mockUsdt as any).getWalletAddress(provider, sender.address);

    console.log(JSON.stringify({
        network: 'testnet',
        rpc: endpoint,
        owner: sender.address.toString(),
        opco: { master: opco.address.toString(), wallet: opcoWallet.toString(), supply: '1000000', decimals: 9 },
        mockUsdt: { master: mockUsdt.address.toString(), wallet: mockUsdtWallet.toString(), supply: '1000000', decimals: 6 },
    }, null, 2));
}