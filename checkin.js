const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'checkin.log');

// Function to log messages
target}
function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logEntry);
    console.log(logEntry.trim());
}

// Function to read tokens from file
function readTokens() {
    try {
        const content = fs.readFileSync('tokens.txt', 'utf8');
        const tokens = content.split('\n').filter(token => token.trim() !== '');
        if (tokens.length === 0) throw new Error('No tokens found in tokens.txt');
        return tokens;
    } catch (error) {
        logMessage(`Error reading tokens file: ${error.message}`);
        process.exit(1);
    }
}

// Function to perform check-in with retry mechanism
async function performCheckIn(token, accountIndex) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.post(
                'https://api.earnos.com/trpc/streak.checkIn?batch=1',
                { "0": { "json": null, "meta": { "values": ["undefined"] } } },
                {
                    headers: {
                        'authorization': `Bearer ${token.trim()}`,
                        'content-type': 'application/json',
                        'user-agent': 'Mozilla/5.0'
                    }
                }
            );

            if (response.data[0]?.result?.data?.json?.success) {
                logMessage(`Account ${accountIndex + 1}: Check-in successful!`);
                return true;
            } else {
                logMessage(`Account ${accountIndex + 1}: Check-in failed (Attempt ${attempt})`);
            }
        } catch (error) {
            logMessage(`Account ${accountIndex + 1}: Error (Attempt ${attempt}): ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // Delay between retries
    }
    return false;
}

// Function to perform check-in for all accounts
async function performAllCheckIns(tokens) {
    let successCount = 0;
    for (let i = 0; i < tokens.length; i++) {
        logMessage(`Processing Account ${i + 1}...`);
        const success = await performCheckIn(tokens[i], i);
        if (success) successCount++;
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    logMessage(`Check-in Summary: ${successCount}/${tokens.length} accounts successful`);
}

// Main function
async function main() {
    const tokens = readTokens();
    logMessage(`Loaded ${tokens.length} accounts`);
    
    cron.schedule('1 0 * * *', async () => {
        logMessage('Starting scheduled check-ins...');
        await performAllCheckIns(tokens);
    });
    
    logMessage('Performing initial check-ins...');
    await performAllCheckIns(tokens);
}

// Start the bot
main().catch(error => logMessage(`Fatal Error: ${error.message}`));

// Handle process termination
process.on('SIGINT', () => {
    logMessage('Bot shutting down...');
    process.exit(0);
});
