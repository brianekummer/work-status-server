case "$OSTYPE" in
  linux-gnu*)
    ##########################################################################
    # Proxmox server
    ##########################################################################
    source /root/.env
    cd /opt/work-status-server/
    node server.js
    ;;

  msys)
    ##########################################################################
    # Windows, running in Git Bash
    ##########################################################################
    source .env
    export LOG_LEVEL="$1"
    node --watch server.js $1
    ;;
esac
