import AttribDashlet from './AttribDashlet';
import { IListEntry, IQBMSOptions, QBMSFunc, QBMSOperationType } from './types';

import { log, selectors, types } from 'vortex-api';

const attribGames = ['residentevil22019', 'devilmaycry5'];

function showAttrib(state: types.IState) {
  const gameMode = selectors.activeGameId(state);

  return attribGames.indexOf(gameMode) !== -1;
}

function init(context: types.IExtensionContext) {
  context.registerDashlet('QBMS Support', 1, 2, 250, AttribDashlet,
    showAttrib, () => ({}), undefined);

  context.once(() => {
    context.api.events.on('quickbms-operation', (bmsScriptPath: string,
                                                 archivePath: string,
                                                 inPath: string,
                                                 opType: QBMSOperationType,
                                                 options: IQBMSOptions,
                                                 // tslint:disable-next-line: max-line-length
                                                 callback: (err: Error, data: IListEntry[]) => void) => {
      const reportError = (err: Error) => {
        log('error', 'qbms encountered an error', err.message);
        callback(err, undefined);
      };

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
            .then(listEntries => callback(undefined, listEntries))
            .catch(err => reportError(err));
      }
      return qbmsFunc(archivePath, bmsScriptPath, inPath, options)
        .then(() => callback(undefined, undefined)) // All went well.
        .catch(err => reportError(err));
    });
  });

  return true;
}

export default init;
