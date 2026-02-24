# QRcode-bot-ts 🤖

A Telegram bot built with TypeScript that generates QR codes on demand. Fast, reliable, and easy to use!

## 🚀 Features

- Generate QR codes instantly via Telegram
- Built with TypeScript for type safety
- Powered by Bun for exceptional performance
- MySQL database for user tracking and analytics
- Production-ready with Nginx reverse proxy

## 📋 Prerequisites

- [Bun](https://bun.sh/) v1.3.2 or higher
- MySQL 8.x
- Nginx
- A Telegram Bot Token (get it from [@BotFather](https://t.me/botfather))

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd QRcode-bot-ts
   ```

2. **Set up environment variables**
   ```bash
   cp .env-example .env
   # Edit .env with your configuration
   ```

3. **Configure the database**
   ```bash
   mysql databasename < QRcodebot_cfg.sql
   ```

4. **Install dependencies**
   ```bash
   bun install
   ```

## ⚙️ Configuration

### Bot Configuration
1. Create a new bot via [@BotFather](https://t.me/botfather)
2. Copy the bot token to your `.env` file
3. Set up the webhook URL (more details below)

### Webhook Setup
Configure your bot to use a webhook endpoint:
```bash
# Example webhook URL format
https://your-domain.com/QRcodebot/webhook
```

## 🚀 Running the Bot

### Development Mode
```bash
bun run index.ts
```

### Background Mode 
```bash
bun run index.ts &
```

### Nginx Configuration
Add this to your Nginx configuration to proxy requests to the bot:

```nginx
location /QRcodebot {
    rewrite ^/QRcodebot(.*)$ $1 break;
    proxy_pass http://localhost:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 40s;
    proxy_send_timeout 40s;
    proxy_read_timeout 40s;
}
```

## 🎮 Usage

Once the bot is running, interact with it on Telegram:
1. Start a chat with your bot
2. Follow instructions to generate a QR code
3. The bot will reply with a QR code image

## 🐛 Troubleshooting

- **Bot not responding?** Check if the webhook is properly set up
- **Database errors?** Verify MySQL is running and credentials are correct
- **Nginx 502 errors?** Ensure the bot process is running on local port

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⭐ Support

If you find this project useful, please consider giving it a star on GitHub!

---

2025 [ ivan deus ]
