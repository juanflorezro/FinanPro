import { appApi } from './appClient.js';
import { makeUseApi } from './makeUseApi.js';

export const useAppApi = makeUseApi(appApi);
