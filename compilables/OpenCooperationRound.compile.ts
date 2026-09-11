import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/OpenCooperationRound.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};