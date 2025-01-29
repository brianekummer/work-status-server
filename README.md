# Work Status (Server App)
This is the server-side part of my work from home status project that shows my Slack status on an Android phone mounted on a wall outside of my home office, as well as the phone sitting on my office desk that shows some additional information. This Node Express app serves simple web pages to those phones.
My repo [`work-status-android`](https://github.com/brianekummer/work-status-android) contains the very simple Android app that runs on my Android phones.

## App Features
- It examines the status and presence of my work and home Slack accounts and maps those into an appropriate status to display on the phone. For example, if I'm on PTO at work for a few days, but my home Slack account shows me in a non-work meeting, that non-work meeting is what will display on my status phone.
    - This mapping of status/presence is stored in a csv file
- I have two phones- one outside of my office and another on my office desk. The one on my desk also shows
    - The time in 12 hour, 24 hour, and UTC
    - The status of my washer, dryer, ands thermostat, read from my instance of Home Assistant, including an icon to denote heating/cooling/fan

## Getting Your Slack Security Token(s)
(These steps are from memory and should be close to correct, but may be missing things)
You need to define an app in Slack to get a security token which you can use to make calls to the Slack API via HTTP GET and POST. Slack has lots of good API documentation, and a "Tester" with each API command that lets you test the command and get real values back.
  - The "User OAuth Token" you'll get will start with `xoxp-`
  - You'll need to log into your work Slack and do this for your work account
  - If you're also using a home account, you'll also need to login to that and repeat these steps
  - I have been using Slack's "Web API" and not their newer "Events API", because the Events API doesn't provide for subscribing to user presence
- First sign up for the Slack developer program at https://api.slack.com/docs/developer-sandbox
- Go to https://api.slack.com/apps to define your app
- On the left toolbar, under Features, is the "OAuth & Permissions" section
    - Scroll down to the "User Token Scopes" section and add you need `users.profile:read` (to get your status) and `users:read` (to get your presence)
    - At some point you'll get your "OAuth Tokens" at the top of the page - that's your security token
    - Click the "Install to xxxxx" button to install it into the Slack workspace and make it active

## Technical Details
- Font Awesome
    - Font Awesome is used to display the icon denoting heating/cooling/fan on the desk page
    - Font Awesome now requires an id because there is a free tier, which I'm using
    - I have an account id that must be included in the HTML's script tag
- Endpoints
    - The wall phone is accessed by http://...:3000/wall
    - The desk phone is accessed by http://...:3000/desk
        - Because I need to include my Font Awesome account id in the HTML, and I don't want to hard-code that and check it into GitHub, I must inject that into the HTML, so I'm using Mustache to do that
- NPM packages
    - `csv-parser`, for parsing status-conditions.csv
    - `express`, for coding simple web pages
    - `luxon`, for date formatting, instead of momentJS
    - `mustache-express`, for templating HTML. I specifically need it to inject my Font Awesome account id into the desk phone's HTML.
    - `node-fetch`, for simplifying http commands
    - `node-watch`, for watching if the status conditions file changes, so we can pickup any changes to that file without requiring an app restart
    - `winston`, for logging
    - `winston-daily-rotate-file`, for easily implementing rotating log files
- HTML/CSS decisions
    - I am using old Android phones to display these web pages, and for simplicity, I am not even logging those phones into a Google account
        - This means the WebView component (embedded Chrome browser) doesn't have any updates, and it's the original stock version that shipped with the phone, which means many newer HTML and CSS features are unavailable
            - An example is CSS nesting
            - I could look into using a polyfill or SASS, or log those phones into a Google account so the WebView can be updated, but it's not currently worth it to me
- Required environment variables
    - `FONT_AWESOME_ACCOUNT_ID`, is my account id for Font Awesome, which is part of the URL for the script to include in my HTML
    - `SLACK_TOKEN_WORK`, is the Slack security token for my work account
    - `SLACK_TOKEN_HOME`, is the Slack security token for my home account, optional
    - `SERVER_POLLING_SECONDS`, is the refresh time on the server side, defaults to 30 seconds
    - `CLIENT_REFRESH_SECONDS`, is the refresh time on the client side, defaults to 15 seconds
    - `LOG_LEVEL`, is the logging level- can be `DEBUG`|`INFO`|`ERROR`
- The mappings of status/presence for work and home are stored in the file `status-conditions.csv`, which is read upon startup, and a watcher re-reads whenever it changes. This avoids the need to restart the application for those changes to take effect.
- A worker thread runs in the background every `SERVER_POLLING_SECONDS` and polls Slack and Home Assistant for status updates, which are stored in a global variable.
- Updates are read from the global variable and pushed from the server to each client using Server Sent Events (SSE) every `CLIENT_REFRESH_SECONDS`

## Running Locally
Use the shell script `start-service.sh`, which optionally takes the desired log level as its only parameter

## Useful Tools
- https://ezgif.com/split takes an animated gif and splits it into individual frames. I use this to create an un-animated image to display on my desk phone, since I don't want animation there.