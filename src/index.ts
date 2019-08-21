import AttribDashlet from './AttribDashlet';
import { IListEntry, IQBMSOptions, QBMSFunc, QBMSOperationType } from './types';

import { log, selectors, types } from 'vortex-api';

const supportedGames = ['residentevil22019', 'devilmaycry5'];

function isSupported(state: types.IState) {
  const gameMode = selectors.activeGameId(state);

  return supportedGames.indexOf(gameMode) !== -1;
}

function init(context: types.IExtensionContext) {
  context.registerDashlet('QBMS Support', 1, 2, 250, AttribDashlet,
    isSupported, () => ({}), undefined);

  context.once(() => {
    context.api.onAsync('quickbms-operation', (gameId: string,
                                               bmsScriptPath: string,
                                               archivePath: string,
                                               inPath: string,
                                               opType: QBMSOperationType,
                                               options: IQBMSOptions,
                                               callback: (data: Error | IListEntry[]) => void) => {
      const reportError = (err: Error) => {
        log('error', 'qbms encountered an error', err.message);
        callback(err);
      };

      if (supportedGames.indexOf(gameId) !== -1) {
        const qbms = require('./quickbms');
        let qbmsFunc: QBMSFunc;
        switch (opType) {
          case 'extract':
            qbmsFunc = qbms.extract;
            break;
          case 'reimport':
            qbmsFunc = qbms.reImport;
            break;
          case 'write':
            qbmsFunc = qbms.write;
            break;
          case 'list':
          default:
            return qbms.list(archivePath, bmsScriptPath, inPath, options)
              .then(listEntries => callback(listEntries))
              .catch(err => reportError(err));
        }
        return qbmsFunc(archivePath, bmsScriptPath, inPath, options)
          .catch(err => reportError(err));
      }
    });
  });

  return true;
}

export default init;
