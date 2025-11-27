export const appId = 'manager-log-prod';

export const getEnv = (key) => {
  try {
    return import.meta.env[key];
  } catch (e) {
    return "";
  }
};
