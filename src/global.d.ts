namespace NodeJS {
  interface ProcessEnv {
    SLACK_TOKEN_WORK: string
    SLACK_TOKEN_HOME?: string
    SERVER_POLLING_SECONDS?: number
    OUT_OF_OFFICE_STATUS_REGEX?: string
    OUT_OF_OFFICE_MIN_HOURS?: number
    LOG_LEVEL?: string
  };
}