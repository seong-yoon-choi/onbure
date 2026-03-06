/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
function extract(file, regex) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const matches = [...content.matchAll(regex)];
        const keys = Array.from(new Set(matches.map(m => m[1])));
        console.log(`--- ${file} ---`);
        console.log(keys.join('\n'));
    } catch (e) { console.error(e); }
}
extract('app/(main)/workspace/[teamId]/page.tsx', /track(?:Ux|MyTeam)Action\([\s\n]*\"([^\"]+)\"/g);
extract('app/(main)/people/[userId]/page.tsx', /track(?:Ux|People)Action\([\s\n]*\"([^\"]+)\"/g);
