import AttribDashlet from './AttribDashlet';
import { IListEntry, IQBMSOptions, QBMSFunc, QBMSOperationType, QuickBMSError } from './types';

import { log, selectors, types, util } from 'vortex-api';

const attribGames = ['residentevil22019', 'devilmaycry5'];

// QBMS may take a while to complete its operations.
//  during this time users may switch between gameModes
//  resulting in them receiving notifications from QBMS
//  failures. We're going to use this boolean to suppress
//  error notification under these circumstances.
// TODO: this is a hack, this extension needs to be re-written
//  to function as a module rather than be event based.
let _GAMEMODE_SUPPORTED: boolean = false;

function showAttrib(state: types.IState) {
  const gameMode = selectors.activeGameId(state);

  return attribGames.indexOf(gameMode) !== -1;
}

function init(context: types.IExtensionContext) {
  context.registerDashlet('QBMS Support', 1, 2, 250, AttribDashlet,
    showAttrib, () => ({}), undefined);

  context.once(() => {
    context.api.events.on('gamemode-activated', (gameMode: string) => {
      _GAMEMODE_SUPPORTED = attribGames.indexOf(gameMode) !== -1;
    });
    context.api.events.on('quickbms-operation', (bmsScriptPath: string,
                                                 archivePath: string,
                                                 inPath: string,
                                                 opType: QBMSOperationType,
                                                 options: IQBMSOptions,
                                                 // tslint:disable-next-line: max-line-length
                                                 callback: (err: Error, data: IListEntry[]) => void) => {
      const state = context.api.store.getState();
      const activeGameId = selectors.activeGameId(state);
      if (attribGames.indexOf(activeGameId) === -1) {
        // Not a QBMS game.
        return callback(new util.ProcessCanceled('[QBMS] active game changed'), undefined);
      }

      const reportError = (err: Error) => {
        const errMessage = (err instanceof QuickBMSError)
          ? err.message + '\n\n' + (err as QuickBMSError).errorLines
          : err.message;
        if (_GAMEMODE_SUPPORTED) {
          log('error', 'qbms encountered an error', errMessage);
          callback(err, undefined);
        } else {
          log('info', 'qbms encountered an error', errMessage);
          callback(new util.ProcessCanceled('[QBMS] active game changed'), undefined);
        }
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
