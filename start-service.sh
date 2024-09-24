case "$OSTYPE" in
  linux-gnu*)
    ##########################################################################
    # Proxmox server
    ##########################################################################
    source /root/.env
    cd /opt/work-status/
    ;;

  msys)
    ##########################################################################
    # Windows, running in Git Bash
    ##########################################################################
    source .env
    ;;
esac

node server.js $SLACK_TOKENS $HOME_ASSISTANT_URL $HOME_ASSISTANT_TOKEN
