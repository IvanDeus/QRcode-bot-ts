// setup_webhook.ts
interface WebhookConfig {
  url: string;
  max_connections?: number;
  drop_pending_updates?: boolean;
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: boolean;
  [key: string]: any;
}

interface WebhookInfo {
  ok: boolean;
  result?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    max_connections?: number;
    ip_address?: string;
    last_error_date?: number;
    last_error_message?: string;
  };
  description?: string;
}

/**
 * Get current webhook info
 */
async function getWebhookInfo(token: string): Promise<WebhookInfo> {
  const telegramApiUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
  
  try {
    const response = await fetch(telegramApiUrl);
    return await response.json();
  } catch (error) {
    console.error('Error getting webhook info:', error);
    return { ok: false, description: 'Network error' };
  }
}

/**
 * Set Telegram webhook
 */
async function setTelegramWebhook(
  token: string,
  url: string,
  maxConnections: number = 18,
  dropPendingUpdates: boolean = true
): Promise<TelegramResponse> {
  const telegramApiUrl = `https://api.telegram.org/bot${token}/setWebhook`;
  const payload: WebhookConfig = {
    url,
    max_connections: maxConnections,
    drop_pending_updates: dropPendingUpdates
  };
  
  const formData = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value.toString());
  });
  
  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });
    return await response.json();
  } catch (error) {
    console.error('Error setting webhook:', error);
    return { ok: false, description: 'Network error' };
  }
}

/**
 * Display current webhook info
 */
async function showWebhookInfo() {
  const TELEGRAM_BOT_TOKEN = Bun.env.BOT_TOKEN;
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env file');
    process.exit(1);
  }
  
  console.log('\n🔍 Fetching current webhook info...\n');
  const info = await getWebhookInfo(TELEGRAM_BOT_TOKEN);
  
  if (info.ok && info.result) {
    console.log('📊 Current Webhook Status:');
    console.log('─────────────────────────────');
    console.log(`URL: ${info.result.url || 'Not set'}`);
    console.log(`Pending updates: ${info.result.pending_update_count}`);
    console.log(`Max connections: ${info.result.max_connections || 'Default'}`);
    console.log(`Custom certificate: ${info.result.has_custom_certificate ? 'Yes' : 'No'}`);
    if (info.result.ip_address) {
      console.log(`IP Address: ${info.result.ip_address}`);
    }
    if (info.result.last_error_date) {
      const errorDate = new Date(info.result.last_error_date * 1000);
      console.log(`Last error: ${errorDate.toLocaleString()}`);
      console.log(`Error message: ${info.result.last_error_message}`);
    }
    console.log('─────────────────────────────');
  } else {
    console.log('❌ Failed to get webhook info:', info.description || 'Unknown error');
  }
}

/**
 * Set webhook
 */
async function setWebhook() {
  const TELEGRAM_BOT_TOKEN = Bun.env.BOT_TOKEN;
  const WEBHOOK_URL = Bun.env.WEBHOOK_URL;
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env file');
    process.exit(1);
  }
  
  let finalWebhookUrl: string;
  
  if (!WEBHOOK_URL) {
    console.log('📝 WEBHOOK_URL is not set in .env file');
    const publicDomain = prompt('Enter your public domain (e.g., https://yourdomain.com): ')?.trim();
    
    if (!publicDomain) {
      console.error('❌ No domain provided');
      process.exit(1);
    }
    finalWebhookUrl = `${publicDomain}`;
  } else {
    finalWebhookUrl = `${WEBHOOK_URL}`;
  }
  
  console.log(`\n⚙️  Setting webhook to: ${finalWebhookUrl}`);
  const result = await setTelegramWebhook(
    TELEGRAM_BOT_TOKEN,
    finalWebhookUrl,
    18,
    true
  );
  
  if (result.ok) {
    console.log('\n✅ Webhook set successfully!');
    console.log('Telegram response:', JSON.stringify(result, null, 2));
    
    // Show updated webhook info
    console.log('\n📊 Updated webhook status:');
    const info = await getWebhookInfo(TELEGRAM_BOT_TOKEN);
    if (info.ok && info.result) {
      console.log(`URL: ${info.result.url}`);
      console.log(`Pending updates: ${info.result.pending_update_count}`);
    }
  } else {
    console.log('\n❌ Failed to set webhook.');
    console.log('Error:', result.description || 'Unknown error');
  }
}

/**
 * Show usage
 */
function showUsage() {
  console.log(`
📋 Usage:
  bun run setup_webhook.ts         Show current webhook info
  bun run setup_webhook.ts -s      Set webhook
  bun run setup_webhook.ts --set   Set webhook
  bun run setup_webhook.ts -h      Show this help
  `);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  if (args.includes('-h') || args.includes('--help')) {
    showUsage();
    return;
  }
  
  if (args.includes('-s') || args.includes('--set')) {
    await setWebhook();
  } else if (args.length === 0) {
    await showWebhookInfo();
  } else {
    console.error('❌ Invalid arguments');
    showUsage();
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.main) {
  main().catch(console.error);
}
