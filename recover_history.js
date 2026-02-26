const fs = require('fs');
const path = require('path');

const historyDir = path.join(process.env.APPDATA, 'Code', 'User', 'History');
const recoveryDir = path.join(process.env.USERPROFILE, 'Desktop', 'onbure_recovery');

if (!fs.existsSync(recoveryDir)) {
    fs.mkdirSync(recoveryDir, { recursive: true });
}

// Cutoff timestamp: 2026-02-25 16:51:10 +09:00
// Since git restore happened precisely around this time, any history entry before this is pre-destruction.
const cutoff = new Date('2026-02-25T16:51:10+09:00').getTime();

const folders = fs.readdirSync(historyDir);

for (const folder of folders) {
    const entryPath = path.join(historyDir, folder, 'entries.json');
    if (!fs.existsSync(entryPath)) continue;

    try {
        const data = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
        const resource = data.resource;

        if (resource && resource.toLowerCase().includes('desktop/onbure')) {
            const entries = data.entries || [];

            let bestEntry = null;
            for (const entry of entries) {
                if (entry.timestamp < cutoff) {
                    if (!bestEntry || entry.timestamp > bestEntry.timestamp) {
                        bestEntry = entry;
                    }
                }
            }

            // We want to avoid restoring things that haven't changed or that might be old, but we just take the latest pre-crash version.
            // If the user hasn't edited the file in VS Code at all, it won't be in History, which is fine, because git restore would have restored the committed version which is perfectly correct.
            if (bestEntry && bestEntry.id) {
                let cleanedPath = decodeURIComponent(resource.replace('file:///', ''));
                const testIdx = cleanedPath.toLowerCase().indexOf('desktop/onbure');
                let relPath = cleanedPath.substring(testIdx + 'desktop/onbure'.length + 1);
                // remove Windows paths specific chars
                relPath = relPath.replace(/\\/g, '/');

                const sourceFile = path.join(historyDir, folder, bestEntry.id);
                if (fs.existsSync(sourceFile)) {
                    const destFile = path.join(recoveryDir, relPath);
                    fs.mkdirSync(path.dirname(destFile), { recursive: true });
                    fs.copyFileSync(sourceFile, destFile);
                    console.log(`Recovered: ${relPath} (Date: ${new Date(bestEntry.timestamp).toLocaleString()})`);
                }
            }
        }
    } catch (e) {
        // ignore parse errors
    }
}
