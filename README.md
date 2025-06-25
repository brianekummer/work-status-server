# Work Status (Server App)
This is the server-side part of my work-from-home status indicator project that shows my Slack status on an old Android phone mounted on a wall outside of my home office, as well as on a phone sitting on my office desk that shows some additional information. This Node Express app serves simple web pages to those phones.
My repo [`work-status-android`](https://github.com/brianekummer/work-status-android) contains the very simple Android app that runs on my Android phones.

## App Features
- It polls Slack for the status and presence of my work and home Slack accounts and maps those into an appropriate status to display on the phones. For example, if I'm on PTO from work for a few days, but my home Slack account shows me in a non-work meeting, that non-work meeting is what will display on my status phones.
    - This mapping of status/presence is stored in a csv file
    - It has a webhook that Home Assistant calls with updates. This means there is no polling of Home Assistant.
- I have two phones- one outside of my office and another on my office desk
    - The wall phone displays an emoji, a description, and the last updated time
    - The desk phone also shows
        - The time in 12 hour, 24 hour, and UTC
        - The status of my washer, dryer, and thermostat, as well as an icon to denote heating/cooling/fan
- When I am on PTO, if I add an Outlook calendar entry with OOO status, the Outlook app installed on my Slack will change my Slack status to "Out Of Office - Outlook Calendar", and my work status phones display that as the "no entry" emoji for that duration- usually midnight to midnight.
    - Since I don't like that, this code sees that Slack status, and if I'm OOO for at least x hours, it changes my Slack status to "PTO" with the palm tree emoji. The status phones then blank out and my co-workers see a nicer "PTO" status and palm tree emoji.

## Terminology
- Emoji - A Slack status, such as :8bit:
- Emoji image - The file/image that will be displayed for a status condition, such as 8bit_1.png, 8bit_2.png, 8bit_2.gif, ...
- Combined Status - Combination of Slack and Home Assistant status

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
- General strategy
    - The mappings of status/presence for work and home are stored in the file `status-conditions.csv`, which is read upon startup, and a watcher re-reads whenever it changes. This avoids the need to restart the application for those changes to take effect.
    - A worker thread runs in the background every `SERVER_POLLING_SECONDS` and polls Slack for status updates, which is maintained by `StatusController`
    - `StatusController` pushes the up-to-date status to every client using Server Sent Events (SSE) every `SERVER_POLLING_SECONDS`
    - Font AwesomeAdd comment
       - Font Awesome is used to display the icon denoting heating/cooling/fan on the desk page
       - Font Awesome now requires an id because there is a free tier, which I'm using
       - I have an account id that must be included in the HTML's script tag
- Endpoints
    - The favicon is NOT returned by /favicon.ico
    - The desk phone is accessed by /desk
       - Because I need to include my Font Awesome account id in the HTML, and I don't want to hard-code that and check it into GitHub, I must inject that into the HTML, so I'm using Mustache to do that
    - The wall phone is accessed by /wall
    - The wall and desk phones make a call to /api/status-updates to initiate getting status updates streamed to them
    - The webhook that Home Assistant calls is /api/home-assistant-update
    - I set my Slack statuses on my work laptop and home computer using an automation tool that makes HTTP POST calls to Slack's API (such as https://slack.com/api/users.profile.set and https://slack.com/api/users.setPresence). Since this app is polling Slack
    ', (request: Request, response: Response) => statusController.startStreamingStatusUpdates(request, response));
  router.post('/api/updated-slack-status', (request: Request, response: Response) => statusController.updatedSlackStatus(response));
- Why polling Slack instead of subscribing? (as of January 2025)
    - Slack's "Real Time Messaging" (RTM) API can do subscriptions, but it is deprecated, to be discontinued in 2025 or 2026 ([link](https://api.slack.com/legacy/rtm))
    - Slack's newest "Events API" allows subscribing to status, but does NOT support subscribing to presence ([link](https://api.slack.com/apis/presence-and-status#presence-querying-events)) and [it doesn't look like they intend to](https://github.com/slackapi/node-slack-sdk/issues/2129)

- NPM packages
    - `body-parser`, for parsing the body of the webhook data from Home Assistant
    - `csv-parser`, for parsing status-conditions.csv
    - `express`, for coding simple web pages
    - `glob`, for reading the list of files in /public/images folder
    - `luxon`, for date formatting, instead of momentJS
    - `mustache-express`, for templating HTML. I specifically need it to inject my Font Awesome account id into the desk phone's HTML.
    - `node-watch`, for watching if the status conditions file changes, so we can pickup any changes to that file without requiring an app restart
    - `typescript`, duh, for TypeScript
    - `winston`, for logging
    - `winston-daily-rotate-file`, for easily implementing rotating log files
- HTML/CSS decisions
    - I am using old Android phones to display these web pages, and for simplicity, I am not even logging those phones into a Google account
        - This means the WebView component (embedded Chrome browser) doesn't have any updates, and it's the original stock version that shipped with the phone, which means many newer HTML and CSS features are unavailable
            - An example is CSS nesting
            - I could look into using a polyfill or SASS, or log those phones into a Google account so the WebView can be updated, but it's not currently worth it to me
- Required environment variables
    - `SLACK_TOKEN_WORK`, is the Slack security token for my work account
    - `SLACK_TOKEN_HOME`, is the Slack security token for my home account, optional
    - `SERVER_POLLING_SECONDS`, is the refresh time on the server side, defaults to 30 seconds
    - `LOG_LEVEL`, is the logging level- code uses `ERROR`|`INFO`|`DEBUG`

## Technical Oddities/Issues
These are things that are a little odd, but I'll live with them because fixing them is too much work, or causes other oddities I'd rather not live with.
- Because I am no longer polling Home Assistant, when this application starts, there is no Home Assistant data until it sends the next update. This could be a minute, or maybe 45 minutes, depending on what's happening. In this case, the desk phone will show the waster/dryer/thermometer icons but no text until the next time Home Assistant pushes an updated status.
- For changing OOO to PTO status, when this code sees that I'm OOO for x hours, it changes my Slack status to PTO. This happens as soon as this code sees that my Slack status has changed to "Out Of Office - Outlook Calendar".
    - In Outlook, if you delete that calendar entry during your PTO (maybe I take a half day instead of a full day), the Outlook app in Slack doesn't clear your status.
    - This is a little odd, but is such a minor issue that it's not worth coding for.

## Building
Use `npm run build` and `npm run lint`

## Running Locally
Use the shell script `start-service.sh`, which optionally takes the desired log level (`INFO`|`DEBUG`|`ERROR`) as its only parameter

## Useful Tools
- https://ezgif.com/split takes an animated gif and splits it into individual frames. I use this to create an un-animated image to display on my desk phone, since I don't want animation there.