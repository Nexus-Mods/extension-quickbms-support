import { IListEntry, IQBMSOptions } from './types';

import * as Promise from 'bluebird';
import { spawn } from 'child_process';
import * as path from 'path';

import { app, remote } from 'electron';
import { fs, util } from 'vortex-api';

const uniApp = app || remote.app;

const FILTER_FILE_PATH = path.join(uniApp.getPath('userData'), 'temp', 'qbms', 'filters.txt');
const LOG_FILE_PATH = path.join(uniApp.getPath('userData'), 'quickbms.log');

const QUICK_BMS_ERRORMSG = [
  'success', // 0
  'encountered an unknown error', // 1
  'unable to allocate memory, memory errors', // 2
  'missing input file', // 3
  'unable to write output file', // 4
  'file compression error (Review BMS script)', // 5
  'file encryption error (Review BMS script)', // 6
  'external dll file has reported an error', // 7
  'BMS script syntax error', // 8
  'invalid quickbms arguments provided', // 9
  'error accessing input/output folder', // 10
  'user/external application has terminated quickBMS', // 11
  'extra IO error', // 12
  'failed to update quickbms', // 13
];

function quote(input: string): string {
  return '"' + input + '"';
}

function parseList(input: string, wildCards: string[]): IListEntry[] {
  const res: IListEntry[] = [];
  const lines = input.split('\n');
  const filtered = lines.filter(line =>
    wildCards.find(file => (line.indexOf('- filter') === -1)
      && (line.indexOf(file) !== -1)) !== undefined);
  filtered.forEach(line => {
    const arr = line.trim().split(' ').filter(entry => !!entry);
    if (arr.length !== 3) {
      return;
    }
    const [ offset, size, filePath ] = arr;
    res.push({ offset, size, filePath });
  });
  return res;
}

function validateArguments(archivePath: string, bmsScriptPath: string,
                           outPath: string, options: IQBMSOptions): Promise<void> {
  if (path.extname(bmsScriptPath) !== '.bms') {
    // Invalid argument - we were expecting a bms script.
    return Promise.reject(new util.ArgumentInvalid('bmsScriptPath'));
  }
  if (!path.isAbsolute(archivePath)) {
    // The archive's absolute path should've been provided.
    return Promise.reject(new util.ArgumentInvalid('archivePath'));
  }
  if (!path.isAbsolute(outPath)) {
    // outPath must be a directory and point towards an absolute path.
    return Promise.reject(new util.ArgumentInvalid('outPath'));
  }

  return Promise.resolve();
}

function run(command: string, parameters: string[], options: IQBMSOptions): Promise<void> {
  let wstream;
  const createLog = (!!options.createLog || (command === 'l'));
  if (createLog) {
    wstream = fs.createWriteStream(LOG_FILE_PATH);
  }

  return new Promise<void>((resolve, reject) => {
    let args = [
      (!!command) ? ' -' + command : undefined,
      (!!options.allowResize)
        ? (!options.allowResize)
          ? '-r'
          : '-r -r'
        : undefined,
      (!!options.quiet) ? '-q' : undefined,
      (!!options.overwrite) ? '-o' : undefined,
      (!!options.caseSensitive) ? '-I' : undefined,
      (!!options.keepTemporaryFiles) ? '-T' : undefined,
      (!!options.wildCards) ? '-f ' + quote(FILTER_FILE_PATH) : undefined,
    ];

    args = args.filter(arg => arg !== undefined).concat(parameters);

    // const theCommand = path.join(__dirname, 'quickbms_4gb_files.exe') + args.join(' ');
    const process = spawn(quote(path.join(__dirname, 'quickbms_4gb_files.exe')),
    args, {
      shell: true,
    });

    const stdOutLines = [];
    const stdErrLines = [];

    process.on('error', (err) => {
      if (createLog) {
        wstream.close();
      }
      return reject(err);
    });

    process.on('close', (code) => {
      if (createLog) {
        wstream.close();
      }

      if (code !== 0) {
        const errorMsg = (code > QUICK_BMS_ERRORMSG.length - 1)
          ? QUICK_BMS_ERRORMSG[1]
          : QUICK_BMS_ERRORMSG[code];
        return reject(new Error(`quickbms(${code}) - ` + errorMsg));
      }

      const hasErrors = stdErrLines.find(line =>
        line.indexOf('Error:') !== -1) !== undefined;
      if (hasErrors) {
        return reject(new Error(stdErrLines.join('\n')));
      }
      return resolve();
    });

    process.stdout.on('data', data => {
      const formatted = data.toString().split('\n');
      formatted.forEach(line => {
        const formattedLine = line.replace(/\\/g, '/');
        stdOutLines.push(formattedLine);
        if (createLog) {
          wstream.write(formattedLine + '\n');
        }
      });
    });

    process.stderr.on('data', data => {
      const formatted = data.toString().split('\n');
      formatted.forEach(line => {
        stdErrLines.push(line);
      });
    });
  });
}

function createFiltersFile(wildCards: string[]): Promise<void> {
  return fs.ensureDirAsync(path.dirname(FILTER_FILE_PATH))
    .then(() => fs.writeFileAsync(FILTER_FILE_PATH, wildCards.join('\n'))
    .then(() => Promise.resolve())
    .catch(err => Promise.reject(err)));
}

function removeFiltersFile(): Promise<void> {
  return fs.statAsync(FILTER_FILE_PATH)
    .then(() => fs.removeAsync(FILTER_FILE_PATH))
    .catch(err => (err.code === 'ENOENT')
      ? Promise.resolve()
      : Promise.reject(err));
}

function reImport(archivePath: string, bmsScriptPath: string,
                  inPath: string, options: IQBMSOptions): Promise<void> {
  return validateArguments(archivePath, bmsScriptPath, inPath, options)
    .then(() => (!!options.wildCards)
      ? createFiltersFile(options.wildCards)
      : Promise.resolve())
    .then(() => (!!options.allowResize)
      ? Promise.resolve()
      : Promise.reject(new util.ArgumentInvalid('Re-import version was not specified')))
    .then(() => run('w',
      [ quote(bmsScriptPath), quote(archivePath), quote(inPath) ], options))
    .then(() => removeFiltersFile());
}

function extract(archivePath: string, bmsScriptPath: string,
                 outPath: string, options: IQBMSOptions): Promise<void> {
  return validateArguments(archivePath, bmsScriptPath, outPath, options)
    .then(() => (!!options.wildCards)
      ? createFiltersFile(options.wildCards)
      : undefined)
    .then(() => run(undefined,
      [ quote(bmsScriptPath), quote(archivePath), quote(outPath) ], options))
    .then(() => removeFiltersFile());
}

function list(archivePath: string, bmsScriptPath: string,
              outPath: string, options: IQBMSOptions): Promise<IListEntry[]> {
  return validateArguments(archivePath, bmsScriptPath, outPath, options)
    .then(() => (!!options.wildCards)
      ? createFiltersFile(options.wildCards)
      : Promise.resolve())
    .then(() => run('l',
      [ quote(bmsScriptPath), quote(archivePath), quote(outPath) ], options))
    .then(() => removeFiltersFile())
    .then(() => fs.readFileAsync(LOG_FILE_PATH, { encoding: 'utf-8' }))
    .then(data => {
      const fileEntries: IListEntry[] = parseList(data, options.wildCards);
      return Promise.resolve(fileEntries);
    });
}

function write(archivePath: string, bmsScriptPath: string,
               outPath: string, options: IQBMSOptions): Promise<void> {
  return validateArguments(archivePath, bmsScriptPath, outPath, options)
    .then(() => run('w',
      [ quote(bmsScriptPath), quote(archivePath), quote(outPath) ], options));
}

module.exports = {
  reImport,
  list,
  write,
  extract,
};
