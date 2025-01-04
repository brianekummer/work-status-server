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
    node --watch server.js $1
    ;;
esac
