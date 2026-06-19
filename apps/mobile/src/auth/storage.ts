import * as SecureStore from 'expo-secure-store';

const KEY = 'cr_token';

export const saveToken = (t: string) => SecureStore.setItemAsync(KEY, t);
export const getToken = () => SecureStore.getItemAsync(KEY);
export const clearToken = () => SecureStore.deleteItemAsync(KEY);
