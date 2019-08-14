import * as Promise from 'bluebird';

export type ReImportType = 'reimportv1' | 'reimportv2';
export type QBMSOperationType = 'extract' | 'reimport' | 'write' | 'list';

export type QBMSFunc = (bmsScriptPath: string,
                        archivePath: string,
                        inPath: string,
                        options: IQBMSOptions) => Promise<void>;

export interface IQBMSOptions {
  // qbms will overwrite any existing files during extraction.
  overwrite?: boolean;

  // qbms verbose mode
  verbose?: boolean;

  // do we want qbms to log all of its operations
  createLog?: boolean;

  // qbms is case _in_sensitive by default
  caseSensitive?: boolean;

  // minimal information output during qbms operations (some output may still be generated)
  quiet?: boolean;

  // file wildcards: both {} and * are valid, although {} is less error prone.
  wildCards?: string[];

  // The reimport process attempts to replace files within a game's archive.
  //  qbms offers two reimport types, "reimport" and "reimport2";
  //  - When using the default "reimport" type it's important to ensure that
  //    the files you're using as replacements are not larger than the original files!!
  //  - Use "reimport2" if the replacement files are larger than the original files but be
  //    wary that this may be _one_ time reimport as it may throw off any existing
  //    BMS scripts because size/offset would have changed.
  reimport?: ReImportType;
}

export interface IListEntry {
  offset: string;
  size: string;
  filePath: string;
}
