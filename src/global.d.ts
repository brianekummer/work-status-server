namespace NodeJS {
  interface ProcessEnv {
    FONT_AWESOME_ACCOUNT_ID: string
    SLACK_TOKEN_WORK: string
    SLACK_TOKEN_HOME?: string
    SERVER_POLLING_SECONDS?: number
    OUT_OF_OFFICE_STATUS_REGEX?: string
    OUT_OF_OFFICE_MIN_HOURS?: number
    TURN_MONITOR_ON_URL?: string
    HOME_ASSISTANT_BASE_URL?: string
    HOME_ASSISTANT_TOKEN?: string
    LOG_LEVEL?: string
  };
}