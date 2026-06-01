import { describe, expect, it, afterEach } from 'vitest';
import {
  MRV_DEFAULT_DRIVE_FOLDER_ID,
  resolveDriveFolderId,
} from '../../server/googleDrive.mjs';

describe('google drive folder', () => {
  const prev = process.env.GOOGLE_DRIVE_FOLDER_ID;

  afterEach(() => {
    if (prev === undefined) delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    else process.env.GOOGLE_DRIVE_FOLDER_ID = prev;
  });

  it('usa la carpeta MRV por defecto', () => {
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    expect(resolveDriveFolderId()).toBe('1TVTxNvx2jNrDK1b0dAGmSeFpsJONWqP7');
    expect(MRV_DEFAULT_DRIVE_FOLDER_ID).toBe('1TVTxNvx2jNrDK1b0dAGmSeFpsJONWqP7');
  });

  it('respeta GOOGLE_DRIVE_FOLDER_ID si está definido', () => {
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'otra-carpeta-id';
    expect(resolveDriveFolderId()).toBe('otra-carpeta-id');
  });
});
