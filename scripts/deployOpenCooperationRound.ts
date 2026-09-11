import { toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { OpenCooperationRound } from '../wrappers/OpenCooperationRound';
import { OpenCooperationRoundClient } from '../wrappers/OpenCooperationRoundClient';
import { stakeConfigFromEnv } from '../wrappers/stake';

export async function run(provider: NetworkProvider) {
    const config = stakeConfigFromEnv(process.env);
    console.log('Deploying OpenCooperationRound with stake policy:', config.policy);

    const round = provider.open(
        OpenCooperationRound.createFromConfig(
            {
                roundId: config.roundId,
                duration: config.duration,
                revealDuration: config.revealDuration,
                stakeType: config.stakeType,
                stakeAmount: config.amount,
                startsAt: config.startsAt,
            },
            await compile('OpenCooperationRound'),
        ),
    );

    const client = OpenCooperationRoundClient.fromOpenedContract(round);
    await client.deploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(round.address);

    console.log('OpenCooperationRound deployed at', round.address.toString());
}
