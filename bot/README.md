# MA3 Studio Telegram Bot

This is the backend controller for the MA3 Studio scheduling and club management system.

## Setup Instructions

1. Make sure you have [Node.js](https://nodejs.org/) installed on your machine or server.
2. Open your terminal and navigate to this `bot` folder:
   ```bash
   cd path/to/MA3/bot
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
```

**⚠️ IMPORTANT:** For `SUPABASE_SERVICE_ROLE_KEY`, you must use the `service_role` secret key, NOT the public `anon` key. This allows the bot to bypass Row Level Security and approve users. Never expose this key on the frontend!
If a real `BOT_TOKEN` was ever committed or shared, rotate it in BotFather before deploying.

## Running the Bot

To start the bot locally:
```bash
npm start
```

## Deployment

To keep the bot running 24/7, you should deploy it to a service like **Render**, **Railway**, or **Heroku**. 
Just link your GitHub repository to one of those services, set the Build Command to `npm install`, the Start Command to `npm start`, and add your Environment Variables in their dashboard.
