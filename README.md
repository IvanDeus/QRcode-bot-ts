# QRcode-bot-ts
Telegram bot: QR code generator

## reqs

- bun 1.3.2
- mysql 8.x
- nginx 

## set up
1. git clone <>
2. cp .env-example .env
3. mysql < QRcodebot_cfg.sql
4. create bot using bot father
5. set up webhook
6. Run: `bun run index.ts &`
7. Add to nginx:  
```
    location /QRcodebot {
        rewrite ^/QRcodebot(.*)$ $1 break;
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout       40s;
        proxy_send_timeout          40s;
        proxy_read_timeout          40s;
    }
```
8. Enjoy!

2025 [ivan deus]
