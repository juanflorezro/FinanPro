import { api } from './client.js';
import { makeUseApi } from './makeUseApi.js';

export const useApi = makeUseApi(api);
