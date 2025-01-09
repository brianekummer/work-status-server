# Work Status (Server App)
This is the server-side part of my work from home status project that shows my Slack status on an Android phone mounted on a wall outside of my home office, as well as the phone sitting on my office desk that shows some additional information. This Node Express app serves simple web pages to those phones.
My repo [`work-status-android`](https://github.com/brianekummer/work-status-android) contains the very simple Android app that runs on my Android phones.

## App Features
- It examines the status and presence of my work and home Slack accounts and maps those into an appropriate status to display on the phone. For example, if I'm on PTO at work for a few days, but my home Slack account shows me in a non-work meeting, that non-work meeting is what will display on my status phone.
    - This mapping of status/presence is stored in a csv file
- I have two phones- one outside of my office and another on my office desk. The one on my desk also shows
    - The time in 12 hour, 24 hour, and UTC
    - The status of my washer, dryer, ands thermostat, read from my instance of Home Assistant

## Technical Details
- Endpoints
    - The wall phone is accessed by http://...:3000/wall.html
    - The desk phone is accessed by http://...:3000/desk.html
- NPM packages
    - `express`, for coding simple web pages
    - `node-fetch`, for simplifying http commands
    - `csv-parser`, for parsing status-conditions.csv
    - `luxon`, for date formatting, instead of momentJS
    - `node-watch`, for watching if the status conditions file changes, so we can pickup any changes to that file without requiring an app restart
- HTML/CSS decisions
    - I am using old Android phones to display these web pages, and for simplicity, I am not even logging those phones into a Google account
        - This means the WebView component (embedded Chrome browser) doesn't have any updates, and it's the original stock version that shipped with the phone, which means many newer HTML and CSS features are unavailable
            - An example is CSS nesting
            - I could look into using a polyfill or SASS, or log those phones into a Google account so the WebView can be updated, but it's not currently worth it to me
- Required environment variables
    - `SLACK_TOKENS`, must be the Slack security tokens for my work and home accounts. The home account can be omitted. Example: `<work_token>,<home_token>`
    - `HOME_ASSISTANT_BASE_URL`, is the base URL for Home Assistant. Optional.
    - `HOME_ASSISTANT_TOKEN`, is the security token for accessing Home Assistant. Optional.
    - `SERVER_REFRESH_SECONDS`, is the refresh time on the server side, defaults to 30 seconds
    - `CLIENT_REFRESH_SECONDS`, is the refresh time on the client side, defaults to 15 seconds
    - `LOG_LEVEL`, is the logging level- can be `DEBUG`|`INFO`|`ERROR`
- The mappings of status/presence for work and home are stored in the file `status-conditions.csv`, which is read upon startup, and a watcher re-reads whenever it changes. This avoids the need to restart the application for those changes to take effect.
- A worker thread runs in the background every `SERVER_REFRESH_SECONDS` and polls Slack and Home Assistant for status updates, which are stored in a global variable.
- Updates are read from the global variable and pushed from the server to each client using Server Sent Events (SSE) every `CLIENT_REFRESH_SECONDS`

## Running Locally
Use the shell script `start-service.sh`, which optionally takes the desired log level as its only parameter