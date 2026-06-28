export type Env = {
  ASSETS: Fetcher;
  B2_KEY_ID: string;
  B2_APPLICATION_KEY: string;
  B2_BUCKET_NAME: string;
  B2_ENDPOINT: string;
  B2_REGION: string;
  SHARE_TOKEN_SECRET: string;
  ACCESS_AUD: string;
  ACCESS_ISSUER: string;
  DEV_AUTH_BYPASS?: string;
};

export type RequestContext = {
  request: Request;
  env: Env;
  url: URL;
};
