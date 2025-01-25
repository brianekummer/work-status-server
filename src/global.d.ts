namespace NodeJS {
    interface ProcessEnv {
      FONT_AWESOME_ACCOUNT_ID: string
      SLACK_TOKEN_WORK: string
      SLACK_TOKEN_HOME?: string
      HOME_ASSISTANT_BASE_URL?: string
      HOME_ASSISTANT_TOKEN?: string
      SERVER_REFRESH_SECONDS?: number
      CLIENT_REFRESH_SECONDS?: number
      LOG_LEVEL?: string
    }
  }