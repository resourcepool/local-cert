import { migrate } from '../src/lib/db/migrate';

await migrate();
console.log('done');
process.exit(0);
