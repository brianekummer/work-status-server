namespace NodeJS {
  interface ProcessEnv {
    FONT_AWESOME_ACCOUNT_ID: string
    SLACK_TOKEN_WORK: string
    SLACK_TOKEN_HOME?: string
    SERVER_POLLING_SECONDS?: number
    LOG_LEVEL?: string
  };
}