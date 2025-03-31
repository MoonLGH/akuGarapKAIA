import { doCheckSpins } from "warpslot-poc";
// this is the sig of the method with default params
// export const doCheckSpins = async ({
//     fids,
//     checkSpinInterval = 20000,
//     logWins = false,
//     doConsoleLog = false,
//     logFn = console.log
// }: {
//     fids: number[],
//     checkSpinInterval?: number,
//     logWins?: boolean,
//     doConsoleLog?: boolean,
//     logFn?: (...args: any[]) => void
// }): Promise<void>

    doCheckSpins({fids:[1037478], checkSpinInterval: 1000, logWins: true, doConsoleLog: true, logFn: console.log})