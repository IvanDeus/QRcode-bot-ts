// index.ts
import { Bot, Context, InlineKeyboard, webhookCallback, InputFile } from "grammy";
import mysql from "mysql2/promise";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
// --- Configuration ---
const SCRIPT_DIR = import.meta.dir;
const STATIC_DIR = path.join(SCRIPT_DIR, "static");
const FONT_PATH = path.join(STATIC_DIR, "DejaVuSans.ttf");
// --- Database Connection Pool ---
// Uses a pool to keep connections alive
const pool = mysql.createPool({
    host: Bun.env.DB_HOST,
    user: Bun.env.DB_USER,
    password: Bun.env.DB_PASS,
    database: Bun.env.DB_NAME,
    socketPath: Bun.env.DB_SOCKET_PATH,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
// --- Types & Interfaces ---
interface TelebotVars {
    [key: string]: string;
}
interface UserState {
    level: number;
    lastmsg: string;
    u_url: string;
}

// --- Database Helpers ---
async function getTelebotVars(): Promise<TelebotVars> {
    try {
        const [rows] = await pool.execute<any[]>("SELECT param, value FROM telebot_vars");
        const vars: TelebotVars = {};
        rows.forEach((row: { param: string; value: string }) => {
            vars[row.param] = row.value;
        });
        return vars;
    } catch (error) {
        console.error("DB Error fetching vars:", error);
        return {};
    }
}

async function addOrUpdateUser(chatId: number, username: string, message: string, firstName: string, lastName: string) {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute<any[]>("SELECT * FROM telebot_users WHERE chat_id = ?", [chatId]);
        
        if (rows.length > 0) {
            await connection.execute("UPDATE telebot_users SET lastmsg = ? WHERE chat_id = ?", [message, chatId]);
        } else {
            await connection.execute(
                "INSERT INTO telebot_users (chat_id, name, lastmsg, first_name, last_name, Sub) VALUES (?, ?, ?, ?, ?, 1)",
                [chatId, username, message, firstName, lastName]
            );
        }
    } catch (err) {
        console.error("DB Error update user:", err);
    } finally {
        connection.release();
    }
}

async function getUserState(chatId: number): Promise<UserState | null> {
    const [rows] = await pool.execute<any[]>(
        "SELECT level, lastmsg, u_url FROM telebot_users WHERE chat_id = ? LIMIT 1", 
        [chatId]
    );
    return rows.length > 0 ? (rows[0] as UserState) : null;
}

async function setUserLevel(chatId: number, level: number) {
    await pool.execute("UPDATE telebot_users SET level = ? WHERE chat_id = ?", [level, chatId]);
}

async function setUserUrl(chatId: number, url: string) {
    await pool.execute("UPDATE telebot_users SET u_url = ? WHERE chat_id = ?", [url, chatId]);
}

// --- PDF & QR Generation ---
async function generateQrPdf(url: string, caption: string, chatId: number): Promise<string> {
    const fileName = `qrcode1${chatId}`;
    const pdfPath = path.join(STATIC_DIR, `${fileName}.pdf`);
    // 1. Generate QR Code as Buffer (No need to save PNG to disk first)
    const qrBuffer = await QRCode.toBuffer(url, {
        errorCorrectionLevel: 'L',
        margin: 4,
        scale: 10,
        color: { dark: '#000000', light: '#FFFFFF' }
    });
    // 2. Create PDF
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        const stream = fs.createWriteStream(pdfPath);

        doc.pipe(stream);
        // Register Font
        if (fs.existsSync(FONT_PATH)) {
            doc.registerFont('DejaVuSans', FONT_PATH);
            doc.font('DejaVuSans');
        } else {
            console.warn("Font file not found, using standard font.");
            doc.font('Helvetica');
        }

        const width = 595.28; // A4 Width in points
        const height = 841.89; // A4 Height in points
        // Top Caption
        const fontSize = 36;
        doc.fontSize(fontSize).fillColor('#800080'); // Purple
        const textWidth = doc.widthOfString(caption);
        // height - 1.6 inches (approx 115 points from top)
        // Note: ReportLab coordinates start bottom-left, PDFKit starts top-left.
        // In PDFKit top-left logic, that's roughly 115pt from top.
        doc.text(caption, (width - textWidth) / 2, 115);
        // QR Code Image
        const qrSize = 6 * 72; // 6 inches
        doc.image(qrBuffer, (width - qrSize) / 2, 200, { width: qrSize, height: qrSize });
        // Footer Caption
        const footerText = "Telegram: @qrcode_a4_Bot";
        doc.fontSize(12).fillColor('black');
        const footerWidth = doc.widthOfString(footerText);
        doc.text(footerText, (width - footerWidth) / 2, height - 100);

        doc.end();

        stream.on('finish', () => resolve(pdfPath));
        stream.on('error', reject);
    });
}

// --- Helper: Parse CSV string to Inline Keyboard ---
function createKeyboard(configStr: string): InlineKeyboard {
    const parts = configStr.split(', ').map(s => s.trim());
    const keyboard = new InlineKeyboard();
    
    for (let i = 0; i < parts.length; i += 2) {
        if (parts[i + 1]) {
            keyboard.text(parts[i], parts[i + 1]);
        }
    }
    return keyboard;
}

// --- BOT LOGIC ---
const bot = new Bot(Bun.env.BOT_TOKEN!);
// Middleware: Log user and fetch DB vars
bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.id && ctx.message?.text) {
        const username = ctx.chat.username || ' ';
        const first = ctx.chat.first_name || ' ';
        const last = ctx.chat.last_name || ' ';
        await addOrUpdateUser(ctx.chat.id, username, ctx.message.text, first, last);
    }
    await next();
});
// Start Command
bot.command("start", async (ctx) => {
    const vars = await getTelebotVars();
    const keyboard = createKeyboard(`${vars['qr']}, /qr, ${vars['help']}, /help`);
    await ctx.reply(vars['welcome_message'] || "Welcome!", { 
        reply_markup: keyboard, 
        parse_mode: "HTML" 
    });
});

// Callback Queries
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.callbackQuery.message?.chat.id;
    if (!chatId) return;

    const vars = await getTelebotVars();
    const keyboard = createKeyboard(`${vars['qr']}, /qr, ${vars['help']}, /help`);

    if (data === "/qr") {
        await ctx.reply(vars['url_text'] || "Send me the URL", { parse_mode: "HTML" });
        await setUserLevel(chatId, 1);
    } else if (data === "/help") {
        await ctx.reply(vars['help_text'] || "Help text...", { 
            reply_markup: keyboard, 
            parse_mode: "HTML" 
        });
    }
    await ctx.answerCallbackQuery();
});

// Text Message Handler (State Machine)
bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;
    const vars = await getTelebotVars();
    const userState = await getUserState(chatId);

    if (!userState) return; // Should not happen due to middleware
    // Level 1: User sends URL
    if (userState.level === 1 && text.startsWith("http")) {
        await ctx.reply(vars['titul_text'] || "Enter caption:", { parse_mode: "HTML" });
        await setUserLevel(chatId, 2);
        await setUserUrl(chatId, text);
    } 
    // Level 2: User sends Caption -> Generate
    else if (userState.level === 2) {
        await ctx.reply(vars['gen_text'] || "Generating...", { parse_mode: "HTML" });
        
        try {
            const pdfPath = await generateQrPdf(userState.u_url, text, chatId); // caption
            await ctx.replyWithDocument(new InputFile(pdfPath));           
            const keyboard = createKeyboard(`${vars['qr']}, /qr, ${vars['help']}, /help`);
            await ctx.reply(vars['gen_text_done'] || "Done!", { 
                reply_markup: keyboard, 
                parse_mode: "HTML" 
            });
            // Cleanup
            fs.unlinkSync(pdfPath);
            await setUserLevel(chatId, 0);

        } catch (e) {
            console.error(e);
            await ctx.reply("Error generating PDF.");
        }
    } 
    // Fallback for unknown input (excluding commands)
    else if (!text.startsWith("/")) {
        const keyboard = createKeyboard(`${vars['qr']}, /qr, ${vars['help']}, /help`);
        await ctx.reply(vars['welcome_nostart'] || "Click a button", { 
            reply_markup: keyboard, 
            parse_mode: "HTML" 
        });
    }
});

// --- Server (Bun Native) ---
console.log(`Bot running on port ${Bun.env.PORT}`);
Bun.serve({
    port: Bun.env.PORT,
    fetch: webhookCallback(bot, "std/http"),
});
