# Lumeya Telegram Bot

This bot currently provides Lumeya's public request notification path while legacy scheduling and club workflows remain dormant on the public website.

## Setup Instructions

1. Make sure you have [Node.js](https://nodejs.org/) installed on your machine or server.
2. Open your terminal and navigate to this `bot` folder:
   ```bash
   cd path/to/Santiago/bot
   ```
3. Install the required dependencies:
   ```bash
   npm install
   ```

## Configuration

Create a file named `.env` in this `bot` directory and add the following keys:

```env
# From @BotFather in Telegram
BOT_TOKEN=replace_with_your_botfather_token

# From your Supabase Project Settings -> API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# The Telegram Chat ID where you want application notifications sent. 
# You can use your own personal Telegram ID for testing.
ADMIN_CHAT_ID=your_telegram_id_here

# Public URL for website login links sent by the bot.
PUBLIC_SITE_URL=https://your-public-site.example

# Optional worker interval; defaults to NOTIFICATION_POLL_MS or 60000
PUBLIC_REQUEST_POLL_MS=60000

# Required only for the disposable live public-MVP database test
SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

**⚠️ IMPORTANT:** For `SUPABASE_SERVICE_ROLE_KEY`, you must use the `service_role` secret key, NOT the public `anon` key. This allows the bot to bypass Row Level Security and approve users. Never expose this key on the frontend!
If a real `BOT_TOKEN` was ever committed or shared, rotate it in BotFather before deploying.

## Running the Bot

To start the bot locally:
```bash
npm start
```

The bot fails closed when any required production variable is missing. The
`public_request` deep-link flow intentionally skips platform profile creation,
stores the request when possible, and directly notifies `ADMIN_CHAT_ID` even if
database persistence fails.

After migration 0016 is applied to the confirmed dedicated Lumeya project, run:

```sh
npm run test:public-mvp
```

The test creates and removes one disposable request while checking the browser
RLS/RPC boundary. Do not run it against another project.

## Deployment

To keep the bot running 24/7, you should deploy it to a service like **Render**, **Railway**, or **Heroku**. 
Just link your GitHub repository to one of those services, set the Build Command to `npm install`, the Start Command to `npm start`, and add your Environment Variables in their dashboard.
