import * as Promise from 'bluebird';
import AttribDashlet from './AttribDashlet';
import QuickBMSWrapper from './QuickBMSWrapper';
import { IListEntry, IQBMSOptions, QBMSFunc, QBMSOperationType } from './types';

import { selectors, types, util } from 'vortex-api';

const supportedGames = ['residentevil22019', 'devilmaycry5'];

function isSupported(state: types.IState) {
  const gameMode = selectors.activeGameId(state);

  return supportedGames.indexOf(gameMode) !== -1;
}

class QuickBMSSingleton {
  public static instance(): QuickBMSWrapper {
    if ((global as any).__quickbms === undefined) {
      (global as any).__quickbms = new QuickBMSWrapper();
    }
    return (global as any).__quickbms;
  }
}

function init(context: types.IExtensionContext) {
  context.registerDashlet('PAK Support', 1, 2, 250, AttribDashlet,
    isSupported, () => ({}), undefined);

  context.once(() => {
    context.api.onAsync('quickbms-operation', (gameId: string,
                                               bmsScriptPath: string,
                                               archivePath: string,
                                               inPath: string,
                                               opType: QBMSOperationType,
                                               options: IQBMSOptions,
                                               parseEntries?: (entries: IListEntry[]) => void) => {
      if (supportedGames.indexOf(gameId) !== -1) {
        const quickbms = QuickBMSSingleton.instance();
        let qbmsFunc: QBMSFunc;
        switch (opType) {
          case 'extract':
            qbmsFunc = quickbms.extract;
            break;
          case 'reimport':
            qbmsFunc = quickbms.reImport;
            break;
          case 'write':
            qbmsFunc = quickbms.write;
            break;
          case 'list':
          default:
            return (!!parseEntries)
              ? quickbms.list(archivePath, bmsScriptPath, inPath, options)
                .then(listEntries => parseEntries(listEntries))
              : Promise.reject(new Error('parseEntries callback is undefined'));
        }
        return qbmsFunc(archivePath, bmsScriptPath, inPath, options);
      }
    });
  });

  return true;
}

export default init;
