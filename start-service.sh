case "$OSTYPE" in
  linux-gnu*)
    ##########################################################################
    # Proxmox server
    ##########################################################################
    source /root/.env
    export LOG_LEVEL="$1"
    cd /opt/work-status-server/
    node app.js
    ;;

  msys)
    ##########################################################################
    # Windows, running in Git Bash
    ##########################################################################
    source .env
    export LOG_LEVEL="$1"
    cd dist/src
    node --watch app.js $1
    ;;
esac
