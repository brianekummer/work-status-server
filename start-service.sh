case "$OSTYPE" in
  linux-gnu*)
    ##########################################################################
    # Proxmox server
    ##########################################################################
    source /root/.env
    cd /opt/work-status/
    node server.js $SLACK_TOKENS $HOME_ASSISTANT_URL $HOME_ASSISTANT_TOKEN
    ;;

  msys)
    ##########################################################################
    # Windows, running in Git Bash
    ##########################################################################
    source .env
    node --watch server.js $SLACK_TOKENS $HOME_ASSISTANT_URL $HOME_ASSISTANT_TOKEN
    ;;
esac

